import postcss from 'postcss'
import upstream from 'postcss-discard-duplicates'
import { describe, expect, test } from 'vitest'
import { dedupeNodes } from '../src/plugins/dedupe-nodes'

/**
 * `postcss-discard-duplicates` compares every at-rule and declaration against all of its
 * preceding siblings, which is quadratic in the sibling count. A generated stylesheet puts
 * one `@media` block per condition side by side under a layer -- 5,000 of them on the config
 * measured -- so that pass spent ~12.5M comparisons, 640ms of a 737ms pipeline, to find in
 * normal operation nothing at all.
 *
 * Every case here is asserted against upstream rather than against a snapshot, which would
 * only record what this plugin does. What it is asserted against is upstream's *fixpoint* --
 * upstream applied until it stops changing anything -- because on one shape this reaches in
 * a single pass a result upstream needs a second one for. See `agreeAfterOnePass` below.
 */
const run = (plugin: postcss.AcceptedPlugin, css: string) => postcss([plugin]).process(css, { from: undefined }).css

/** Upstream applied until it stops changing anything. */
const fixpoint = (css: string) => {
  for (let i = 0; i < 20; i++) {
    const next = run(upstream(), css)
    if (next === css) return css
    css = next
  }
  throw new Error('upstream did not converge')
}

const agree = (css: string) => expect(run(dedupeNodes(), css)).toBe(fixpoint(css))

/**
 * Where upstream converges in one pass, which is everywhere but the shape below, agreeing
 * with the fixpoint and agreeing with a single pass are the same statement. Asserting both
 * keeps that visible rather than letting the fixpoint quietly paper over a divergence.
 */
const agreeAfterOnePass = (css: string) => expect(run(dedupeNodes(), css)).toBe(run(upstream(), css))

