import { createGeneratorContext } from '@bamboocss/fixture'
import type { Config } from '@bamboocss/types'
import { describe, expect, test } from 'vitest'

/**
 * `reachable` is `tokensReachableFromJs` — whether anything under `include` reaches for a
 * token from javascript. It defaults to *false* here, unlike in `pruneTokens` itself, because
 * these tests are about what the reachability walk can decide. With it true there is nothing
 * left to decide: `token()` hands back a `var()` for every token, so every declaration is
 * kept and pruning is a no-op. `the gate keeps everything once js can reach a token` below
 * pins that half.
 */
const buildCss = (userConfig?: Config, keep?: Set<string>, reachable = false) => {
  const ctx = createGeneratorContext({
    // stands in for what extraction would contribute, without needing source files
    staticCss: { css: [{ properties: { color: ['red.300'] } }] },
    ...userConfig,
  })

  const sheet = ctx.createSheet()
  ctx.appendLayerParams(sheet)
  ctx.appendBaselineCss(sheet)
  ctx.pruneTokens(sheet, keep, reachable)

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
    const css = buildCss({ prune: { tokens: false } })

    expect(declares(css, '--colors-red-300')).toBe(true)
    expect(declares(css, '--colors-pink-500')).toBe(true)
  })

  /**
   * The flag exists because a token can be reached by a name this pass never sees —
   * `token.value()` with a path built at runtime. A registration has no such surface: nothing
   * hands one to javascript and none are part of the token api, so whether the finished
   * stylesheet mentions it is the whole question. Opting out of the half that cannot be
   * proven should not mean carrying the half that can.
   */
  test('still drops unreachable @property registrations when disabled', () => {
    const registered = (css: string) => [...css.matchAll(/@property\s+(--[\w-]+)/g)].map((m) => m[1])

    expect(registered(buildCss({ prune: { tokens: false } }))).toEqual([])
    expect(registered(buildCss())).toEqual([])
  })

  test('only ever removes declarations', () => {
    const before = buildCss({ prune: { tokens: false } })
    const after = buildCss({ prune: { tokens: true } })

    const names = (css: string) => new Set([...css.matchAll(/(--[a-z0-9-]+)\s*:/g)].map((m) => m[1]))
    const added = [...names(after)].filter((name) => !names(before).has(name))

    expect(added).toEqual([])
    expect(after.length).toBeLessThan(before.length)
  })

  test('keeps a token named only by the caller, standing in for token.value()', () => {
    const css = buildCss({ prune: { tokens: true } }, new Set(['--colors-pink-500']))

    expect(declares(css, '--colors-pink-500')).toBe(true)
  })

  /**
   * The cost of `token()` returning a reference for every token: a path the build cannot
   * resolve could name any of them, so once javascript can reach a token at all, nothing is
   * prunable.
   *
   * This is the coarse half of the design, and the reason narrowing the gate is the next
   * piece of work: a project whose token calls all resolve to string literals needs none of
   * these keeps, because `collectTokenReferences` already kept those paths by name.
   */
  test('the gate keeps everything once js can reach a token', () => {
    const reached = buildCss({ prune: { tokens: true } }, undefined, true)
    const unreached = buildCss({ prune: { tokens: true } }, undefined, false)

    expect(declares(reached, '--colors-pink-500')).toBe(true)
    expect(declares(unreached, '--colors-pink-500')).toBe(false)
    expect(reached.length).toBeGreaterThan(unreached.length)
  })

  /**
   * `token()` hands a conditional token to javascript as a `var()` reference, so once js can
   * reach a token its declaration has to survive whether or not the css names it. Passed
   * `reachable` explicitly, because that is the premise being tested rather than the default.
   */
  test('keeps conditional tokens whatever the css references', () => {
    const config: Config = {
      prune: { tokens: true },
      theme: {
        extend: {
          semanticTokens: {
            colors: {
              unreferenced: { value: { base: 'token(colors.gray.600)', _osDark: 'token(colors.gray.400)' } },
            },
          },
        },
      },
    }

    expect(declares(buildCss(config, undefined, true), '--colors-unreferenced')).toBe(true)
  })

  test('does not disturb keyframes', () => {
    const config: Config = {
      prune: { tokens: true },
      theme: { extend: { keyframes: { spin: { to: { transform: 'rotate(360deg)' } } } } },
    }

    expect(buildCss(config)).toContain('@keyframes spin')
  })
})
