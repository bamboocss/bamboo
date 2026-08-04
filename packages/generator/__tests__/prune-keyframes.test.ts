import { createGeneratorContext } from '@bamboocss/fixture'
import type { Config } from '@bamboocss/types'
import { describe, expect, test } from 'vitest'

const KEYFRAMES = {
  'fade-in': { from: { opacity: '0' }, to: { opacity: '1' } },
  spin: { to: { transform: 'rotate(360deg)' } },
}

const buildCss = (userConfig?: Config, keep?: Set<string>) => {
  const ctx = createGeneratorContext({
    theme: { extend: { keyframes: KEYFRAMES } },
    ...userConfig,
  })

  const sheet = ctx.createSheet()
  ctx.appendLayerParams(sheet)
  ctx.appendBaselineCss(sheet)
  ctx.pruneKeyframes(sheet, keep)

  return ctx.getCss(sheet)
}

const declares = (css: string, name: string) => new RegExp(`@keyframes\\s+${name}\\b`).test(css)

describe('pruneKeyframes', () => {
  /**
   * The guarantee for every project that does not ask for this: off by default, and
   * leaving it off produces exactly the css it produced before.
   */
  test('is inert unless enabled', () => {
    expect(buildCss()).toBe(buildCss({ pruneUnusedKeyframes: false }))
  })

  test('keeps every keyframe when disabled', () => {
    const css = buildCss()

    expect(declares(css, 'fade-in')).toBe(true)
    expect(declares(css, 'spin')).toBe(true)
  })

  test('drops keyframes the css cannot reach once enabled', () => {
    const css = buildCss({ pruneUnusedKeyframes: true })

    expect(declares(css, 'fade-in')).toBe(false)
    expect(declares(css, 'spin')).toBe(false)
  })

  test('keeps one reached through a static style', () => {
    const css = buildCss({
      pruneUnusedKeyframes: true,
      staticCss: { css: [{ properties: { animation: ['fade-in 1s ease-out'] } }] },
    })

    expect(declares(css, 'fade-in')).toBe(true)
    expect(declares(css, 'spin')).toBe(false)
  })

  test('keeps one named only in the keep set', () => {
    const css = buildCss({ pruneUnusedKeyframes: true }, new Set(['spin']))

    expect(declares(css, 'spin')).toBe(true)
    expect(declares(css, 'fade-in')).toBe(false)
  })

  test('enabling it only ever removes, never adds or rewrites', () => {
    const before = buildCss({ pruneUnusedKeyframes: false })
    const after = buildCss({ pruneUnusedKeyframes: true })

    expect(after.length).toBeLessThan(before.length)

    // Everything surviving the prune must appear verbatim in the unpruned sheet, so the
    // pass cannot be rewriting anything on its way through.
    for (const line of after.split('\n')) {
      const trimmed = line.trim()
      if (trimmed) expect(before).toContain(trimmed)
    }
  })

  test('leaves the token layer alone', () => {
    const withPrune = buildCss({ pruneUnusedKeyframes: true })

    // Token declarations are `pruneTokens`' business; this pass must not touch them.
    expect(withPrune).toContain('--colors-red-300')
  })

  test('a project with no keyframes is unaffected', () => {
    const ctx = createGeneratorContext({ pruneUnusedKeyframes: true })
    const sheet = ctx.createSheet()
    ctx.appendLayerParams(sheet)
    ctx.appendBaselineCss(sheet)

    expect(() => ctx.pruneKeyframes(sheet)).not.toThrow()
  })
})
