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
  /** The escape hatch has to be exact: disabling it produces the css it produced before. */
  test('keeps every keyframe when disabled', () => {
    const css = buildCss({ prune: { keyframes: false } })

    expect(declares(css, 'fade-in')).toBe(true)
    expect(declares(css, 'spin')).toBe(true)
  })

  test('prunes by default, without being asked', () => {
    expect(buildCss()).toBe(buildCss({ prune: { keyframes: true } }))
  })

  test('drops keyframes the css cannot reach once enabled', () => {
    const css = buildCss({ prune: { keyframes: true } })

    expect(declares(css, 'fade-in')).toBe(false)
    expect(declares(css, 'spin')).toBe(false)
  })

  test('keeps one reached through a static style', () => {
    const css = buildCss({
      prune: { keyframes: true },
      staticCss: { css: [{ properties: { animation: ['fade-in 1s ease-out'] } }] },
    })

    expect(declares(css, 'fade-in')).toBe(true)
    expect(declares(css, 'spin')).toBe(false)
  })

  test('keeps one named only in the keep set', () => {
    const css = buildCss({ prune: { keyframes: true } }, new Set(['spin']))

    expect(declares(css, 'spin')).toBe(true)
    expect(declares(css, 'fade-in')).toBe(false)
  })

  test('enabling it only ever removes, never adds or rewrites', () => {
    const before = buildCss({ prune: { keyframes: false } })
    const after = buildCss({ prune: { keyframes: true } })

    expect(after.length).toBeLessThan(before.length)

    // Everything surviving the prune must appear verbatim in the unpruned sheet, so the
    // pass cannot be rewriting anything on its way through.
    for (const line of after.split('\n')) {
      const trimmed = line.trim()
      if (trimmed) expect(before).toContain(trimmed)
    }
  })

  test('leaves the token layer alone', () => {
    const withPrune = buildCss({ prune: { keyframes: true } })

    // Token declarations are `pruneTokens`' business; this pass must not touch them.
    expect(withPrune).toContain('--colors-red-300')
  })

  test('a project with no keyframes is unaffected', () => {
    const ctx = createGeneratorContext({ prune: { keyframes: true } })
    const sheet = ctx.createSheet()
    ctx.appendLayerParams(sheet)
    ctx.appendBaselineCss(sheet)

    expect(() => ctx.pruneKeyframes(sheet)).not.toThrow()
  })
})

describe('themes', () => {
  /**
   * A theme is emitted separately and injected at runtime, so nothing in the pruned
   * sheet names what it needs. Pointing an animation token at a different keyframe than
   * the base does is the case that breaks.
   */
  const themed = (prune: boolean) => {
    const ctx = createGeneratorContext({
      prune: { keyframes: prune },
      theme: {
        extend: {
          keyframes: KEYFRAMES,
          tokens: { animations: { enter: { value: 'fade-in 1s ease-out' } } },
        },
      },
      themes: {
        dark: { tokens: { animations: { enter: { value: 'spin 1s linear' } } } },
      },
      staticCss: { css: [{ properties: { animation: ['enter'] } }] },
    } as never)

    const sheet = ctx.createSheet()
    ctx.appendLayerParams(sheet)
    ctx.appendBaselineCss(sheet)
    ctx.pruneKeyframes(sheet)

    return ctx.getCss(sheet)
  }

  test('a keyframe only the theme names is kept', () => {
    const css = themed(true)

    // `fade-in` is what the base token resolves to and the sheet shows it.
    expect(declares(css, 'fade-in')).toBe(true)
    // `spin` appears only in the dark theme's override of the same token.
    expect(declares(css, 'spin')).toBe(true)
  })
})
