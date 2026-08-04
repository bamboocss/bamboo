import type { Dict } from '@bamboocss/types'
import { describe, expect, test } from 'vitest'
import { foldSource } from '../src/fold'
import { createFoldFixture } from './fixture'

/**
 * Splitting a call into a static half and a runtime half.
 *
 * The soundness argument is narrow: `css()` merges and emits one class per property, a
 * split emits two strings and concatenates them, and `cx` here does no conflict
 * resolution. So the two agree only while no property is produced by both halves — which
 * is why the shorthand cases below matter more than the happy path.
 */
const src = (body: string) => `import { css } from 'styled-system/css'\n${body}\n`

describe('splits a partly static call', () => {
  test('static properties become a literal, dynamic ones stay', () => {
    const { fold } = createFoldFixture()
    const result = fold(src(`export const f = (p) => css({ color: 'red.300', padding: p })`))

    expect(result.folded).toHaveLength(1)
    expect(result.code).toContain('cx("c_red.300", css({ padding: p }))')
  })

  test('cx is added to the import that already brings in css', () => {
    const { fold } = createFoldFixture()
    const result = fold(src(`export const f = (p) => css({ color: 'red.300', padding: p })`))

    expect(result.code).toContain(`import { css, cx } from 'styled-system/css'`)
  })

  test('an existing cx import is reused rather than re-added', () => {
    const { fold } = createFoldFixture()
    const result = fold(
      `import { css, cx } from 'styled-system/css'\nexport const f = (p) => css({ color: 'red.300', padding: p })\n`,
    )

    // Two assertions, because either alone passes on an unchanged file: the fold has to
    // have happened, *and* the binding must not have been added a second time.
    expect(result.folded).toHaveLength(1)
    expect(result.code.match(/\bcx\b(?=[,\s}])/g)?.length).toBe(1)
  })

  test('an aliased css callee keeps its alias in the runtime half', () => {
    const { fold } = createFoldFixture()
    const result = fold(
      `import { css as xcss } from 'styled-system/css'\nexport const f = (p) => xcss({ color: 'red.300', padding: p })\n`,
    )

    expect(result.code).toContain('xcss({ padding: p })')
  })

  test('several static properties fold together', () => {
    const { fold, runtimeCss } = createFoldFixture()
    const result = fold(src(`export const f = (p) => css({ color: 'red.300', display: 'flex', padding: p })`))

    expect(result.folded[0]!.className).toBe(runtimeCss({ color: 'red.300', display: 'flex' }))
  })

  test('a static condition block folds while a dynamic sibling stays', () => {
    const { fold, runtimeCss } = createFoldFixture()
    const result = fold(src(`export const f = (p) => css({ _hover: { color: 'red.300' }, padding: p })`))

    expect(result.folded[0]!.className).toBe(runtimeCss({ _hover: { color: 'red.300' } }))
    expect(result.code).toContain('css({ padding: p })')
  })
})

describe('refuses to split where the halves could collide', () => {
  test('a shorthand and its longhand are not split apart', () => {
    const { fold } = createFoldFixture()
    const code = src(`export const f = (p) => css({ mx: '4', marginInline: p })`)

    // Both resolve to the same property. `css()` keeps the last; a split would emit both.
    expect(fold(code).folded).toHaveLength(0)
    expect(fold(code).code).toBe(code)
  })

  test('the longhand-first spelling is refused too', () => {
    const { fold } = createFoldFixture()
    const code = src(`export const f = (p) => css({ marginInline: '4', mx: p })`)

    expect(fold(code).folded).toHaveLength(0)
  })

  test('a multi-argument call is not split', () => {
    const { fold } = createFoldFixture()
    const code = src(`export const f = (extra) => css({ color: 'red.300' }, extra)`)

    // `css(a, b)` is later-wins across the whole object, so the static half cannot be
    // hoisted out without reproducing the merge.
    expect(fold(code).folded).toHaveLength(0)
    expect(fold(code).code).toBe(code)
  })

  test('a spread is not split', () => {
    const { fold } = createFoldFixture()
    const code = src(`export const f = (rest) => css({ color: 'red.300', ...rest })`)

    // A spread contributes keys that belong to neither half.
    expect(fold(code).folded).toHaveLength(0)
  })

  test('a computed key is not split', () => {
    const { fold } = createFoldFixture()
    const code = src(`export const f = (k, p) => css({ color: 'red.300', [k]: p })`)

    expect(fold(code).folded).toHaveLength(0)
  })

  test('a fully dynamic call is left alone', () => {
    const { fold } = createFoldFixture()
    const code = src(`export const f = (c, p) => css({ color: c, padding: p })`)

    expect(fold(code).folded).toHaveLength(0)
    expect(fold(code).code).toBe(code)
  })

  test('a fully static call still folds whole, not split', () => {
    const { fold } = createFoldFixture()
    const result = fold(src(`export const cls = css({ color: 'red.300', padding: '4' })`))

    expect(result.code).toContain('export const cls = "c_red.300 p_4"')
    expect(result.code).not.toContain('cx(')
  })
})

describe('the partial option', () => {
  test('turns splitting off without affecting whole folds', () => {
    const { ctx } = createFoldFixture()
    const code = src(`export const f = (p) => css({ color: 'red.300', padding: p })`)

    ctx.project.addSourceFile('app/off.tsx', code)
    const result = foldSource({
      ctx,
      code,
      parserResult: ctx.project.parseSourceFile('app/off.tsx')!,
      filePath: 'app/off.tsx',
      partial: false,
    })

    expect(result.folded).toHaveLength(0)
    expect(result.code).toBe(code)
  })
})

describe('the split half is backed by css', () => {
  test('every class in the static half has a rule', async () => {
    const { fold, getCss } = createFoldFixture()
    const result = fold(
      src(`export const f = (p) => css({ color: 'red.300', _hover: { display: 'flex' }, padding: p })`),
    )

    const { esc } = await import('@bamboocss/shared')
    const css = getCss()

    for (const name of result.folded[0]!.className.split(' ')) {
      expect(css).toContain(`.${esc(name)}`)
    }
  })
})

