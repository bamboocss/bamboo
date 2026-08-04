import { describe, expect, test } from 'vitest'
import { createFoldFixture } from './fixture'

/**
 * Everything the fold declines to touch must come back byte-identical.
 *
 * This is the half that matters most. A missed fold costs a few nanoseconds; a wrong
 * fold silently changes what the page renders. Each case here is a shape where the
 * call does not evaluate to a class string, or does not evaluate to a *knowable* one.
 */
const skipCases: Array<{ name: string; code: string; reason?: string }> = [
  {
    name: 'css.raw returns a style object, not a class string',
    reason: 'raw-call',
    code: `
      import { css } from 'styled-system/css'
      export const styles = css.raw({ color: 'red.300' })
    `,
  },
  {
    name: 'aliased css.raw',
    reason: 'raw-call',
    code: `
      import { css as xcss } from 'styled-system/css'
      export const styles = xcss.raw({ color: 'red.300' })
    `,
  },
  {
    name: 'cva returns a function',
    reason: 'not-foldable',
    code: `
      import { cva } from 'styled-system/css'
      export const button = cva({ base: { color: 'red.300' } })
    `,
  },
  {
    name: 'sva returns a function',
    reason: 'not-foldable',
    code: `
      import { sva } from 'styled-system/css'
      export const parts = sva({ slots: ['root'], base: { root: { color: 'red.300' } } })
    `,
  },
  {
    name: 'runtime variable value',
    reason: 'dynamic',
    code: `
      import { css } from 'styled-system/css'
      export const make = (tone) => css({ color: tone })
    `,
  },
  {
    name: 'spread of an unknown object',
    reason: 'dynamic',
    code: `
      import { css } from 'styled-system/css'
      export const make = (rest) => css({ color: 'red.300', ...rest })
    `,
  },
  {
    name: 'ternary value',
    reason: 'dynamic',
    code: `
      import { css } from 'styled-system/css'
      export const make = (on) => css({ color: on ? 'red.300' : 'blue.500' })
    `,
  },
  {
    name: 'partially dynamic multi-argument call',
    reason: 'dynamic',
    code: `
      import { css } from 'styled-system/css'
      export const make = (extra) => css({ color: 'red.300' }, extra)
    `,
  },
  {
    name: 'dynamic condition key',
    reason: 'dynamic',
    code: `
      import { css } from 'styled-system/css'
      export const make = (key) => css({ [key]: { color: 'red.300' } })
    `,
  },
  {
    name: 'value from a function call',
    reason: 'dynamic',
    code: `
      import { css } from 'styled-system/css'
      export const make = (n) => css({ padding: compute(n) })
    `,
  },
  {
    name: 'dynamic pattern props',
    reason: 'dynamic',
    code: `
      import { stack } from 'styled-system/patterns'
      export const make = (gap) => stack({ gap })
    `,
  },
]

describe('calls the fold declines', () => {
  test.each(skipCases)('$name — source is unchanged', ({ code }) => {
    const { fold } = createFoldFixture()
    const result = fold(code)

    expect(result.code).toBe(code)
    expect(result.folded).toHaveLength(0)
    expect(result.map).toBeNull()
  })

  test.each(skipCases.filter((c) => c.reason))('$name — reports reason "$reason"', ({ code, reason }) => {
    const { fold } = createFoldFixture()
    const result = fold(code)

    expect(result.skipped.map((s) => s.reason)).toContain(reason)
  })
})

