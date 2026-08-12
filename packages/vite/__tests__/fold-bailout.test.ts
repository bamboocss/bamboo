import { describe, expect, test } from 'vitest'
import { createFoldFixture } from './fixture'

/**
 * Bailout guards, ported from the constructs Panda v2 covers in
 * `crates/pandacss_project/tests/transform/{advanced,css_mixed,edges,recipe_inline}.rs`.
 *
 * The compiler is deliberately all-or-nothing for `css()`: an open runtime value has no
 * finite rule set to emit, so the whole call is rejected. No runtime leaf fallback exists.
 *
 * A wrong fold is silent. It does not throw, it does not fail a build, it ships a
 * component with missing styles. That asymmetry is why the declining cases get more
 * coverage here than the folding ones.
 */

const expectUnchanged = (code: string) => {
  const { fold } = createFoldFixture()
  const result = fold(code)

  expect(result.folded).toHaveLength(0)
  expect(result.code).toBe(code)
  return result
}

const expectFolded = (code: string) => {
  const { fold } = createFoldFixture()
  const result = fold(code)

  expect(result.folded).toHaveLength(1)
  return result
}

const withImport = (body: string) => `import { css } from 'styled-system/css'\n${body}\n`

describe('partially dynamic objects', () => {
  // The extractor omits what it cannot evaluate rather than flagging it, so a
  // partially dynamic object looks fully static from the box alone. Each nesting
  // depth is a separate opportunity to lose that check.
  test('a dynamic value at the top level rejects the whole call', () => {
    expectUnchanged(withImport(`export const f = (t) => css({ padding: '2', color: t })`))
  })

  test('a dynamic value inside a condition bails', () => {
    expectUnchanged(withImport(`export const f = (t) => css({ _hover: { color: t } })`))
  })

  test('a dynamic value two conditions deep bails', () => {
    expectUnchanged(withImport(`export const f = (t) => css({ _hover: { _dark: { color: t } } })`))
  })

  test('a static sibling does not hide a dynamic nested value', () => {
    expectUnchanged(withImport(`export const f = (t) => css({ padding: '2', _hover: { color: t } })`))
  })

  test('a dynamic value inside a nested selector bails', () => {
    expectUnchanged(withImport(`export const f = (t) => css({ '& > p': { color: t } })`))
  })

  test('a spread nested under a static sibling rejects the whole call', () => {
    expectUnchanged(
      withImport(`export const f = (rest) => css({ padding: '2', _hover: { color: 'red.300', ...rest } })`),
    )
  })

  test('a member expression value rejects the whole call', () => {
    expectUnchanged(withImport(`export const f = (theme) => css({ color: theme.color })`))
  })

  test('a dynamic template literal rejects the whole call', () => {
    expectUnchanged(withImport('export const f = (x) => css({ width: `${x}px` })'))
  })

  test('a getter bails', () => {
    expectUnchanged(withImport(`export const s = css({ get color() { return 'red.300' } })`))
  })
})

describe('spreads', () => {
  // The spread rule is the conservative one, and therefore the one most likely to be
  // relaxed. Each of these is a shape where the resolved and unresolved cases are
  // indistinguishable after flattening.
  test('an identifier spread bails', () => {
    expectUnchanged(withImport(`export const f = (rest) => css({ color: 'red.300', ...rest })`))
  })

  test('a logical-or spread bails', () => {
    expectUnchanged(withImport(`export const f = (a, b) => css({ ...(a || b) })`))
  })

  test('a nullish-coalescing spread bails', () => {
    expectUnchanged(withImport(`export const f = (a, b) => css({ ...(a ?? b) })`))
  })

  test('a conditional spread bails, even with static branches', () => {
    expectUnchanged(withImport(`export const f = (on) => css({ ...(on ? { color: 'red.300' } : {}) })`))
  })
})

describe('.raw in its less obvious forms', () => {
  // `.raw` must keep returning a style object. The file matcher strips `.raw` when it
  // normalizes names, so the parser result cannot distinguish these — only the callee
  // can, and these are the spellings a text check can miss.
  test('optional-chained raw is not folded', () => {
    const result = expectUnchanged(withImport(`export const s = css.raw?.({ color: 'red.300' })`))
    expect(result.skipped.map((s) => s.reason)).toContain('raw-call')
  })

  test('a computed raw key is not folded', () => {
    expectUnchanged(withImport(`export const s = css['raw']({ color: 'red.300' })`))
  })

  test('raw with a non-object argument is not folded', () => {
    expectUnchanged(withImport(`export const s = css.raw(notAnObject)`))
  })

  test('a bare raw reference is not folded', () => {
    expectUnchanged(withImport(`export const fn = css.raw`))
  })
})

describe('callee spellings that should still fold', () => {
  // The mirror image: `isImportedCallee` walks the callee to its root identifier, and
  // these are the forms that walk differently.
  test('an optional-chained css call folds', () => {
    const result = expectFolded(withImport(`export const s = css?.({ color: 'red.300' })`))
    expect(result.code).toContain('"c_red.300"')
  })

  test('a namespace import member call folds', () => {
    const { fold } = createFoldFixture()
    const result = fold(
      `import * as panda from 'styled-system/css'\nexport const s = panda.css({ color: 'red.300' })\n`,
    )

    expect(result.folded).toHaveLength(1)
    expect(result.code).toContain('"c_red.300"')
  })

  test('a static template literal value folds', () => {
    const result = expectFolded(withImport('export const s = css({ color: `red.300` })'))
    expect(result.code).toContain('"c_red.300"')
  })

  test('a satisfies-annotated argument folds', () => {
    const result = expectFolded(
      withImport(`export const s = css({ color: 'red.300' } satisfies Record<string, string>)`),
    )
    expect(result.code).toContain('"c_red.300"')
  })

  test('an unknown utility property folds to its fallback class name', () => {
    // Matches upstream `rewrites_unknown_utility_property_using_fallback_class_name`:
    // an unconfigured property still hyphenates into a class rather than bailing.
    const result = expectFolded(withImport(`export const s = css({ someUnknownProp: 'value' })`))
    expect(result.code).toContain('"some-unknown-prop_value"')
  })
})

describe('values the extractor resolves to nothing', () => {
  /**
   * A dynamic template literal is boxed as a *literal* whose value is `undefined`, not as
   * `unresolvable`. Both staticness checks accepted that — `isStaticBox` only rejects
   * `unresolvable` and `conditional`, and the key genuinely is present in the map — so the
   * call folded and the property vanished from the output.
   */
  test('a dynamic template literal beside a static value is not dropped', () => {
    expectUnchanged(withImport('export const f = (x) => css({ color: `red.300`, width: `${x}px` })'))
  })

  test('the single-property spelling keeps its value too', () => {
    expectUnchanged(withImport('export const f = (x) => css({ width: `${x}px` })'))
  })
})
