import { createGeneratorContext } from '@bamboocss/fixture'
import type { Config } from '@bamboocss/types'
import { describe, expect, test } from 'vitest'

/**
 * Both stop where the product's own regex stops, rather than at `[a-z0-9-]`. A token name
 * can carry an escape — `spacing.0.5` is declared as `--spacing-0\.5` — and truncating it
 * to `--spacing-0` invents a name that collides with a real, unrelated token.
 */
const declarations = (css: string) => new Set([...css.matchAll(/(--[^\s:;{}]+)\s*:/g)].map((m) => m[1]))
const references = (css: string) => new Set([...css.matchAll(/var\(\s*(--[^\s,)]+)/g)].map((m) => m[1]))

/**
 * A `var()` with nothing declaring it. Some are there before pruning and are meant to be —
 * the reset refers to `--global-*` properties for the consumer to define — so the test is
 * always whether pruning *introduces* one, never whether any exist.
 */
const dangling = (css: string) => {
  const declared = declarations(css)
  return [...references(css)].filter((name) => !declared.has(name))
}

const buildWithContext = (config: Config, tokensReachableFromJs?: boolean) => {
  const ctx = createGeneratorContext({
    staticCss: { css: [{ properties: { color: ['red.300'] } }] },
    ...config,
  })

  const sheet = ctx.createSheet()
  ctx.appendLayerParams(sheet)
  ctx.appendBaselineCss(sheet)
  ctx.pruneTokens(sheet, undefined, tokensReachableFromJs)

  return { ctx, css: ctx.getCss(sheet) }
}

const build = (config: Config) => buildWithContext(config).css

/**
 * The custom properties `token()` hands javascript as a `var()` reference rather than a
 * literal, mirroring `generateTokenJs` — it is what decides the value a caller receives.
 *
 * Not the same set as "tokens with their own var": a negative token's value is
 * `calc(var(--spacing-4) * -1)`, so the name it depends on is the *positive* token's.
 */
const referencedByJs = (ctx: ReturnType<typeof buildWithContext>['ctx']) => {
  const names = new Set<string>()

  ctx.tokens.allTokens.forEach((token) => {
    const { isVirtual, condition, varRef } = token.extensions
    const value = isVirtual || condition !== 'base' ? varRef : token.value
    references(String(value)).forEach((name) => names.add(name))
  })

  return names
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
        semanticTokens: {
          colors: { fg: { value: { base: 'token(colors.red.300)', _osDark: 'token(colors.red.500)' } } },
        },
      },
    },
    staticCss: { css: [{ properties: { color: ['fg'] } }] },
  },
  // Exporting a token for something outside the stylesheet to read. Nothing in the sheet
  // references `--brand`, which is the point of declaring it — so the colour behind it has
  // to be kept by the declaration itself rather than by a reference to it.
  'globalCss custom property': {
    globalCss: { ':root': { '--brand': 'token(colors.blue.500)' } },
  },
  'globalVars custom property': {
    globalVars: { '--accent': 'var(--colors-orange-500)' },
  },
  // A palette declared but never read. The rule survives — its properties are virtual, so
  // pruning does not own them — and its targets are held by the blanket keeps rather than
  // by any reference. Passes without the fix above; here so that stays true.
  'unread color palette': {
    staticCss: { css: [{ properties: { colorPalette: ['red'] } }] },
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
    themes: { pink: { tokens: { colors: { primary: { value: 'token(colors.pink.500)' } } } } },
  }

  test.each([true, false])('keeps what a theme artifact references (reachable=%s)', (reachable) => {
    const ctx = createGeneratorContext(config)
    const sheet = ctx.createSheet()
    ctx.appendLayerParams(sheet)
    ctx.appendBaselineCss(sheet)
    ctx.pruneTokens(sheet, undefined, reachable)

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

/**
 * `token('spacing.-4')` returns `calc(var(--spacing-4) * -1)`, and `token('colors.text')`
 * a `var()` at whatever the condition resolves to. Prune the declaration behind either and
 * javascript is left holding a reference to nothing — a silent one, since the css itself
 * stays consistent.
 */
describe.each(Object.entries(CASES))('references javascript is handed: %s', (_name, config) => {
  const before = buildWithContext({ ...config, pruneUnusedTokens: false })
  const after = buildWithContext({ ...config, pruneUnusedTokens: true })

  test('keeps every declaration token() resolves to', () => {
    const declaredBefore = declarations(before.css)
    const declaredAfter = declarations(after.css)

    // Some are undeclared before pruning too — a virtual token has no declaration of its
    // own until a utility emits one — so the test is what pruning takes away.
    const lost = [...referencedByJs(after.ctx)].filter((name) => declaredBefore.has(name) && !declaredAfter.has(name))

    expect(lost).toEqual([])
  })
})

/**
 * The same surface with `tokensReachableFromJs` false — the path taken when no file under
 * `include` reaches for a token from javascript, so the exemption above has no caller.
 *
 * The invariant it drops is the one the block above asserts, and it drops it on purpose:
 * that is the entire saving. What has to survive is the weaker and more important one, that
 * the *stylesheet* stays self-consistent. Asserted here rather than inferred, because the
 * default parameter means the block above only ever exercises the ungated path and would
 * keep passing however this one behaved.
 */
describe.each(Object.entries(CASES))('with nothing reaching for a token from javascript: %s', (_name, config) => {
  const unpruned = build({ ...config, pruneUnusedTokens: false })
  const ungated = buildWithContext({ ...config, pruneUnusedTokens: true }, true)
  const gated = buildWithContext({ ...config, pruneUnusedTokens: true }, false)

  test('introduces no reference the stylesheet cannot resolve', () => {
    // Some are dangling before pruning too — the reset names `--global-*` properties for the
    // consumer to define — so the question is only ever what pruning *adds*.
    const before = new Set(dangling(unpruned))

    expect(dangling(gated.css).filter((name) => !before.has(name))).toEqual([])
  })

  test('drops nothing the stylesheet itself reads', () => {
    const declaredGated = declarations(gated.css)
    const dropped = [...declarations(ungated.css)].filter((name) => !declaredGated.has(name))

    expect(dropped.filter((name) => references(gated.css).has(name))).toEqual([])
  })
})

/**
 * Non-vacuity for the block above. If the gate ever stops removing anything, those tests keep
 * passing while the optimisation they cover has quietly become a no-op.
 */
describe.each(Object.entries(CASES))('the gate is not a no-op: %s', (_name, config) => {
  test('removes declarations the ungated path keeps', () => {
    const ungated = buildWithContext({ ...config, pruneUnusedTokens: true }, true)
    const gated = buildWithContext({ ...config, pruneUnusedTokens: true }, false)

    expect(declarations(gated.css).size).toBeLessThan(declarations(ungated.css).size)
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