/**
 * Every case here was reported by an independent review of the first implementation, and
 * each one was a real defect. They are grouped so the reasons stay visible: two of them
 * broke the build outright and three changed what a page renders.
 */
describe('regressions the first implementation had', () => {
  test('two split calls in one file add the import once', () => {
    const { fold } = createFoldFixture()
    const result = fold(
      src(`export const a = (p) => css({ color: 'red.300', padding: p })
export const b = (q) => css({ display: 'flex', margin: q })`),
    )

    // Two inserts at the same offset produced `import { css, cx, cx }`, which is a
    // SyntaxError -- and any component with two prop-driven calls hits it.
    expect(result.folded).toHaveLength(2)
    expect(result.code).toContain(`import { css, cx } from 'styled-system/css'`)
    expect(result.code).not.toContain('cx, cx')
  })

  test('a ternary keeps both branches', () => {
    const { fold } = createFoldFixture()
    const result = fold(src(`export const f = (flag, p) => css({ color: flag ? 'red.300' : 'blue.500', padding: p })`))

    // The extracted data is a projection that has already picked `whenTrue`, so reading
    // it would discard the other branch. Both branches are resolved instead.
    expect(result.code).toContain(`flag ? "c_red.300" : "c_blue.500"`)
    expect(result.code).toContain('css({ padding: p })')
  })

  test('a ternary nested in a condition block goes to the runtime', () => {
    const { fold } = createFoldFixture()
    const result = fold(
      src(`export const f = (flag) => css({ margin: '2', _hover: { color: flag ? 'red.300' : 'blue.500' } })`),
    )

    // Only a top-level ternary lowers; a nested one would need its condition path folded
    // into each branch's class, so the block travels whole.
    expect(result.code).toContain(`css({ _hover: { color: flag ? 'red.300' : 'blue.500' } })`)
    expect(result.folded[0]!.className).toBe('m_2')
  })

  test('a dynamic element in a responsive array is not dropped', () => {
    const { fold } = createFoldFixture()
    const code = src(`export const f = (p, q) => css({ padding: ['1', p], color: q })`)

    // Folding the static half emitted only `p_1`, losing the breakpoint class entirely.
    expect(fold(code).folded).toHaveLength(0)
  })

  test('a base block disqualifies the split', () => {
    const { fold } = createFoldFixture()
    const code = src(`export const f = (p) => css({ base: { color: 'blue.500' }, color: p })`)

    // `createCss` merges `base` over its siblings, so it overrides a key of any name and
    // comparing key names cannot see the conflict.
    expect(fold(code).folded).toHaveLength(0)
  })

  test('a locally declared cx blocks the split', () => {
    const { fold } = createFoldFixture()
    const code = src(`const cx = (...a) => a.join('!')\nexport const f = (p) => css({ color: 'red.300', padding: p })`)

    // Inserting the import would redeclare it; calling the local would use the wrong
    // join. Either way the split has to be declined.
    expect(fold(code).folded).toHaveLength(0)
    expect(fold(code).code).toBe(code)
  })

  test('a cx parameter in scope blocks the split', () => {
    const { fold } = createFoldFixture()
    const code = src(`export const f = (p, cx) => css({ color: 'red.300', padding: p })`)

    expect(fold(code).folded).toHaveLength(0)
  })

  test('a cx imported from somewhere else is not called', () => {
    const { fold } = createFoldFixture()
    const code = `import { css } from 'styled-system/css'\nimport { cx } from 'other-lib'\nexport const f = (p) => css({ color: 'red.300', padding: p })\n`

    // That `cx` may not be a plain concatenation, which is the property this relies on.
    expect(fold(code).folded).toHaveLength(0)
  })

  test('a deep import path does not get cx added to it', () => {
    const { fold } = createFoldFixture()
    const code = `import { css } from 'styled-system/css/css'\nexport const f = (p) => css({ color: 'red.300', padding: p })\n`

    // `ImportMap.match` is substring-based, so this module matches the css entry while
    // exporting no `cx`. Inserting one there is an import of a non-existent binding.
    expect(fold(code).folded).toHaveLength(0)
    expect(fold(code).code).toBe(code)
  })

  test('a pattern module does not get cx added to it', () => {
    const { fold } = createFoldFixture()
    const code = `import { stack } from 'styled-system/patterns'\nimport { css } from 'styled-system/patterns'\nexport const f = (p) => css({ color: 'red.300', padding: p })\n`

    // The recipe and pattern matchers accept any imported name, so those modules matched
    // the old probe too. Neither exports `cx`.
    expect(fold(code).folded).toHaveLength(0)
  })

  test('the static half is read from raw, not from a condition projection', () => {
    const { fold } = createFoldFixture()
    const result = fold(src(`export const f = (a) => css({ margin: '2', color: a ? 'red.300' : 'blue.500' })`))

    // `data[0]` is the first *condition* once a ternary is present, so it holds
    // `{ color: 'red.300' }` and not `{ margin: '2' }`. Drawing the static half from it
    // would both invent a class and lose one.
    expect(result.folded[0]!.className).toBe('m_2')
  })

  test('a type-only cx import is not reused', () => {
    const { fold } = createFoldFixture()
    const code = `import { css } from 'styled-system/css'\nimport type { cx } from './types'\nexport const f = (p) => css({ color: 'red.300', padding: p })\n`

    // Erased at runtime, so calling it is a ReferenceError.
    expect(fold(code).folded).toHaveLength(0)
  })
})

describe('tsconfig path aliases', () => {
  /**
   * `ImportMap.match` resolves a path alias before deciding whether an import is bamboo's,
   * so extraction has always understood these. The module check for the `cx` insert did
   * not, which turned partial folding off for any project importing through an alias —
   * `@site/styled-system/css` is the spelling this repo's own website uses. It failed
   * silently, reported as `dynamic`, indistinguishable from a call that genuinely cannot
   * be resolved.
   */
  const aliased = () =>
    createFoldFixture({
      tsOptions: { pathMappings: [{ pattern: /^@site\/(.*)$/, paths: ['styled-system/$1'] }] },
    } as never)

  test('a call imported through an alias still splits', () => {
    const { fold } = aliased()
    const result = fold(
      `import { css } from '@site/styled-system/css'\nexport const f = (p) => css({ color: 'red.300', padding: p })\n`,
    )

    expect(result.folded).toHaveLength(1)
    expect(result.code).toContain(`import { css, cx } from '@site/styled-system/css'`)
  })

  test('an alias resolving somewhere else is still refused', () => {
    const { fold } = aliased()
    const code = `import { css } from '@site/lib/other'\nexport const f = (p) => css({ color: 'red.300', padding: p })\n`

    expect(fold(code).folded).toHaveLength(0)
  })
})