describe('mixed modules', () => {
  test('a static call folds while a dynamic one beside it is left alone', () => {
    const { fold } = createFoldFixture()

    const code = `
      import { css } from 'styled-system/css'
      export const fixed = css({ color: 'red.300' })
      export const dynamic = (tone) => css({ color: tone })
    `

    const result = fold(code)

    expect(result.folded).toHaveLength(1)
    expect(result.code).toContain('export const fixed = "c_red.300"')
    expect(result.code).toContain('export const dynamic = (tone) => css({ color: tone })')
  })

  test('css.raw beside a foldable css() does not confuse the fold', () => {
    const { fold } = createFoldFixture()

    const code = `
      import { css } from 'styled-system/css'
      export const base = css.raw({ color: 'red.300' })
      export const cls = css({ display: 'flex' })
    `

    const result = fold(code)

    expect(result.folded).toHaveLength(1)
    expect(result.code).toContain(`css.raw({ color: 'red.300' })`)
    expect(result.code).toContain('export const cls = "d_flex"')
  })

  test('a folded call composed from css.raw keeps the raw call intact', () => {
    const { fold } = createFoldFixture()

    const code = `
      import { css } from 'styled-system/css'
      const base = css.raw({ color: 'red.300' })
      export const cls = css(base, { display: 'flex' })
    `

    const result = fold(code)

    // The raw definition must survive verbatim whether or not the consumer folded.
    expect(result.code).toContain(`const base = css.raw({ color: 'red.300' })`)
  })

  test('modules with no bamboo calls are returned untouched', () => {
    const { fold } = createFoldFixture()

    const code = `export const value = compute({ color: 'red.300' })\n`
    const result = fold(code)

    expect(result.code).toBe(code)
    expect(result.folded).toHaveLength(0)
  })
})

describe('nested calls', () => {
  test('a call nested inside another folded call is not double-written', () => {
    const { fold } = createFoldFixture()

    const code = `
      import { css } from 'styled-system/css'
      import { stack } from 'styled-system/patterns'
      export const cls = stack({ gap: '4', css: css({ color: 'red.300' }) })
    `

    // Whatever the fold decides here, it must not corrupt the output.
    const result = fold(code)

    expect(() => result.code).not.toThrow()
    expect(result.code).toBeTruthy()
    // No overlapping rewrite may produce a truncated or duplicated fragment.
    expect(result.code.split('export const cls').length).toBe(2)
  })
})

describe('config recipe calls', () => {
  test('a static recipe call folds to its class string', () => {
    const { fold } = createFoldFixture()
    const result = fold(`
      import { buttonStyle } from 'styled-system/recipes'
      export const cls = buttonStyle({ size: 'sm' })
    `)

    expect(result.folded).toHaveLength(1)
    expect(result.code).toContain('export const cls = "')
    expect(result.folded[0]!.className).toContain('buttonStyle--size_sm')
  })

  test('default variants are applied', () => {
    const { fold } = createFoldFixture()
    const withNone = fold(`
      import { buttonStyle } from 'styled-system/recipes'
      export const cls = buttonStyle({})
    `)

    // The base class is always present, and the defaults resolve without being passed.
    expect(withNone.folded[0]!.className).toContain('buttonStyle')
  })

  test('a dynamic variant does not fold', () => {
    const { fold } = createFoldFixture()
    const code = `
      import { buttonStyle } from 'styled-system/recipes'
      export const make = (s) => buttonStyle({ size: s })
    `

    expect(fold(code).folded).toHaveLength(0)
    expect(fold(code).code).toBe(code)
  })

  test('a slot recipe is left to the runtime', () => {
    const { fold } = createFoldFixture()
    const code = `
      import { checkbox } from 'styled-system/recipes'
      export const cls = checkbox({ size: 'sm' })
    `

    // A slot recipe resolves to one class per slot, not to a single string.
    expect(fold(code).folded).toHaveLength(0)
    expect(fold(code).skipped.map((s) => s.reason)).toContain('unsupported-kind')
  })

  test('a recipe.raw call is left alone', () => {
    const { fold } = createFoldFixture()
    const code = `
      import { buttonStyle } from 'styled-system/recipes'
      export const styles = buttonStyle.raw({ size: 'sm' })
    `

    expect(fold(code).folded).toHaveLength(0)
    expect(fold(code).skipped.map((s) => s.reason)).toContain('raw-call')
  })

  test('a recipe call does not block a css() fold in the same file', () => {
    const { fold } = createFoldFixture()

    const result = fold(`
      import { css } from 'styled-system/css'
      import { buttonStyle } from 'styled-system/recipes'
      export const a = buttonStyle({ size: 'sm' })
      export const b = css({ color: 'red.300' })
    `)

    expect(result.folded).toHaveLength(2)
    expect(result.code).toContain('export const b = "c_red.300"')
  })
})
