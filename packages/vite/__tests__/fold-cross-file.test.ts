import { describe, expect, test } from 'vitest'
import { createFoldFixture, selectorsFor } from './fixture'

/**
 * Bamboo's extractor already resolves values across files and through pure local
 * helpers — see `packages/parser/__tests__/cross-file.test.ts` and the compiled-JSX
 * cases in `packages/parser/__tests__/jsx.test.ts`.
 *
 * These pin down what the *fold* does with that, which is a separate question. The
 * fold has its own admission rules on top of extraction, so a shape can be fully
 * extracted (and produce CSS) while still being declined for rewriting. Both outcomes
 * are correct; what matters is that they are deliberate rather than incidental.
 */

describe('cross-file composition', () => {
  test('an imported css.raw value folds as a multi-argument call', () => {
    const { fold, addFiles, getCss } = createFoldFixture()

    addFiles({
      'app/styles.ts': `import { css } from 'styled-system/css'
export const button = css.raw({ display: 'inline-flex', padding: '4' })
`,
    })

    const result = fold(
      `import { css } from 'styled-system/css'
import { button } from './styles'
export const cls = css(button, { background: 'blue.500' })
`,
      'app/button.tsx',
    )

    expect(result.folded).toHaveLength(1)

    // The imported half must survive into the folded string, not be dropped.
    const className = result.folded[0]!.className
    expect(className).toContain('d_inline-flex')
    expect(className).toContain('p_4')
    expect(className).toContain('bg_blue.500')

    const css = getCss()
    for (const selector of selectorsFor(className)) expect(css).toContain(selector)
  })

  test('a plain exported object folds', () => {
    const { fold, addFiles } = createFoldFixture()

    addFiles({ 'app/tokens.ts': `export const base = { display: 'inline-flex', padding: '4' }\n` })

    const result = fold(
      `import { css } from 'styled-system/css'
import { base } from './tokens'
export const cls = css(base, { background: 'blue.500' })
`,
      'app/use.tsx',
    )

    expect(result.folded).toHaveLength(1)
    expect(result.folded[0]!.className).toContain('d_inline-flex')
  })

  test('an imported value spread inside a nested selector is extracted but not folded', () => {
    const { fold, addFiles, getCss } = createFoldFixture()

    addFiles({
      'app/icon.ts': `import { css } from 'styled-system/css'
export const icon = css.raw({ flexShrink: '0' })
`,
    })

    const code = `import { css } from 'styled-system/css'
import { icon } from './icon'
export const cls = css({ '& svg': { ...icon, color: 'red.300' } })
`

    const result = fold(code, 'app/comp.tsx')

    // Extraction handles this — the CSS is emitted either way.
    expect(getCss()).toContain('flex-shrink')

    // The fold declines it, because the spread rule cannot tell a resolved spread
    // from a skipped one. Safe, and the call keeps its runtime path.
    expect(result.folded).toHaveLength(0)
    expect(result.code).toBe(code)
    expect(result.skipped.map((s) => s.reason)).toContain('dynamic')
  })
})

/**
 * Spreads, which used to be declined as a class rather than judged one at a time.
 *
 * The rule was "an inline object literal, or nothing", because a spread the extractor
 * flattened and one it silently skipped were indistinguishable in the result — both simply
 * contribute keys, or fail to. The extractor now records the spreads it walked
 * structurally, so the two can be told apart, and only the second has to decline.
 *
 * The recorded list is of *successes*, deliberately: absence means decline. A list of
 * failures answers "may I trust this" only while it is exhaustive, and the cost of an
 * omission there is a wrong fold rather than a missed one.
 */
