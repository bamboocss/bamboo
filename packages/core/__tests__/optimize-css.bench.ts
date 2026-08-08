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

const SMALL = conditions(500)
const LARGE = conditions(5_000)
const CONTROL = flat(5_000)

// Whichever bench runs first pays for module init of the whole postcss pipeline, so one
// warmup iteration is not enough to keep the first reading comparable to the rest.
const opts = { warmupIterations: 3, time: 2000 }

describe('optimizeCss', () => {
  bench('500 sibling at-rules', () => void optimizeCss(SMALL), opts)
  bench('5,000 sibling at-rules', () => void optimizeCss(LARGE), opts)
  bench('5,000 sibling at-rules, minified', () => void optimizeCss(LARGE, { minify: true }), opts)

  // The control: same declaration count, no sibling group to scan.
  bench('5,000 flat rules', () => void optimizeCss(CONTROL), opts)
})
