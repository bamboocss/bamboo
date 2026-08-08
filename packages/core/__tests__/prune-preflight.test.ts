import postcss from 'postcss'
import { describe, expect, test } from 'vitest'
import { prunePreflight } from '../src/prune-preflight'

/**
 * Two thirds of the reset is bound to specific elements — 41 of them, covering `table`,
 * `pre`, `kbd`, `optgroup` and the rest of the long tail. The reset is a fixed size, so it
 * dominates a small stylesheet: a third of one sandbox's css here and nearly half of
 * another's. Dropping what the source never renders is worth 15% and 25% gzipped.
 *
 * It is the one saving in this area that survives compression, because it emits less rather
 * than spelling the same thing differently.
 */
const run = (css: string, rendered: string[]) => {
  const root = postcss.parse(css)
  const result = prunePreflight({ target: root, rendered: new Set(rendered) })
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

  /** Nothing about a universal or pseudo-only selector says which element it reaches. */
  test.each([
    ['universal', `*{box-sizing:border-box}`],
    ['pseudo element', `::backdrop{margin:0}`],
    ['attribute', `[hidden]{display:none}`],
    ['class', `.thing{color:red}`],
  ])('keeps a %s selector', (_label, css) => {
    expect(run(css, ['div']).css).toBe(css)
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
})
