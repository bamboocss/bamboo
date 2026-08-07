import { createRuleProcessor } from '@bamboocss/fixture'
import { describe, expect, test } from 'vitest'

/**
 * `filter` and `backdrop-filter` are each built from nine variables, one per utility, and a
 * filter list is invalid *as a whole* if any function in it is. So a utility that emits
 * something which is not a filter function does not merely fail to apply — it takes every
 * other filter on the element down with it, including ones a different utility set.
 *
 * That is what `dropShadow` did: it passed its value straight through, so `filter` resolved
 * to `blur(4px) 0 1px 2px black` and the browser dropped the lot. Nothing caught it because
 * nothing ran these transforms — `effects.ts` sat at 10% statement coverage, with every
 * `transform` body among the untested part.
 *
 * So each one is checked here for the shape it contributes, rather than for a snapshot of the
 * whole rule: the invariant is "this is a filter function", and it is the invariant that has
 * to survive someone editing the values.
 */
type Styles = Parameters<ReturnType<typeof createRuleProcessor>['css']>[0]

const css = (styles: Styles) => createRuleProcessor().css(styles).toCss()

/** The declaration a utility writes, with whitespace normalized. */
const declaration = (styles: Styles, variable: string) => {
  const match = css(styles).match(new RegExp(`${variable}:\\s*([^;]+);`))
  return match?.[1]?.trim()
}

describe('filter utilities', () => {
  test.each([
    { fn: 'blur', input: { blur: '4px' }, variable: '--blur' },
    { fn: 'brightness', input: { brightness: '0.5' }, variable: '--brightness' },
    { fn: 'contrast', input: { contrast: '2' }, variable: '--contrast' },
    { fn: 'grayscale', input: { grayscale: '1' }, variable: '--grayscale' },
    { fn: 'hue-rotate', input: { hueRotate: '90deg' }, variable: '--hue-rotate' },
    { fn: 'invert', input: { invert: '1' }, variable: '--invert' },
    { fn: 'saturate', input: { saturate: '2' }, variable: '--saturate' },
    { fn: 'sepia', input: { sepia: '1' }, variable: '--sepia' },
    { fn: 'drop-shadow', input: { dropShadow: '0 1px 2px black' }, variable: '--drop-shadow' },
  ])('$fn contributes a $fn() function', ({ fn, input, variable }) => {
    const value = declaration(input, variable)
    expect(value, `${variable} was not emitted`).toBeDefined()
    expect(value!.startsWith(`${fn}(`), `${variable} is \`${value}\`, which is not a filter function`).toBe(true)
    expect(value!.endsWith(')')).toBe(true)
  })

  test.each([
    { fn: 'blur', input: { backdropBlur: '4px' }, variable: '--backdrop-blur' },
    { fn: 'brightness', input: { backdropBrightness: '0.5' }, variable: '--backdrop-brightness' },
    { fn: 'contrast', input: { backdropContrast: '2' }, variable: '--backdrop-contrast' },
    { fn: 'grayscale', input: { backdropGrayscale: '1' }, variable: '--backdrop-grayscale' },
    { fn: 'hue-rotate', input: { backdropHueRotate: '90deg' }, variable: '--backdrop-hue-rotate' },
    { fn: 'invert', input: { backdropInvert: '1' }, variable: '--backdrop-invert' },
    { fn: 'saturate', input: { backdropSaturate: '2' }, variable: '--backdrop-saturate' },
    { fn: 'sepia', input: { backdropSepia: '1' }, variable: '--backdrop-sepia' },
  ])('backdrop $fn contributes a $fn() function', ({ fn, input, variable }) => {
    const value = declaration(input, variable)
    expect(value, `${variable} was not emitted`).toBeDefined()
    expect(value!.startsWith(`${fn}(`), `${variable} is \`${value}\`, which is not a filter function`).toBe(true)
  })

  /**
   * The exception, and the reason it is stated rather than folded into the table above:
   * `backdrop-filter` takes a bare `<number>` for opacity, so this one must *not* be wrapped.
   */
  test('backdrop opacity contributes a bare number, not a function', () => {
    expect(declaration({ backdropOpacity: '0.5' }, '--backdrop-opacity')).toBe('0.5')
  })

  test('a token value resolves before it is wrapped', () => {
    // `blur` is the only filter here with a token category, so it is the only one that can
    // show the wrapper going on the outside of a resolved value rather than around the name.
    expect(declaration({ blur: 'sm' }, '--blur')).toBe('blur(var(--blurs-sm))')
  })

  test('every filter variable composes into one valid list', () => {
    // The composition the variables exist for. Each has to read as a filter function, because
    // one that does not invalidates the whole declaration rather than its own slot.
    const out = css({ filter: 'auto', blur: '4px', dropShadow: '0 1px 2px black', sepia: '1' })
    for (const variable of ['--blur', '--drop-shadow', '--sepia']) {
      const value = out.match(new RegExp(`${variable}:\\s*([^;]+);`))?.[1]?.trim()
      expect(value, `${variable} missing`).toBeDefined()
      expect(value).toMatch(/^[a-z-]+\(.*\)$/)
    }
  })
})
