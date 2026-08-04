import type { Context } from '@bamboocss/core'
import { compact, createCss, createMergeCss, withoutSpace } from '@bamboocss/shared'
import type { Dict } from '@bamboocss/types'

/**
 * The generated runtime's `css`, rebuilt in-process from a resolved context.
 *
 * A fold replaces a call with the string the runtime would have returned, so it has
 * to compute that string the same way the runtime does — not the way the stylesheet
 * does. The two differ in one respect that matters here: `StyleDecoder` escapes class
 * names for use in a CSS selector (`.c_red\.300`), while the runtime emits the raw
 * value that belongs in a `class` attribute (`c_red.300`). Folding the decoder's form
 * would put a stray backslash in the DOM.
 *
 * Matching the runtime this way makes the substitution behaviour-preserving by
 * construction. What still needs asserting — and is asserted in `__tests__` — is that
 * these class names correspond to rules the build actually emits.
 *
 * Mirrors `generateCssFn` in `@bamboocss/generator`: `css = (...styles) =>
 * cssFn(mergeCss(...styles))`.
 */
export interface RuntimeCss {
  (...styles: Dict[]): string
}

/** The shape `createCss` and `createMergeCss` both take, derived from a resolved context. */
export const createCssContext = (ctx: Context) => ({
  grouped: ctx.config.cssMode === 'grouped',
  hash: Boolean(ctx.hash.className),
  conditions: {
    shift: ctx.conditions.shift,
    finalize: ctx.conditions.finalize,
    breakpoints: { keys: ctx.conditions.breakpoints.keys },
  },
  utility: {
    prefix: ctx.utility.prefix,
    hasShorthand: ctx.utility.hasShorthand,
    resolveShorthand: ctx.utility.resolveShorthand.bind(ctx.utility),
    transform: ctx.utility.transform.bind(ctx.utility),
    toHash: ctx.utility.toHash.bind(ctx.utility),
  },
})

export const createRuntimeCss = (ctx: Context): RuntimeCss => {
  const cssContext = createCssContext(ctx)

  const cssFn = createCss(cssContext)
  const { mergeCss } = createMergeCss(cssContext)

  return (...styles: Dict[]) => cssFn(mergeCss(...styles))
}

/**
 * The generated `createRecipe`, rebuilt in-process.
 *
 * A config recipe call resolves to `cx(recipeCss(variants), css(compoundVariantStyles))`.
 * Both halves are reachable from shared primitives: `cx` is a plain concatenation here,
 * and the recipe's own `createCss` differs from the ordinary one only in its `transform`,
 * which names classes `recipe--prop_value` instead of going through the utility table.
 *
 * `getCompoundVariantCss` is the one piece the generated artifact builds inline rather
 * than importing, so it is mirrored below. That is a second implementation and therefore
 * a drift risk, which is why `__tests__/recipe-runtime-parity.test.ts` checks this
 * against the recipe functions a real codegen produced rather than against itself.
 *
 * Mirrors `generateCreateRecipeFn` in `@bamboocss/generator`.
 */
export interface RuntimeRecipe {
  (name: string, variants: Dict): string | undefined
}

export const createRuntimeRecipe = (ctx: Context, runtimeCss: RuntimeCss): RuntimeRecipe => {
  const separator = ctx.utility.separator
  const { mergeCss } = createMergeCss(createCssContext(ctx))

  return (name, variants) => {
    const config = ctx.recipes.getConfig(name)
    const node = ctx.recipes.getRecipe(name)
    if (!config || !node) return undefined

    // Slot recipes resolve to one class per slot rather than to a single string.
    if ('slots' in config) return undefined

    const className = node.className
    const { defaultVariants = {}, compoundVariants = [] } = config

    const recipeCss = createCss({
      hash: Boolean(ctx.hash.className),
      conditions: {
        shift: ctx.conditions.shift,
        finalize: ctx.conditions.finalize,
        breakpoints: { keys: ctx.conditions.breakpoints.keys },
      },
      utility: {
        prefix: ctx.utility.prefix,
        hasShorthand: false,
        resolveShorthand: (prop: string) => prop,
        toHash: ctx.utility.toHash.bind(ctx.utility),
        transform: (prop: string, value: any) => {
          if (value === '__ignore__') return { className }
          return { className: `${className}--${prop}${separator}${withoutSpace(value)}` }
        },
      },
    })

    const recipeStyles = { [className]: '__ignore__', ...defaultVariants, ...compact(variants) }

    // The generated `transform` calls `assertCompoundVariant` on every prop, which throws
    // for a conditional variant value on a recipe that has compound variants. So the
    // runtime does not return a class here at all — it crashes. Declining leaves the call
    // on its runtime path and the crash where the user put it; folding would quietly
    // repair a bug rather than preserve behaviour. Spelled the way the assert spells it,
    // `typeof` against the variants as passed, so the two agree on the edge cases.
    if (compoundVariants.length > 0 && Object.keys(recipeStyles).some((prop) => typeof variants[prop] === 'object')) {
      return undefined
    }

    const compoundStyles = getCompoundVariantCss(compoundVariants as Dict[], recipeStyles, mergeCss)

    return [recipeCss(recipeStyles), runtimeCss(compoundStyles)].filter(Boolean).join(' ')
  }
}

/**
 * Mirrors the function of the same name in the generated `cva` artifact, down to the
 * `mergeCss` it accumulates with.
 *
 * That merge has to be the deep one. More than one compound variant can match a single
 * selection, and their `css` objects then combine rather than replace: `_hover` set by
 * one and `_hover` set by another have to end up as a single condition holding both
 * declarations. `Object.assign` drops everything the earlier match contributed under a
 * shared key, which produces a shorter class list and no error at all.
 *
 * Taking `mergeCss` as an argument rather than importing one keeps it the same instance
 * the rest of the fold resolves through, built from the same context.
 */
export const getCompoundVariantCss = (
  compoundVariants: Dict[],
  variantMap: Dict,
  mergeCss: (...styles: Dict[]) => Dict,
): Dict => {
  let result: Dict = {}

  for (const compoundVariant of compoundVariants) {
    if (!compoundVariant) continue

    const isMatching = Object.entries(compoundVariant).every(([key, value]) => {
      if (key === 'css') return true
      const values = Array.isArray(value) ? value : [value]
      return values.some((entry) => variantMap[key] === entry)
    })

    if (isMatching) result = mergeCss(result, compoundVariant.css)
  }

  return result
}
