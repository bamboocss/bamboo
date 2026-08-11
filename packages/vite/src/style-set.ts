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
}

const isRecord = (value: unknown): value is Dict => Boolean(value) && typeof value === 'object' && !Array.isArray(value)

/** A compound selection matches before its `css` payload is read. */
const matchesCompound = (compound: Record<string, unknown>, selection: Dict) => {
  for (const [key, expected] of Object.entries(compound)) {
    if (key === 'css') continue
    const alternatives = Array.isArray(expected) ? expected : [expected]
    if (!alternatives.some((value) => selection[key] === value)) return false
  }
  return true
}

/**
 * Resolve the style fragments one recipe call contributes, in runtime merge order.
 *
 * This intentionally rejects conditional variant *selections*. A scalar selects a style
 * object; an object such as `{ base: 'sm', md: 'lg' }` selects several objects under
 * conditions and needs a separate lowering. Returning `undefined` keeps that call on the
 * established recipe path instead of silently compiling only one branch.
 */
export const createStaticStyleSetCompiler = (ctx: Context, runtimeCss: RuntimeCss): StaticStyleSetCompiler => {
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

    // Preserve the runtime's selection order: existing default keys keep their position,
    // and newly supplied keys append in the order the caller wrote them.
    for (const [variant, value] of Object.entries(selection)) {
      if (value == null) continue
      take(config.variants?.[variant]?.[String(value)])
    }

    for (const compound of config.compoundVariants ?? []) {
      if (!isRecord(compound) || !matchesCompound(compound, selection)) continue
      take(compound.css)
    }

    return compose(...fragments)
  }

  return {
    compose,
    resolveRecipe,
    className: (...styles) => runtimeCss(...styles),
  }
}
