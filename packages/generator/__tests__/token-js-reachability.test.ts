import { createGeneratorContext } from '@bamboocss/fixture'
import { describe, expect, test } from 'vitest'

/**
 * Some token declarations survive pruning purely so `token()` can answer for them at runtime:
 * virtual tokens, conditional ones, and the positive counterpart of every negative token.
 * That last case is the expensive one — a negative is never declared itself, so it pins its
 * positive and keeps the whole spacing scale alive whether or not anything uses it.
 *
 * The exemption only has a point if some caller exists. The tokens artifact is generated into
 * the project rather than installed, so the import is written in the project's own source and
 * a scan of `include` sees it — which is what makes a scan a usable answer here.
 *
 * Not a complete one, and this file is the wrong place to look for that. `include` scopes
 * style extraction rather than everything that may import, so a build script or a sibling
 * package calling `token()` is outside it, as is a binding renamed away from `token`. Those
 * gaps and the shapes the scan does cover live in `node/__tests__/token-references.test.ts`;
 * what is asserted here is only what the gate does to the emitted declarations once decided.
 */
const build = (tokensReachableFromJs: boolean) => {
  const ctx: any = createGeneratorContext({
    preflight: false,
    // one utility that reads a single spacing token, so the rest of the scale is unreachable
    staticCss: { css: [{ properties: { padding: ['4'] } }] },
  } as any)
  const sheet = ctx.createSheet()
  ctx.appendLayerParams(sheet)
  ctx.appendBaselineCss(sheet)
  ctx.appendCssOfType('static', sheet)
  ctx.pruneTokens(sheet, new Set(), tokensReachableFromJs)
  return ctx.getCss(sheet)
}

const spacingDeclarations = (css: string) => (css.match(/--spacing-[\w-]+\s*:/g) ?? []).length

describe('token declarations kept for javascript', () => {
  test('the whole scale survives when the project reaches for tokens', () => {
    expect(spacingDeclarations(build(true))).toBeGreaterThan(5)
  })

  test('only what the css reads survives when it does not', () => {
    const kept = spacingDeclarations(build(false))

    expect(kept).toBeGreaterThan(0)
    expect(kept).toBeLessThan(spacingDeclarations(build(true)))
  })

  /** The declaration the stylesheet actually uses is never at risk either way. */
  test.each([true, false])('the token the css reads survives (reachable=%s)', (reachable) => {
    expect(build(reachable)).toContain('--spacing-4:')
  })

  test('gating changes nothing the css can reach', () => {
    const withJs = build(true)
    const withoutJs = build(false)

    for (const match of withoutJs.matchAll(/(--[\w-]+)\s*:/g)) {
      expect(withJs).toContain(match[1]!)
    }
  })
})
