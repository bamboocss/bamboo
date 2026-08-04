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

export const createRuntimeCss = (ctx: Context): RuntimeCss => {
  const cssContext = {
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
  }

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
    const compoundStyles = getCompoundVariantCss(compoundVariants as Dict[], recipeStyles)

    return [recipeCss(recipeStyles), runtimeCss(compoundStyles)].filter(Boolean).join(' ')
  }
}

/** Mirrors the function of the same name in the generated `cva` artifact. */
const getCompoundVariantCss = (compoundVariants: Dict[], variantMap: Dict): Dict => {
  let result: Dict = {}

  for (const compoundVariant of compoundVariants) {
    if (!compoundVariant) continue

    const isMatching = Object.entries(compoundVariant).every(([key, value]) => {
      if (key === 'css') return true
      const values = Array.isArray(value) ? value : [value]
      return values.some((entry) => variantMap[key] === entry)
    })

    if (isMatching) result = Object.assign({}, result, compoundVariant.css)
  }

  return result
}
