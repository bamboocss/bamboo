import type { BambooHooks } from '@bamboocss/types'
import postcss, { type Document, type Root } from 'postcss'
import nested from 'postcss-nested'
import { optimizePostCss } from './plugins/optimize-postcss'
import prettify from './plugins/prettify'

interface OptimizeOptions {
  minify?: boolean
  browserslist?: string[]
  hooks?: Partial<BambooHooks>
}

/**
 * `css` is a thunk because the hook is the only thing that needs the text. A caller holding a
 * tree pays to serialize it only when a `css:optimize` hook is actually registered.
 */
function runOptimize(code: string | Root | Document, css: () => string, options: OptimizeOptions) {
  const { hooks } = options

  if (hooks?.['css:optimize']) {
    const result = hooks['css:optimize']({
      css: css(),
      minify: options.minify,
      browserslist: options.browserslist,
    })
    // Note that a hook merged through `mergeHooks` returns the css it was handed rather than
    // `undefined` when every registered implementation declines, so this branch is what runs
    // for any project with a plugin that defines `css:optimize` at all. Longstanding, and
    // unrelated to the tree/string split here.
    if (result !== undefined) {
      return result
    }
  }

  return optimizePostCss(code, options)
}

/**
 * Optimize a stylesheet, leaving anything it was given alone.
 *
 * A `Root` argument is serialized rather than handed to postcss, which is what keeps that
 * promise: the pipeline behind `optimizePostCss` merges rules, drops nodes and rewrites
 * whitespace, all in place. This was previously true only by accident -- the serialization
 * existed for the hook -- and callers of the exported function depend on it.
 *
 * `optimizeCssRoot` is the same work without that guarantee, for the one caller that owns its
 * tree outright.
 */
export function optimizeCss(code: string | Root, options: OptimizeOptions = {}) {
  const css = typeof code === 'string' ? code : code.toString()
  return runOptimize(css, () => css, options)
}

/**
 * `optimizeCss` for a tree the caller is finished with. **Consumes `root`** -- it comes back
 * merged, pruned and reformatted -- so it is deliberately not exported from the package index.
 *
 * `Stylesheet.toCss` is the caller it exists for. It builds a clone precisely so that the
 * pipeline has something of its own to rewrite, and serializing that clone only for postcss to
 * parse it straight back cost 13.0ms against the clone's 6.8ms on a 432 kB sheet.
 */
export function optimizeCssRoot(root: Root | Document, options: OptimizeOptions = {}) {
  return runOptimize(root, () => root.toString(), options)
}

export function expandNestedCss(code: string) {
  const { css } = postcss([nested(), prettify()]).process(code)
  return css
}
