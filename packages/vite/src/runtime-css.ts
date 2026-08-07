import { Recipes, type Context } from '@bamboocss/core'
import { compact, createCss, createMergeCss, getSlotCompoundVariant, withoutSpace } from '@bamboocss/shared'
import type { Dict, SlotRecipeConfig } from '@bamboocss/types'

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
 * The generated runtime's `token`, rebuilt in-process from a resolved context.
 *
 * Mirrors `generateTokenJs` in `@bamboocss/generator`, down to which of a token's two
 * values it resolves to: a virtual or conditional token resolves to its `var()` reference,
 * everything else to its literal value. Getting that split wrong would inline a raw colour
 * where the runtime emits a variable, and the two would stop agreeing the moment a theme
 * switched — the one difference a fold can make that no class-name check would catch.
 *
 * Built once per context rather than per call site. It is every token in the project, and
 * the fold asks it one question per `token()` call.
 */
export interface RuntimeToken {
  (path: string): string | undefined
}

/**
 * The map is every token in the project, so it is built once per context and shared by
 * every module in the build — not once per `foldSource`, which would price a whole token
 * table into each of the overwhelming majority of modules that call `token()` zero times.
 * Keyed weakly so a context that goes out of scope takes its table with it.
 */
const tokenValues = new WeakMap<Context, Map<string, unknown>>()

const tokenValuesFor = (ctx: Context) => {
  let values = tokenValues.get(ctx)
  if (values) return values

  values = new Map<string, unknown>()
  for (const token of ctx.tokens.allTokens) {
    const { varRef, isVirtual, condition } = token.extensions
    values.set(token.name, isVirtual || condition !== 'base' ? varRef : token.value)
  }
  tokenValues.set(ctx, values)

  return values
}

export const createRuntimeToken =
  (ctx: Context): RuntimeToken =>
  (path) => {
    const value = tokenValuesFor(ctx).get(path)
    // Only a string can stand in for what the runtime returned. A token whose value is a
    // number would fold to `123` where the runtime returns the number `123` — the same
    // text, a different type.
    return typeof value === 'string' ? value : undefined
  }

/**
 * The generated `createRecipe`, rebuilt in-process.
 *
 * A config recipe call resolves to `recipeCss(variants)` and nothing else. The recipe's own
 * `createCss` differs from the ordinary one only in its `transform`, which names classes
 * `recipe--prop_value` instead of going through the utility table.
 *
 * Compound variants contribute no class to either side: their rule selects on the variant
 * classes `recipeCss` already named, so it applies without one. `getCompoundVariantCss`
 * below is still mirrored from the generated artifact, but for `raw()` — which returns
 * styles rather than classes — and `__tests__/recipe-runtime-parity.test.ts` checks it
 * against the functions a real codegen produced rather than against itself.
 *
 * Mirrors `generateCreateRecipeFn` in `@bamboocss/generator`.
 */
export interface RuntimeRecipe {
  /**
   * `slot` resolves one slot of a slot recipe. Without it a slot recipe is declined, since
   * the whole call returns an object rather than a string.
   */
  (name: string, variants: Dict, slot?: string): string | undefined
}

/**
 * Whether a slot's class is independent of the variant props.
 *
 * A scoped slot recipe delivers variants through `@scope` rules anchored on an enclosing
 * slot, so every *other* slot carries a constant class — the same string whatever the props
 * are. That is what makes `recipe(anything).slot` foldable even when the variant is fully
 * dynamic, which was not true before scoping existed.
 */
export const createConstantSlotCheck =
  (ctx: Context) =>
  (name: string, slot: string): boolean => {
    const config = ctx.recipes.getConfig(name)
    if (!config || !('slots' in config)) return false

    const slots = (config as SlotRecipeConfig).slots as string[]
    if (!slots.includes(slot)) return false

    const anchors = Recipes.getScopeRoots(config as SlotRecipeConfig)
    return anchors.length > 0 && !anchors.includes(slot)
  }

export const createRuntimeRecipe = (ctx: Context): RuntimeRecipe => {
  const separator = ctx.utility.separator

  return (name, variants, slot) => {
    const config = ctx.recipes.getConfig(name)
    const node = ctx.recipes.getRecipe(name)
    if (!config || !node) return undefined

    const isSlotRecipe = 'slots' in config
    // A whole slot recipe call returns one class per slot rather than a string, so it can
    // only be folded a slot at a time.
    if (isSlotRecipe !== Boolean(slot)) return undefined
    if (slot && !((config as SlotRecipeConfig).slots as string[]).includes(slot)) return undefined

    // A slot that no anchor takes variants for is a constant: its class does not depend on
    // the props at all, so it folds even when the variant is fully dynamic. That is what
    // scoping bought — before it, every slot carried a variant class.
    const anchors = isSlotRecipe ? Recipes.getScopeRoots(config as SlotRecipeConfig) : []
    const isConstantSlot = Boolean(slot) && anchors.length > 0 && !anchors.includes(slot as string)

    const className = slot ? ctx.recipes.getSlotKey(node.className, slot) : node.className
    const { defaultVariants = {} } = config
    const compoundVariants = slot
      ? getSlotCompoundVariant((config.compoundVariants ?? []) as Array<{ css: any }>, slot)
      : ((config.compoundVariants ?? []) as Dict[])

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

    // Built through `recipeCss` even for a constant, rather than by concatenating the name:
    // `hash.className` and `prefix` are applied there, and reconstructing the string is
    // exactly how the runtime and the stylesheet drifted apart once already.
    const recipeStyles = isConstantSlot
      ? { [className]: '__ignore__' }
      : { [className]: '__ignore__', ...defaultVariants, ...compact(variants) }

    // The generated `transform` calls `assertCompoundVariant` on every prop, which throws
    // for a conditional variant value on a recipe that has compound variants. So the
    // runtime does not return a class here at all — it crashes. Declining leaves the call
    // on its runtime path and the crash where the user put it; folding would quietly
    // repair a bug rather than preserve behaviour. Spelled the way the assert spells it,
    // `typeof` against the variants as passed, so the two agree on the edge cases.
    if (compoundVariants.length > 0 && Object.keys(recipeStyles).some((prop) => typeof variants[prop] === 'object')) {
      return undefined
    }

    // A slot recipe evaluates *every* anchor's `recipeFn`, so the throw can come from an
    // anchor's compound variants rather than from this slot's. A constant slot is not
    // exempt: its class does not depend on the props, but the call it replaces still runs
    // the anchor's assert.
    if (isSlotRecipe) {
      const anchorThrows = anchors.some(
        (anchor) =>
          getSlotCompoundVariant((config.compoundVariants ?? []) as Array<{ css: any }>, anchor).length > 0 &&
          Object.values(variants).some((value) => typeof value === 'object' && value !== null),
      )
      if (anchorThrows) return undefined
    }

    // No class for the compound variants. Their rule selects on the variant classes
    // `recipeCss` just named — `.button--visual_solid.button--size_sm` — so it applies
    // without one, and the generated `createRecipe` returns none either.
    return recipeCss(recipeStyles)
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
