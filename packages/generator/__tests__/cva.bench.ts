import { cloneStyles, compact, createCss, createMergeCss, memo } from '@bamboocss/shared'
import { bench, describe } from 'vitest'

/**
 * Benchmarks the runtime shape `generateCvaFn` emits, so the numbers track what actually
 * ships in `styled-system/css/cva.mjs` — the same approach `css-fn.bench.ts` takes.
 *
 * `raw()` is the case that matters: every JSX factory calls it once per element per render
 * to build the styles it merges with style props, so it runs as often as the factory does.
 * Nothing else here covered `cva` at all.
 *
 * Reported, not asserted, like every other bench here. The invariant that the result stays
 * independent of the cache is pinned deterministically in `raw-independence.test.ts` and in
 * `sandbox/codegen/__tests__/cva.test.ts`.
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

const ctx = makeContext()
const cssFn = createCss(ctx)
const { mergeCss } = createMergeCss(ctx)
const css = memo((...styles: any[]) => cssFn(mergeCss(...styles)))

/** A design-system button: a base, three variant groups, and a compound variant. */
const config = {
  base: { display: 'inline-flex', alignItems: 'center', borderRadius: 'md', fontWeight: 'bold' },
  variants: {
    size: { sm: { padding: '4px' }, md: { padding: '8px' }, lg: { padding: '12px' } },
    tone: {
      primary: { backgroundColor: 'blue.600', color: { base: 'white', _dark: 'gray.800' } },
      danger: { backgroundColor: 'red.500', color: 'white' },
    },
    ghost: { true: { backgroundColor: 'transparent' } },
  },
  compoundVariants: [{ size: 'lg', tone: 'primary', css: { letterSpacing: '0.02em' } }] as any[],
  defaultVariants: { size: 'md', tone: 'primary' } as Record<string, unknown>,
}

const getCompoundVariantCss = (compoundVariants: any[], variantMap: Record<string, unknown>) => {
  let result = {}
  compoundVariants.forEach((compoundVariant) => {
    const isMatching = Object.entries(compoundVariant).every(([key, value]) => {
      if (key === 'css') return true
      const values = Array.isArray(value) ? value : [value]
      return values.some((v) => variantMap[key] === v)
    })
    if (isMatching) result = mergeCss(result, compoundVariant.css)
  })
  return result
}

/**
 * `shortCircuit` is the emitted runtime's `if (compoundVariants.length === 0) return
 * variantCss`. Both forms are built here so the pair can be measured in one run: a
 * stash-and-rerun A/B cannot reach this file's mirror of the artifact, and comparing two
 * readings taken minutes apart on a shared machine is how a 5% effect gets lost in drift.
 */
const build = (source: typeof config, shortCircuit = true) => {
  const { base, variants, defaultVariants, compoundVariants } = source as any
  const getVariantProps = (v: Record<string, unknown>) => ({ ...defaultVariants, ...compact(v) })

  function resolve(props: Record<string, unknown> = {}) {
    const computedVariants = getVariantProps(props)
    let variantCss = { ...base }
    for (const [key, value] of Object.entries(computedVariants)) {
      if (variants[key]?.[value as string]) variantCss = mergeCss(variantCss, variants[key][value as string])
    }
    if (shortCircuit && compoundVariants.length === 0) return variantCss
    return mergeCss(variantCss, getCompoundVariantCss(compoundVariants, computedVariants))
  }

  const resolveVariants = memo(resolve)
  return {
    raw: (...args: any[]) => cloneStyles((resolveVariants as any)(...args)),
    cvaFn: memo((props: any) => css(resolve(props))),
  }
}

/** The same recipe with its compound variant removed — the shape most recipes have. */
const plainConfig = { ...config, compoundVariants: [] as any[] }

const { raw, cvaFn } = build(config)
const plain = build(plainConfig)
const plainUnconditional = build(plainConfig, false)
const ITERATIONS = 10_000

// Two prop sets alternating, so a cache that only ever sees one shape is not flattered.
const A = { size: 'lg', tone: 'primary' }
const B = { size: 'md', tone: 'danger' }

describe('cva() runtime', () => {
  bench(`raw() warm x${ITERATIONS}`, () => {
    for (let i = 0; i < ITERATIONS; i++) raw(i % 2 ? A : B)
  })

  bench(`cva() warm x${ITERATIONS}`, () => {
    for (let i = 0; i < ITERATIONS; i++) cvaFn(i % 2 ? A : B)
  })

  // Worst case for the memo: every call a distinct variant combination, so nothing is
  // reusable and the cache can only cost. Tracked so a change that trades cold for warm
  // shows up here rather than in a user's build.
  bench(
    `raw() all-miss x${ITERATIONS}`,
    () => {
      for (let i = 0; i < ITERATIONS; i++) raw({ size: 'md', tone: 'primary', ghost: i })
    },
    { time: 2000 },
  )
})

/**
 * The compound-free recipe, which is what most recipes are, measured both ways in one run.
 *
 * The pair is the point. Read them against each other rather than against a previous run:
 * they share a process, a warm-up and a machine, so the difference between them is the
 * change and nothing else.
 *
 * `all-miss` is where any difference has to show. Warm, both forms return from the memo
 * without reaching `resolve` at all.
 */
describe('cva() runtime, no compound variants', () => {
  bench(
    `raw() all-miss, short-circuited x${ITERATIONS}`,
    () => {
      for (let i = 0; i < ITERATIONS; i++) plain.raw({ size: 'md', tone: 'primary', ghost: i })
    },
    { time: 2000 },
  )

  bench(
    `raw() all-miss, merging against empty x${ITERATIONS}`,
    () => {
      for (let i = 0; i < ITERATIONS; i++) plainUnconditional.raw({ size: 'md', tone: 'primary', ghost: i })
    },
    { time: 2000 },
  )

  bench(`raw() warm, short-circuited x${ITERATIONS}`, () => {
    for (let i = 0; i < ITERATIONS; i++) plain.raw(i % 2 ? A : B)
  })

  bench(`raw() warm, merging against empty x${ITERATIONS}`, () => {
    for (let i = 0; i < ITERATIONS; i++) plainUnconditional.raw(i % 2 ? A : B)
  })
})