describe('a configured importMap wrapper', () => {
  /**
   * `importMap.css` points at the user's own module. A wrapper that re-exports `css` need
   * not re-export `cx`, so adding one there imports a binding that may not exist — the
   * same failure class as the deep-path case, reached a different way.
   */
  const wrapped = () => createFoldFixture({ importMap: { css: ['@/lib/style'] } } as never)

  test('cx is not added to a wrapper module', () => {
    const { fold } = wrapped()
    const code = `import { css } from '@/lib/style'\nexport const f = (p) => css({ color: 'red.300', padding: p })\n`

    expect(fold(code).folded).toHaveLength(0)
    expect(fold(code).code).toBe(code)
  })

  test('a cx the user already imported from the wrapper is reused', () => {
    const { fold } = wrapped()
    const result = fold(
      `import { css, cx } from '@/lib/style'\nexport const f = (p) => css({ color: 'red.300', padding: p })\n`,
    )

    // That binding demonstrably resolves, so only *adding* one is restricted.
    expect(result.folded).toHaveLength(1)
    expect(result.code).toContain('cx("c_red.300"')
  })
})

/**
 * A single dynamic leaf used to send its whole block to the runtime, losing every
 * resolved sibling with it. A class is identified by its condition path *and* its
 * property, so `_hover.color` and `_hover.bg` cannot collide and the block can be split.
 */
describe('splitting inside a block', () => {
  const cases: Array<{ name: string; styles: string; staticHalf: Record<string, unknown>; runtime: string }> = [
    {
      name: 'a condition block',
      styles: `{ _hover: { color: 'red.300', bg: p } }`,
      staticHalf: { _hover: { color: 'red.300' } },
      runtime: 'css({ _hover: { bg: p } })',
    },
    {
      name: 'a condition block beside a static sibling',
      styles: `{ margin: '2', _hover: { color: 'red.300', bg: p } }`,
      staticHalf: { margin: '2', _hover: { color: 'red.300' } },
      runtime: 'css({ _hover: { bg: p } })',
    },
    {
      name: 'two conditions deep',
      styles: `{ _hover: { _dark: { color: 'red.300', bg: p } } }`,
      staticHalf: { _hover: { _dark: { color: 'red.300' } } },
      runtime: 'css({ _hover: { _dark: { bg: p } } })',
    },
    {
      name: 'a nested selector',
      styles: `{ '& > p': { color: 'red.300', bg: p } }`,
      staticHalf: { '& > p': { color: 'red.300' } },
      runtime: `css({ '& > p': { bg: p } })`,
    },
  ]

  test.each(cases)('$name splits', ({ styles, staticHalf, runtime }) => {
    const { fold, runtimeCss } = createFoldFixture()
    const result = fold(src(`export const f = (p) => css(${styles})`))

    expect(result.folded).toHaveLength(1)
    // The static half has to equal what the runtime produces for exactly that subtree,
    // so a class cannot be invented or dropped by the reconstruction.
    expect(result.folded[0]!.className).toBe(runtimeCss(staticHalf))
    expect(result.code).toContain(runtime)
  })

  test('the two halves together equal the whole', () => {
    const { fold, runtimeCss } = createFoldFixture()
    const result = fold(src(`export const f = (p) => css({ margin: '2', _hover: { color: 'red.300', bg: p } })`))

    // With the dynamic value resolved, split output and whole output must carry the same
    // classes — the property this whole feature rests on.
    const whole = runtimeCss({ margin: '2', _hover: { color: 'red.300', bg: 'blue.500' } })
    const split = [result.folded[0]!.className, runtimeCss({ _hover: { bg: 'blue.500' } })].join(' ')

    expect(split.split(' ').sort()).toEqual(whole.split(' ').sort())
  })

  test.each([
    ['a shorthand colliding inside the block', `{ _hover: { mx: '4', marginInline: p } }`],
    ['a spread inside the block', `{ _hover: { color: 'red.300', ...rest } }`],
    ['a computed key inside the block', `{ _hover: { color: 'red.300', [k]: p } }`],
    ['a base key inside a conditional value map', `{ fontSize: { base: 'sm', md: p } }`],
  ])('declines %s', (_name, styles) => {
    const { fold } = createFoldFixture()
    const code = src(`export const f = (p, k, rest) => css(${styles})`)

    expect(fold(code).folded).toHaveLength(0)
    expect(fold(code).code).toBe(code)
  })

  test.each([
    ['a shorthand colliding inside the block', `_hover: { mx: '4', marginInline: p }`, "mx: '4'"],
    ['a spread inside the block', `_hover: { color: 'red.300', ...rest }`, '...rest'],
    ['a computed key inside the block', `_hover: { color: 'red.300', [k]: p }`, '[k]: p'],
  ])('%s sends the whole block to the runtime rather than splitting it', (_name, inner, marker) => {
    const { fold } = createFoldFixture()
    // Without a static sibling these decline for having no static half at all, so they
    // do not pin the rule they are named for. With one, the split proceeds and the block
    // has to travel whole.
    const result = fold(src(`export const f = (p, k, rest) => css({ margin: '2', ${inner} })`))

    expect(result.folded).toHaveLength(1)
    expect(result.folded[0]!.className).toBe('m_2')
    expect(result.code).toContain(marker)
  })

  test('a duplicated key declines rather than emitting both halves', () => {
    const { fold } = createFoldFixture()
    const code = src(`export const f = (p) => css({ _hover: { color: 'red.300', bg: p }, _hover: { margin: '2' } })`)

    // Object literals are last-wins, so `css()` only ever sees the second `_hover` and
    // returns `hover:m_2`. Splitting emitted the discarded block's classes alongside it.
    expect(fold(code).folded).toHaveLength(0)
    expect(fold(code).code).toBe(code)
  })

  test('a duplicated key declines whichever order it is written in', () => {
    const { fold } = createFoldFixture()
    const code = src(`export const f = (p) => css({ _hover: { margin: '2' }, _hover: { color: 'red.300', bg: p } })`)

    // This order happened to come out right, which made the bug intermittent by spelling.
    expect(fold(code).folded).toHaveLength(0)
  })

  test('a duplicated key declines across quoting styles', () => {
    const { fold } = createFoldFixture()
    const code = src(`export const f = (p) => css({ '_hover': { color: 'red.300', bg: p }, _hover: { margin: '2' } })`)

    expect(fold(code).folded).toHaveLength(0)
  })

  test('a duplicated key at the top level declines', () => {
    const { fold } = createFoldFixture()
    const code = src(`export const f = (p) => css({ margin: '2', color: p, margin: '4' })`)

    expect(fold(code).folded).toHaveLength(0)
  })
})

