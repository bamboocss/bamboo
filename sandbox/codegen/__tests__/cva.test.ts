import { describe, expect, test } from 'vitest'
import { cva } from '../styled-system/css/cva'

describe('cva', () => {
  const button = cva({
    base: {
      borderRadius: 'md',
      fontWeight: 'semibold',
      h: '10',
      px: '4',
    },
    variants: {
      visual: {
        solid: {
          bg: { base: 'colorPalette.500', _dark: 'colorPalette.300' },
          color: { base: 'white', _dark: 'gray.800' },
        },
        outline: {
          border: '1px solid',
          color: { base: 'colorPalette.600', _dark: 'colorPalette.200' },
          borderColor: 'currentColor',
        },
        unstyled: {},
      },
    },
    defaultVariants: {
      visual: 'unstyled',
    },
  })

  test('base styles', () => {
    const result = button()

    expect(result).toMatchInlineSnapshot(`"cva_iwgVLg cva_iwgVLg--visual_unstyled"`)
  })

  test('solid variant styles', () => {
    const result = button({ visual: 'solid' })

    expect(result).toMatchInlineSnapshot(`"cva_iwgVLg cva_iwgVLg--visual_solid"`)
  })

  test('outline variant styles', () => {
    const result = button({ visual: 'outline' })

    expect(result).toMatchInlineSnapshot(`"cva_iwgVLg cva_iwgVLg--visual_outline"`)
  })

  test('split variant props', () => {
    const result = button.splitVariantProps({ visual: 'solid', bg: 'red.500' })

    expect(result).toMatchInlineSnapshot(`
      [
        {
          "visual": "solid",
        },
        {
          "bg": "red.500",
        },
      ]
    `)
  })

  test('get variant props', () => {
    const result = button.getVariantProps()

    expect(result).toMatchInlineSnapshot(`
      {
        "visual": "unstyled",
      }
    `)
  })

  test('raw returns an object the caller owns', () => {
    const first = button.raw({ visual: 'solid' })
    const second = button.raw({ visual: 'solid' })

    // `resolve` is memoized, so the two calls share one computation. They must not share the
    // object: mutating what `raw` handed back would otherwise poison every later call.
    expect(first).not.toBe(second)

    // Snapshotted before the mutation. Comparing against `second` directly would be vacuous
    // under a shallow copy, since `second.color` would be the very object being poisoned.
    const expected = structuredClone(second)

    first.fontWeight = 'poisoned'
    ;(first.color as Record<string, string>)._dark = 'poisoned'

    expect(button.raw({ visual: 'solid' })).toEqual(expected)
  })

  test('the copy reaches nested condition blocks', () => {
    // `resolve` ends in `mergeCss`, and `mergeProps` builds a fresh top level while assigning
    // nested objects by reference — so a condition block aliases straight into the `cva`
    // config. A shallow copy at the `raw` boundary would let this escape into every later
    // call, and into the class names built from it.
    const outline = button.raw({ visual: 'outline' })
    delete (outline.color as Record<string, unknown>)._dark

    expect(button.raw({ visual: 'outline' }).color).toEqual({
      base: 'colorPalette.600',
      _dark: 'colorPalette.200',
    })
  })
})
