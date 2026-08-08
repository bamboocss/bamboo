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
    // A bare `color: tone` lowers to the leaf helper now. A responsive array does not:
    // it expands to one class per breakpoint, which no single prefix describes.
    name: 'runtime variable in a responsive array',
    reason: 'dynamic',
    code: `
      import { css } from 'styled-system/css'
      export const make = (tone, other) => css({ color: [tone, other] })
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
    // A ternary between two resolvable values lowers to a ternary between two classes;
    // one unresolvable branch makes the choice infinite again. At the top level it would
    // still lower as a leaf, so this is nested, where neither mechanism applies.
    name: 'ternary with a dynamic branch inside a condition',
    reason: 'dynamic',
    code: `
      import { css } from 'styled-system/css'
      export const make = (on, tone) => css({ _hover: { color: on ? 'red.300' : tone } })
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
    name: 'value from a function call in a responsive array',
    reason: 'dynamic',
    code: `
      import { css } from 'styled-system/css'
      export const make = (n) => css({ padding: [compute(n), '2'] })
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
      export const dynamic = (tone, other) => css({ color: [tone, other] })
    `

    const result = fold(code)

    expect(result.folded).toHaveLength(1)
    expect(result.code).toContain('export const fixed = "c_red.300"')
    expect(result.code).toContain('export const dynamic = (tone, other) => css({ color: [tone, other] })')
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

/**
 * `const badge = cva(...)` then `badge({ tone })`.
 *
 * These calls were invisible before the parser tracked local bindings: matching happens on
 * the *imported* name, and a local binding has no import. So an invocation nothing could
 * fold looked exactly like an invocation nothing had parsed, and a build had no way to tell
 * them apart. They are reported here, not folded — resolving one means emitting a literal
 * for a static selection or a lookup for a dynamic one, which is its own change.
 */
describe('calls of an inline recipe', () => {
  const inline = (body: string) => `
      import { cva } from 'styled-system/css'
      const badge = cva({ base: { color: 'red.300' }, variants: { tone: { a: { color: 'blue.300' } } } })
      ${body}
    `

  test('a static call is reported, and the source is unchanged', () => {
    const { fold } = createFoldFixture()
    const code = inline(`export const cls = badge({ tone: 'a' })`)
    const result = fold(code)

    expect(result.code).toBe(code)
    expect(result.folded).toHaveLength(0)
    expect(result.skipped.map((s) => s.reason)).toContain('recipe-call')
  })

  test('a dynamic call is reported the same way', () => {
    const { fold } = createFoldFixture()
    const result = fold(inline(`export const make = (tone) => badge({ tone })`))

    expect(result.skipped.map((s) => s.reason)).toContain('recipe-call')
  })

  test('the definition and the call are reported separately', () => {
    const { fold } = createFoldFixture()
    const result = fold(inline(`export const cls = badge({ tone: 'a' })`))

    const reasons = result.skipped.map((s) => s.reason)
    expect(reasons).toContain('not-foldable') // the cva(...) definition
    expect(reasons).toContain('recipe-call') // the badge(...) invocation
  })

  /**
   * The parser registers an inline recipe for the whole file, so these two are the shapes
   * where the name at the call site is not the recipe at all. Cosmetic while this only
   * reports — but the report is the entire point of it, and a fold built on top would be
   * rewriting somebody else's function.
   */
  test('a nearer binding of the same name is not reported', () => {
    const { fold } = createFoldFixture()
    const result = fold(
      inline(`
      export function other() {
        const badge = (x) => x
        return badge({ tone: 'a' })
      }
    `),
    )

    expect(result.skipped.map((s) => s.reason)).not.toContain('recipe-call')
  })

  test('a reassignable binding is not registered at all', () => {
    const { fold } = createFoldFixture()
    const result = fold(`
      import { cva } from 'styled-system/css'
      let badge = cva({ base: { color: 'red.300' } })
      badge = (x) => x
      export const y = badge({ tone: 'a' })
    `)

    expect(result.skipped.map((s) => s.reason)).not.toContain('recipe-call')
  })

  test('a call nested in a function still reports, when nothing shadows it', () => {
    const { fold } = createFoldFixture()
    const result = fold(inline(`export function ok() { return badge({ tone: 'a' }) }`))

    expect(result.skipped.map((s) => s.reason)).toContain('recipe-call')
  })

  test('an inline recipe call does not block a css() fold beside it', () => {
    const { fold } = createFoldFixture()
    const result = fold(
      inline(`
      export const cls = badge({ tone: 'a' })
      export const b = css({ color: 'red.300' })
    `).replace(`import { cva }`, `import { css, cva }`),
    )

    expect(result.folded).toHaveLength(1)
    expect(result.code).toContain('export const b = "c_red.300"')
    expect(result.code).toContain(`badge({ tone: 'a' })`)
  })
})
