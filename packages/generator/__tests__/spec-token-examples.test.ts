import { createContext } from '@bamboocss/fixture'
import { describe, expect, test } from 'vitest'
import { generateTokenTypes } from '../src/artifacts/types/token-types'
import { generateTokenExamples } from '../src/spec/token-examples'

/**
 * The spec must never advertise a call the generated `.d.ts` rejects.
 *
 * `token.value()` is typed to `LiteralToken`, so a virtual, conditional or negative token is a
 * type error there. The spec offers `tokenFunctionExamples` as copy-pasteable usage, and it
 * pushed `token.value(...)` for every token — recommending, for a semantic colour, precisely
 * the call that will not compile.
 *
 * The two rules live apart on purpose: `LiteralToken` reads the resolved value off the
 * dictionary view, and the spec has no view in scope, so it asks the token's own fields. This
 * is what stops them drifting.
 */
const literalTokens = (config?: Parameters<typeof createContext>[0]) => {
  const match = generateTokenTypes(createContext(config)).match(/export type LiteralToken = ([^\n]*)/)

  return new Set((match?.[1] ?? '').split('|').map((entry) => entry.trim().replace(/^"|"$/g, '')))
}

describe('token spec examples', () => {
  test.each([
    ['the default theme', undefined],
    [
      'a theme with a semantic token beside a plain one',
      {
        theme: {
          extend: {
            semanticTokens: { colors: { brand: { value: { base: '{colors.red.500}', _dark: '{colors.red.400}' } } } },
          },
        },
      },
    ],
  ])('never offers token.value() for a path LiteralToken rejects — %s', (_label, config) => {
    const ctx = createContext(config as never)
    const literals = literalTokens(config as never)

    const offered: string[] = []
    for (const token of ctx.tokens.allTokens) {
      for (const example of generateTokenExamples(token, ctx.tokens.view.get(token.name)).tokenFunctionExamples) {
        const path = example.match(/^token\.value\('(.*)'\)$/)?.[1]
        if (path !== undefined && !literals.has(path)) offered.push(`${token.name} → ${example}`)
      }
    }

    expect(offered).toEqual([])
  })

  /** The control: it still offers the literal example where one genuinely exists. */
  test('offers token.value() for a token that has a literal', () => {
    const ctx = createContext()
    const red = ctx.tokens.allTokens.find((token) => token.name === 'colors.red.300')!

    expect(generateTokenExamples(red, ctx.tokens.view.get(red.name)).tokenFunctionExamples).toContain(
      "token.value('colors.red.300')",
    )
  })
})
