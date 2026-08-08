import { bench, describe } from 'vitest'
import { buildCss, buildStack, ITERATIONS } from './css-fn-harness'

/**
 * Benchmarks the runtime shape `generateCssFn` / `generatePattern` emit, so the
 * numbers track what actually ships in `styled-system`.
 *
 * Every bench here is a *cached* path: the memo answers each call after the first, which is
 * the shape a real render has. The uncached counterparts live in `css-fn-miss.bench.ts`,
 * which has to be a separate file — see its header.
 *
 * Reported, not asserted: wall-clock ratios are machine- and load-dependent, so a
 * threshold here would fail on a busy CI box rather than on a real regression. The
 * behaviour these rely on is locked down deterministically instead, by counting
 * serialization work in `packages/shared/__tests__/memo.test.ts`.
 */
const css = buildCss()
const stack = buildStack()

const stable = { color: 'red', fontSize: '12px', padding: '4px' }
const l1 = { color: 'blue' }
const l2 = { padding: '8px' }

describe('css() runtime', () => {
  bench(`inline css() x${ITERATIONS}`, () => {
    for (let i = 0; i < ITERATIONS; i++) css({ color: 'red', fontSize: '12px', padding: '4px' })
  })

  bench(`stable-identity css() x${ITERATIONS}`, () => {
    for (let i = 0; i < ITERATIONS; i++) css(stable)
  })

  bench(`multi-arg css(a, b) x${ITERATIONS}`, () => {
    for (let i = 0; i < ITERATIONS; i++) css({ color: 'red' }, { padding: '2px' })
  })

  bench(`composed css([a, [b, c]]) x${ITERATIONS}`, () => {
    for (let i = 0; i < ITERATIONS; i++) css([l1, [l2, { margin: '2px' }]])
  })

  bench(`pattern stack() x${ITERATIONS}`, () => {
    for (let i = 0; i < ITERATIONS; i++) stack({ gap: '4px', align: 'center' })
  })
})

/**
 * `cssMode: 'grouped'` names one class per call instead of one per property, and had no
 * benchmark at all — so nothing would have shown a regression on the branch that builds
 * the group id and hashes it.
 *
 * The atomic cases above are the control: they run the same `createCss` with `grouped`
 * off, so a reading that moves in both is the machine, not the code. On the cached path the
 * two should read the *same* — the group id is built on a miss, and everything here is
 * answered by `memo` before that branch is entered. A gap between them is the signal.
 *
 * That control could not do its job while `css([...])` deoptimized the shared runtime for
 * the rest of the process. `composed css([a, [b, c]])` above passes an array; the control
 * ran *before* it and the grouped cases *after*, so the file reported grouped as 9.4x atomic
 * (6.89ms against 0.73ms) — while atomic measured after that same bench read 6.72ms. It also
 * inverted the pair below, reporting the nested `grouped conditions` case as *faster* than
 * the flat `grouped inline` one, which cannot be true: nested arguments take the
 * `JSON.stringify` path and flat ones do not.
 *
 * Both are fixed at the source, in `memo.ts`. The pair now agrees to within noise.
 */
const groupedCss = buildCss(true)

describe('grouped css() runtime', () => {
  bench(`grouped inline css() x${ITERATIONS}`, () => {
    for (let i = 0; i < ITERATIONS; i++) groupedCss({ color: 'red', fontSize: '12px', padding: '4px' })
  })

  bench(`grouped conditions css() x${ITERATIONS}`, () => {
    for (let i = 0; i < ITERATIONS; i++) groupedCss({ color: 'red', _hover: { color: 'blue' }, md: { padding: '4px' } })
  })
})

/**
 * The atomic counterpart of `grouped conditions`, which the file never had.
 *
 * Without it the nested shape had no control, and the grouped/atomic comparison covered
 * only flat arguments — so a regression confined to the `JSON.stringify` path would have
 * shown up as an unexplained grouped/atomic gap rather than as itself.
 */
describe('css() runtime, nested arguments', () => {
  const nestedCss = buildCss()

  bench(`atomic conditions css() x${ITERATIONS}`, () => {
    for (let i = 0; i < ITERATIONS; i++) nestedCss({ color: 'red', _hover: { color: 'blue' }, md: { padding: '4px' } })
  })
})
