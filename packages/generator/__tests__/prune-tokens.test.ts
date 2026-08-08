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
  test('drops tokens the css cannot reach, by default', () => {
    const css = buildCss()

    expect(declares(css, '--colors-red-300')).toBe(true)
    expect(declares(css, '--colors-pink-500')).toBe(false)
  })

  test('keeps every token declaration when disabled', () => {
    const css = buildCss({ pruneUnusedTokens: false })

    expect(declares(css, '--colors-red-300')).toBe(true)
    expect(declares(css, '--colors-pink-500')).toBe(true)
  })

  /**
   * The flag exists because a token can be reached by a name this pass never sees —
   * `token.var()` with a path built at runtime. A registration has no such surface: nothing
   * hands one to javascript and none are part of the token api, so whether the finished
   * stylesheet mentions it is the whole question. Opting out of the half that cannot be
   * proven should not mean carrying the half that can.
   */
  test('still drops unreachable @property registrations when disabled', () => {
    const registered = (css: string) => [...css.matchAll(/@property\s+(--[\w-]+)/g)].map((m) => m[1])

    expect(registered(buildCss({ pruneUnusedTokens: false }))).toEqual([])
    expect(registered(buildCss())).toEqual([])
  })

  test('only ever removes declarations', () => {
    const before = buildCss({ pruneUnusedTokens: false })
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
