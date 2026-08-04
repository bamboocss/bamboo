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

  test('a ternary value is not folded to one of its branches', () => {
    const { fold } = createFoldFixture()
    const code = src(`export const f = (flag, p) => css({ color: flag ? 'red.300' : 'blue.500', padding: p })`)

    // The extracted data is a projection that already picked `whenTrue`, so classifying
    // on it alone silently discarded the other branch.
    expect(fold(code).folded).toHaveLength(0)
    expect(fold(code).code).toBe(code)
  })

  test('a ternary nested in a condition block is not folded', () => {
    const { fold } = createFoldFixture()
    const code = src(
      `export const f = (flag) => css({ margin: '2', _hover: { color: flag ? 'red.300' : 'blue.500' } })`,
    )

    expect(fold(code).folded).toHaveLength(0)
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

  test('a call whose data carries condition projections is not split', () => {
    const { fold } = createFoldFixture()
    const code = src(`export const f = (a, p) => css({ color: a ? 'red.300' : 'blue.500', padding: p })`)

    // `data[0]` is the first condition rather than the object as written, so the static
    // half would be drawn from a branch projection.
    expect(fold(code).folded).toHaveLength(0)
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
