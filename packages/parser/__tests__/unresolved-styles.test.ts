import { describe, expect, test } from 'vitest'
import { parseAndExtract } from './fixture'

/**
 * Under `cssMode: 'grouped'` a class names the whole `css()` call, so a property the build
 * cannot resolve does not go missing on its own — it changes the class, and the element
 * renders with no styles at all. These are the shapes that do that, and each has to be
 * reported with somewhere to look.
 */
const unresolved = (code: string) => parseAndExtract(code, { cssMode: 'grouped' }).parserResult.unresolved

const withCss = (body: string) => `import { css } from "styled-system/css"\n${body}`

describe('unresolved styles under grouped', () => {
  test('a value the extractor cannot evaluate', () => {
    const found = unresolved(withCss(`function App(props) { return css({ fontSize: "xl", color: props.color }) }`))

    expect(found).toHaveLength(1)
    expect(found[0].prop).toBe('color')
    expect(found[0].line).toBeGreaterThan(0)
    expect(found[0].filePath).toContain('test.tsx')
  })

  // The common shape, and the one a box walk alone misses: `maybeBoxNode` returns nothing
  // for a call expression, the pair is never recorded, and the property leaves no trace.
  test('a call expression, whose key never reaches the box at all', () => {
    const found = unresolved(
      withCss(`declare const getColor: () => string\ncss({ fontSize: "xl", color: getColor() })`),
    )

    expect(found.map((entry) => entry.prop)).toContain('color')
  })

  test('an element access the extractor cannot follow', () => {
    const found = unresolved(
      withCss(`declare const theme: any\ndeclare const key: string\ncss({ padding: "2", color: theme.colors[key] })`),
    )

    expect(found.map((entry) => entry.prop)).toContain('color')
  })

  test('a template literal with an interpolation, which boxes as an undefined literal', () => {
    const found = unresolved(withCss(`declare const tone: string\ncss({ color: \`\${tone}.400\` })`))

    expect(found.map((entry) => entry.prop)).toContain('color')
  })

  // A ternary past the enumeration cap is emitted as per-property fragments, so the class
  // the runtime asks for was never named. The box tree cannot show this — every box in it
  // resolved — so `setCss` reports it from the combination count.
  test('a ternary past the combination cap is reported, with atomic rules to land on', () => {
    const result = parseAndExtract(
      withCss(`function App({a,b,c,d,e,f}) {
        return css({ color: a?"red":"blue", padding: b?"1":"2", margin: c?"1":"2",
                     gap: d?"1":"2", fontSize: e?"sm":"xl", lineHeight: f?"1":"2" })
      }`),
      { cssMode: 'grouped' },
    )

    expect(result.parserResult.unresolved).toHaveLength(1)
    expect(result.encoder.atomic.size).toBeGreaterThan(0)
  })

  // --- quiet where it should be ---

  // A ternary *within* the cap is not a loss: `setCss` enumerates the branches and emits a
  // complete group for each, so the runtime finds whichever one it evaluates to. Reporting
  // it claimed a working element would render unstyled, and pulled the call into the
  // atomic-duplication path, emitting rules nothing could ask for.
  test('a ternary within the cap is not reported and duplicates nothing', () => {
    const result = parseAndExtract(
      withCss(`declare const flag: boolean\ncss({ margin: "2", color: flag ? "red.300" : "green.300" })`),
      { cssMode: 'grouped' },
    )

    expect(result.parserResult.unresolved).toEqual([])
    expect(result.encoder.grouped.size).toBe(2)
    expect(result.encoder.atomic.size).toBe(0)
  })

  // Boxes identically to an interpolated template literal — a literal carrying `undefined` —
  // but is not a loss: the build and the runtime both drop it, and they agree.
  test('a written undefined is not reported', () => {
    const result = parseAndExtract(withCss(`css({ color: undefined, fontSize: "14px" })`), { cssMode: 'grouped' })

    expect(result.parserResult.unresolved).toEqual([])
    expect(result.encoder.atomic.size).toBe(0)
  })

  test('a fully static call reports nothing', () => {
    expect(unresolved(withCss(`css({ fontSize: "xl", color: "red" })`))).toEqual([])
  })

  test('a statically resolvable const reports nothing', () => {
    expect(unresolved(withCss(`const base = { fontSize: "xl" }\ncss({ ...base, color: "red" })`))).toEqual([])
  })

  test('a spread it cannot enumerate is declined rather than guessed at', () => {
    // The keys a spread contributes are not knowable from the source, so the count check
    // is skipped. A genuinely unresolvable *value* is still reported by the box walk.
    const found = unresolved(withCss(`declare const rest: any\ncss({ color: "red", ...rest })`))
    expect(found.every((entry) => entry.prop !== 'color')).toBe(true)
  })

  // The runtime falls back to naming declarations atomically when a group has no rule, and
  // that only helps if rules for those names exist. A grouped build emits none by default,
  // so an at-risk call has to contribute both.
  test('an at-risk call emits atomic rules as well as its group', () => {
    const result = parseAndExtract(
      withCss(`function App(props) { return css({ padding: "2", color: props.color }) }`),
      { cssMode: 'grouped' },
    )

    expect(result.encoder.grouped.size).toBe(1)
    // `padding: 2` is the half the build did resolve, so the fallback can land on it.
    expect(result.encoder.atomic.size).toBeGreaterThan(0)
    expect(result.css).toContain('p_2')
  })

  test('a fully resolvable call contributes no atomic duplication', () => {
    const result = parseAndExtract(withCss(`css({ padding: "2", color: "red" })`), { cssMode: 'grouped' })

    expect(result.encoder.grouped.size).toBe(1)
    // Nothing at risk, so nothing is duplicated — the cost is bounded by unresolvable
    // call sites rather than by the size of the stylesheet.
    expect(result.encoder.atomic.size).toBe(0)
  })

  test('atomic mode reports nothing, because it degrades per declaration', () => {
    const result = parseAndExtract(
      withCss(`function App(props) { return css({ fontSize: "xl", color: props.color }) }`),
      { cssMode: 'atomic' },
    )
    expect(result.parserResult.unresolved).toEqual([])
  })
})