describe('dedupeNodes', () => {
  test.each([
    ['adjacent identical rules', `.a{color:red}.a{color:red}`],
    ['separated identical rules', `.a{color:red}.b{color:blue}.a{color:red}`],
    ['same selector, overlapping declarations', `.a{color:red;padding:1px}.a{color:red;margin:2px}`],
    ['duplicate declarations in one rule', `.a{color:red;color:red}`],
    ['duplicate at-rules', `@media (min-width:1px){.a{c:1}}@media (min-width:1px){.a{c:1}}`],
    ['at-rules differing only in body', `@media (min-width:1px){.a{c:1}}@media (min-width:1px){.a{c:2}}`],
    ['duplicate at-rules separated', `@media print{.a{c:1}}.x{y:2}@media print{.a{c:1}}`],
    ['duplicates nested in an at-rule', `@media print{.a{c:1}.b{d:2}.a{c:1}}`],
    ['@layer is exempt', `@layer a{.x{c:1}}@layer a{.x{c:1}}`],
    ['important is not equal to plain', `.a{color:red}.a{color:red !important}`],
    ['three copies', `.a{c:1}.a{c:1}.a{c:1}`],
    ['comments survive', `.a{/* keep */c:1}.a{c:1}`],
    ['deeply nested', `@supports (a:b){@media print{.a{c:1}.a{c:1}}}`],
    /**
     * The case that broke the first version. Upstream walks from the end, so every member of
     * a same-selector group strips its declarations from all earlier members -- deduping only
     * against the final member drops nothing here.
     */
    ['every member of a selector group takes a turn', `.a{d:2}.a{d:2}.a{c:1}`],
    /**
     * The key is a concatenation, so it needs a separator between the fields or `--a: bc`
     * and `--ab: c` build the same string and one gets dropped as a duplicate of the other.
     * `signature` puts a `\u0001` between them. Written out here because the random
     * generator cannot reach it -- its alphabet has no pair that collides -- so removing the
     * separators passes every other case in this file while silently corrupting css.
     */
    ['a prop/value boundary that would collide without separators', `.a{--a:bc;--ab:c}`],
    ['the same across two rules', `.a{--a:bc}.a{--ab:c}`],
    ['a selector/child boundary', `.a{--b:1}.a1{--b:1}`],
  ])('agrees with upstream: %s', (_label, css) => {
    agree(css)
    agreeAfterOnePass(css)
  })

  /**
   * Randomised over a tiny alphabet, so duplicates arise constantly rather than by luck.
   *
   * Worth knowing what this cannot reach: it builds every node independently, so two
   * siblings that become equal only after their own contents are deduped essentially never
   * arise. That shape is the one place the two part company, and it is covered below by a
   * generator built to produce it rather than left to chance here.
   */
  test('agrees with upstream over random stylesheets', () => {
    let seed = 99
    const rnd = () => (seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff
    const pick = <T>(xs: T[]) => xs[Math.floor(rnd() * xs.length)]!
    const node = (depth: number): string => {
      if (depth > 0 && rnd() < 0.3) {
        const inner = Array.from({ length: 1 + Math.floor(rnd() * 3) }, () => node(depth - 1)).join('')
        return `${pick(['@media print', '@media (min-width:1px)', '@supports (a:b)', '@layer L'])}{${inner}}`
      }
      const decls = Array.from({ length: 1 + Math.floor(rnd() * 3) }, () =>
        pick(['c:1', 'c:1', 'd:2', 'e:3 !important', 'c:2']),
      ).join(';')
      return `${pick(['.a', '.b', '.a', '.c'])}{${decls}}`
    }

    const mismatches: string[] = []
    for (let i = 0; i < 400; i++) {
      const css = Array.from({ length: 2 + Math.floor(rnd() * 6) }, () => node(2)).join('')
      if (run(dedupeNodes(), css) !== fixpoint(css)) mismatches.push(css)
    }

    expect(mismatches).toEqual([])
  })
})

/**
 * The one shape where this removes something upstream leaves behind, and the reason the
 * assertions above are written against a fixpoint rather than a single pass.
 *
 * Upstream interleaves its recursion with its sibling walk: `dedupe(last)` runs as each
 * node's turn comes, walking siblings from the end, so a later sibling is compared against
 * earlier ones *before* those have had their own inner duplicates removed. Two blocks that
 * are equal only once their contents are deduped therefore look different at the moment
 * upstream compares them, and both survive -- until a second pass, by which point they are
 * identical and one goes.
 *
 * This pass recurses over the whole subtree first, so siblings are already in final form
 * when they are compared, and it converges immediately.
 *
 * Removing more is safe here, and specifically safe rather than merely smaller: what is
 * dropped is an exact duplicate, and dropping the *earlier* of two exact duplicates cannot
 * change the cascade, because the later copy won anyway. It is the same transformation
 * upstream performs, applied where upstream's traversal order happened to miss it.
 */
describe('dedupeNodes converges where upstream needs a second pass', () => {
  test.each([
    [
      'an earlier sibling that matches only after its own dupes go',
      `@media print{.a{c:1}.a{c:1}}@media print{.a{c:1}}`,
    ],
    ['the same, one level down', `@supports (a:b){@media print{.a{c:1}.a{c:1}}@media print{.a{c:1}}}`],
    ['duplicate declarations rather than duplicate rules', `@media print{.a{c:1;c:1}}@media print{.a{c:1}}`],
  ])('%s', (_label, css) => {
    // Pinned as a difference, so that this stops being a silent superset.
    expect(run(dedupeNodes(), css)).not.toBe(run(upstream(), css))
    expect(run(dedupeNodes(), css)).toBe(fixpoint(css))
  })

  /**
   * The generator the suite above cannot be: it emits a block holding duplicated content
   * beside the same block already clean, so the divergent shape arises on every case rather
   * than never.
   */
  test('over random stylesheets built to diverge', () => {
    let seed = 7
    const rnd = () => (seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff
    const pick = <T>(xs: T[]) => xs[Math.floor(rnd() * xs.length)]!

    const mismatches: string[] = []
    let diverged = 0

    for (let i = 0; i < 200; i++) {
      const at = pick(['@media print', '@media (min-width:1px)', '@supports (a:b)'])
      const body = `${pick(['.a', '.b', '.c'])}{${pick(['c:1', 'd:2', 'e:3 !important'])}}`
      const css = `${at}{${body}${body}}${at}{${body}}`

      if (run(dedupeNodes(), css) !== run(upstream(), css)) diverged++
      if (run(dedupeNodes(), css) !== fixpoint(css)) mismatches.push(css)
    }

    expect(mismatches).toEqual([])
    // If this ever reads 0, the generator has stopped producing the shape it exists for.
    expect(diverged).toBe(200)
  })
})

/**
 * The one shape running the other way, and the reason the fixpoint equivalence above is not
 * quite total. Upstream's `equals` compares children only when *both* nodes have them, so it
 * calls a bodyless at-rule equal to a bodied one sharing its name and params, and keeps the
 * last of the run. So the ordering that does damage is a bodyless at-rule *following* a real
 * block: `@media print{.a{c:1}}@media print;` keeps only the empty one. `signature` appends
 * its child section only when there are children, so the two get different keys and both
 * survive. Both orderings are covered below, since only one of them loses anything.
 *
 * Keeping both is the defensible answer, and nothing bamboo emits is bodyless, so this cannot
 * arise in practice. It is pinned because the docstring's "one pass equals upstream applied
 * until it stops changing anything" reads as unconditional, and this is the exception.
 */
describe('dedupeNodes keeps what upstream drops for a bodyless at-rule', () => {
  test.each([
    ['bodyless first', `@media print;@media print{.a{c:1}}`],
    ['bodyless second', `@media print{.a{c:1}}@media print;`],
    ['no body either side', `@foo bar;@foo bar{}`],
  ])('%s', (_label, css) => {
    // Upstream converges immediately, so its fixpoint and its single pass agree here -- what
    // differs is this pass, and it differs by removing less.
    const upstreamOut = run(upstream(), css)

    expect(fixpoint(css)).toBe(upstreamOut)
    expect(run(dedupeNodes(), css)).not.toBe(upstreamOut)
    expect(run(dedupeNodes(), css)).toBe(css)
  })

  /** Same name and params, both bodied: the ordinary case, where the two still agree. */
  test('still dedupes when both have a body', () => {
    const css = `@media print{.a{c:1}}@media print{.a{c:1}}`

    expect(run(dedupeNodes(), css)).toBe(run(upstream(), css))
  })
})
