import { createGeneratorContext } from '@bamboocss/fixture'
import type { Config } from '@bamboocss/types'
import { describe, expect, test } from 'vitest'

const declarations = (css: string) => new Set([...css.matchAll(/(--[a-z0-9-]+)\s*:/gi)].map((m) => m[1]))
const references = (css: string) => new Set([...css.matchAll(/var\(\s*(--[a-z0-9-]+)/gi)].map((m) => m[1]))

/**
 * A `var()` with nothing declaring it. Some are there before pruning and are meant to be —
 * the reset refers to `--global-*` properties for the consumer to define — so the test is
 * always whether pruning *introduces* one, never whether any exist.
 */
const dangling = (css: string) => {
  const declared = declarations(css)
  return [...references(css)].filter((name) => !declared.has(name))
}

const build = (config: Config) => {
  const ctx = createGeneratorContext({
    staticCss: { css: [{ properties: { color: ['red.300'] } }] },
    ...config,
  })

  const sheet = ctx.createSheet()
  ctx.appendLayerParams(sheet)
  ctx.appendBaselineCss(sheet)
  ctx.pruneTokens(sheet)

  return ctx.getCss(sheet)
}

/** Every configuration whose token output differs in shape. */
const CASES: Record<string, Config> = {
  plain: {},
  hashed: { hash: true },
  prefixed: { prefix: 'bb' },
  'custom var root': { cssVarRoot: ':where(html)' },
  themed: { themes: { pink: { tokens: { colors: { primary: { value: '#f0f' } } } } } },
  'themed via staticCss': {
    themes: { pink: { tokens: { colors: { primary: { value: '#f0f' } } } } },
    staticCss: { themes: ['*'], css: [{ properties: { color: ['red.300'] } }] },
  },
  'color palette': {
    staticCss: { css: [{ properties: { colorPalette: ['red'], color: ['colorPalette.300'] } }] },
  },
  conditional: {
    theme: {
      extend: {
        semanticTokens: { colors: { fg: { value: { base: '{colors.red.300}', _osDark: '{colors.red.500}' } } } },
      },
    },
    staticCss: { css: [{ properties: { color: ['fg'] } }] },
  },
}

/**
 * A theme ships as its own artifact and is injected at runtime, so nothing in the pruned
 * sheet points at what it needs. Left unhandled, a theme mapping a token onto a base
 * colour renders with that colour missing.
 */
describe('themes injected at runtime', () => {
  const config: Config = {
    pruneUnusedTokens: true,
    staticCss: { css: [{ properties: { color: ['red.300'] } }] },
    themes: { pink: { tokens: { colors: { primary: { value: '{colors.pink.500}' } } } } },
  }

  test('keeps what a theme artifact references', () => {
    const ctx = createGeneratorContext(config)
    const sheet = ctx.createSheet()
    ctx.appendLayerParams(sheet)
    ctx.appendBaselineCss(sheet)
    ctx.pruneTokens(sheet)

    const declared = declarations(ctx.getCss(sheet))
    const themeCss = ctx
      .getArtifacts(['themes'])
      .flatMap((artifact) => artifact?.files ?? [])
      .map((file) => file.code)
      .join('\n')

    const referenced = [...references(themeCss)]

    expect(referenced.length).toBeGreaterThan(0)
    expect(referenced.filter((name) => !declared.has(name))).toEqual([])
  })
})

describe.each(Object.entries(CASES))('pruning invariants: %s', (_name, config) => {
  const before = build({ ...config, pruneUnusedTokens: false })
  const after = build({ ...config, pruneUnusedTokens: true })

  test('introduces no reference without a declaration', () => {
    const introduced = dangling(after).filter((name) => !dangling(before).includes(name))

    expect(introduced).toEqual([])
  })

  test('only ever removes declarations', () => {
    const added = [...declarations(after)].filter((name) => !declarations(before).has(name))

    expect(added).toEqual([])
  })

  test('keeps every declaration the css still references', () => {
    const referenced = [...references(after)]
    const lost = referenced.filter((name) => declarations(before).has(name) && !declarations(after).has(name))

    expect(lost).toEqual([])
  })
})
