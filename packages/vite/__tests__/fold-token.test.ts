import { createContext } from '@bamboocss/fixture'
import { describe, expect, test } from 'vitest'
import { foldSource } from '../src/fold'
import { createRuntimeCss } from '../src/runtime-css'
import { createFoldFixture, FILE_PATH } from './fixture'

/**
 * `token()` is the one fold that does not produce a class.
 *
 * It resolves to a CSS *value* — either a literal (`#fca5a5`) or a variable reference
 * (`var(--colors-primary)`), depending on whether the token is conditional. Which of the
 * two it picks is the whole risk: inlining a base colour where the runtime would have
 * emitted a variable produces source that looks right and stops responding to themes.
 */
describe('fold: token()', () => {
  test('a base token folds to its literal value', () => {
    const { fold } = createFoldFixture()
    const result = fold(`
      import { token } from 'styled-system/tokens'
      export const red = token('colors.red.300')
    `)

    expect(result.code).toContain('export const red = "#fca5a5"')
    expect(result.folded).toHaveLength(1)
    expect(result.folded[0]!.kind).toBe('value')
    expect(result.folded[0]!.value).toBe('#fca5a5')
  })

  test('a semantic token folds to its variable reference, not to either branch', () => {
    const { fold } = createFoldFixture()
    const result = fold(`
      import { token } from 'styled-system/tokens'
      export const brand = token('colors.primary')
    `)

    // `colors.primary` is `{ base: '{colors.red.500}', _dark: '{colors.red.400}' }`. Both
    // branch values would be wrong here: the token has to stay a variable so the cascade
    // keeps choosing between them.
    expect(result.folded).toHaveLength(1)
    expect(result.folded[0]!.value).toMatch(/^var\(--/)
    expect(result.code).not.toContain('#ef4444')
  })

  test('a token fold reports no class, so nothing looks for a rule behind it', () => {
    const { fold } = createFoldFixture()
    const result = fold(`
      import { token } from 'styled-system/tokens'
      export const red = token('colors.red.300')
    `)

    expect(result.folded[0]!.className).toBe('')
    expect(result.folded[0]!.classNames).toEqual([])
  })

  test('a resolving token drops an inert fallback', () => {
    const { fold } = createFoldFixture()
    const result = fold(`
      import { token } from 'styled-system/tokens'
      export const red = token('colors.red.300', 'rebeccapurple')
    `)

    expect(result.code).toContain('export const red = "#fca5a5"')
    expect(result.code).not.toContain('rebeccapurple')
  })

  test('an aliased import folds under the name the file gave it', () => {
    const { fold } = createFoldFixture()
    const result = fold(`
      import { token as t } from 'styled-system/tokens'
      export const red = t('colors.red.300')
    `)

    // Which binding the call reaches is `calleeRootName`'s question, and the import scan
    // has already answered it. Asking the *callee* to spell `token` as well would decline
    // every aliased import, which is a rename away from any project that has one.
    expect(result.code).toContain('export const red = "#fca5a5"')
    expect(result.folded).toHaveLength(1)
  })

  test('a namespace import folds', () => {
    const { fold } = createFoldFixture()
    const result = fold(`
      import * as tokens from 'styled-system/tokens'
      export const red = tokens.token('colors.red.300')
    `)

    expect(result.folded[0]?.value).toBe('#fca5a5')
  })

  test('a value containing quotes survives as a string literal', () => {
    const { fold } = createFoldFixture()
    const result = fold(`
      import { token } from 'styled-system/tokens'
      export const mono = token('fonts.mono')
    `)

    // The font stack quotes its multi-word families. Splicing it in unescaped would end
    // the string literal early and produce source that does not parse.
    const [call] = result.folded
    expect(call!.value).toContain('"Courier New"')
    expect(result.code).toContain(JSON.stringify(call!.value))

    const reparsed = createFoldFixture().fold(result.code)
    expect(reparsed.code).toBe(result.code)
  })
})

/**
 * Every shape that must come back untouched. A `token()` that folds when it should not is
 * worse than one that never folds: it bakes a value into source that the runtime would
 * have resolved differently, or never resolved at all.
 */
describe('fold: token() declines', () => {
  const cases: Array<{ name: string; reason: string; code: string }> = [
    {
      name: 'a path that is not a literal',
      reason: 'dynamic',
      code: `
        import { token } from 'styled-system/tokens'
        export const pick = (name) => token(name)
      `,
    },
    {
      // The dangerous shape, and the reason the path is required to be one *resolved*
      // literal rather than merely a string somewhere in `data`. A conditional argument
      // boxes every branch, so reading the first would pick one and delete the condition
      // that chose between them — a wrong value with nothing left to show it was wrong.
      name: 'a ternary path, where every branch is resolvable',
      reason: 'dynamic',
      code: `
        import { token } from 'styled-system/tokens'
        export const pick = (dark) => token(dark ? 'colors.red.300' : 'colors.red.400')
      `,
    },
    {
      name: 'a defaulted path, where the left side decides',
      reason: 'dynamic',
      code: `
        import { token } from 'styled-system/tokens'
        export const pick = (chosen) => token(chosen || 'colors.red.300')
      `,
    },
    {
      name: 'a guarded path, which is falsy when the guard fails',
      reason: 'dynamic',
      code: `
        import { token } from 'styled-system/tokens'
        export const pick = (flag) => token(flag && 'colors.red.300')
      `,
    },
    {
      name: 'a path naming no token, where the fallback decides',
      reason: 'unresolved-token',
      code: `
        import { token } from 'styled-system/tokens'
        export const nope = token('colors.does.not.exist', 'rebeccapurple')
      `,
    },
    {
      // `token(path, compute())` evaluates `compute()` before the call, so folding the
      // call away also deletes whatever that did.
      name: 'a fallback that could run something',
      reason: 'dynamic',
      code: `
        import { token } from 'styled-system/tokens'
        export const red = token('colors.red.300', compute())
      `,
    },
    {
      name: 'a fallback that reads a property',
      reason: 'dynamic',
      code: `
        import { token } from 'styled-system/tokens'
        export const red = token('colors.red.300', theme.fallback)
      `,
    },
    {
      name: 'a local binding shadowing the import',
      reason: 'not-imported',
      code: `
        import { token } from 'styled-system/tokens'
        export const make = (token) => token('colors.red.300')
      `,
    },
    {
      name: 'a same-named function from somewhere else',
      reason: 'not-imported',
      code: `
        import { token } from '@acme/design'
        export const red = token('colors.red.300')
      `,
    },
  ]

  for (const { name, reason, code } of cases) {
    test(name, () => {
      const { fold } = createFoldFixture()
      const result = fold(code)

      expect(result.code, name).toBe(code)
      expect(result.folded, name).toHaveLength(0)

      // `not-imported` for a foreign module is reached only when the parser recorded the
      // call at all; a module bamboo does not own may produce no entry to decline.
      if (result.skipped.length) {
        expect(
          result.skipped.map((entry) => entry.reason),
          name,
        ).toContain(reason)
      }
    })
  }

  test('token.var is left alone', () => {
    const { fold } = createFoldFixture()
    const code = `
      import { token } from 'styled-system/tokens'
      export const ref = token.var('colors.red.300')
    `
    const result = fold(code)

    // `token.var` returns the variable reference where `token` returns the resolved
    // value. Folding one as the other swaps a themeable reference for a fixed colour.
    expect(result.code).toBe(code)
    expect(result.folded).toHaveLength(0)
  })
})

/**
 * What the token fold costs a module that does not use it.
 *
 * The lookup table is every token in the project, so building it per module would price a
 * whole token table into the overwhelming majority of files that call `token()` zero
 * times. Counted rather than timed, deliberately: a wall-clock threshold fails on a busy
 * machine rather than on a regression, where a count of "how many times was the table
 * built" is exact and runs in CI.
 */
describe('fold: token() table construction', () => {
  /** Wrap `allTokens` so each build of the table is observable. */
  const countingContext = () => {
    const ctx = createContext()
    const real = ctx.tokens.allTokens
    let reads = 0

    Object.defineProperty(ctx.tokens, 'allTokens', {
      configurable: true,
      get() {
        reads++
        return real
      },
    })

    return { ctx, reads: () => reads }
  }

  const foldWith = (ctx: ReturnType<typeof createContext>, code: string, path: string) => {
    ctx.project.addSourceFile(path, code)
    const parserResult = ctx.project.parseSourceFile(path)
    if (!parserResult) return
    foldSource({ ctx, code, parserResult, filePath: path, runtimeCss: createRuntimeCss(ctx) })
  }

  test('a module with no token() call never builds the table', () => {
    const { ctx, reads } = countingContext()

    foldWith(
      ctx,
      `
        import { css } from 'styled-system/css'
        export const cls = css({ color: 'red.300', padding: '4' })
      `,
      FILE_PATH,
    )

    expect(reads()).toBe(0)
  })

  test('the table is built once and shared across modules', () => {
    const { ctx, reads } = countingContext()

    for (const index of [0, 1, 2]) {
      foldWith(
        ctx,
        `
          import { token } from 'styled-system/tokens'
          export const red${index} = token('colors.red.300')
        `,
        `app/src/tokens-${index}.tsx`,
      )
    }

    expect(reads()).toBe(1)
  })
})

describe('fold: token() alongside styles', () => {
  test('a token inside a css() argument is subsumed by the outer fold', () => {
    const { fold } = createFoldFixture()
    const result = fold(`
      import { css } from 'styled-system/css'
      import { token } from 'styled-system/tokens'
      export const cls = css({ color: token('colors.red.300') })
    `)

    // The extractor resolves `token()` while evaluating the style object, so the whole
    // `css()` call already collapses to a class. The token sits inside that span and is
    // declined as overlapping rather than rewritten underneath it — folding both would
    // mean two overwrites of the same range, which magic-string rejects outright.
    expect(result.folded).toHaveLength(1)
    expect(result.folded[0]!.kind).toBe('class')
    expect(result.skipped).toContainEqual(expect.objectContaining({ name: 'token', reason: 'overlapping' }))
  })

  test('a token outside the style pipeline folds on its own', () => {
    const { fold } = createFoldFixture()
    const result = fold(`
      import { css } from 'styled-system/css'
      import { token } from 'styled-system/tokens'
      export const cls = css({ color: 'red.300' })
      export const chart = { grid: token('colors.red.300') }
    `)

    // The case `token()` exists for: a design token needed somewhere bamboo emits no CSS
    // — an inline style, a canvas, a chart config. Nothing claims that span, so the call
    // collapses to the value on its own, alongside the class fold above it.
    const value = result.folded.find((entry) => entry.kind === 'value')
    expect(value?.value).toBe('#fca5a5')
    expect(result.code).toContain('{ grid: "#fca5a5" }')
    expect(result.folded.filter((entry) => entry.kind === 'class')).toHaveLength(1)
  })

  test('a token nested in a call that folds whole is left to the outer fold', () => {
    const { fold } = createFoldFixture()
    const result = fold(`
      import { css } from 'styled-system/css'
      import { token } from 'styled-system/tokens'
      export const cls = css({ color: 'red.300', background: token('colors.red.300') })
    `)

    // Whichever way the outer call resolves, the two rewrites must not both apply to
    // overlapping spans — magic-string rejects that outright.
    const overlaps = result.folded.some((a) => result.folded.some((b) => a !== b && a.start < b.end && b.start < a.end))
    expect(overlaps).toBe(false)
  })
})
