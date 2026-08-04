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

  test('a compiled css *prop* is extracted but left to the runtime', () => {
    const { fold, getCss } = createFoldFixture()

    const code = `import { jsx as _jsx } from 'react/jsx-runtime'
import { Box } from 'styled-system/jsx'
export const El = () => _jsx(Box, { css: { color: 'red.300' } })
`

    const result = fold(code, 'app/compiled-prop.tsx')

    // JSX style props are a different surface from call sites; the fold does not
    // rewrite them in this phase, whether the JSX is compiled or not.
    expect(result.folded).toHaveLength(0)
    expect(result.code).toBe(code)

    // Extraction is unaffected — the styles still reach the stylesheet.
    expect(getCss()).toContain('--colors-red-300')
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
