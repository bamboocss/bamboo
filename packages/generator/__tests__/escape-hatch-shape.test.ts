import { createGeneratorContext } from '@bamboocss/fixture'
import { describe, expect, test } from 'vitest'
import { generatePropTypes } from '../src/artifacts/types/prop-types'

/**
 * The shape of `WithEscapeHatch`, asserted structurally because its cost cannot be asserted
 * any other way.
 *
 * Type-checking cost is wall-clock, so it is excluded from CI for the same reason every other
 * benchmark here is — a threshold would fail on a busy runner rather than on a regression.
 * But this is a hot path with no coverage at all: `strictTokens` was measured at 4.89s against
 * 3.08s for the default over 4,000 call sites, and nothing in the repo would have noticed
 * either number moving.
 *
 * So this counts the work instead of timing it, the shape `memo.test.ts` uses. Both properties
 * below are the *cause* of that cost, they are deterministic, and each has a measured number
 * attached to what happens when it is lost.
 */
describe('WithEscapeHatch', () => {
  const propTypes = () => generatePropTypes(createGeneratorContext({}) as never)

  const withEscapeHatch = (source: string) =>
    source.slice(source.indexOf('export type WithEscapeHatch'), source.indexOf('export type OnlyKnown'))

  /**
   * A template literal distributes over a union in every placeholder, so one `${T}` against a
   * 258-token colour palette is 258 union members. `color` reached ~1,560 with two such forms,
   * of which `${T}${Important}` — four exact marks — was 1,036 on its own.
   *
   * One is the floor while the escape hatch describes a modifier at all. Two is the shape this
   * replaced; anything more has multiplied the token union again.
   */
  test('distributes the token union across at most one member', () => {
    const source = propTypes()
    const body = withEscapeHatch(source)

    const distributing = ['WithModifier<T>', 'WithImportant<T>', 'WithColorOpacityModifier<T>'].filter((name) =>
      body.includes(name),
    )

    expect(distributing).toEqual(['WithModifier<T>'])
  })

  /**
   * The landmine. `& { __modifier?: true }` is optional, nothing reads it, and nothing in the
   * repo would break if it went — except that it is what stops TypeScript attempting subtype
   * reduction across the union these expand into. Removing both brands measured **87.2s
   * against 6.8s** on the same 4,000-call-site fixture, a 12.8x regression, with the emitted
   * types otherwise identical and every test still passing.
   */
  test('every distributing form carries a brand', () => {
    const source = propTypes()

    for (const helper of ['WithModifier', 'WithImportant']) {
      const line = source.split('\n').find((l) => l.startsWith(`type ${helper}<T>`))

      expect(line, `${helper} is declared`).toBeDefined()
      expect(line, `${helper} keeps its brand — see the 12.8x note above`).toMatch(/&\s*\{\s*__\w+\?:\s*true\s*\}/)
    }
  })

  test('the modifier tail covers the forms the runtime accepts', () => {
    // `/` opens the colour opacity modifier; `!` and ` !` open the important mark, whose long
    // spelling `!important` is covered by the open tail after them. Losing one silently makes
    // a legitimate value a type error under `strictTokens`.
    const source = propTypes()
    const marker = source.split('\n').find((l) => l.startsWith('type Modifier'))

    expect(marker).toContain('"/"')
    expect(marker).toContain('"!"')
    expect(marker).toContain('" !"')
  })
})
