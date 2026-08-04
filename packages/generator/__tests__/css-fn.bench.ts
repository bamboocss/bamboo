import { createCss, createMergeCss, getPatternStyles, memo } from '@bamboocss/shared'
import { bench, describe } from 'vitest'

/**
 * Benchmarks the runtime shape `generateCssFn` / `generatePattern` emit, so the
 * numbers track what actually ships in `styled-system`.
 *
 * Reported, not asserted: wall-clock ratios are machine- and load-dependent, so a
 * threshold here would fail on a busy CI box rather than on a real regression. The
 * behaviour these rely on is locked down deterministically instead, by counting
 * serialization work in `packages/shared/__tests__/memo.test.ts`.
 */
const makeContext = () => ({
  hash: false,
  utility: {
    prefix: '',
    hasShorthand: false,
    resolveShorthand: (p: string) => p,
    transform: (prop: string, value: any) => ({ className: `${prop}_${value}` }),
    toHash: (path: string[], h: (s: string) => string) => h(path.join(':')),
  },
  conditions: {
    breakpoints: { keys: ['sm', 'md'] },
    shift: (v: string[]) => v,
    finalize: (v: string[]) => v,
  },
})

const build = () => {
  const ctx = makeContext()
  const cssFn = createCss(ctx)
  const { mergeCss } = createMergeCss(ctx)
  const css = memo((...styles: any[]) => cssFn(mergeCss(...styles)))

  const stackConfig = {
    transform: (props: any) => {
      const { align, justify, direction = 'column', gap, ...rest } = props
      return { display: 'flex', flexDirection: direction, alignItems: align, justifyContent: justify, gap, ...rest }
    },
  }
  const stackStyle = (styles: any = {}) => stackConfig.transform(getPatternStyles(stackConfig as any, styles))
  const stack = memo((styles: any) => css(stackStyle(styles)))

  return { css, stack }
}

const { css, stack } = build()
const ITERATIONS = 10_000
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

  // Worst case for a bounded cache: every call is a distinct style, so nothing is
  // reusable and the cache can only cost. Tracked so a bound change shows up here.
  // ~45x slower per iteration than the cached cases above, so the default 500ms
  // budget only buys ~15 samples and the rme swamps anything worth seeing.
  bench(
    `high-cardinality css() x${ITERATIONS}`,
    () => {
      for (let i = 0; i < ITERATIONS; i++) css({ color: 'red', width: `${i}px` })
    },
    { time: 2000 },
  )
})
