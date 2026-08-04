import { describe, expect, test } from 'vitest'
import { createFoldFixture } from './fixture'

/**
 * Edge cases drawn from the equivalent upstream suite (Panda v2's
 * `crates/pandacss_project/tests/transform`), restricted to the surface this phase
 * actually folds. They exist because each one is a place where a naive splice is
 * wrong in a way the happy-path tests cannot show.
 */

describe('callee shapes', () => {
  test('an aliased css import folds', () => {
    const { fold } = createFoldFixture()

    const result = fold(`
      import { css as xcss } from 'styled-system/css'
      export const cls = xcss({ color: 'red.300' })
    `)

    expect(result.folded).toHaveLength(1)
    expect(result.code).toContain('export const cls = "c_red.300"')
  })

  test('a value containing the text ".raw" does not make a call look raw', () => {
    const { fold } = createFoldFixture()

    const result = fold(`
      import { css } from 'styled-system/css'
      export const cls = css({ content: "'.raw'" })
    `)

    // Classification must come from the callee, not from anything in the arguments.
    expect(result.folded).toHaveLength(1)
    expect(result.skipped.map((s) => s.reason)).not.toContain('raw-call')
  })

  test('a locally defined function named css is not folded', () => {
    const { fold } = createFoldFixture()

    const code = `
      const css = (styles) => JSON.stringify(styles)
      export const cls = css({ color: 'red.300' })
    `

    const result = fold(code)

    // The parser matches style calls by name and does not require an import, so it
    // reports this one. The fold must not act on it.
    expect(result.code).toBe(code)
    expect(result.folded).toHaveLength(0)
    expect(result.skipped.map((s) => s.reason)).toContain('not-imported')
  })

  test('a local binding shadowing the import inside a function is not folded', () => {
    const { fold } = createFoldFixture()

    const code = `
      import { css } from 'styled-system/css'
      export function render(css) {
        return css({ color: 'red.300' })
      }
    `

    const result = fold(code)

    expect(result.code).toBe(code)
    expect(result.skipped.map((s) => s.reason)).toContain('not-imported')
  })

  test('a block-scoped const shadowing the import is not folded', () => {
    const { fold } = createFoldFixture()

    const code = `
      import { css } from 'styled-system/css'
      export function render() {
        const css = (s) => JSON.stringify(s)
        return css({ color: 'red.300' })
      }
    `

    const result = fold(code)

    expect(result.code).toBe(code)
  })

  test('the same file still folds unshadowed calls', () => {
    const { fold } = createFoldFixture()

    const result = fold(`
      import { css } from 'styled-system/css'
      export const outer = css({ display: 'flex' })
      export function render(css) {
        return css({ color: 'red.300' })
      }
    `)

    expect(result.folded).toHaveLength(1)
    expect(result.code).toContain('export const outer = "d_flex"')
    expect(result.code).toContain(`return css({ color: 'red.300' })`)
  })
})

describe('syntactic positions', () => {
  const positions: Array<{ name: string; code: string; expect: string }> = [
    {
      name: 'concise arrow body',
      code: `export const make = () => css({ color: 'red.300' })`,
      expect: `() => "c_red.300"`,
    },
    {
      name: 'after return',
      code: `export function make() { return css({ color: 'red.300' }) }`,
      expect: `return "c_red.300"`,
    },
    {
      name: 'as a call argument',
      code: `export const cls = String(css({ color: 'red.300' }))`,
      expect: `String("c_red.300")`,
    },
    {
      name: 'as an object property value',
      code: `export const map = { a: css({ color: 'red.300' }) }`,
      expect: `{ a: "c_red.300" }`,
    },
    {
      name: 'in a template literal',
      code: 'export const cls = `prefix ${css({ color: "red.300" })}`',
      expect: '${"c_red.300"}',
    },
    {
      name: 'in an array',
      code: `export const all = [css({ color: 'red.300' }), 'other']`,
      expect: `["c_red.300", 'other']`,
    },
    {
      name: 'statement position without a semicolon',
      code: `css({ color: 'red.300' })\nexport const after = 1`,
      expect: `"c_red.300"`,
    },
  ]

  test.each(positions)('$name', ({ code, expect: expected }) => {
    const { fold } = createFoldFixture()

    const result = fold(`import { css } from 'styled-system/css'\n${code}\n`)

    expect(result.folded.length).toBeGreaterThan(0)
    expect(result.code).toContain(expected)
  })
})

describe('degenerate arguments', () => {
  test('css() with no arguments is left alone', () => {
    const { fold } = createFoldFixture()

    const code = `import { css } from 'styled-system/css'\nexport const cls = css()\n`
    const result = fold(code)

    expect(result.code).toBe(code)
  })

  test('css({}) does not produce a broken literal', () => {
    const { fold } = createFoldFixture()

    const code = `import { css } from 'styled-system/css'\nexport const cls = css({})\n`
    const result = fold(code)

    // Either left intact or folded to an empty string — never to nothing at all.
    if (result.folded.length) {
      expect(result.code).toContain('""')
    } else {
      expect(result.code).toBe(code)
    }
  })
})

describe('offsets', () => {
  test('multibyte characters before a call do not shift the splice', () => {
    const { fold } = createFoldFixture()

    const result = fold(`
      import { css } from 'styled-system/css'
      // 🐼 日本語 comment with astral plane characters 𝕏
      const label = '🎋 竹 emoji before the call'
      export const cls = css({ color: 'red.300' })
      export const tail = '🌿 after'
    `)

    expect(result.folded).toHaveLength(1)
    expect(result.code).toContain('export const cls = "c_red.300"')
    // Nothing either side may be clipped by an off-by-N offset.
    expect(result.code).toContain(`const label = '🎋 竹 emoji before the call'`)
    expect(result.code).toContain(`export const tail = '🌿 after'`)
  })

  test('a multibyte value inside the folded call survives', () => {
    const { fold } = createFoldFixture()

    const result = fold(`
      import { css } from 'styled-system/css'
      export const cls = css({ content: "'🐼'" })
      export const tail = 'after'
    `)

    expect(result.code).toContain(`export const tail = 'after'`)
  })
})

describe('merge depth', () => {
  test('multi-argument merge is deep, not shallow', () => {
    const { fold, runtimeCss } = createFoldFixture()

    const result = fold(`
      import { css } from 'styled-system/css'
      export const cls = css({ _hover: { color: 'red.300' } }, { _hover: { padding: '2' } })
    `)

    expect(result.folded).toHaveLength(1)

    const folded = result.folded[0]!.className
    expect(folded).toBe(runtimeCss({ _hover: { color: 'red.300' } }, { _hover: { padding: '2' } }))

    // A shallow merge would drop the first object's `color` entirely.
    expect(folded).toContain('hover:c_red.300')
    expect(folded).toContain('hover:p_2')
  })

  test('later-wins applies inside a nested condition', () => {
    const { fold, runtimeCss } = createFoldFixture()

    const result = fold(`
      import { css } from 'styled-system/css'
      export const cls = css({ _hover: { color: 'red.300' } }, { _hover: { color: 'blue.500' } })
    `)

    const folded = result.folded[0]!.className
    expect(folded).toBe(runtimeCss({ _hover: { color: 'red.300' } }, { _hover: { color: 'blue.500' } }))
    expect(folded).not.toContain('hover:c_red.300')
  })
})
