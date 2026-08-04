import type { Context } from '@bamboocss/core'
import { createCss, createMergeCss } from '@bamboocss/shared'
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