/**
 * A ternary is finite, not dynamic: both branches are known, so each resolves now and the
 * choice becomes a ternary between two literals. Independent conditionals stay linear —
 * two properties give two ternaries, not four combinations — which is sound only because
 * `collides()` rules out two properties resolving to the same class.
 */
describe('finite branches', () => {
  /**
   * Execute a folded module and return the class string it produces, so equivalence is
   * checked against what actually runs rather than against a re-derivation of it. `cx` is
   * the generated one: concatenate the string arguments, skip everything else.
   */
  const run = (code: string, ...args: unknown[]) => {
    const body = code.replace(/^\s*import .*$/gm, '').replace('export const', 'const')
    const cx = (...parts: unknown[]) => parts.filter((part) => part && typeof part === 'string').join(' ')

    return new Function('cx', `${body}; return f`)(cx)(...args) as string
  }

  test('a lone ternary lowers to a ternary of literals', () => {
    const { fold } = createFoldFixture()
    const result = fold(src(`export const f = (e) => css({ margin: '2', color: e ? 'red.300' : 'blue.500' })`))

    expect(result.code).toContain(`cx("m_2", e ? "c_red.300" : "c_blue.500")`)
  })

  test('either branch recombines to the whole', () => {
    const { fold, runtimeCss } = createFoldFixture()
    const result = fold(src(`export const f = (e) => css({ margin: '2', color: e ? 'red.300' : 'blue.500' })`))

    for (const [e, value] of [
      [true, 'red.300'],
      [false, 'blue.500'],
    ] as const) {
      // The folded expression is *run*, rather than reconstructed with the same
      // `runtimeCss` the fold used — which would only assert that function against itself.
      expect(run(result.code, e).split(' ').sort()).toEqual(runtimeCss({ margin: '2', color: value }).split(' ').sort())
    }
  })

  test('two independent conditionals stay linear', () => {
    const { fold } = createFoldFixture()
    const result = fold(
      src(`export const f = (a, b) => css({ color: a ? 'red.300' : 'blue.500', margin: b ? '1' : '2' })`),
    )

    // Two ternaries, not four combinations.
    expect(result.code).toContain(`cx(a ? "c_red.300" : "c_blue.500", b ? "m_1" : "m_2")`)
  })

  test('a ternary beside a dynamic value keeps both mechanisms', () => {
    const { fold } = createFoldFixture()
    const result = fold(src(`export const f = (e, p) => css({ color: e ? 'red.300' : 'blue.500', padding: p })`))

    expect(result.code).toContain(`cx(e ? "c_red.300" : "c_blue.500", css({ padding: p }))`)
  })

  test('a ternary with a dynamic branch does not lower', () => {
    const { fold } = createFoldFixture()
    const code = src(`export const f = (e, x) => css({ margin: '2', color: e ? 'red.300' : x })`)

    // One branch unresolvable means the choice is not finite.
    expect(fold(code).code).toContain(`color: e ? 'red.300' : x`)
  })

  test('a lone ternary removes the call entirely', () => {
    const { fold } = createFoldFixture()
    const result = fold(src(`export const f = (e) => css({ color: e ? 'red.300' : 'blue.500' })`))

    // Nothing static to pair it with, but the runtime call is still gone. `cx` stays
    // around the ternary: splicing a bare conditional into the call's position would
    // reassociate against a neighbouring operator.
    expect(result.code).toContain(`cx(e ? "c_red.300" : "c_blue.500")`)
    expect(result.code).not.toContain('css(')
  })

  test('a fully dynamic call is left alone', () => {
    const { fold } = createFoldFixture()
    const code = src(`export const f = (c, p) => css({ color: c, padding: p })`)

    // No static half and no finite branch, so a split would only re-wrap the same call.
    expect(fold(code).code).toBe(code)
  })

  test('a ternary colliding with a static sibling declines', () => {
    const { fold } = createFoldFixture()
    const code = src(`export const f = (e) => css({ mx: '4', marginInline: e ? '1' : '2' })`)

    // Both resolve to one property, so emitting a literal and a ternary for it would
    // apply two classes where the runtime applies one.
    expect(fold(code).folded).toHaveLength(0)
    expect(fold(code).code).toBe(code)
  })

  test('a lowering that cannot be kept goes back to the runtime, and the split survives', () => {
    const { fold } = createFoldFixture()

    // Interleaved with dynamic values, so the condition cannot be hoisted without
    // reordering it. The property returns to the call; `bg` is still worth hoisting.
    const interleaved = fold(
      src(
        `export const f = (p, e, m) => css({ bg: 'red.300', padding: p, color: e ? 'red.300' : 'blue.500', margin: m })`,
      ),
    )
    expect(interleaved.code).toContain(
      `cx("bg_red.300", css({ padding: p, color: e ? 'red.300' : 'blue.500', margin: m }))`,
    )

    // Same for a nested split, which must not be lost either.
    const nested = fold(
      src(
        `export const f = (p, e) => css({ _hover: { bg: 'red.300', padding: p }, color: e ? 'red.300' : 'blue.500', margin: p })`,
      ),
    )
    expect(nested.code).toContain('cx("hover:bg_red.300", css({ _hover: { padding: p },')

    // And for a colliding pair, where both ternaries demote and the static half stays.
    const colliding = fold(
      src(`export const f = (a, b) => css({ padding: '2', mx: a ? '1' : '2', marginInline: b ? '3' : '4' })`),
    )
    expect(colliding.code).toContain(`cx("p_2", css({ mx: a ? '1' : '2', marginInline: b ? '3' : '4' }))`)
  })

  test('a branch reached as an identifier is checked against its own box', () => {
    const { fold } = createFoldFixture()

    // `warm` accounts for its box trivially, being an identifier rather than a literal.
    // The other branch does not account for its own — `g()` did not evaluate — so pairing
    // each source with the wrong box would let this through against the wrong one.
    const code = src(
      `const warm = { color: 'red.300', margin: '4' }\nexport const f = (e) => css({ padding: '2', _hover: e ? warm : { color: 'blue.500', margin: g() } })`,
    )

    expect(fold(code).code).toContain('margin: g()')
    expect(fold(code).code).not.toContain('hover:c_red.300')
  })

  test('two ternaries colliding with each other decline', () => {
    const { fold } = createFoldFixture()
    const code = src(`export const f = (a, b) => css({ mx: a ? '1' : '2', marginInline: b ? '3' : '4' })`)

    // No static half to collide against, so the guard has to compare the ternaries to
    // one another. All four combinations would otherwise emit two margin-inline classes.
    expect(fold(code).folded).toHaveLength(0)
    expect(fold(code).code).toBe(code)
  })

  test('a branch the box does not fully account for declines', () => {
    const { fold } = createFoldFixture()

    // The extractor omits `base` rather than marking it unresolvable, so the branch map
    // looks static while missing a value. Lowering it would drop the base colour.
    const dropped = src(
      `export const f = (e) => css({ margin: '2', color: e ? { base: g(), md: 'blue.500' } : 'red.300' })`,
    )
    expect(fold(dropped).code).toContain('base: g()')

    // A spread inside a branch is the same hole, and there it produces a *wrong* class
    // rather than a missing one, since the spread may override the key beside it.
    const overridden = src(
      `export const f = (e, o) => css({ margin: '2', _hover: e ? { color: 'red.300', ...o } : { color: 'blue.500' } })`,
    )
    expect(fold(overridden).code).toContain('...o')
  })

  test('a condition is not hoisted past a dynamic value', () => {
    const { fold } = createFoldFixture()

    // Both are arbitrary expressions, so which runs first is observable. Written after
    // the dynamic value, the ternary has to stay after the call.
    const after = fold(
      src(`export const f = (p, e) => css({ padding: log(p), color: log(e) ? 'red.300' : 'blue.500' })`),
    )
    expect(after.code).toContain(`cx(css({ padding: log(p) }), log(e) ? "c_red.300" : "c_blue.500")`)

    // Written before it, before.
    const before = fold(
      src(`export const f = (p, e) => css({ color: log(e) ? 'red.300' : 'blue.500', padding: log(p) })`),
    )
    expect(before.code).toContain(`cx(log(e) ? "c_red.300" : "c_blue.500", css({ padding: log(p) }))`)

    // Interleaved, neither order holds, so the lowering is declined outright.
    const between = src(
      `export const f = (p, q, e) => css({ padding: log(p), color: log(e) ? 'red.300' : 'blue.500', margin: log(q) })`,
    )
    expect(fold(between).code).toContain(`color: log(e) ? 'red.300' : 'blue.500'`)
  })
  test('a wrapped branch is still checked', () => {
    const { fold } = createFoldFixture()

    // The extractor unwraps `as`, `satisfies`, `!` and parentheses before boxing, so a
    // check that unwraps fewer of them looks at the wrapper and waves the object through.
    for (const branch of [`({ color: 'red.300', ...o } as any)`, `(({ color: 'red.300', ...o }))`]) {
      const code = src(`export const f = (e, o) => css({ margin: '2', _hover: e ? ${branch} : { color: 'blue.500' } })`)

      expect(fold(code).code).toContain('...o')
      expect(fold(code).code).not.toContain('hover:c_red.300')
    }
  })

  test('a condition found outside this call is not copied into it', () => {
    const { fold } = createFoldFixture()

    // The extractor resolves identifiers through their declarations, across modules, so
    // the conditional it found is often not written here. Copying its condition would
    // emit a reference to a binding this scope does not have, and would re-evaluate it on
    // every call rather than once where it was declared.
    const local = src(`const v = flag ? 'red.300' : 'blue.500'\nexport const f = () => css({ margin: '2', color: v })`)

    // `flag ?` still appears in the declaration, which is untouched; what must not appear
    // is the lowered form, where the condition has been moved into `f`.
    expect(fold(local).code).not.toContain('flag ? "c_red.300"')
    expect(fold(local).code).toContain('css({ color: v })')
  })

  test('a conditional in a key position is not read as the value', () => {
    const { fold } = createFoldFixture()

    // Here the box's conditional is the lookup key, and its branches are the values it
    // found — so the source's when-true is `'a'`, not the object the box holds.
    const code = src(
      `const palette = { a: 'red.300', b: 'blue.500' }\nexport const f = (e) => css({ margin: '2', color: palette[e ? 'a' : 'b'] })`,
    )

    expect(fold(code).code).toContain(`css({ color: palette[e ? 'a' : 'b'] })`)
    expect(fold(code).code).not.toContain('c_red.300')
  })

  test('every folded shape produces the classes the runtime would', () => {
    const { fold, runtimeCss } = createFoldFixture()

    /** Run a folded module with the real `css` behind it, not just `cx`. */
    const execute = (code: string, e: unknown) => {
      const body = code.replace(/^\s*import .*$/gm, '').replace('export const', 'const')
      const cx = (...parts: unknown[]) => parts.filter((part) => part && typeof part === 'string').join(' ')
      const classes = new Function('cx', 'css', `${body}; return f`)(cx, runtimeCss)(e) as string

      return classes.split(' ').filter(Boolean).sort()
    }

    // Each shape paired with the object it is equivalent to, per branch. Declining shapes
    // are included deliberately: they execute through the stub unchanged, so the
    // comparison proves the decline was right rather than merely counting it.
    const shapes: Array<[string, (e: boolean) => Dict]> = [
      [
        `css({ margin: '2', color: e ? 'red.300' : 'blue.500' })`,
        (e) => ({ margin: '2', color: e ? 'red.300' : 'blue.500' }),
      ],
      [`css({ color: e ? 'red.300' : 'blue.500' })`, (e) => ({ color: e ? 'red.300' : 'blue.500' })],
      [
        `css({ mx: e ? '1' : '2', marginInline: e ? '3' : '4' })`,
        (e) => ({ mx: e ? '1' : '2', marginInline: e ? '3' : '4' }),
      ],
      [
        `css({ padding: '2', mx: e ? '1' : '2', marginInline: e ? '3' : '4' })`,
        (e) => ({ padding: '2', mx: e ? '1' : '2', marginInline: e ? '3' : '4' }),
      ],
      [
        `css({ margin: '2', _hover: e ? { color: 'red.300' } : { color: 'blue.500' } })`,
        (e) => ({ margin: '2', _hover: { color: e ? 'red.300' : 'blue.500' } }),
      ],
      [
        `css({ margin: '2', color: e ? ['red.300', 'blue.500'] : 'green.400' })`,
        (e) => ({ margin: '2', color: e ? ['red.300', 'blue.500'] : 'green.400' }),
      ],
      [
        `css({ bg: 'red.300', color: e ? 'red.300' : 'blue.500', margin: e ? '1' : '2' })`,
        (e) => ({ bg: 'red.300', color: e ? 'red.300' : 'blue.500', margin: e ? '1' : '2' }),
      ],
      [
        `css({ _hover: { color: 'red.300', padding: e ? '1' : '2' } })`,
        (e) => ({ _hover: { color: 'red.300', padding: e ? '1' : '2' } }),
      ],
    ]

    for (const [call, whole] of shapes) {
      const result = fold(src(`export const f = (e) => ${call}`))

      for (const e of [true, false]) {
        expect(execute(result.code, e), `${call} with e=${e}`).toEqual(
          runtimeCss(whole(e)).split(' ').filter(Boolean).sort(),
        )
      }
    }
  })

  test('a ternary written after a nested split stays after it', () => {
    const { fold } = createFoldFixture()
    const result = fold(
      src(`export const f = (p, e) => css({ _hover: { color: 'red.300', padding: p }, margin: e ? '1' : '2' })`),
    )

    // The runtime half of a split block counts as a dynamic property for ordering, the
    // same as a whole one does.
    expect(result.code).toContain(`cx("hover:c_red.300", css({ _hover: { padding: p } }), e ? "m_1" : "m_2")`)
  })
})

