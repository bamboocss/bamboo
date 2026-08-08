import postcss, { Container } from 'postcss'
import discardEmpty from 'postcss-discard-empty'
import minifySelectors from 'postcss-minify-selectors'
import nested from 'postcss-nested'
import normalizeWhiteSpace from 'postcss-normalize-whitespace'
import { dedupeNodes } from './dedupe-nodes'
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

export function optimizePostCss(code: string | Container, options: OptimizeOptions = {}) {
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
    plugins.push(normalizeWhiteSpace(), minifySelectors({ convertToIs: true, overrideBrowserslist: BASELINE }))
  } else {
    plugins.push(prettify() as any)
  }

  const { css } = postcss(plugins).process(code)
  return css
}