describe('spreads', () => {
  test('a spread of a static local object folds', () => {
    const { fold, getCss } = createFoldFixture()

    const result = fold(`
      import { css } from 'styled-system/css'
      const known = { padding: '4' }
      export const cls = css({ color: 'red.300', ...known })
    `)

    expect(result.folded).toHaveLength(1)
    expect(result.folded[0]!.className).toBe('c_red.300 p_4')

    const css = getCss()
    for (const selector of selectorsFor(result.folded[0]!.className)) expect(css).toContain(selector)
  })

  test('a spread overrides what it lands on, in source order', () => {
    const { fold } = createFoldFixture()

    const result = fold(`
      import { css } from 'styled-system/css'
      const override = { color: 'blue.500' }
      export const cls = css({ color: 'red.300', ...override })
    `)

    // The later spread wins, exactly as the runtime merge would have it.
    expect(result.folded[0]!.className).toBe('c_blue.500')
  })

  test('a spread from another module folds and reports that module', () => {
    const { fold, addFiles } = createFoldFixture()

    addFiles({ 'app/styles.ts': `export const shared = { padding: '4' }\n` })

    const result = fold(
      `import { css } from 'styled-system/css'
import { shared } from './styles'
export const cls = css({ color: 'red.300', ...shared })
`,
      'app/use.tsx',
    )

    expect(result.folded[0]!.className).toBe('c_red.300 p_4')

    // The literal now depends on a file this module only imports. Without the edge, editing
    // it would leave the old class behind — which is the whole reason the fold reports
    // dependencies at all.
    expect(result.dependencies).toContain('/app/styles.ts')
  })

  test.each([
    ['a spread of a runtime value', `export const make = (rest) => css({ color: 'red.300', ...rest })`],
    [
      'a conditional spread',
      `export const make = (f) => css({ color: 'red.300', ...(f ? { margin: '2' } : { margin: '4' }) })`,
    ],
    ['a spread inside a condition block', `export const make = (r) => css({ _hover: { color: 'red.300', ...r } })`],
  ])('%s declines', (_name, body) => {
    const { fold } = createFoldFixture()
    const code = `
      import { css } from 'styled-system/css'
      ${body}
    `

    const result = fold(code)

    expect(result.folded).toHaveLength(0)
    expect(result.code).toBe(code)
  })

  /**
   * A spread the extractor *walked* is not a spread it accounted for.
   *
   * It builds a map whenever it walked the object literal, however many of that object's
   * properties it silently dropped along the way — and once they are flattened into the
   * result, what was dropped is unrecoverable. So the spread object gets the same audit the
   * literal being folded gets, rather than being waved through for having been walked.
   *
   * Every case here folds — wrongly, and silently — if that recursion is removed. They are
   * the ones the simpler "is it on the list" check got wrong.
   */
  test.each([
    [
      'a nested unresolvable spread',
      `export const make = (r) => { const g = { padding: '4', ...r }; return css({ color: 'red.300', ...g }) }`,
    ],
    [
      'a dynamic computed key',
      `export const make = (k) => { const g = { padding: '4', [k]: '2' }; return css({ color: 'red.300', ...g }) }`,
    ],
    [
      'a getter that branches',
      `export const make = (x) => { const g = { padding: '4', get mm() { if (x) return '1'; return '2' } }; return css({ color: 'red.300', ...g }) }`,
    ],
    [
      'a method',
      `export const make = (p) => { const g = { padding: '4', mm() { return p } }; return css({ color: 'red.300', ...g }) }`,
    ],
    [
      'an unresolvable spread inside a condition block of the spread object',
      `export const make = (r) => { const g = { padding: '4', _hover: { color: 'blue.500', ...r } }; return css({ color: 'red.300', ...g }) }`,
    ],
  ])('a spread carrying %s declines', (_name, body) => {
    const { fold } = createFoldFixture()
    const code = `
      import { css } from 'styled-system/css'
      ${body}
    `

    const result = fold(code)

    expect(result.folded).toHaveLength(0)
    expect(result.code).toBe(code)
  })

  test('a statically resolvable computed key inside a spread still folds', () => {
    const { fold } = createFoldFixture()

    const result = fold(`
      import { css } from 'styled-system/css'
      const K = 'padding'
      export const cls = css({ color: 'red.300', ...{ [K]: '4' } })
    `)

    // The audit is about what could not be resolved, not about the syntax used to write it.
    expect(result.folded[0]!.className).toBe('c_red.300 p_4')
  })
})

describe('pure local helpers', () => {
  test('a pure arrow-function helper call folds', () => {
    const { fold } = createFoldFixture()

    const result = fold(`
      import { css } from 'styled-system/css'
      const pad = (n) => ({ padding: n })
      export const cls = css(pad('4'))
    `)

    expect(result.folded).toHaveLength(1)
    expect(result.folded[0]!.className).toBe('p_4')
  })

  test('an IIFE argument folds', () => {
    const { fold } = createFoldFixture()

    const result = fold(`
      import { css } from 'styled-system/css'
      export const cls = css((() => ({ padding: '4' }))())
    `)

    expect(result.folded).toHaveLength(1)
    expect(result.folded[0]!.className).toBe('p_4')
  })

  test('a helper reading a runtime argument does not fold', () => {
    const { fold } = createFoldFixture()

    const code = `
      import { css } from 'styled-system/css'
      const pad = (n) => ({ padding: n })
      export const make = (n) => css(pad(n))
    `

    const result = fold(code)

    expect(result.folded).toHaveLength(0)
    expect(result.code).toBe(code)
  })

  test.each([
    ['a function declaration', `function pad(n) { return { padding: n } }`, `css(pad('4'))`, 'p_4'],
    ['a default parameter', `const pad = (n = '4') => ({ padding: n })`, `css(pad())`, 'p_4'],
    [
      'a helper composed from another',
      `const pad = (n) => ({ padding: n })\nconst both = (n) => ({ ...pad(n), margin: n })`,
      `css(both('4'))`,
      'p_4 m_4',
    ],
  ])('%s folds', (_name, helper, call, expected) => {
    const { fold } = createFoldFixture()

    const result = fold(`
      import { css } from 'styled-system/css'
      ${helper}
      export const cls = ${call}
    `)

    expect(result.folded).toHaveLength(1)
    expect(result.folded[0]!.className).toBe(expected)
  })

  test('a helper returning conditions folds them too', () => {
    const { fold } = createFoldFixture()

    const result = fold(`
      import { css } from 'styled-system/css'
      const hover = (c) => ({ _hover: { color: c } })
      export const cls = css(hover('red.300'))
    `)

    expect(result.folded[0]!.className).toBe('hover:c_red.300')
  })
})

