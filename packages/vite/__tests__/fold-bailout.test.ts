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

/**
 * A destructuring default is a fallback, not a value.
 *
 * `const { tone = 'red.300' } = source` boxes as the literal `'red.300'`: the extractor's
 * `maybeDefinitionValue` checks for an initializer *first* and returns the boxed default,
 * never reaching the branch that would read `source`. It is resolved as the value whether or
 * not it is the one that applies.
 *
 * That is only optimistic for extraction, and deliberately so — a CLI or PostCSS build ships a
 * runtime `css()`, where the default really does apply when the caller omits the key and needs
 * a rule behind it. Folding *replaces* the call with that value, so the same resolution ships
 * the wrong styles: a component taking a `css` prop with a default returned the default's
 * classes no matter what its caller passed, silently, with the build green and no skip recorded
 * for the survivor check to catch.
 */
describe('destructuring defaults', () => {
  test('a parameter pattern default is not the caller value', () => {
    expectUnchanged(withImport(`export const A = ({ css: cssProp = { color: 'red.300' } }) => css(cssProp)`))
  })

  test('an empty default is not the caller value either', () => {
    // The spelling that made this invisible: folding to `""` reads like "no styles here"
    // rather than like a caller's value being discarded.
    expectUnchanged(withImport(`export const B = ({ css: cssProp = {} }) => css(cssProp)`))
  })

  test('a default reached through a property is not the value', () => {
    expectUnchanged(withImport(`export const C = ({ tone = 'red.300' }) => css({ color: tone })`))
  })

  /**
   * Not a parameter, and still wrong: `source` plainly carries `tone`, two lines up and
   * statically knowable, and the default won anyway. The rule is not "parameters are dynamic"
   * but "nothing here established that this default is the one that applies".
   */
  test('a local destructure whose source has the key is not the default', () => {
    expectUnchanged(
      withImport(
        `const source = { tone: 'blue.500' }\nconst { tone = 'red.300' } = source\nexport const D = css({ color: tone })`,
      ),
    )
  })

  test('a nested value inside the default is caught too', () => {
    expectUnchanged(withImport(`export const E = ({ s = { color: 'red.300' } }) => css({ ...s, padding: '2' })`))
  })

  test('an array pattern default is not the value', () => {
    expectUnchanged(withImport(`export const H = ([tone = 'red.300']) => css({ color: tone })`))
  })

  test('a nested pattern default is not the value', () => {
    expectUnchanged(withImport(`export const I = ({ a: { b = 'red.300' } }) => css({ color: b })`))
  })

  test('a for-of pattern default is not the value', () => {
    expectUnchanged(
      withImport(
        `export const J = (list) => { for (const { tone = 'red.300' } of list) { return css({ color: tone }) } }`,
      ),
    )
  })

  /**
   * The other half of the rule, and the expensive half to get wrong.
   *
   * A call *written inside* a default is not the default's value being passed around — it is a
   * call site whose argument is written right there, and folding it is correct. An earlier cut
   * of this guard walked from the boxed value to any binding-element ancestor, which called
   * these defaults too and failed the build on code that had always compiled. There is no
   * runtime fallback, so a false rejection here is not a smaller sheet; it is a build a user
   * cannot make progress on.
   */
  test('a call written inside a default still folds', () => {
    const result = expectFolded(withImport(`export const K = ({ cls = css({ color: 'red.300' }) }) => cls`))
    expect(result.code).toContain('"c_red.300"')
  })

  test('a call inside a local destructure default still folds', () => {
    const result = expectFolded(
      withImport(`const o = {}\nconst { cls = css({ color: 'red.300' }) } = o\nexport const M = cls`),
    )
    expect(result.code).toContain('"c_red.300"')
  })

  test('a call inside a default arrow still folds', () => {
    expectFolded(withImport(`export const L = ({ make = () => css({ color: 'red.300' }) }) => make()`))
  })

  // A plain parameter default is not a binding element at all, and never resolved this way.
  test('a plain parameter default still folds', () => {
    expectFolded(withImport(`export const N = (cls = css({ color: 'red.300' })) => cls`))
  })

  /**
   * A destructure with no default is declined, and was before this guard existed — the
   * extractor's object-pattern branch resolves nothing, so there is no value to fold.
   *
   * Pinned because it is the boundary the guard must not move: adding a default to this same
   * line used to make it *start* folding, to the default, which is the wrong direction for more
   * information to push a compiler. Both spellings decline now, for different reasons.
   */
  test('a destructure with no default is declined, as it always was', () => {
    expectUnchanged(
      withImport(`const source = { tone: 'blue.500' }\nconst { tone } = source\nexport const F = css({ color: tone })`),
    )
  })

  // Nothing about a defaulted destructure elsewhere in the module may reach an unrelated call.
  test('an unrelated call beside a defaulted destructure still folds', () => {
    const result = expectFolded(
      withImport(`export const P = ({ tone = 'red.300' }) => tone\nexport const Q = css({ color: 'blue.500' })`),
    )
    expect(result.code).toContain('"c_blue.500"')
  })
})