/**
 * The extractor answers "what styles could this produce", so when one arm of a choice
 * does not evaluate it returns the other rather than refusing. Generating CSS for a
 * branch that might run is right; *replacing source* with it is not, because the arm it
 * kept becomes the only one there is.
 *
 * The tell is the arms rather than the condition: it guessed exactly when one produced a
 * box and the other did not.
 */
describe('choices the extractor could not decide', () => {
  test('a ternary whose other arm did not evaluate is not folded to this one', () => {
    const { fold } = createFoldFixture()
    const result = fold(src(`export const f = (e) => css({ margin: '2', color: e ? 'red.300' : fn() })`))

    // The box is a plain literal holding `'red.300'` — indistinguishable from a value
    // that was actually written there, which is what made this fold silently wrong.
    expect(result.code).toContain(`color: e ? 'red.300' : fn()`)
    expect(result.code).not.toContain('c_red.300')
    // The sibling still folds, so this is a declined property and not a declined file.
    expect(result.code).toContain('cx("m_2"')
  })

  test('a decided condition does not rescue an arm that did not evaluate', () => {
    const { fold } = createFoldFixture()
    const code = src(`const on = true\nexport const f = () => css({ margin: '2', color: on ? 'red.300' : fn() })`)

    // `on` is known, so `'red.300'` is in fact the value. Reading the condition to prove
    // that means trusting an evaluation the extractor did not do — and `({ on = true })`
    // is a condition the extractor deliberately treats as undecided while a plain read
    // of it says `true`. Asking only about the arms avoids having to match that rule.
    expect(fold(code).code).toContain(`color: on ? 'red.300' : fn()`)
    expect(fold(code).code).toContain('cx("m_2"')
  })

  test('a default binding is not read as a decided condition', () => {
    const { fold } = createFoldFixture()
    const code = src(`export const f = ({ on = true }) => css({ margin: '2', color: on ? 'red.300' : fn() })`)

    // `f({ on: false })` runs `fn()`, while a plain read of the initializer says `true`.
    // This declines because `fn()` does not resolve, not because the condition was
    // judged — the rule never looks at the condition. It is kept as a guard against
    // going back to one that does, which is where this shape was getting folded.
    expect(fold(code).code).toContain(`color: on ? 'red.300' : fn()`)
    expect(fold(code).code).not.toContain('c_red.300')
    // The sibling still folds, so this is a declined property rather than a declined file.
    expect(fold(code).code).toContain('cx("m_2"')
  })

  test('a guess in either arm position declines', () => {
    const { fold } = createFoldFixture()

    // The extractor answers with whichever arm evaluated, so the failing one can be
    // either. Only checking the second would leave half the rule unpinned.
    for (const value of [`e ? fn() : 'blue.500'`, `e ? 'red.300' : fn()`]) {
      const result = fold(src(`export const f = (e) => css({ margin: '2', color: ${value} })`))

      expect(result.code, value).toContain(value)
      expect(result.code, value).toContain('cx("m_2"')
      expect(result.code.replace(value, ''), value).not.toContain('c_')
    }
  })

  test('a chain of short-circuits is judged all the way down', () => {
    const { fold } = createFoldFixture()

    // `a || b || c` parses as `(a || b) || c`, so the outer operator is handed whatever
    // the inner one answered — here an arm the extractor invented, which looks like an
    // ordinary literal by the time the outer sees it.
    for (const value of [`fn() || 'red.300' || 'blue.500'`, `fn() ?? 'red.300' ?? 'blue.500'`]) {
      const result = fold(src(`export const f = () => css({ margin: '2', color: ${value} })`))

      expect(result.code, value).toContain(value)
      expect(result.code, value).not.toContain('c_red.300')
      expect(result.code, value).toContain('cx("m_2"')
    }
  })

  test('a chain is judged on the element surface too', () => {
    const { fold } = createFoldFixture()
    // `css` is imported because element splitting needs `cx` alongside it, and the fold
    // will not add an import to a file that has neither.
    const code = `import { css } from 'styled-system/css'\nimport { styled } from 'styled-system/jsx'\nexport const El = () => <styled.div margin="2" color={fn() || 'red.300' || 'blue.500'} />\n`
    const result = fold(code)

    // The same guard runs for style props, and an element fold writes the class straight
    // into the attribute where nothing downstream would notice it was invented.
    expect(result.code).not.toContain('c_red.300')
    // The static half still folds, so an element that folded nothing would not pass.
    expect(result.code).toContain('m_2')
  })

  test('a comparison is not folded to one of its operands', () => {
    const { fold } = createFoldFixture()

    // A comparison's value is a boolean, and the extractor never computes one — it
    // collapses the expression the same way it collapses a choice and answers with an
    // operand. So no shape of answer could be right, a boolean least of all: the operand
    // *is* one, and `false === false` comes back as `false` where the value is `true`.
    //
    // Every operator `isLogicalSyntax` collapses is here, because dropping any one of
    // them from the list re-opens a fold that is wrong.
    for (const value of [
      `fn() === 'red.300'`,
      `'red.300' in fn()`,
      `(fn() === 'red.300') || 'blue.500'`,
      `empty === fn()`,
      `false === false`,
      `true !== true`,
      `flag === fn()`,
      `flag == fn()`,
      `flag != fn()`,
      `flag !== fn()`,
      `flag < fn()`,
      `flag > fn()`,
      `flag <= fn()`,
      `flag >= fn()`,
      `flag instanceof fn()`,
    ]) {
      const result = fold(
        src(`const empty = ''\nconst flag = false\nexport const f = () => css({ margin: '2', truncate: ${value} })`),
      )

      expect(result.code, value).toContain(value)
      expect(result.code, value).not.toContain('trunc_')
      expect(result.code, value).toContain('cx("m_2"')
    }

    // A comparison in a *condition* is a different position: what gets judged there is
    // the ternary, and the extractor did resolve which of its arms runs.
    const decided = fold(
      src(
        `const mode = 'dark'\nexport const f = () => css({ margin: '2', color: mode === 'light' ? 'red.300' : 'blue.500' })`,
      ),
    )
    expect(decided.code).toContain(`"m_2 c_blue.500"`)
  })

  test('a nested choice in a ternary arm is judged too', () => {
    const { fold } = createFoldFixture()
    const code = src(`export const f = (e, g) => css({ margin: '2', color: e ? (g ? 'red.300' : fn()) : 'blue.500' })`)

    // The arm positions need the same recursion the operand positions do, or an arm that
    // is itself a guess passes for a resolved one.
    expect(fold(code).code).toContain(`g ? 'red.300' : fn()`)
    expect(fold(code).code).not.toContain('c_red.300')
    expect(fold(code).code).toContain('cx("m_2"')
  })

  test('an operand box is not read as the value at this call site', () => {
    const { fold } = createFoldFixture()

    // The box says the declaration was an object; it says nothing about what the operand
    // holds here. A default binding can be overridden and a `let` reassigned, and either
    // way the box is unchanged while the value is nullish.
    const bound = src(
      `export const f = ({ o = { color: 'red.300' } }) => css({ padding: '2', _hover: o || { color: 'blue.500' } })`,
    )
    expect(fold(bound).code).toContain('o || {')
    expect(fold(bound).code).toContain('cx("p_2"')

    const reassigned = src(
      `let m = ['1', '2']\nm = undefined\nexport const f = () => css({ padding: '2', margin: m || '2' })`,
    )
    expect(fold(reassigned).code).toContain(`m || '2'`)
    expect(fold(reassigned).code).toContain('cx("p_2"')

    // A *literal* reached through a name has the same problem, so the line is not
    // literal-versus-object — it is written-here versus named.
    const literal = src(`let m = '1'\nm = undefined\nexport const f = () => css({ padding: '2', margin: m || '2' })`)
    expect(fold(literal).code).toContain(`m || '2'`)

    const defaulted = src(`export const f = ({ c = 'red.300' }) => css({ padding: '2', color: c || 'blue.500' })`)
    expect(fold(defaulted).code).toContain(`c || 'blue.500'`)
    expect(fold(reassigned).code).toContain('cx("p_2"')
  })

  test('a left that decides the result does not wait on the right', () => {
    const { fold } = createFoldFixture()

    // `||` and `??` answer with the left, so once the left wins the right is dead code and
    // whether it resolves is irrelevant. `&&` is the mirror: a falsy left is the result.
    const cases: Array<[string, string]> = [
      [`'red.300' || fn()`, 'c_red.300'],
      [`false && fn()`, 'c_false'],
      // A left that is a nested choice staying conditional is neither literal nor object,
      // and the outer literal still decides it.
      [`'red.300' || ((e ? '1' : '2') || 'green.400')`, 'c_red.300'],
    ]

    for (const [value, expected] of cases) {
      const result = fold(src(`export const f = (e) => css({ padding: '2', color: ${value} })`))
      expect(result.code, value).toContain(`"p_2 ${expected}"`)
    }
  })

  test('a wrapped arm is still resolved', () => {
    const { fold } = createFoldFixture()

    // The extractor unwraps before boxing, so re-boxing has to as well. Reading these as
    // unresolvable declines folds that were never in doubt — `as const` on a style value
    // is ordinary TypeScript.
    const arms = [`('red.300')`, `'red.300' as const`, `('red.300' satisfies string)`]

    for (const arm of arms) {
      const code = src(`const on = true\nexport const f = () => css({ margin: '2', color: on ? ${arm} : 'blue.500' })`)
      expect(fold(code).code, arm).toContain(`export const f = () => "m_2 c_red.300"`)
    }

    const wrappedLeft = src(`export const f = () => css({ margin: '2', color: ('red.300') || 'blue.500' })`)
    expect(fold(wrappedLeft).code).toContain(`export const f = () => "m_2 c_red.300"`)
  })

  test('each short-circuit operator gets its own answer', () => {
    const { fold } = createFoldFixture()
    const prelude = `const named = 'red.300'`
    const call = (property: string, value: string) =>
      src(`${prelude}\nexport const f = () => css({ padding: '2', ${property}: ${value} })`)

    // These reach the operator rules rather than exiting early on an operand that did not
    // resolve, which is what makes the three rules distinguishable at all.
    const folds: Array<[string, string, string]> = [
      // `||` answers with the left, and a truthy left is what wins.
      ['color', `'red.300' || fn()`, 'c_red.300'],
      // `??` answers with a left that is merely non-nullish, which `||` would not: this
      // is the pair that separates the two rules.
      ['margin', `0 ?? fn()`, 'm_0'],
      // An object or array written here is truthy, so `||` yields it.
      ['margin', `['1', '2'] || '2'`, 'm_1 sm:m_2'],
      ['_hover', `{ color: 'red.300' } || { color: 'blue.500' }`, 'hover:c_red.300'],
      // `&&` with a falsy left yields the left, so the right never has to resolve.
      ['color', `false && fn()`, 'c_false'],
    ]

    for (const [property, value, expected] of folds) {
      expect(fold(call(property, value)).code, value).toContain(`"p_2 ${expected}"`)
    }

    // `||` answers with the left only when it is truthy, `??` only when it is not nullish.
    for (const [property, value] of [
      ['color', `null ?? 'blue.500'`],
      ['color', `'' || fn()`],
      // A named left records its declaration, not what the operand holds here — a `let`
      // can be reassigned and a parameter default overridden, and the box sees neither.
      ['color', `named || 'blue.500'`],
    ] as const) {
      const result = fold(call(property, value))

      expect(result.code, value).toContain(value)
      expect(result.code, value).toContain('cx("p_2"')
    }
  })

  test('an operand that did not resolve declines whatever the operator', () => {
    const { fold } = createFoldFixture()

    for (const value of [
      // Left unevaluatable: whichever side wins is unknown.
      `fn() || 'blue.500'`,
      `fn() && 'blue.500'`,
      `fn() ?? 'blue.500'`,
      // Right unevaluatable, and `&&` with a truthy left yields the *right*. The extractor
      // answers with the left, which is the one value it cannot be.
      `on && fn()`,
    ]) {
      const code = src(`const on = 'red.300'\nexport const f = () => css({ padding: '2', color: ${value} })`)

      expect(fold(code).code, value).toContain(value)
      expect(fold(code).code, value).toContain('cx("p_2"')
    }
  })

  test('a choice with two resolvable arms is still folded', () => {
    const { fold } = createFoldFixture()

    // Nothing is guessed at when both arms evaluate: the extractor either decided the
    // choice or the arms agreed. Declining these would trade real folds for no safety.
    const named = fold(
      src(
        `const on = true\nconst c = 'red.300'\nexport const f = () => css({ margin: '2', color: on ? c : 'blue.500' })`,
      ),
    )
    expect(named.code).toContain(`export const f = () => "m_2 c_red.300"`)

    const compared = fold(
      src(
        `const mode = 'dark'\nexport const f = () => css({ margin: '2', color: mode === 'light' ? 'red.300' : 'blue.500' })`,
      ),
    )
    expect(compared.code).toContain(`export const f = () => "m_2 c_blue.500"`)

    const same = fold(src(`export const f = (e) => css({ margin: '2', color: e ? 'red.300' : 'red.300' })`))
    expect(same.code).toContain(`export const f = (e) => "m_2 c_red.300"`)
  })

  test('an object reached by name is checked where it was written', () => {
    const { fold } = createFoldFixture()

    // `base` accounts for its box trivially — it is an identifier, not a literal — so the
    // spread inside the declaration is invisible unless the box's own node is followed.
    const spread = fold(
      src(`const base = { color: 'red.300', ...o }\nexport const f = (p) => css({ _hover: base, padding: p })`),
    )
    expect(spread.code).toContain('_hover: base')
    expect(spread.code).not.toContain('hover:c_red.300')

    // Including through a shorthand, where the name is the whole property.
    const shorthand = fold(src(`const _hover = { color: 'red.300', ...o }\nexport const f = () => css({ _hover })`))
    expect(shorthand.code).toContain('css({ _hover })')
    expect(shorthand.code).not.toContain('hover:c_red.300')

    // And as a ternary arm.
    const arm = fold(
      src(
        `const warm = { color: 'red.300', ...o }\nexport const f = (e, p) => css({ margin: '2', padding: p, _hover: e ? warm : { color: 'blue.500' } })`,
      ),
    )
    // The sibling still folds, so a file that folded nothing would not pass this.
    expect(arm.code).toContain('cx(')
    expect(arm.code).toContain('e ? warm :')
    expect(arm.code).not.toContain('hover:c_red.300')
  })

  test('an object reached by name still folds when nothing is hidden in it', () => {
    const { fold } = createFoldFixture()

    expect(
      fold(src(`const base = { color: 'red.300' }\nexport const f = (p) => css({ _hover: base, padding: p })`)).code,
    ).toContain('cx("hover:c_red.300", css({ padding: p }))')

    // Shorthands too, or the fix above would have closed the hole by declining everything.
    expect(
      fold(src(`const _hover = { color: 'red.300' }\nexport const f = (p) => css({ _hover, padding: p })`)).code,
    ).toContain('cx("hover:c_red.300", css({ padding: p }))')
  })
})
