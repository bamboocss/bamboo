import postcss from 'postcss'
import { describe, expect, test } from 'vitest'
import { prunePreflight } from '../src/prune-preflight'

/**
 * Two thirds of the reset is bound to specific elements — 41 of them, covering `table`,
 * `pre`, `kbd`, `optgroup` and the rest of the long tail. The reset is a fixed size, so it
 * dominates a small stylesheet: a third of one sandbox's css here and four fifths of
 * another's. Dropping what the source never renders is worth 15% and 29% gzipped.
 *
 * It is the one saving in this area that survives compression, because it emits less rather
 * than spelling the same thing differently.
 */
const run = (css: string, rendered: string[], scope?: string) => {
  const root = postcss.parse(css)
  const result = prunePreflight({ target: root, rendered: new Set(rendered), scope })
  return { css: root.toString(), ...result }
}

describe('prunePreflight', () => {
  test('drops a rule for an element the source never renders', () => {
    expect(run(`table{border-collapse:collapse}`, ['div']).css).toBe('')
  })

  test('keeps a rule for an element the source renders', () => {
    expect(run(`table{border-collapse:collapse}`, ['table']).css).toBe('table{border-collapse:collapse}')
  })

  /** Never removable: they are not written in a component, and losing their reset is silent. */
  test.each(['html', 'body'])('never drops %s', (element) => {
    expect(run(`${element}{line-height:1.5}`, ['div']).css).toContain(element)
  })

  /**
   * A selector list loses only the parts that name unrendered elements, so a rule shared
   * between an element and a pseudo keeps the half that still applies.
   */
  test('trims only the unrendered parts of a selector list', () => {
    const { css } = run(`button, input, ::file-selector-button{appearance:button}`, ['button'])

    expect(css).toContain('button')
    expect(css).toContain('::file-selector-button')
    expect(css).not.toMatch(/(^|,)\s*input/)
  })

  /**
   * Nothing about a universal or pseudo-only selector says which element it reaches.
   *
   * `:host` is in this list rather than in the always-kept set it once sat in: it is a
   * pseudo-class, so it reports no element and is kept by that rule alone. The shape the
   * reset actually emits is `html,:host`, covered below.
   */
  test.each([
    ['universal', `*{box-sizing:border-box}`],
    ['pseudo element', `::backdrop{margin:0}`],
    ['attribute', `[hidden]{display:none}`],
    ['class', `.thing{color:red}`],
    ['host', `:host{color:red}`],
    ['host with a selector', `:host(.dark){color:red}`],
  ])('keeps a %s selector', (_label, css) => {
    expect(run(css, ['div']).css).toBe(css)
  })

  /** The reset opens with this rule, and neither half of it may go. */
  test('keeps html,:host intact', () => {
    expect(run(`html,:host{line-height:1.5}`, ['div']).css).toBe('html,:host{line-height:1.5}')
  })

  test('an element with a pseudo still counts as that element', () => {
    expect(run(`input:where([type=text]){color:inherit}`, ['div']).css).toBe('')
    expect(run(`input:where([type=text]){color:inherit}`, ['input']).css).not.toBe('')
  })

  test('matching is case-insensitive, since JSX may not be', () => {
    expect(run(`TABLE{border-collapse:collapse}`, ['table']).css).not.toBe('')
  })

  test('reports what it removed', () => {
    const result = run(`table{a:1}pre{b:2}div{c:3}`, ['div'])

    expect(result.removedRules).toBe(2)
    expect(result.css).toBe('div{c:3}')
  })

  /**
   * A compound or descendant selector reports no element and is kept. That is the
   * conservative answer rather than the precise one -- `.scope table` does target a table --
   * and it is pinned so a future `elementOf` written against a real selector parser has to
   * decide the question deliberately instead of inheriting an answer from this one.
   */
  test.each([
    ['descendant', `ul ul{margin:0}`],
    ['child', `table > tr{color:red}`],
    ['nesting parent', `& table{color:red}`],
    ['compound class', `input.thing{color:red}`],
    ['compound id', `input#thing{color:red}`],
  ])('keeps a %s selector, which names more than one thing', (_label, css) => {
    expect(run(css, ['div']).css).toBe(css)
  })

  /**
   * `elementOf` strips one level of parens, so a nested pseudo leaves a stray `(` or `)`
   * behind and `ELEMENT_ONLY` rejects what is left. That is why nesting fails safe rather
   * than reporting the wrong element -- the reset ships one such rule today, and a rewrite
   * that starts consuming nested parens would silently turn this from over-keeping into
   * over-removing.
   */
  test.each([
    ['nested in :where', `[hidden]:where(:not([hidden='until-found'])){display:none}`],
    ['nested in :not', `input:not(:where([type=button])){color:red}`],
    ['nested in :is', `button:is(:not(.plain)){color:red}`],
  ])('keeps a selector whose pseudo nests parens: %s', (_label, css) => {
    expect(run(css, ['div']).css).toBe(css)
  })
})

/**
 * A scoped reset writes its scope onto every selector, so without stripping it first nothing
 * reports an element and the pass quietly does nothing at all -- which is what it used to do.
 * `preflight: { scope }` emits `.app table`; with `level: 'element'`, `table.app`.
 */
describe('prunePreflight with a scoped reset', () => {
  test('drops a scoped rule for an element the source never renders', () => {
    expect(run(`.app table{border-collapse:collapse}`, ['div'], '.app').css).toBe('')
    expect(run(`table.app{border-collapse:collapse}`, ['div'], '.app').css).toBe('')
  })

  test('keeps a scoped rule for an element the source renders', () => {
    expect(run(`.app table{a:1}`, ['table'], '.app').css).toBe('.app table{a:1}')
    expect(run(`table.app{a:1}`, ['table'], '.app').css).toBe('table.app{a:1}')
  })

  /** The scope alone is the root rule a scoped reset emits in place of `html, :host`. */
  test('keeps the scope root rule', () => {
    expect(run(`.app{line-height:1.5}`, ['div'], '.app').css).toBe('.app{line-height:1.5}')
  })

  /** `level: 'element'` rewrites a trailing pseudo to `<scope> ::selection`. */
  test('keeps a scoped pseudo, which still names no element', () => {
    expect(run(`.app ::selection{background:red}`, ['div'], '.app').css).toBe('.app ::selection{background:red}')
  })

  /** Stripping is not a substring match: an unrelated selector that merely ends the same way
   * loses nothing it needs, because what is left still names no element. */
  test('does not mistake an unrelated selector for a scoped one', () => {
    expect(run(`.not-app{color:red}`, ['div'], '.app').css).toBe('.not-app{color:red}')
  })

  test('without the scope the same rules are all kept, which is the bug this covers', () => {
    expect(run(`.app table{a:1}`, ['div']).css).toBe('.app table{a:1}')
  })
})
