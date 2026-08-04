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
