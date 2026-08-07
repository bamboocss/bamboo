import { describe, expect, test } from 'vitest'
import { sva } from '../styled-system/css/sva'

describe('sva', () => {
  const button = sva({
    slots: ['root', 'icon'],
    base: {
      root: { borderRadius: 'md', fontWeight: 'semibold', h: '10', px: '4' },
      icon: { fontSize: '2xl' },
    },
    variants: {
      visual: {
        solid: {
          root: {
            bg: { base: 'colorPalette.500', _dark: 'colorPalette.300' },
            color: { base: 'white', _dark: 'gray.800' },
          },
          icon: {
            color: 'white',
          },
        },
        outline: {
          root: {
            border: '1px solid',
            color: { base: 'colorPalette.600', _dark: 'colorPalette.200' },
            borderColor: 'currentColor',
          },
          icon: {
            border: '1px solid',
          },
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

    expect(result).toMatchInlineSnapshot(`
      {
        "icon": "sva_XfaJN__icon",
        "root": "sva_XfaJN__root sva_XfaJN__root--visual_unstyled",
      }
    `)
  })

  test('solid variant styles', () => {
    const result = button({ visual: 'solid' })

    expect(result).toMatchInlineSnapshot(
      `
      {
        "icon": "sva_XfaJN__icon",
        "root": "sva_XfaJN__root sva_XfaJN__root--visual_solid",
      }
    `,
    )
  })

  test('outline variant styles', () => {
    const result = button({ visual: 'outline' })

    expect(result).toMatchInlineSnapshot(
      `
      {
        "icon": "sva_XfaJN__icon",
        "root": "sva_XfaJN__root sva_XfaJN__root--visual_outline",
      }
    `,
    )
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
})
