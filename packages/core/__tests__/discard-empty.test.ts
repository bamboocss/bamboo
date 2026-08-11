import postcss from 'postcss'
import upstream from 'postcss-discard-empty'
import nested from 'postcss-nested'
import { describe, expect, test } from 'vitest'
import { dedupeNodes } from '../src/plugins/dedupe-nodes'
import { discardEmpty } from '../src/plugins/discard-empty'
import { mergeRules } from '../src/plugins/merge-rules'

/**
 * `postcss-discard-empty` removes each node through `Node.remove()`, which resolves to an
 * `indexOf` over the parent's children followed by a splice -- linear per removal, so a pass
 * costs removals x siblings. That is invisible on hand-written CSS and quadratic on a
 * generated sheet, where every atomic rule under a cascade layer is a sibling of every other
 * and `mergeRules` runs immediately before, hollowing out thousands of rules rather than
 * deleting them. See the note on `discardEmpty` for the measurements.
 *
 * Every case here is asserted against upstream rather than a snapshot, which would only record
 * what this plugin does. The predicate is a straight port, so unlike `dedupeNodes` there is no
 * fixpoint to reach for -- one pass of each has to agree exactly.
 */
const run = (plugin: postcss.AcceptedPlugin, css: string) => postcss([plugin]).process(css, { from: undefined }).css

const agree = (css: string) => expect(run(discardEmpty(), css)).toBe(run(upstream(), css))

describe('discardEmpty', () => {
  test.each([
    ['empty rule', `.a{}`],
    ['empty rule between full ones', `.a{c:1}.b{}.c{d:2}`],
    ['every rule empty', `.a{}.b{}.c{}`],
    ['first rule empty', `.a{}.b{c:1}`],
    ['last rule empty', `.a{c:1}.b{}`],
    ['nothing empty', `.a{c:1}.b{d:2}`],
    ['empty at-rule', `@media print{}`],
    ['at-rule emptied by its children', `@media print{.a{}}`],
    ['at-rule with one full and one empty child', `@media print{.a{}.b{c:1}}`],
    ['nested empties collapse upward', `@supports (a:b){@media print{.a{}}}`],
    ['nested empties do not collapse a live sibling', `@supports (a:b){@media print{.a{}}.keep{c:1}}`],
    ['bodyless at-rule with params', `@import 'x.css';`],
    ['bodyless at-rule with no params', `@foo;`],
    ['bodyless layer with no params', `@layer;`],
    ['comments are not empty', `.a{/* keep */}`],
    ['comment at top level', `/* keep */.a{}`],
    /**
     * `Root` overrides `removeChild` to move a dropped first child's `raws.before` onto its
     * replacement. Every case above writes its input without whitespace, which makes that
     * transfer a no-op -- both `raws.before` are `''` -- so agreement there says nothing about
     * whether it happens. These carry the whitespace that makes it observable.
     */
    ['leading whitespace moves off a dropped first rule', `.a{}\n\n.b{c:1}`],
    ['leading whitespace, first rule indented', `\n.a{}\n\n\n.b{c:1}`],
    ['a run of dropped first rules', `\n.a{}\n\n.b{}\n\n\n.c{d:1}`],
    ['whitespace is left alone when the first rule survives', `\n.a{c:1}\n\n.b{}\n\n.c{d:2}`],
    ['nothing survives to receive it', `\n\n.a{}\n\n.b{}`],
    ['the transfer is a root rule only, not an at-rule one', `@media print{\n.a{}\n\n.b{c:1}}`],
    /**
     * The two clauses that are easy to lose when reimplementing the predicate, and that the
     * bulk cases above would never reach.
     */
    ['a custom property with an empty value survives', `.a{--x: ;}`],
    ['a normal declaration with an empty value goes', `.a{color:;}`],
    ['a named empty layer survives', `@layer utilities{}`],
    ['an anonymous empty layer goes', `@layer{}`],
    ['the layer statement survives', `@layer reset, base, utilities;`],
    ['a named layer emptied by its children survives', `@layer utilities{.a{}}`],
    ['a rule with no selector goes', `{c:1}`],
    /**
     * What `mergeRules` actually hands this. It leaves empty *at-rules*, not empty rules --
     * `mergeParents` lifts a rule out of its enclosing `@media` and never removes the shell,
     * while every path that empties a rule removes it -- so the sibling run this pass walks is
     * `@media` blocks, and the predicate branch it exercises is the at-rule one.
     */
    ['a run of at-rule shells under a layer', `@layer u{@media print{.a{c:1}}@media print{}@media screen{}}`],
    ['a run of hollowed rules under a layer', `@layer utilities{.a{c:1}.b{}.c{}.d{}.e{f:2}}`],
  ])('%s', (_name, css) => agree(css))

  /**
   * The shape above, produced rather than hand-written -- so that if `mergeRules` ever stops
   * leaving shells, or starts leaving a different kind, this stops agreeing for a real reason
   * instead of continuing to pass against a fixture that has drifted from it.
   */
  test('agrees on what mergeRules actually leaves behind', () => {
    const parts: string[] = []
    for (let i = 0; i < 200; i++) parts.push(`@media print{.m${i}{color:red}}`)
    const merged = postcss([nested(), dedupeNodes(), mergeRules()]).process(`@layer u{${parts.join('')}}`, {
      from: undefined,
    }).css

    let shells = 0
    postcss.parse(merged).walkAtRules((n) => {
      if (n.nodes && n.nodes.length === 0) shells++
    })
    expect(shells).toBeGreaterThan(100)

    expect(run(discardEmpty(), merged)).toBe(run(upstream(), merged))
  })

  /**
   * Order and identity across a whole sheet, not just the byte output -- rebuilding the `nodes`
   * array is the one thing this does differently, so surviving nodes keeping their relative
   * order is the property at risk.
   */
  test('agrees on a large mixed sheet', () => {
    const parts: string[] = []
    for (let i = 0; i < 500; i++) {
      parts.push(i % 3 === 0 ? `.r${i}{}` : `.r${i}{color:rgb(${i % 255} 0 0)}`)
      if (i % 7 === 0) parts.push(`@media (min-width:${i}px){${i % 2 ? `.m${i}{}` : `.m${i}{c:1}`}}`)
    }
    const css = `@layer utilities{${parts.join('')}}`

    const ours = run(discardEmpty(), css)
    expect(ours).toBe(run(upstream(), css))
    // Not vacuous: the sheet has to actually lose something for the agreement to mean anything.
    expect(ours.length).toBeLessThan(css.length)
  })

  /**
   * A detached node reports no parent. `dedupeNodes` reads `child.parent` to tell whether a
   * node it collected earlier is still in the tree, so a removal that left `parent` set would
   * be invisible to it.
   */
  test('removed nodes are detached from their parent', () => {
    const root = postcss.parse(`.a{}.b{c:1}`)
    const removed = root.nodes[0]
    postcss([discardEmpty()]).process(root, { from: undefined }).css
    expect(removed.parent).toBeUndefined()
    expect(root.nodes).toHaveLength(1)
  })
})
