import { describe, expect, test } from 'vitest'
import { createFoldFixture, selectorsFor } from './fixture'

/**
 * A fold is only safe if the string it substitutes is (a) what the runtime would have
 * returned and (b) backed by rules the build actually emits. (a) alone is not enough:
 * a class nobody styled is still a wrong answer.
 *
 * Every case below asserts both, because the two can drift independently — the
 * runtime and the stylesheet compute class names through different code, and the
 * cases here are chosen to be exactly the places that drift historically shows up:
 * whitespace handling, `!important`, escaping, and shorthand resolution.
 */
const cases: Array<{ name: string; styles: string }> = [
  { name: 'flat properties', styles: `{ color: 'red.300', display: 'flex' }` },
  { name: 'pseudo condition', styles: `{ color: 'red.300', _hover: { color: 'blue.500' } }` },
  { name: 'nested conditions', styles: `{ _hover: { _dark: { color: 'red.300' } } }` },
  { name: 'responsive object', styles: `{ fontSize: { base: 'sm', md: 'lg' } }` },
  { name: 'responsive object across three breakpoints', styles: `{ fontSize: { base: 'sm', md: 'md', lg: 'lg' } }` },
  { name: 'breakpoint key', styles: `{ md: { color: 'red.300' } }` },
  {
    name: 'conditional value map',
    styles: `{ color: { base: 'red.300', _hover: 'blue.500', _disabled: 'green.300' } }`,
  },
  { name: 'important shorthand', styles: `{ color: 'red.300!' }` },
  { name: 'important longhand', styles: `{ padding: '0 !important' }` },
  { name: 'multiline value', styles: '{ gridTemplateAreas: `"a b"\n"c d"` }' },
  { name: 'value with surrounding space', styles: `{ margin: '0 auto ' }` },
  { name: 'arbitrary value', styles: `{ width: 'calc(100% - 10px)' }` },
  { name: 'arbitrary value with double quote', styles: `{ color: '[var(--x, "red")]' }` },
  { name: 'arbitrary value with single quote', styles: `{ content: "'hello'" }` },
  { name: 'arbitrary value with backslash', styles: `{ content: "'\\\\2014'" }` },
  { name: 'arbitrary selector', styles: `{ '&[data-state=open]': { color: 'red.300' } }` },
  { name: 'child selector', styles: `{ '& > p': { color: 'red.300' } }` },
  { name: 'shorthand', styles: `{ mx: '4', py: '2' }` },
  { name: 'shorthand and longhand together', styles: `{ mx: '4', marginLeft: '2' }` },
  { name: 'longhand then shorthand', styles: `{ marginLeft: '2', mx: '4' }` },
  { name: 'numeric value', styles: `{ zIndex: 10, opacity: 0.4 }` },
  { name: 'negative value', styles: `{ marginTop: '-2' }` },
  { name: 'token reference', styles: `{ boxShadow: 'outline' }` },
  { name: 'empty-ish value', styles: `{ color: 'red.300', display: undefined }` },
]

describe('fold round-trip', () => {
  test.each(cases)('$name — folded string equals the runtime result', ({ styles }) => {
    const { fold, runtimeCss } = createFoldFixture()

    const result = fold(`
      import { css } from 'styled-system/css'
      export const cls = css(${styles})
    `)

    expect(result.folded).toHaveLength(1)

    // The fold computes its string from what the *extractor* recovered from source.
    // Comparing against the runtime applied to the style object as authored is
    // therefore a check on extraction fidelity: if the extractor dropped or mangled
    // a value, the two diverge here.
    expect(result.folded[0]!.className).toBe(runtimeCss(evalStyles(styles)))
  })

  test.each(cases)('$name — every folded class has a rule in the emitted CSS', ({ styles }) => {
    const { fold, getCss } = createFoldFixture()

    const result = fold(`
      import { css } from 'styled-system/css'
      export const cls = css(${styles})
    `)

    expect(result.folded).toHaveLength(1)

    const css = getCss()
    for (const selector of selectorsFor(result.folded[0]!.className)) {
      expect(css).toContain(selector)
    }
  })
})

describe('multi-argument ordering', () => {
  test('css(a, b) merges later-wins before hashing, not concatenating class lists', () => {
    const { fold, runtimeCss } = createFoldFixture()

    const result = fold(`
      import { css } from 'styled-system/css'
      export const cls = css({ color: 'red.300', padding: '2' }, { color: 'blue.500' })
    `)

    expect(result.folded).toHaveLength(1)

    const folded = result.folded[0]!.className
    expect(folded).toBe(runtimeCss({ color: 'red.300', padding: '2' }, { color: 'blue.500' }))

    // The losing value must not survive as a second class.
    expect(folded).toContain('c_blue.500')
    expect(folded).not.toContain('c_red.300')
  })

  test('conflicting shorthand and longhand resolve the same way the runtime resolves them', () => {
    const { fold, runtimeCss } = createFoldFixture()

    const result = fold(`
      import { css } from 'styled-system/css'
      export const cls = css({ marginLeft: '2' }, { ms: '4' })
    `)

    expect(result.folded[0]!.className).toBe(runtimeCss({ marginLeft: '2' }, { ms: '4' }))
  })

  test('three arguments still fold to a single merged class string', () => {
    const { fold, runtimeCss } = createFoldFixture()

    const result = fold(`
      import { css } from 'styled-system/css'
      export const cls = css({ color: 'red.300' }, { padding: '2' }, { color: 'green.300' })
    `)

    expect(result.folded[0]!.className).toBe(runtimeCss({ color: 'red.300' }, { padding: '2' }, { color: 'green.300' }))
  })

  test('array argument folds like the runtime flattens it', () => {
    const { fold, runtimeCss } = createFoldFixture()

    const result = fold(`
      import { css } from 'styled-system/css'
      export const cls = css([{ color: 'red.300' }, { padding: '2' }])
    `)

    expect(result.folded).toHaveLength(1)
    expect(result.folded[0]!.className).toBe(runtimeCss([{ color: 'red.300' }, { padding: '2' }] as never))
  })
})

describe('patterns', () => {
  test('a pattern call folds through its transform', () => {
    const { fold, ctx, runtimeCss } = createFoldFixture()

    const result = fold(`
      import { flex } from 'styled-system/patterns'
      export const cls = flex({ gap: '4', align: 'center' })
    `)

    expect(result.folded).toHaveLength(1)
    expect(result.folded[0]!.className).toBe(runtimeCss(ctx.patterns.transform('flex', { gap: '4', align: 'center' })))
  })

  test('pattern classes are backed by emitted CSS', () => {
    const { fold, getCss } = createFoldFixture()

    const result = fold(`
      import { flex } from 'styled-system/patterns'
      export const cls = flex({ gap: '4' })
    `)

    const css = getCss()
    for (const selector of selectorsFor(result.folded[0]!.className)) {
      expect(css).toContain(selector)
    }
  })
})

/**
 * Mirrors the style object in the source string above. Kept deliberately dumb — a
 * real evaluator here would just re-implement the extractor and stop being an
 * independent check.
 */
function evalStyles(source: string): Record<string, any> {
  // eslint-disable-next-line no-new-func
  return new Function(`return (${source})`)()
}
