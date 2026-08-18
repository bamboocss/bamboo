import { createContext } from '@bamboocss/fixture'
import type { Config } from '@bamboocss/types'
import { describe, expect, test } from 'vitest'

const tokenCss = (config?: Config) => {
  const ctx = createContext(config)
  const sheet = ctx.createSheet()
  ctx.appendCssOfType('tokens', sheet)
  return sheet.toCss()
}

// Not `eject`: the fold is gated on `_osDark` resolving to its media query, and ejecting
// leaves the condition undefined.
const semantic = (colors: Record<string, { value: unknown }>, config?: Config): Config =>
  ({ ...config, theme: { extend: { semanticTokens: { colors } } } }) as Config

describe('light-dark()', () => {
  test('folds a base/_osDark pair and drops the media block', () => {
    const css = tokenCss(semantic({ panel: { value: { base: '#ffffff', _osDark: '#131211' } } }))

    expect(css).toContain('--colors-panel: light-dark(#ffffff, #131211)')
    expect(css).not.toContain('prefers-color-scheme: dark')
  })

  /**
   * `light-dark()` returns the light value unless `color-scheme` names both, so a sheet that
   * folds without declaring it is a sheet where dark mode silently never engages.
   */
  test('declares color-scheme alongside the folded tokens', () => {
    const css = tokenCss(semantic({ panel: { value: { base: '#ffffff', _osDark: '#131211' } } }))

    expect(css).toContain('color-scheme: light dark')
  })

  test('declares it only when something actually folded', () => {
    expect(tokenCss(semantic({ panel: { value: '#ffffff' } }))).not.toContain('color-scheme')
  })

  /**
   * `light-dark()` takes exactly two arguments and CSS cannot group a list into one of them,
   * so folding a multi-part shadow produced `light-dark(a, b, c)` — invalid, dropped by the
   * browser, and silent. Every element carrying the token rendered unshadowed while its class
   * looked right. A realistic elevation token is almost always two shadows, so this hit whole
   * design systems at once rather than an edge case.
   */
  test('leaves a token whose light arm is a comma-separated list alone', () => {
    const css = tokenCss({
      theme: {
        extend: {
          semanticTokens: {
            shadows: {
              sm: {
                value: {
                  base: '0 1px 2px rgb(16 19 26 / 0.06), 0 1px 3px rgb(16 19 26 / 0.04)',
                  _osDark: '0 1px 2px rgb(0 0 0 / 0.3)',
                },
              },
            },
          },
        },
      },
    } as Config)

    expect(css).not.toContain('light-dark(')
    expect(css).toContain('prefers-color-scheme: dark')
  })

  test('leaves a token whose dark arm is a comma-separated list alone', () => {
    const css = tokenCss({
      theme: {
        extend: {
          semanticTokens: {
            shadows: {
              sm: { value: { base: '0 1px 2px rgb(0 0 0 / 0.1)', _osDark: '0 1px 2px red, 0 2px 4px blue' } },
            },
          },
        },
      },
    } as Config)

    expect(css).not.toContain('light-dark(')
    expect(css).toContain('prefers-color-scheme: dark')
  })

  /**
   * The guard is depth-aware, not a `includes(',')`. Legacy `rgb()` notation carries its own
   * commas and is a single value, so it must still fold.
   */
  test('still folds a value whose commas are inside a function', () => {
    const css = tokenCss(semantic({ panel: { value: { base: 'rgb(16, 19, 26)', _osDark: 'rgb(255, 255, 255)' } } }))

    expect(css).toContain('--colors-panel: light-dark(rgb(16, 19, 26), rgb(255, 255, 255))')
  })

  /** A token that cannot fold must not suppress folding for one that can. */
  test('folds the foldable token and leaves the list token on the media block', () => {
    const css = tokenCss({
      theme: {
        extend: {
          semanticTokens: {
            colors: { panel: { value: { base: '#ffffff', _osDark: '#131211' } } },
            shadows: { sm: { value: { base: '0 1px 2px red, 0 2px 4px blue', _osDark: '0 1px 2px black' } } },
          },
        },
      },
    } as Config)

    expect(css).toContain('--colors-panel: light-dark(#ffffff, #131211)')
    expect(css).toContain('prefers-color-scheme: dark')
    expect(css).toContain('color-scheme: light dark')
  })

  /**
   * The light arm and an `@media (prefers-color-scheme: light)` block would both be in play
   * for one var, and the block wins on order — so the arm would be dead code. Three-way
   * tokens keep the mechanism they had.
   */
  test('leaves a token carrying _osLight alone', () => {
    const css = tokenCss(semantic({ ink: { value: { base: 'red', _osDark: 'blue', _osLight: 'green' } } }))

    expect(css).not.toContain('light-dark(')
    expect(css).toContain('prefers-color-scheme: dark')
    expect(css).toContain('prefers-color-scheme: light')
  })

  /**
   * `_dark` is a class selector, not a media query. It stays a rule of its own — an explicit
   * toggle sets `color-scheme` on the subtree rather than restating each token.
   */
  test('leaves a selector condition alone', () => {
    const css = tokenCss(semantic({ ink: { value: { base: '#131211', _dark: '#ffffff' } } }))

    expect(css).not.toContain('light-dark(')
    expect(css).toContain('.dark')
  })

  /**
   * `_osDark` is a configurable condition, not a keyword. Pointed at a selector it no longer
   * means "the OS prefers dark", and `light-dark()` cannot express a selector — so folding it
   * would silently rewrite the mechanism the user chose.
   */
  test('leaves _osDark alone when it has been redefined as a selector', () => {
    const css = tokenCss(
      semantic({ panel: { value: { base: '#ffffff', _osDark: '#131211' } } }, {
        conditions: { extend: { osDark: '[data-os=dark] &' } },
      } as Config),
    )

    expect(css).not.toContain('light-dark(')
    expect(css).not.toContain('color-scheme')
    expect(css).toContain('[data-os=dark]')
  })

  test('folds only the paired vars, leaving the rest of the dark block standing', () => {
    const css = tokenCss(
      semantic({
        panel: { value: { base: '#ffffff', _osDark: '#131211' } },
        ink: { value: { base: 'red', _osDark: 'blue', _osLight: 'green' } },
      }),
    )

    expect(css).toContain('--colors-panel: light-dark(#ffffff, #131211)')
    expect(css).toContain('prefers-color-scheme: dark')
    expect(css).toContain('--colors-ink: blue')
  })
})
