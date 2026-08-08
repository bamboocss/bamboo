import { bench, describe } from 'vitest'
import { buildCss, ITERATIONS } from './css-fn-harness'

/**
 * The uncached path: every call is a distinct style, so nothing is reusable and the memo can
 * only cost. Tracked so a change to the cache bound, or to the grouped naming branch, shows
 * up somewhere.
 *
 * ## Why this is a file of its own
 *
 * These allocate 10k distinct objects per iteration for two seconds each, filling a bounded
 * memo well past its rotation point. Measured, that is benign for the cached benches *as
 * long as it runs after them* — moving it back into `css-fn.bench.ts` at the bottom left
 * every reading there unchanged. That is the whole problem: it is a property of the order,
 * which nobody maintains — and an ordering bug is exactly what made this file report
 * `cssMode: 'grouped'` as 9.4x slower than atomic when the two are at parity (see the
 * grouped note in `css-fn.bench.ts`).
 *
 * Vitest isolates per *file* — the default forks pool runs each in its own process — so a
 * separate file is the only version of this guarantee that survives someone appending a
 * bench. Keep pathological cases here rather than next to a cached-path one.
 *
 * The 2000ms budget is deliberate: at ~3x the cost of a cached case, the default 500ms buys
 * only a handful of samples and the rme swamps anything worth seeing.
 */
const MISS_BUDGET = { time: 2000 }

describe('css() runtime, uncached', () => {
  const css = buildCss()

  bench(
    `high-cardinality css() x${ITERATIONS}`,
    () => {
      for (let i = 0; i < ITERATIONS; i++) css({ color: 'red', width: `${i}px` })
    },
    MISS_BUDGET,
  )
})

/**
 * The grouped miss path, where the group id is built, sorted, joined and hashed — the work
 * the cached benches never reach. Its own `css`, so the atomic case above cannot leave a
 * warm memo or a rotated generation behind for it.
 */
describe('grouped css() runtime, uncached', () => {
  const groupedCss = buildCss(true)

  bench(
    `high-cardinality grouped css() x${ITERATIONS}`,
    () => {
      for (let i = 0; i < ITERATIONS; i++) groupedCss({ color: 'red', width: `${i}px` })
    },
    MISS_BUDGET,
  )
})
