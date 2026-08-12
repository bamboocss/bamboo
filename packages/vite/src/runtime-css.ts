import type { Context } from '@bamboocss/core'
import { createCssUncached, createMergeCss, memo } from '@bamboocss/shared'
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
 * Mirrors `generateCssFn` in `@bamboocss/generator`: `css = memo((...styles) =>
 * cssFn(mergeCssUncached(...styles)))`, with the memo on the argument list and neither
 * inner cache. Unlike the generated runtime this one is built once per build and shared
 * across every module, so the outer cache is what carries the repeats.
 */
export interface RuntimeCss {
  (...styles: Dict[]): string
}

/** The shape `createCss` and `createMergeCss` both take, derived from a resolved context. */
export const createCssContext = (ctx: Context) => ({
  hash: Boolean(ctx.hash.className),
  conditions: {
    shift: ctx.conditions.shift,
    finalize: ctx.conditions.finalize,
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

  const cssFn = createCssUncached(cssContext)
  const { mergeCssUncached } = createMergeCss(cssContext)

  return memo((...styles: Dict[]) => cssFn(mergeCssUncached(...styles)))
}

/**
 * The generated runtime's `token.value`, rebuilt in-process from a resolved context.
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
 *
 * Both halves of the generated entry are stored, because `token()` and `token.value()` read
 * different ones and building a second table would pay the same per-project cost twice.
 */
const tokenValues = new WeakMap<Context, Map<string, { value: unknown; variable: string }>>()

const tokenValuesFor = (ctx: Context) => {
  let values = tokenValues.get(ctx)
  if (values) return values

  values = new Map<string, { value: unknown; variable: string }>()
  for (const token of ctx.tokens.allTokens) {
    const { varRef, isVirtual, condition } = token.extensions
    // Both halves through the view, for the reason `generateTokenJs` does it: a negative
    // token's `varRef` names its *positive* counterpart, so reading it would flip the sign.
    values.set(token.name, {
      value: ctx.tokens.view.get(token.name) ?? (isVirtual || condition !== 'base' ? varRef : token.value),
      variable: ctx.tokens.view.getVar(token.name) ?? varRef,
    })
  }
  tokenValues.set(ctx, values)

  return values
}

export const createRuntimeTokenValue =
  (ctx: Context): RuntimeToken =>
  (path) => {
    const value = tokenValuesFor(ctx).get(path)?.value
    // Only a string can stand in for what the runtime returned. A token whose value is a
    // number would fold to `123` where the runtime returns the number `123` — the same
    // text, a different type.
    return typeof value === 'string' ? value : undefined
  }

/**
 * The generated runtime's `token()`, rebuilt in-process.
 *
 * Reads the `variable` half of the same entry `token.value()` reads the `value` half of.
 * That half is `varRef` for every token regardless of condition, so unlike
 * `createRuntimeTokenValue` there is no split to get wrong and no non-string case to
 * decline: a `var()` reference is a string or the token does not exist. Which is what makes
 * the default form the trivially foldable one.
 */
export const createRuntimeToken =
  (ctx: Context): RuntimeToken =>
  (path) =>
    tokenValuesFor(ctx).get(path)?.variable || undefined