/**
 * Two shapes where inlining a helper is not equivalent to calling it. Both are pinned
 * because they are the edges of what "pure" is taken to mean here, and neither is
 * currently detected — a reader deciding whether to trust a helper needs to know which.
 */
describe('local helpers, where inlining is not calling', () => {
  test('a side effect in the helper body is dropped', () => {
    const { fold } = createFoldFixture()

    const result = fold(`
      import { css } from 'styled-system/css'
      let count = 0
      const pad = (n) => { count++; return { padding: n } }
      export const cls = css(pad('4'))
    `)

    // The class is right and the increment is gone: the call the fold removed was the
    // only thing performing it. A style helper that mutates is pathological, and telling
    // one apart needs real analysis of the body rather than of the value it returns — so
    // this is a known limitation rather than a case that declines.
    expect(result.folded[0]!.className).toBe('p_4')
    expect(result.code).not.toContain('pad(')
  })

  test('a reassigned binding resolves to its initializer, and the CSS agrees', () => {
    const { fold, getCss } = createFoldFixture()

    const result = fold(`
      import { css } from 'styled-system/css'
      let base = '4'
      const pad = () => ({ padding: base })
      base = '8'
      export const cls = css(pad())
    `)

    // At runtime this call returns `p_8`; the extractor reads the initializer and says
    // `p_4`. That is extraction's answer, not the fold's — and it is the answer the
    // stylesheet is written against, so folding to it is what makes the rendered element
    // match the CSS that exists. Left unfolded, the element asks for a rule nobody emitted.
    expect(result.folded[0]!.className).toBe('p_4')
    expect(getCss()).toContain('p_4')
    expect(getCss()).not.toContain('p_8')
  })
})

describe('compiled JSX output', () => {
  test('a css() call inside compiled jsx output folds', () => {
    const { fold } = createFoldFixture()

    const result = fold(
      `import { jsx as _jsx } from 'react/jsx-runtime'
import { css } from 'styled-system/css'
export const El = () => _jsx('div', { className: css({ color: 'red.300' }) })
`,
      'app/compiled.js',
    )

    expect(result.folded).toHaveLength(1)
    expect(result.code).toContain(`className: "c_red.300"`)
  })
})

describe('dependency reporting', () => {
  test('a cross-file fold reports the module it read from', () => {
    const { fold, addFiles } = createFoldFixture()

    addFiles({
      'app/styles.ts': `import { css } from 'styled-system/css'
export const button = css.raw({ display: 'inline-flex' })
`,
    })

    const result = fold(
      `import { css } from 'styled-system/css'
import { button } from './styles'
export const cls = css(button, { background: 'blue.500' })
`,
      'app/button.tsx',
    )

    expect(result.folded).toHaveLength(1)
    expect(result.dependencies.some((path) => path.endsWith('app/styles.ts'))).toBe(true)
  })

  test('a same-file fold reports no dependencies', () => {
    const { fold } = createFoldFixture()

    const result = fold(`
      import { css } from 'styled-system/css'
      export const cls = css({ color: 'red.300' })
    `)

    expect(result.folded).toHaveLength(1)
    expect(result.dependencies).toEqual([])
  })

  test('the module being folded never lists itself', () => {
    const { fold } = createFoldFixture()

    const result = fold(`
      import { css } from 'styled-system/css'
      const base = { padding: '4' }
      export const cls = css(base, { color: 'red.300' })
    `)

    expect(result.folded).toHaveLength(1)
    expect(result.dependencies).toEqual([])
  })

  test('nothing folded means nothing reported', () => {
    const { fold } = createFoldFixture()

    const result = fold(`
      import { css } from 'styled-system/css'
      export const f = (t) => css({ color: t })
    `)

    expect(result.dependencies).toEqual([])
  })
})
