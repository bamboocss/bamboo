import { createContext } from '@bamboocss/fixture'
import { describe, expect, test } from 'vitest'
import { generateIsValidProp } from '../src/artifacts/js/is-valid-prop'

/**
 * `generateIsValidProp` rewrites a prebuilt module by matching its text, so it is
 * coupled to whatever shape the bundler emits. Every one of those rewrites failed
 * silently once the bundler changed — the output still parsed, it just behaved
 * wrongly at render time — so assert each one landed.
 */
const propertiesOf = (js: string) => {
  const match = js.match(/const allCssProperties = "(.*?)"\.split/)
  expect(match).not.toBeNull()
  return match![1].split(',')
}

describe('generateIsValidProp', () => {
  test('injects the project properties rather than leaving the list empty', () => {
    const properties = propertiesOf(generateIsValidProp(createContext())!.js)

    expect(properties.length).toBeGreaterThan(1)
    // a shorthand: unrecognised properties render as raw HTML attributes
    expect(properties).toContain('mx')
    // a browser property, which the project list does not supply
    expect(properties).toContain('WebkitMaskClip')
  })

  test('emits the project and browser lists as one deduplicated list', () => {
    const properties = propertiesOf(generateIsValidProp(createContext())!.js)

    expect(properties).toEqual([...new Set(properties)])
    // the two lists are no longer concatenated at runtime
    expect(generateIsValidProp(createContext())!.js).not.toMatch(/concat\(userGenerated\)/)
  })

  test('strips the module own memo when importing the shared one', () => {
    const js = generateIsValidProp(createContext())!.js

    expect(js).toContain("import { memo } from '../helpers.mjs'")
    // leaving both is a duplicate declaration, i.e. a syntax error
    expect(js).not.toMatch(/function memo\(/)
    // the declaration that followed it must survive the removal
    expect(js).toMatch(/cssPropertySelectorRegex/)
  })

  test('drops the browser property list when style props are not used', () => {
    const js = generateIsValidProp(createContext({ jsxStyleProps: 'minimal' }))!.js

    expect(js).toContain('const allCssProperties = "css".split(",")')
  })
})
