import type { Context } from '@bamboocss/core'
import type { ArtifactFilters, JsxFramework } from '@bamboocss/types'
import {
  generatePreactJsxFactory,
  generatePreactJsxPattern,
  generatePreactJsxTypes,
  generatePreactCreateStyleContext,
} from './preact-jsx'
import { generateQwikJsxFactory, generateQwikJsxPattern, generateQwikJsxTypes } from './qwik-jsx'
import {
  generateReactJsxFactory,
  generateReactJsxPattern,
  generateReactJsxTypes,
  generateReactCreateStyleContext,
} from './react-jsx'
import {
  generateSolidJsxFactory,
  generateSolidJsxPattern,
  generateSolidJsxTypes,
  generateSolidCreateStyleContext,
} from './solid-jsx'
import {
  generateVueJsxFactory,
  generateVueJsxPattern,
  generateVueJsxTypes,
  generateVueCreateStyleContext,
} from './vue-jsx'

/* -----------------------------------------------------------------------------
 * JSX Types
 * -----------------------------------------------------------------------------*/

const typesMap = {
  react: generateReactJsxTypes,
  preact: generatePreactJsxTypes,
  solid: generateSolidJsxTypes,
  vue: generateVueJsxTypes,
  qwik: generateQwikJsxTypes,
}

const isKnownFramework = (framework: string): framework is JsxFramework => Boolean((typesMap as any)[framework])

export function generateJsxTypes(ctx: Context) {
  if (!ctx.jsx.framework) return
  if (!isKnownFramework(ctx.jsx.framework)) return
  return typesMap[ctx.jsx.framework]?.(ctx)
}

/* -----------------------------------------------------------------------------
 * Factory JSX
 * -----------------------------------------------------------------------------*/

const factoryMap = {
  react: generateReactJsxFactory,
  solid: generateSolidJsxFactory,
  preact: generatePreactJsxFactory,
  vue: generateVueJsxFactory,
  qwik: generateQwikJsxFactory,
}

export function generateJsxFactory(ctx: Context) {
  if (!ctx.jsx.framework) return
  if (!isKnownFramework(ctx.jsx.framework)) return
  return factoryMap[ctx.jsx.framework]?.(ctx)
}

/* -----------------------------------------------------------------------------
 * Pattern JSX
 * -----------------------------------------------------------------------------*/

const patternMap = {
  react: generateReactJsxPattern,
  solid: generateSolidJsxPattern,
  preact: generatePreactJsxPattern,
  vue: generateVueJsxPattern,
  qwik: generateQwikJsxPattern,
}

export function generateJsxPatterns(ctx: Context, filters?: ArtifactFilters) {
  if (ctx.patterns.isEmpty() || !ctx.jsx.framework) return []
  if (!isKnownFramework(ctx.jsx.framework)) return
  return patternMap[ctx.jsx.framework!](ctx, filters)
}

/* -----------------------------------------------------------------------------
 * Create Style Context JSX
 * -----------------------------------------------------------------------------*/

const createStyleContextMap = {
  react: generateReactCreateStyleContext,
  preact: generatePreactCreateStyleContext,
  solid: generateSolidCreateStyleContext,
  vue: generateVueCreateStyleContext,
}

export function generateJsxCreateStyleContext(ctx: Context) {
  if (!ctx.jsx.framework) return
  if (!isKnownFramework(ctx.jsx.framework)) return
  const generator = (createStyleContextMap as any)[ctx.jsx.framework]
  return generator?.(ctx)
}
