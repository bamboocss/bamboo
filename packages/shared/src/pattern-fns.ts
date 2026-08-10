import { compact } from './compact'
import { isCssFunction } from './is-css-function'
import { isCssUnit } from './is-css-unit'
import { isCssVar } from './is-css-var'
import { mapObject } from './walk-object'

/**
 * Resolves a token path to its css variable reference, or returns `fallback` when the path names
 * no token.
 *
 * A pattern transform is otherwise token-blind, which is why it used to defer the question into a
 * string — `token(spacing.4, 4)` — for the css pipeline to answer later. That deferral is what
 * required a parser, and what left a token reference opaque until late. Answered here, a pattern
 * emits a concrete value.
 *
 * Every context that runs a transform has to answer identically, because the value becomes a
 * class name and the build's copy must match the browser's.
 */
export type PatternTokenFn = (path: string, fallback?: string) => string | undefined

export const createPatternFns = (token: PatternTokenFn) => ({
  map: mapObject,
  isCssFunction,
  isCssVar,
  isCssUnit,
  token,
})

/**
 * For a context with no dictionary to consult. Every path is treated as naming no token, which
 * is what an extraction pass that only wants the shape of the styles needs.
 */
export const patternFns = createPatternFns((_path, fallback) => fallback)

export const getPatternStyles = (pattern: any, styles: Record<string, any>) => {
  if (!pattern?.defaultValues) return styles
  const defaults = typeof pattern.defaultValues === 'function' ? pattern.defaultValues(styles) : pattern.defaultValues
  return Object.assign({}, defaults, compact(styles))
}
