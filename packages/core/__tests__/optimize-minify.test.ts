import { afterEach, describe, expect, test } from 'vitest'
import { optimizePostCss } from '../src/plugins/optimize-postcss'

/**
 * The minified branch had no coverage at all, which is how a dependency bump came to change
 * `postcss-minify-selectors` from "sort and dedupe a selector list" to "fold it into `:is()`"
 * without a single test noticing. Everything else here runs `minify: false`.
 */

function minify(code: string) {
  return optimizePostCss(code, { minify: true })
}

describe('optimize (minify)', () => {
  test('folds a shared prefix into :is()', () => {
    expect(
      minify(`
      .checkbox__root--size_md .checkbox__control { width: 10px }
      .checkbox__root--size_lg .checkbox__control { width: 10px }`),
    ).toMatchInlineSnapshot(`":is(.checkbox__root--size_lg,.checkbox__root--size_md) .checkbox__control{width:10px}"`)
  })

  test('leaves a selector list with nothing in common alone', () => {
    expect(
      minify(`
      .bg_blue { background: blue }
      .bg_navy { background: blue }`),
    ).toMatchInlineSnapshot(`".bg_blue,.bg_navy{background:blue}"`)
  })

  test('folds under a condition prefix', () => {
    expect(
      minify(`
      .dark .text_red { color: red }
      .dark .text_crimson { color: red }`),
    ).toMatchInlineSnapshot(`".dark :is(.text_crimson,.text_red){color:red}"`)
  })

  test('leaves a single selector alone', () => {
    expect(minify(`.text_red { color: red }`)).toMatchInlineSnapshot(`".text_red{color:red}"`)
  })

  test('keeps a @scope prelude intact', () => {
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
   */
  const input = `
    .checkbox__root--size_md .checkbox__control { width: 10px }
    .checkbox__root--size_lg .checkbox__control { width: 10px }`

  // `ie 11` and `op_mini all` genuinely lack `:is()`; both would switch the fold off if the
  // ambient target were the one being consulted.
  test.each(['ie 11', 'op_mini all', 'chrome 120', 'defaults'])(
    'emits the folded CSS under BROWSERSLIST=%s',
    (query) => {
      process.env.BROWSERSLIST = query
      expect(minify(input)).toBe(
        ':is(.checkbox__root--size_lg,.checkbox__root--size_md) .checkbox__control{width:10px}',
      )
    },
  )
})
