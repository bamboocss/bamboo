import { createGeneratorContext } from '@bamboocss/fixture'
import type { Config } from '@bamboocss/types'
import { describe, expect, test } from 'vitest'

const buildCss = (userConfig?: Config, keep?: Set<string>) => {
  const ctx = createGeneratorContext({
    // stands in for what extraction would contribute, without needing source files
    staticCss: { css: [{ properties: { color: ['red.300'] } }] },
    ...userConfig,
  })

  const sheet = ctx.createSheet()
  ctx.appendLayerParams(sheet)
  ctx.appendBaselineCss(sheet)
  ctx.pruneTokens(sheet, keep)

  return ctx.getCss(sheet)
}

const declares = (css: string, name: string) => new RegExp(`\\${name}\\s*:`).test(css)

describe('pruneTokens', () => {
  /**
   * The guarantee for every project that does not ask for this: the option is off by
   * default, and leaving it off has to produce exactly the css it produced before.
   */
  test('is inert unless enabled', () => {
    expect(buildCss()).toBe(buildCss({ pruneUnusedTokens: false }))
  })

  test('leaves the token layer untouched when disabled', () => {
    const css = buildCss()

    expect(declares(css, '--colors-red-300')).toBe(true)
    expect(declares(css, '--colors-pink-500')).toBe(true)
  })

  test('drops tokens the css cannot reach once enabled', () => {
    const css = buildCss({ pruneUnusedTokens: true })

    expect(declares(css, '--colors-red-300')).toBe(true)
    expect(declares(css, '--colors-pink-500')).toBe(false)
  })

  test('enabling it only ever removes declarations', () => {
    const before = buildCss()
    const after = buildCss({ pruneUnusedTokens: true })

    const names = (css: string) => new Set([...css.matchAll(/(--[a-z0-9-]+)\s*:/g)].map((m) => m[1]))
    const added = [...names(after)].filter((name) => !names(before).has(name))

    expect(added).toEqual([])
    expect(after.length).toBeLessThan(before.length)
  })

  test('keeps a token named only by the caller, standing in for token.var()', () => {
    const css = buildCss({ pruneUnusedTokens: true }, new Set(['--colors-pink-500']))

    expect(declares(css, '--colors-pink-500')).toBe(true)
  })

  /**
   * `token()` hands a conditional token to javascript as a `var()` reference rather than a
   * literal, so its declaration has to survive whether or not the css names it.
   */
  test('keeps conditional tokens whatever the css references', () => {
    const config: Config = {
      pruneUnusedTokens: true,
      theme: {
        extend: {
          semanticTokens: {
            colors: {
              unreferenced: { value: { base: '{colors.gray.600}', _osDark: '{colors.gray.400}' } },
            },
          },
        },
      },
    }

    expect(declares(buildCss(config), '--colors-unreferenced')).toBe(true)
  })

  test('does not disturb keyframes', () => {
    const config: Config = {
      pruneUnusedTokens: true,
      theme: { extend: { keyframes: { spin: { to: { transform: 'rotate(360deg)' } } } } },
    }

    expect(buildCss(config)).toContain('@keyframes spin')
  })
})
