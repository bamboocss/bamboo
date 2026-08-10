import { createContext } from '@bamboocss/fixture'
import { describe, expect, test } from 'vitest'

/**
 * A declared `@position-try` name becomes a value the properties that take one accept.
 *
 * The same trade `globalFontface` makes for `fontFamily`, and the reason to prefer either over
 * writing the at-rule into `globalCss`: both spellings emit the rule, only this one leaves the
 * name known to the generated types.
 */
const typesFor = (config: object, property: string) => {
  const types = createContext(config as never).utility.getTypes()
  const map = types instanceof Map ? types : new Map(Object.entries(types as object))

  return [...(map.get(property) ?? [])]
}

const config = { globalPositionTry: { flip: { top: 'auto' }, '--slide': { left: 'auto' } } }

describe('globalPositionTry registers its names', () => {
  /** Dashed, because that is what the property takes — `position-try-fallbacks: flip` is invalid. */
  test.each(['positionTryFallbacks', 'positionTry'])('%s accepts the declared idents', (property) => {
    expect(typesFor(config, property)).toEqual(['"--flip"', '"--slide"'])
  })

  /** It takes keywords rather than a name, so a registration here would be wrong. */
  test('positionTryOrder is left alone', () => {
    expect(typesFor(config, 'positionTryOrder')).toEqual([])
  })

  test('registers nothing when none are declared', () => {
    expect(typesFor({}, 'positionTryFallbacks')).toEqual([])
  })

  /**
   * The rule still ships when written by hand — this is only about the name being known, which
   * is the whole reason the docs point at `globalPositionTry` instead.
   */
  test('a raw @position-try in globalCss registers nothing', () => {
    const raw = { globalCss: { '@position-try --flip': { top: 'auto' } } }

    expect(typesFor(raw, 'positionTryFallbacks')).toEqual([])
  })
})
