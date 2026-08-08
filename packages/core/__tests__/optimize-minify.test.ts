import { createGeneratorContext } from '@bamboocss/fixture'
import type { Dict } from '@bamboocss/types'
import { afterEach, describe, expect, test } from 'vitest'
import { optimizePostCss } from '../src/plugins/optimize-postcss'

/**
 * The minified branch had no coverage at all, which is how a dependency bump came to change
 * `postcss-minify-selectors` from "sort and dedupe a selector list" to "fold it into `:is()`"
 * without a single test noticing. Everything else here runs `minify: false`.
 *
 * The shapes below are the ones `globalCss` produces, because that is the only place the fold
 * has anything to bite on. Atomic and recipe output has no foldable selector: each atomic
 * class carries a unique declaration, so `merge-rules` never combines two into a list with
 * shared structure, and a scoped slot variant is a plain selector inside an `@scope` block
 * rather than a list. Across every stylesheet generated in this repo that is 59 selector
 * lists and none foldable -- so a test written against recipe output would assert nothing.
 */

function minify(code: string) {
  return optimizePostCss(code, { minify: true })
}

/** The authored rules, without the `@property` block `toCss` appends to the base layer. */
function globalCss(values: Dict) {
  const ctx = createGeneratorContext()
  const sheet = ctx.createSheet()
  sheet.processGlobalCss(values)
  return sheet.toCss({ minify: true }).match(/@layer base\{(.*?)@property/s)?.[1] ?? ''
}

describe('optimize (minify) folds a selector list into :is()', () => {
  test('a list nested under a parent', () => {
    expect(globalCss({ '.card': { '& h1, & h2': { fontWeight: 'bold' } } })).toMatchInlineSnapshot(
      `".card :is(h1,h2){font-weight:var(--font-weights-bold)}"`,
    )
  })

  test('a list sharing a trailing compound', () => {
    expect(globalCss({ '.a .icon, .b .icon': { color: 'red' } })).toMatchInlineSnapshot(`":is(.a,.b) .icon{color:red}"`)
  })

  /**
   * `:is(.nav,.footer) a` is longer than the list it replaces, so upstream leaves it. Worth
   * pinning: it is the reason a shared prefix does not imply a fold.
   */
  test('but not when the fold would be longer', () => {
    expect(globalCss({ '.nav a, .footer a': { color: 'red' } })).toMatchInlineSnapshot(`".footer a,.nav a{color:red}"`)
  })

  test('and not a single selector', () => {
    expect(minify(`.text_red { color: red }`)).toMatchInlineSnapshot(`".text_red{color:red}"`)
  })

  test('a @scope prelude is left intact', () => {
    expect(
      minify(`@scope (.checkbox__root--size_md) to (.checkbox__root) {
        .checkbox__control { width: 10px }
      }`),
    ).toMatchInlineSnapshot(`"@scope (.checkbox__root--size_md) to (.checkbox__root){.checkbox__control{width:10px}}"`)
  })
})

describe('optimize (minify) is independent of the ambient browserslist', () => {
  const original = process.env.BROWSERSLIST

  afterEach(() => {
    if (original === undefined) delete process.env.BROWSERSLIST
    else process.env.BROWSERSLIST = original
  })

  /**
   * `minifySelectors` resolves its target from `process.cwd()` unless given one, so without
   * the explicit baseline this input compiles one way in this repo and another in a project
   * whose browserslist happens to sit below `:is()`. Emitted CSS is not allowed to depend on
   * where the build ran.
   *
   * `ie 11` and `op_mini all` genuinely lack `:is()`; both would switch the fold off if the
   * ambient target were the one being consulted.
   */
  const input = `.a .icon, .b .icon { color: red }`

  test.each(['ie 11', 'op_mini all', 'chrome 120', 'defaults'])(
    'emits the folded CSS under BROWSERSLIST=%s',
    (query) => {
      process.env.BROWSERSLIST = query
      expect(minify(input)).toBe(':is(.a,.b) .icon{color:red}')
    },
  )
})
