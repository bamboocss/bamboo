import { createRuleProcessor, createColorMixTransform } from '@bamboocss/fixture'
import type { Dict } from '@bamboocss/types'
import { describe, expect, test } from 'vitest'

describe('color-mix', () => {
  const api = createRuleProcessor({
    utilities: {
      background: {
        shorthand: 'bg',
        className: 'bg',
        values: 'colors',
        transform: createColorMixTransform('background'),
      },
      gradientFrom: {
        className: 'from',
        values: 'colors',
        transform: createColorMixTransform('--gradient-from'),
      },
      WebkitTextFillColor: {
        className: 'wktf-c',
        values: 'colors',
        transform: createColorMixTransform('WebkitTextFillColor'),
      },
    },
    theme: {
      extend: {
        tokens: {
          opacity: {
            half: { value: 0.5 },
          },
        },
      },
    },
  })

  const css = (styles: Dict) => {
    const result = api.clone().css(styles)
    return { className: result.getClassNames(), css: result.toCss() }
  }

  test('native CSS color', () => {
    expect(css({ bg: 'red/30' })).toMatchInlineSnapshot(`
      {
        "className": [
          "bg_red\\/30",
        ],
        "css": "@layer utilities {
        .bg_red\\/30 {
          --mix-background: color-mix(in srgb, red 30%, transparent);
          background: var(--mix-background, red);
      }
      }",
      }
    `)
  })

  test('native CSS color', () => {
    expect(css({ bg: 'red/30' })).toMatchInlineSnapshot(`
      {
        "className": [
          "bg_red\\/30",
        ],
        "css": "@layer utilities {
        .bg_red\\/30 {
          --mix-background: color-mix(in srgb, red 30%, transparent);
          background: var(--mix-background, red);
      }
      }",
      }
    `)
  })

  test('config token color', () => {
    expect(css({ bg: 'red.300/30' })).toMatchInlineSnapshot(`
      {
        "className": [
          "bg_red\\.300\\/30",
        ],
        "css": "@layer utilities {
        .bg_red\\.300\\/30 {
          --mix-background: color-mix(in srgb, var(--colors-red-300) 30%, transparent);
          background: var(--mix-background, var(--colors-red-300));
      }
      }",
      }
    `)
  })

  test('decimal opacity', () => {
    expect(css({ bg: 'red/0.33' })).toMatchInlineSnapshot(`
      {
        "className": [
          "bg_red\\/0\\.33",
        ],
        "css": "@layer utilities {
        .bg_red\\/0\\.33 {
          --mix-background: color-mix(in srgb, red 0.33%, transparent);
          background: var(--mix-background, red);
      }
      }",
      }
    `)
  })

  test('percent opacity', () => {
    expect(css({ bg: 'red/33' })).toMatchInlineSnapshot(`
      {
        "className": [
          "bg_red\\/33",
        ],
        "css": "@layer utilities {
        .bg_red\\/33 {
          --mix-background: color-mix(in srgb, red 33%, transparent);
          background: var(--mix-background, red);
      }
      }",
      }
    `)
  })

  test('inside var', () => {
    expect(css({ gradientFrom: 'red/33' })).toMatchInlineSnapshot(`
      {
        "className": [
          "from_red\\/33",
        ],
        "css": "@layer utilities {
        .from_red\\/33 {
          --mix---gradient-from: color-mix(in srgb, red 33%, transparent);
          --gradient-from: var(--mix---gradient-from, red);
      }
      }",
      }
    `)
  })

  test('in token fn', () => {
    expect(css({ bg: 'token(colors.pink.400/30)' })).toMatchInlineSnapshot(`
      {
        "className": [
          "bg_token\\(colors\\.pink\\.400\\/30\\)",
        ],
        "css": "@layer utilities {
        .bg_token\\(colors\\.pink\\.400\\/30\\) {
          background: color-mix(in srgb, var(--colors-pink-400) 30%, transparent);
      }
      }",
      }
    `)
  })

  /**
   * The retired curly spelling, which used to mean the same as the `token()` above.
   *
   * An error rather than a literal: left alone it is silent in both directions — the declaration
   * is dropped here, and a curly value in a *token* emits its text into the stylesheet. Neither
   * reports itself, and neither is valid css.
   *
   * Safe to throw on because the spelling was never available for anything else: until it was
   * removed, `{…}` in a value was consumed unconditionally, so no literal `{a.b}` could have
   * survived to mean itself.
   */
  test('a curly reference fails rather than emitting a literal', () => {
    expect(() => css({ color: '{colors.pink.400/30}' })).toThrow(/retired token reference syntax/)
  })

  test('the error names the replacement', () => {
    expect(() => css({ color: '1px solid {colors.red.300}' })).toThrow(/token\(colors\.red\.300\)/)
  })

  /** Braces that are not a reference are left alone — a `content` string, most obviously. */
  test('a brace that is not a reference still passes through', () => {
    expect(() => css({ content: '"{ a: 1 }"' })).not.toThrow()
  })

  // below are invalid cases

  test('wrong format', () => {
    expect(css({ bg: 'xx1x//30' })).toMatchInlineSnapshot(`
      {
        "className": [
          "bg_xx1x\\/\\/30",
        ],
        "css": "@layer utilities {
        .bg_xx1x\\/\\/30 {
          background: xx1x//30;
      }
      }",
      }
    `)
  })

  test('wrong opacity', () => {
    expect(css({ bg: 'red/abc' })).toMatchInlineSnapshot(`
      {
        "className": [
          "bg_red\\/abc",
        ],
        "css": "@layer utilities {
        .bg_red\\/abc {
          background: red/abc;
      }
      }",
      }
    `)
  })

  test('wrong number format', () => {
    expect(css({ bg: 'red/0,4' })).toMatchInlineSnapshot(`
      {
        "className": [
          "bg_red\\/0\\,4",
        ],
        "css": "@layer utilities {
        .bg_red\\/0\\,4 {
          background: red/0,4;
      }
      }",
      }
    `)
  })

  test('invalid number format', () => {
    expect(css({ bg: 'red/0..,4' })).toMatchInlineSnapshot(`
      {
        "className": [
          "bg_red\\/0\\.\\.\\,4",
        ],
        "css": "@layer utilities {
        .bg_red\\/0\\.\\.\\,4 {
          background: red/0..,4;
      }
      }",
      }
    `)
  })

  test('opacity token', () => {
    expect(css({ bg: 'red/half' })).toMatchInlineSnapshot(`
      {
        "className": [
          "bg_red\\/half",
        ],
        "css": "@layer utilities {
        .bg_red\\/half {
          --mix-background: color-mix(in srgb, red 50%, transparent);
          background: var(--mix-background, red);
      }
      }",
      }
    `)
  })

  test('WebkitTextFillColor with color token', () => {
    expect(css({ WebkitTextFillColor: 'red.300' })).toMatchInlineSnapshot(`
      {
        "className": [
          "wktf-c_red\\.300",
        ],
        "css": "@layer utilities {
        .wktf-c_red\\.300 {
          -webkit-text-fill-color: var(--colors-red-300);
      }
      }",
      }
    `)
  })
})
