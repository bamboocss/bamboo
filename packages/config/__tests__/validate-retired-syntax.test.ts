import { describe, expect, test } from 'vitest'
import { validateConfig } from '../src/validate-config'

/**
 * A token value in the retired curly syntax fails the build.
 *
 * Left alone it is silent in the direction that matters least to notice and most to debug: the
 * text is emitted into the stylesheet as-is, and nothing downstream reports it. Every other
 * finding in `validateConfig` is an opinion about a config that still builds, which is why this
 * one throws rather than joining the warnings.
 */
const validate = (config: object) => () => validateConfig(config as never)

const curly = (value: unknown) => ({ theme: { tokens: { colors: { bg: { value } } } } })

describe('retired reference syntaxes', () => {
  test('throws for a token value', () => {
    expect(validate(curly('{colors.primary}'))).toThrow(/retired reference syntax/)
  })

  /** The edit for that token, not an example — the same shape `validate-removed` reports. */
  test('names the token and its replacement', () => {
    expect(validate(curly('{colors.primary}'))).toThrow(/theme\.tokens\.colors\.bg/)
    expect(validate(curly('{colors.primary}'))).toThrow(/token\(colors\.primary\)/)
  })

  test('throws for a semantic token, including inside a condition', () => {
    const config = { theme: { semanticTokens: { colors: { fg: { value: { base: '{colors.red.300}' } } } } } }

    expect(validate(config)).toThrow(/theme\.semanticTokens\.colors\.fg/)
  })

  /** `themes` is a top-level option rather than part of `theme`, and is walked separately. */
  test('throws for a theme variant', () => {
    const config = { theme: { variants: { dark: { tokens: { colors: { bg: { value: '{colors.black}' } } } } } } }

    expect(validate(config)).toThrow(/theme\.variants\.dark\.tokens\.colors\.bg/)
  })

  /**
   * `validation: 'off'` opts out of opinions about a config that will still build. This is not
   * one of those, so it runs ahead of the opt-out.
   */
  test('throws even under validation: off', () => {
    expect(validate({ ...curly('{colors.primary}'), validation: 'off' })).toThrow(/retired reference syntax/)
  })

  /** Collected rather than reported one at a time, so a config is fixed in one pass. */
  test('reports every occurrence at once', () => {
    const config = {
      theme: {
        tokens: { colors: { a: { value: '{colors.x}' }, b: { value: '{colors.y}' } } },
      },
    }

    expect(validate(config)).toThrow(/2 token value\(s\)/)
  })

  test('says nothing about the surviving syntax', () => {
    expect(validate(curly('token(colors.primary)'))).not.toThrow()
  })

  /** A brace that is not a reference — the shape a `content` string or json-ish value takes. */
  test('leaves a non-reference brace alone', () => {
    expect(validate(curly('"{ a: 1 }"'))).not.toThrow()
  })

  test('ignores a value that is not a string', () => {
    expect(validate(curly(400))).not.toThrow()
  })
})

describe('retired token(path, fallback) form', () => {
  test('throws, naming the replacement', () => {
    expect(validate(curly('token(colors.primary, red)'))).toThrow(/token\(colors\.primary\)/)
  })

  /** The surviving form is untouched, fallback or not. */
  test('says nothing about a plain reference', () => {
    expect(validate(curly('token(colors.primary)'))).not.toThrow()
  })
})
