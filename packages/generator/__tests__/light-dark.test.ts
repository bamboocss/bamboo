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
