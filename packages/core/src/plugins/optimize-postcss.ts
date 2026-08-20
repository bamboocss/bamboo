import { createRequire } from 'node:module'
import postcss, { type Document, type Root } from 'postcss'
import type minifySelectorsPlugin from 'postcss-minify-selectors'
import nested from 'postcss-nested'
import type normalizeWhiteSpacePlugin from 'postcss-normalize-whitespace'
import { dedupeNodes } from './dedupe-nodes'
import { discardEmpty } from './discard-empty'
import { mergeRules } from './merge-rules'
import prettify from './prettify'

interface OptimizeOptions {
  minify?: boolean
}

/**
 * The documented browser baseline, as exact floor versions.
 *
 * Support is a question about the *floor*, so the floor is all this names. An open-ended
 * `chrome >= 118` would also drag in whatever browserslist believes is current, and that
 * is where this goes wrong: browserslist enumerates versions from `baseline-browser-mapping`
 * while `caniuse-api` answers from `caniuse-lite`, which lags it. With the pinned data the
 * two disagree by five Chrome releases, so `chrome >= 118` reports `:is()` unsupported --
 * on the strength of Chrome 150, which has supported it since 88. Naming the floor asks the
 * question we mean and gets the same answer from any `caniuse-lite`.
 *
 * Keep in sync with `website/content/docs/overview/browser-support.mdx`.
 */
const BASELINE = ['chrome 123', 'edge 123', 'firefox 146', 'ios_saf 17.5', 'safari 17.5', 'opera 109']

/**
 * The minifier, loaded the first time something is actually minified.
 *
 * `postcss-minify-selectors` reaches `browserslist` for the `convertToIs` gate, and importing
 * browserslist loads `caniuse-lite` — 598 separate CommonJS files. Statically imported, every
 * consumer of this package paid all of it at module load, including dev servers and any build
 * that never minifies, which is roughly two thirds of the 949 modules `@bamboocss/node` used to
 * compile on import. `optimizePostCss` is synchronous, so this is a lazy `require`; the pinned
 * `overrideBrowserslist` below means none of that data can reach the output either way.
 */
interface Minifiers {
  minifySelectors: typeof minifySelectorsPlugin
  normalizeWhiteSpace: typeof normalizeWhiteSpacePlugin
}

let minifiers: Minifiers | undefined
const loadMinifiers = (): Minifiers => {
  if (minifiers) return minifiers
  const load = createRequire(import.meta.url)
  // Both are CommonJS with a single default export; `require` of one under an ESM build hands
  // back the namespace instead, so accept either shape rather than assuming the interop.
  const interop = <Plugin>(id: string): Plugin => {
    const module = load(id)
    return (module.default ?? module) as Plugin
  }
  minifiers = {
    minifySelectors: interop<typeof minifySelectorsPlugin>('postcss-minify-selectors'),
    normalizeWhiteSpace: interop<typeof normalizeWhiteSpacePlugin>('postcss-normalize-whitespace'),
  }
  return minifiers
}

export function optimizePostCss(code: string | Root | Document, options: OptimizeOptions = {}) {
  const { minify = false } = options

  // prettier-ignore
  const plugins = [
    nested(),
    dedupeNodes(),
    mergeRules(),
    discardEmpty(),
  ]

  if (minify) {
    // `convertToIs` (new in postcss-minify-selectors 8) folds a shared prefix in a selector
    // list into `:is(...)`. It is gated on the browserslist target supporting `:is()`, and
    // left alone it resolves that target from `process.cwd()` -- the consuming project, not
    // `config.browserslist`. That would make the same input emit different CSS depending on
    // where the build ran. Passing BASELINE pins the answer to what we document instead.
    const { minifySelectors, normalizeWhiteSpace } = loadMinifiers()
    plugins.push(normalizeWhiteSpace(), minifySelectors({ convertToIs: true, overrideBrowserslist: BASELINE }))
  } else {
    plugins.push(prettify() as any)
  }

  const { css } = postcss(plugins).process(code)
  return css
}
