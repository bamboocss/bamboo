import { createGeneratorContext } from '@bamboocss/fixture'
import { parseFallbackValue } from '@bamboocss/shared'
import type { Config, SystemStyleObject } from '@bamboocss/types'
import { describe, expect, test } from 'vitest'
import { createRuleProcessor } from './fixture'

const css = (styles: SystemStyleObject, config?: Config) => {
  return createRuleProcessor(config).css(styles).toCss()
}

describe('parseFallbackValue', () => {
  test('splits candidates, most-preferred first', () => {
    expect(parseFallbackValue('fallback(100dvh, 100vh)')).toEqual(['100dvh', '100vh'])
    expect(parseFallbackValue('fallback(-webkit-grab, grab, move)')).toEqual(['-webkit-grab', 'grab', 'move'])
  })

  test('ignores commas nested in parens and quotes', () => {
    expect(parseFallbackValue('fallback(calc(100dvh - 10px), calc(100vh - 10px))')).toEqual([
      'calc(100dvh - 10px)',
      'calc(100vh - 10px)',
    ])
    expect(parseFallbackValue('fallback(var(--a, var(--b, red)), blue)')).toEqual(['var(--a, var(--b, red))', 'blue'])
    expect(parseFallbackValue(`fallback("a, b", 'c, d')`)).toEqual([`"a, b"`, `'c, d'`])
  })

  test('tolerates surrounding and inner whitespace', () => {
    expect(parseFallbackValue('  fallback( 100dvh ,  100vh )  ')).toEqual(['100dvh', '100vh'])
  })

  test('a single candidate is still a fallback', () => {
    expect(parseFallbackValue('fallback(100dvh)')).toEqual(['100dvh'])
  })

  test('only a value that is entirely one call is a fallback', () => {
    expect(parseFallbackValue('100dvh')).toBeUndefined()
    expect(parseFallbackValue('1px solid fallback(red, blue)')).toBeUndefined()
    expect(parseFallbackValue('fallback(a), fallback(b)')).toBeUndefined()
    expect(parseFallbackValue('fallback(a')).toBeUndefined()
    expect(parseFallbackValue('calc(fallback(a, b))')).toBeUndefined()
    expect(parseFallbackValue('')).toBeUndefined()
    expect(parseFallbackValue(undefined)).toBeUndefined()
    expect(parseFallbackValue(42)).toBeUndefined()
  })

  test('does not split inside the arbitrary-value escape hatch', () => {
    expect(parseFallbackValue('fallback([color, background-color], all)')).toEqual(['[color, background-color]', 'all'])
    expect(parseFallbackValue('fallback([1fr, 2fr], repeat(2, 1fr))')).toEqual(['[1fr, 2fr]', 'repeat(2, 1fr)'])
  })

  test('rejects unbalanced brackets rather than splitting through them', () => {
    expect(parseFallbackValue('fallback([a, b)')).toBeUndefined()
    expect(parseFallbackValue('fallback(a], b)')).toBeUndefined()
  })

  test('handles escapes inside quoted candidates', () => {
    expect(parseFallbackValue(String.raw`fallback("a\"b, c", d)`)).toEqual([String.raw`"a\"b, c"`, 'd'])
    // A trailing escaped backslash leaves the quote closing, not escaped.
    expect(parseFallbackValue(String.raw`fallback("a\\", b)`)).toEqual([String.raw`"a\\"`, 'b'])
  })
})

