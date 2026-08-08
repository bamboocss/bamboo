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
