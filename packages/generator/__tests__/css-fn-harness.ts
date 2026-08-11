import { createCss, createMergeCss, getPatternStyles, memo } from '@bamboocss/shared'

/**
 * The runtime shape `generateCssFn` / `generatePattern` emit, shared by the two bench files
 * that measure it — `css-fn.bench.ts` for the cached path, `css-fn-miss.bench.ts` for the
 * uncached one.
 *
 * They are separate files on purpose; see the header of `css-fn-miss.bench.ts`.
 */
export const ITERATIONS = 10_000

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

/**
 * A `css` with a memo of its own.
 *
 * Per call site rather than per module: a memo is mutable state, so two benches sharing one
 * means whichever runs second measures what the first left behind.
 */
export const buildCss = (grouped = false) => {
  const ctx = { ...makeContext(), ...(grouped ? { grouped: true } : {}) } as any
  const cssFn = createCss(ctx)
  // The uncached merge, mirroring what `generateCssFn` emits: `css` is already memoized on
  // this argument list, so a second cache keyed on it could only ever miss.
  const { mergeCssUncached } = createMergeCss(ctx)
  return memo((...styles: any[]) => cssFn(mergeCssUncached(...styles)))
}

/**
 * Show the runtime every argument shape once, before anything is timed.
 *
 * A canary rather than a warmup: showing every shape once means a deopt shows up as every
 * bench in the file slowing down together, instead of only the ones declared after whichever
 * bench first passed the offending shape. That asymmetry once made this file report one bench
 * as 9.4x slower than another when the two were at parity.
 *
 * The shape that caused it was an array argument — `css([a, [b, c]])` — which mixed element
 * kinds at these call sites. `css()` no longer accepts one, so it is no longer warmed here.
 * `flatHashOrNull` in `memo.ts` still routes arrays to the string key for the same reason,
 * since other memoized functions can still be handed one.
 */
const warmArgumentShapes = () => {
  const throwaway = buildCss()
  throwaway({ color: 'red' })
  throwaway({ color: 'red' }, { padding: '2px' })
  throwaway({ color: 'red', _hover: { color: 'blue' } })
}

warmArgumentShapes()

/** The `stack` pattern, over its own `css`, for the same reason. */
export const buildStack = () => {
  const css = buildCss()
  const stackConfig = {
    transform: (props: any) => {
      const { align, justify, direction = 'column', gap, ...rest } = props
      return { display: 'flex', flexDirection: direction, alignItems: align, justifyContent: justify, gap, ...rest }
    },
  }
  const stackStyle = (styles: any = {}) => stackConfig.transform(getPatternStyles(stackConfig as any, styles))
  return memo((styles: any) => css(stackStyle(styles)))
}
