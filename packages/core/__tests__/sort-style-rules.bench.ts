import type { AtomicStyleResult } from '@bamboocss/types'
import { bench, describe } from 'vitest'
import { sortStyleRules } from '../src/sort-style-rules'

/**
 * `sortStyleRules` runs twice over every atom a build produces — once in the decoder's
 * `collectAtomic`, once again in `Stylesheet.processDecoder` — and its comparator derives
 * everything it needs from scratch on each call. A comparison sort of N items makes on the
 * order of N log N of them, so anything recomputed inside the comparator is paid ~13x per
 * item at the sizes a real `staticCss` config reaches (13,350 atoms for one rule set).
 *
 * Input order is what makes this measurable. Sorting the decoder's already-ordered output
 * reads several times cheaper than sorting encoder-insertion order, because a nearly-sorted
 * array costs TimSort far fewer comparisons — measuring the wrong one flatters the comparator
 * by about 4x, which is exactly how the cost hid.
 */

/**
 * The dialect breakpoints are emitted in — range syntax, which the comparator has to rewrite to
 * the `min-`/`max-` form before it can classify. These were the `screen and (min-width: …)`
 * spelling, which is no longer generated: the rewrite is the part of the comparator that only
 * range syntax reaches, so measuring the old spelling measured the one path a real build no
 * longer takes.
 */
const QUERIES = [
  '(width >= 24rem)',
  '(width >= 28rem)',
  '(width >= 32rem)',
  '(width >= 36rem)',
  '(width < 48rem)',
  'print',
]

const SELECTORS = [':hover', ':focus', ':active', ':focus-visible', ':visited']
const PROPS = ['padding', 'margin', 'fontSize', 'color', 'backgroundColor', 'borderWidth']

/** Fixed LCG, so every run sorts the same permutation. */
const shuffled = <T>(items: T[]) => {
  const out = items.slice()
  let seed = 0x2f6e2b1
  for (let i = out.length - 1; i > 0; i--) {
    seed = (seed * 1103515245 + 12345) & 0x7fffffff
    const j = seed % (i + 1)
    ;[out[i], out[j]] = [out[j], out[i]]
  }
  return out
}

const atRuleItem = (i: number) =>
  ({
    entry: { prop: PROPS[i % PROPS.length], value: `v${i}` },
    conditions: [{ type: 'at-rule', raw: QUERIES[i % QUERIES.length], params: QUERIES[i % QUERIES.length] }],
  }) as unknown as AtomicStyleResult

const selectorItem = (i: number) =>
  ({
    entry: { prop: PROPS[i % PROPS.length], value: `v${i}` },
    conditions: [
      { type: 'self-nesting', raw: SELECTORS[i % SELECTORS.length], value: SELECTORS[i % SELECTORS.length] },
    ],
  }) as unknown as AtomicStyleResult

const bareItem = (i: number) =>
  ({ entry: { prop: PROPS[i % PROPS.length], value: `v${i}` }, conditions: [] }) as unknown as AtomicStyleResult

const N = 10_000

const atRules = shuffled(Array.from({ length: N }, (_, i) => atRuleItem(i)))
const selectors = shuffled(Array.from({ length: N }, (_, i) => selectorItem(i)))
const bare = shuffled(Array.from({ length: N }, (_, i) => bareItem(i)))

// `sortStyleRules` sorts the arrays it is handed in place, so each iteration gets its own copy
// — otherwise every call after the first sorts an already-sorted array and measures TimSort's
// best case instead of the comparator.
const opts = { warmupIterations: 5, time: 2000 }

describe('sortStyleRules', () => {
  bench(`at-rule conditions x${N}`, () => void sortStyleRules(atRules.slice()), opts)
  bench(`selector conditions x${N}`, () => void sortStyleRules(selectors.slice()), opts)

  // The control: no conditions, so neither comparator runs and only the property-priority
  // tiebreak does. If this moves between two readings, the machine did.
  bench(`no conditions x${N}`, () => void sortStyleRules(bare.slice()), opts)
})
