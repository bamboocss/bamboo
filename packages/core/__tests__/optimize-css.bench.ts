import { bench, describe } from 'vitest'
import { optimizeCss } from '../src/optimize'

/**
 * `optimizeCss` is the whole of `getCss` after the sheet is built, and it was 87% of one
 * measured build: 925ms of 1,066ms, of which 767ms was a single quadratic pass. Replacing
 * that pass took the same build to 263ms, and nothing in CI would have noticed either the
 * regression or the fix — `static-css-*.bench.ts` measure `getCssRuleObjects`, which stops
 * before this runs. This exists so the next change to the pipeline has a reading to beat.
 *
 * The shape is what makes it a benchmark rather than a formality. A generated stylesheet puts
 * one `@media` block per condition side by side under a single layer, so the sibling count at
 * one level grows with the config rather than staying small the way hand-written CSS does.
 * Anything in the pipeline that compares siblings pairwise is quadratic in exactly that
 * number, and only shows up once it is large.
 */

/** One `@media` per condition, all siblings under one layer, each holding a couple of rules. */
const conditions = (count: number) => {
  const blocks: string[] = []

  for (let i = 0; i < count; i++) {
    blocks.push(
      `@media (min-width:${i}px){` +
        `.c${i}_a{color:rgb(${i % 255} 0 0);padding-inline:${i}px}` +
        `.c${i}_b{margin-inline:${i}px;font-size:${i % 40}px}` +
        `}`,
    )
  }

  return `@layer utilities{${blocks.join('')}}`
}

/**
 * The same declaration count with no nesting at all, so it exercises the parse, the rule
 * merge and the emit without ever building a large sibling group.
 *
 * This is the control. It is the part of the pipeline no sibling-scan change can touch, so
 * if it moves between two readings the machine did and the comparison is void.
 */
const flat = (count: number) => {
  const rules: string[] = []

  for (let i = 0; i < count; i++) {
    rules.push(`.f${i}{color:rgb(${i % 255} 0 0);padding-inline:${i}px;margin-inline:${i}px;font-size:${i % 40}px}`)
  }

  return `@layer utilities{${rules.join('')}}`
}

/**
 * A large sibling group, half of it empty shells, which is what the *removal* pass actually
 * receives. `mergeRules` runs immediately before `discardEmpty` and leaves empty `@media`
 * blocks rather than empty rules -- `mergeParents` lifts a rule out of its enclosing at-rule
 * and never removes the shell, while every path that empties a rule removes it. A 663 kB sheet
 * arrives here with 6,005 shells and zero empty rules.
 *
 * Neither case above reaches that path. Both are well-formed throughout, so the removal pass
 * walks them and removes nothing, and a plugin costing removals x siblings contributes nothing
 * to their readings. That is how a quadratic removal pass survived a bench file written to
 * catch exactly this shape of bug, and it is the reason for the sizes: the cost is a product,
 * so it only separates from the control once the group is large.
 *
 * `full` is the size-matched control for each -- the same sibling count and the same
 * declarations with nothing empty in it, so the removal pass walks an identical tree and
 * removes nothing. Anything that moves both readings together is `nested`, `dedupeNodes` or
 * `mergeRules`, not this.
 */
const shells = (count: number, empty: boolean) => {
  const blocks: string[] = []

  for (let i = 0; i < count; i++) {
    const body = `.h${i}{color:rgb(${i % 255} 0 0);padding-inline:${i}px}`
    blocks.push(empty && i % 2 ? `@media (min-width:${i}px){}` : `@media (min-width:${i}px){${body}}`)
  }

  return `@layer utilities{${blocks.join('')}}`
}

const SMALL = conditions(500)
const LARGE = conditions(5_000)
const CONTROL = flat(5_000)
const HOLLOW = shells(8_000, true)
const HOLLOW_FULL = shells(8_000, false)
const HOLLOW_LARGE = shells(32_000, true)
const HOLLOW_LARGE_FULL = shells(32_000, false)

// Whichever bench runs first pays for module init of the whole postcss pipeline, so one
// warmup iteration is not enough to keep the first reading comparable to the rest.
const opts = { warmupIterations: 3, time: 2000 }

describe('optimizeCss', () => {
  bench('500 sibling at-rules', () => void optimizeCss(SMALL), opts)
  bench('5,000 sibling at-rules', () => void optimizeCss(LARGE), opts)
  bench('5,000 sibling at-rules, minified', () => void optimizeCss(LARGE, { minify: true }), opts)

  // The control: same declaration count, no sibling group to scan.
  bench('5,000 flat rules', () => void optimizeCss(CONTROL), opts)

  // The removal pass, each against a size-matched control with nothing to remove. `32,000` is
  // where a per-removal sibling scan separates from a single-pass one by an order of magnitude
  // rather than by a factor; read the pair, never the hollowed reading on its own.
  bench('8,000 at-rule siblings, half empty', () => void optimizeCss(HOLLOW), opts)
  bench('8,000 at-rule siblings, none empty (control)', () => void optimizeCss(HOLLOW_FULL), opts)
  bench('32,000 at-rule siblings, half empty', () => void optimizeCss(HOLLOW_LARGE), opts)
  bench('32,000 at-rule siblings, none empty (control)', () => void optimizeCss(HOLLOW_LARGE_FULL), opts)
})
