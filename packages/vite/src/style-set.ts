import type { Context } from '@bamboocss/core'
import { compact, createMergeCss } from '@bamboocss/shared'
import type { Dict } from '@bamboocss/types'
import { createCssContext, type RuntimeCss } from './runtime-css'

/**
 * The build-time meaning of a recipe, before any class name is allocated.
 *
 * Recipe names and source files are deliberately absent. They select a style set; they are
 * not part of a declaration's identity. Keeping this shape beside the Vite fold lets the
 * compiler merge a recipe with `css()` before either is materialised as a class string.
 */
export interface StyleSetRecipeConfig {
  base?: Dict
  variants?: Record<string, Record<string, unknown>>
  defaultVariants?: Record<string, unknown>
  compoundVariants?: Array<Record<string, unknown>>
  slots?: string[]
}

export interface StaticStyleSetCompiler {
  /** Merge style sets with the same left-to-right precedence as `css(a, b)`. */
  compose(...styles: Dict[]): Dict
  /** Resolve one recipe selection to authored styles. */
  resolveRecipe(config: StyleSetRecipeConfig, selection?: Dict, slot?: string): Dict | undefined
  /** Allocate the ordinary globally shared utility atoms for a style set. */
  className(...styles: Dict[]): string
  /** Allocate a compact class for a non-atomic compiler surface such as `viewTransition()`. */
  allocateClassString(className: string): string
}

const isRecord = (value: unknown): value is Dict => Boolean(value) && typeof value === 'object' && !Array.isArray(value)

/** A compound selector matches only through variant classes the recipe actually emits. */
const matchesCompound = (
  compound: Record<string, unknown>,
  selection: Dict,
  variants: StyleSetRecipeConfig['variants'],
) => {
  for (const [key, expected] of Object.entries(compound)) {
    if (key === 'css') continue
    const declared = variants?.[key]
    const selected = selection[key]
    // The named-rule representation has no class for an absent or undeclared value, so a
    // compound selector requiring it can never match. Preserve that behavior when replacing
    // the selector with a complete StyleSet; this also makes static and finite-miss paths agree.
    if (selected == null || !declared || !Object.hasOwn(declared, String(selected))) return false
    const alternatives = Array.isArray(expected) ? expected : [expected]
    // Variant classes are named through property-key coercion. A boolean `false` selection
    // and a compound value written as `'false'` therefore select the same CSS conjunction.
    if (!alternatives.some((value) => value != null && String(selected) === String(value))) return false
  }
  return true
}

/**
 * Resolve the style fragments one recipe call contributes, in emitted-rule precedence.
 *
 * This intentionally rejects conditional variant *selections*. A scalar selects a style
 * object; an object such as `{ base: 'sm', md: 'lg' }` selects several objects under
 * conditions and needs a separate lowering. Returning `undefined` rejects that call instead
 * of silently compiling only one branch.
 */
export const createStaticStyleSetCompiler = (
  ctx: Context,
  runtimeCss: RuntimeCss,
  allocateClassString: (className: string) => string = (className) => className,
): StaticStyleSetCompiler => {
  const { mergeCssUncached } = createMergeCss(createCssContext(ctx))

  const compose = (...styles: Dict[]) => mergeCssUncached(...styles)

  const resolveRecipe = (config: StyleSetRecipeConfig, input: Dict = {}, slot?: string): Dict | undefined => {
    const slots = Array.isArray(config.slots) ? config.slots : undefined
    if (Boolean(slots) !== Boolean(slot)) return undefined
    if (slot && !slots?.includes(slot)) return undefined

    const selection = { ...(config.defaultVariants ?? {}), ...compact(input) }
    if (Object.values(selection).some((value) => isRecord(value))) return undefined

    const fragments: Dict[] = []
    const take = (candidate: unknown) => {
      if (!isRecord(candidate)) return
      const styles = slot ? candidate[slot] : candidate
      if (isRecord(styles)) fragments.push(styles)
    }

    take(config.base)

    // Recipe rules are emitted in declaration order, and later variant axes therefore win
    // when two selected axes write the same property. A call site's object-key order never
    // changes that CSS precedence. Resolve in the config's order as well, so replacing those
    // rules with one complete StyleSet is behavior-preserving and an opaque props object does
    // not make precedence depend on how a caller happened to construct it.
    for (const variant of Object.keys(config.variants ?? {})) {
      const value = selection[variant]
      if (value == null) continue
      take(config.variants?.[variant]?.[String(value)])
    }

    for (const compound of config.compoundVariants ?? []) {
      if (!isRecord(compound) || !matchesCompound(compound, selection, config.variants)) continue
      take(compound.css)
    }

    return compose(...fragments)
  }

  return {
    compose,
    resolveRecipe,
    className: (...styles) => runtimeCss(...styles),
    allocateClassString,
  }
}
