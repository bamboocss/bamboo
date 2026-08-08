import { describe, expect, test } from 'vitest'
import { parseAndExtract } from './fixture'

/**
 * A property the build cannot resolve has no rule behind it, so the declaration is simply
 * absent from the element — no error, no warning, and the rest of the call still applies.
 *
 * Only the surprising half of that is reported. A spread or computed key looks static and
 * is not, which is worth interrupting for. A value the build could not evaluate is the
 * documented dynamic-styling shape, answered by `staticCss` and already covered by the
 * `no-dynamic-styling` lint rule — warning on every one of those would bury the first.
 */
const unresolved = (code: string) => parseAndExtract(code).parserResult.unresolved

const withCss = (body: string) => `import { css } from "styled-system/css"\n${body}`

describe('unresolved styles', () => {
  test('a spread the build cannot enumerate is reported', () => {
    const found = unresolved(withCss(`declare const rest: any\ncss({ color: "red", ...rest })`))

    expect(found).toHaveLength(1)
    expect(found[0].reason).toBe('unenumerable-keys')
    expect(found[0].line).toBeGreaterThan(0)
    expect(found[0].filePath).toContain('test.tsx')
  })

  test('a computed key is reported for the same reason', () => {
    const found = unresolved(withCss(`declare const key: string\ncss({ color: "red", [key]: "blue" })`))

    expect(found.map((entry) => entry.reason)).toContain('unenumerable-keys')
  })

  // --- quiet where it should be ---

  /**
   * The documented dynamic shape. It loses `color` and keeps `fontSize`, which is what the
   * `no-dynamic-styling` rule and `staticCss` are for — reporting it here would fire on
   * ordinary code and drown the spread case above.
   */
  test('a value the extractor cannot evaluate is not reported', () => {
    const result = parseAndExtract(
      withCss(`function App(props) { return css({ fontSize: "xl", color: props.color }) }`),
    )

    expect(result.parserResult.unresolved).toEqual([])
    // The half it did resolve still reaches the stylesheet.
    expect(result.css).toContain('fs_xl')
  })

  test('a written undefined is not reported', () => {
    const result = parseAndExtract(withCss(`css({ color: undefined, fontSize: "14px" })`))

    expect(result.parserResult.unresolved).toEqual([])
  })

  test('a fully static call reports nothing', () => {
    expect(unresolved(withCss(`css({ fontSize: "xl", color: "red" })`))).toEqual([])
  })

  test('a statically resolvable spread reports nothing', () => {
    expect(unresolved(withCss(`const base = { fontSize: "xl" }\ncss({ ...base, color: "red" })`))).toEqual([])
  })
})