describe('fallback values', () => {
  test('emits one declaration per candidate, least-preferred first', () => {
    expect(css({ height: 'fallback(calc(100dvh - 100px), calc(100vh - 100px))' })).toMatchInlineSnapshot(`
      "@layer utilities {
        .h_fallback\\(calc\\(100dvh_-_100px\\)\\,_calc\\(100vh_-_100px\\)\\) {
          height: calc(100vh - 100px);
          height: calc(100dvh - 100px);
      }
      }"
    `)
  })

  test('supports more than two candidates', () => {
    expect(css({ cursor: 'fallback(-webkit-grab, grab, move)' })).toMatchInlineSnapshot(`
      "@layer utilities {
        .cursor_fallback\\(-webkit-grab\\,_grab\\,_move\\) {
          cursor: move;
          cursor: grab;
          cursor: -webkit-grab;
      }
      }"
    `)
  })

  test('resolves tokens inside each candidate', () => {
    expect(css({ color: 'fallback(red.300, red)' })).toMatchInlineSnapshot(`
      "@layer utilities {
        .c_fallback\\(red\\.300\\,_red\\) {
          color: red;
          color: var(--colors-red-300);
      }
      }"
    `)
  })

  test('resolves the arbitrary-value escape hatch inside each candidate', () => {
    expect(css({ width: 'fallback([stretch], [100%])' })).toMatchInlineSnapshot(`
      "@layer utilities {
        .w_fallback\\(\\[stretch\\]\\,_\\[100\\%\\]\\) {
          width: 100%;
          width: stretch;
      }
      }"
    `)
  })

  test('expands shorthands and multi-declaration utilities per candidate', () => {
    expect(css({ paddingX: 'fallback(4, 2)' })).toMatchInlineSnapshot(`
      "@layer utilities {
        .px_fallback\\(4\\,_2\\) {
          padding-inline: var(--spacing-2);
          padding-inline: var(--spacing-4);
      }
      }"
    `)
  })

  test('collapses candidates that resolve to the same declaration', () => {
    expect(css({ height: 'fallback(100px, 100px)' })).toMatchInlineSnapshot(`
      "@layer utilities {
        .h_fallback\\(100px\\,_100px\\) {
          height: 100px;
      }
      }"
    `)
  })

  test('works under conditions', () => {
    expect(css({ _hover: { height: 'fallback(100dvh, 100vh)' } })).toMatchInlineSnapshot(`
      "@layer utilities {
        .hover\\:h_fallback\\(100dvh\\,_100vh\\):is(:hover, [data-hover]) {
          height: 100vh;
          height: 100dvh;
      }
      }"
    `)
  })

  test('works inside at-rules', () => {
    expect(css({ md: { height: 'fallback(100dvh, 100vh)' } })).toMatchInlineSnapshot(`
      "@layer utilities {
        @media screen and (min-width: 48rem) {
          .md\\:h_fallback\\(100dvh\\,_100vh\\) {
            height: 100vh;
            height: 100dvh;
      }
      }
      }"
    `)
  })

  test('a single candidate emits a single declaration', () => {
    expect(css({ height: 'fallback(100dvh)' })).toMatchInlineSnapshot(`
      "@layer utilities {
        .h_fallback\\(100dvh\\) {
          height: 100dvh;
      }
      }"
    `)
  })

  test('declines a candidate that resolves to more than one declaration', () => {
    // `transitionProperty` emits `--transition-prop` beside `transition-property`. A custom
    // property takes the last value unconditionally, so the preferred one would win even in
    // the browser that fell back — the variable and the property would disagree.
    expect(css({ transitionProperty: 'fallback([color, background-color], all)' })).toMatchInlineSnapshot(`
      "@layer utilities {
        .trs-prop_fallback\\(\\[color\\,_background-color\\]\\,_all\\) {
          --transition-prop: color, background-color;
          transition-property: color, background-color;
      }
      }"
    `)
  })

  test('applies the unit to numeric candidates', () => {
    const config = {
      utilities: { extend: { myNum: { className: 'myNum', transform: (v: string) => ({ marginTop: Number(v) }) } } },
    } as unknown as Config

    expect(css({ myNum: 'fallback(4, 8)' } as SystemStyleObject, config)).toMatchInlineSnapshot(`
      "@layer utilities {
        .myNum_fallback\\(4\\,_8\\) {
          margin-top: 8px;
          margin-top: 4px;
      }
      }"
    `)
  })

  test('declines a nested fallback instead of emitting it verbatim', () => {
    expect(css({ height: 'fallback(fallback(100dvh, 100svh), 100vh)' })).toMatchInlineSnapshot(`""`)
  })

  test('strips a NUL arriving in an author value', () => {
    expect(css({ height: '100px\u0000200px' })).toMatchInlineSnapshot(`
      "@layer utilities {
        .h_100px200px {
          height: 100px200px;
      }
      }"
    `)
  })

  test('a custom utility returning an array still comma-joins', () => {
    // An array under a declaration means a comma-separated list — a font stack. The
    // fallback carrier must not take that meaning over.
    const config = {
      utilities: {
        extend: {
          myFont: { className: 'myFont', transform: (v: string) => ({ fontFamily: [v, 'sans-serif'] }) },
        },
      },
    } as unknown as Config

    expect(css({ myFont: 'Inter' } as SystemStyleObject, config)).toMatchInlineSnapshot(`
      "@layer utilities {
        .myFont_Inter {
          font-family: Inter,sans-serif;
      }
      }"
    `)
    expect(css({ myFont: 'fallback(Inter, Arial)' } as SystemStyleObject, config)).toMatchInlineSnapshot(`
      "@layer utilities {
        .myFont_fallback\\(Inter\\,_Arial\\) {
          font-family: Arial,sans-serif;
          font-family: Inter,sans-serif;
      }
      }"
    `)
  })

  test('does not corrupt the style memo across calls', () => {
    const config = {
      utilities: {
        extend: {
          myFont: { className: 'myFont', transform: (v: string) => ({ fontFamily: [v, 'sans-serif'] }) },
        },
      },
    } as unknown as Config

    const processor = createRuleProcessor(config)
    processor.css({ myFont: 'fallback(Inter, multi)' } as SystemStyleObject)
    // The second call must be unaffected by the first — a shared cached style object that
    // the fallback path mutated would leak the extra candidate into it.
    expect(processor.css({ myFont: 'multi' } as SystemStyleObject).toCss()).toMatchInlineSnapshot(`
      "@layer utilities {
        .myFont_fallback\\(Inter\\,_multi\\) {
          font-family: multi,sans-serif;
          font-family: Inter,sans-serif;
      }

        .myFont_multi {
          font-family: multi,sans-serif;
      }
      }"
    `)
  })

  test('declines to stack candidates that resolve to different declarations', () => {
    // `lineClamp` emits four declarations for a number and one for `none`, so there is no
    // per-property cascade to build. The preferred candidate is used on its own.
    expect(css({ lineClamp: 'fallback(none, 3)' })).toMatchInlineSnapshot(`
      "@layer utilities {
        .lc_fallback\\(none\\,_3\\) {
          -webkit-line-clamp: unset;
      }
      }"
    `)
  })

  test('declines to stack candidates that expand to a nested rule', () => {
    expect(css({ divideX: 'fallback(2px, 1px)' })).toMatchInlineSnapshot(`
      "@layer utilities {
        .dvd-x_fallback\\(2px\\,_1px\\) > :not([hidden]) ~ :not([hidden]) {
          border-inline-start-width: 2px;
          border-inline-end-width: 0px;
      }
      }"
    `)
  })

  test('drops a malformed call instead of emitting invalid CSS', () => {
    expect(css({ color: 'red', height: 'fallback(100dvh, 100vh', display: 'flex' })).toMatchInlineSnapshot(`
      "@layer utilities {
        .c_red {
          color: red;
      }

        .d_flex {
          display: flex;
      }
      }"
    `)
  })

  test('carries !important onto every candidate', () => {
    expect(css({ height: 'fallback(100dvh, 100vh)!' })).toMatchInlineSnapshot(`
      "@layer utilities {
        .h_fallback\\(100dvh\\,_100vh\\)\\! {
          height: 100vh !important;
          height: 100dvh !important;
      }
      }"
    `)
  })

  test('works in globalCss', () => {
    const ctx = createGeneratorContext()
    const sheet = ctx.createSheet()
    sheet.processGlobalCss({ body: { height: 'fallback(100dvh, 100vh)' } })
    expect(sheet.toCss()).toMatchInlineSnapshot(`
      "@layer base {
        body {
          height: 100vh;
          height: 100dvh;
      }

        @property --gradient-from-position {
          syntax: '*';

          inherits: false;
        }

        @property --gradient-to-position {
          syntax: '*';

          inherits: false;
        }

        @property --gradient-via-position {
          syntax: '*';

          inherits: false;
        }

        @property --blur {
          syntax: '*';

          inherits: false;
        }

        @property --brightness {
          syntax: '*';

          inherits: false;
        }

        @property --contrast {
          syntax: '*';

          inherits: false;
        }

        @property --drop-shadow {
          syntax: '*';

          inherits: false;
        }

        @property --grayscale {
          syntax: '*';

          inherits: false;
        }

        @property --hue-rotate {
          syntax: '*';

          inherits: false;
        }

        @property --invert {
          syntax: '*';

          inherits: false;
        }

        @property --saturate {
          syntax: '*';

          inherits: false;
        }

        @property --sepia {
          syntax: '*';

          inherits: false;
        }

        @property --backdrop-blur {
          syntax: '*';

          inherits: false;
        }

        @property --backdrop-brightness {
          syntax: '*';

          inherits: false;
        }

        @property --backdrop-contrast {
          syntax: '*';

          inherits: false;
        }

        @property --backdrop-grayscale {
          syntax: '*';

          inherits: false;
        }

        @property --backdrop-hue-rotate {
          syntax: '*';

          inherits: false;
        }

        @property --backdrop-invert {
          syntax: '*';

          inherits: false;
        }

        @property --backdrop-opacity {
          syntax: '*';

          inherits: false;
        }

        @property --backdrop-saturate {
          syntax: '*';

          inherits: false;
        }

        @property --backdrop-sepia {
          syntax: '*';

          inherits: false;
        }

        @property --border-spacing-x {
          syntax: '*';

          inherits: false;

          initial-value: 0;
        }

        @property --border-spacing-y {
          syntax: '*';

          inherits: false;

          initial-value: 0;
        }

        @property --rotate-x {
          syntax: '*';

          inherits: false;

          initial-value: 0;
        }

        @property --rotate-y {
          syntax: '*';

          inherits: false;

          initial-value: 0;
        }

        @property --rotate-z {
          syntax: '*';

          inherits: false;

          initial-value: 0;
        }

        @property --scale-x {
          syntax: '*';

          inherits: false;

          initial-value: 1;
        }

        @property --scale-y {
          syntax: '*';

          inherits: false;

          initial-value: 1;
        }

        @property --translate-x {
          syntax: '*';

          inherits: false;

          initial-value: 0;
        }

        @property --translate-y {
          syntax: '*';

          inherits: false;

          initial-value: 0;
        }

        @property --translate-z {
          syntax: '*';

          inherits: false;

          initial-value: 0;
        }

        @property --scroll-snap-strictness {
          syntax: '*';

          inherits: false;

          initial-value: proximity;
        }
      }"
    `)
  })

  test('works with hashed class names', () => {
    expect(css({ height: 'fallback(100dvh, 100vh)' }, { hash: true } as Config)).toMatchInlineSnapshot(`
      "@layer utilities {
        .oFJfu {
          height: 100vh;
          height: 100dvh;
      }
      }"
    `)
  })

  test('leaves a value that merely contains the call alone', () => {
    expect(css({ border: '1px solid fallback(red, blue)' })).toMatchInlineSnapshot(`
      "@layer utilities {
        .bd_1px_solid_fallback\\(red\\,_blue\\) {
          border: 1px solid fallback(red, blue);
      }
      }"
    `)
  })
})
