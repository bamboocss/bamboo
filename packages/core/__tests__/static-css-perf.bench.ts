import { fixtureDefaults } from '@bamboocss/fixture'
import type { StaticCssOptions } from '@bamboocss/types'
import { bench, describe } from 'vitest'
import { Context } from '../src/context'

describe('static-css performance', () => {
  // Create a large token configuration similar to issue #3106
  const largeTokenConfig = {
    fontSizes: Object.fromEntries(Array.from({ length: 35 }, (_, i) => [`${i + 1}`, { value: `${0.5 + i * 0.25}em` }])),
    sizes: Object.fromEntries([
      ...Array.from({ length: 200 }, (_, i) => [`${i}`, { value: `${i * 0.25}em` }]),
      ['auto', { value: 'auto' }],
      ['full', { value: '100%' }],
      ['1/2', { value: '50%' }],
      ['1/3', { value: '33.333333%' }],
      ['2/3', { value: '66.666667%' }],
      ['1/4', { value: '25%' }],
      ['3/4', { value: '75%' }],
    ]),
    colors: Object.fromEntries(
      ['red', 'blue', 'green', 'yellow', 'purple', 'pink', 'gray'].flatMap((color) =>
        Array.from({ length: 10 }, (_, i) => [`${color}.${i * 100}`, { value: `${color}${i * 100}` }]),
      ),
    ),
  }

  const { hooks, ...defaults } = fixtureDefaults
  const conf = {
    hooks,
    ...defaults,
    config: {
      ...defaults.config,
      theme: {
        ...defaults.config.theme,
        tokens: {
          ...defaults.config.theme?.tokens,
          ...largeTokenConfig,
        },
      },
    },
  } as typeof fixtureDefaults

  /**
   * Shared by the cold benches only, and safe for them: `process` on a *cloned* instance
   * rebuilds from `context.encoder.clone()` and never writes back, so a clone cannot leave
   * anything here for the next bench to find.
   */
  const ctx = new Context(conf)

  /**
   * A context of its own for every bench that processes on `ctx.staticCss` directly.
   *
   * `process` run on the context's own instance accumulates into `context.encoder` and never
   * lets it go (`static-css.ts` — the `isClonedInstance` branch). Every "cache miss" bench
   * below builds its cold instance with `ctx.staticCss.clone()`, which clones exactly that
   * encoder. So a warm bench sharing `ctx` charges every later bench in the file for the state
   * it accumulated, and both arms end up contaminated by whichever warm bench ran first.
   *
   * That is not hypothetical: it inverted this file's headline result. Measured on the `medium
   * config` pair, a warm run reads 0.25ms against its own context and 1.77ms against one the
   * `large config` bench had already run on — while the cold clone it is compared against
   * reads 0.27ms. The file reported the cache as a 6-22x pessimization; it is a mild win.
   *
   * Anything added here that calls `process` without `clone()` needs its own context too.
   */
  const warmed = (options: StaticCssOptions) => {
    const own = new Context(conf)
    // Primed outside the timed body: "subsequent processing" means the second call onward, and
    // charging the first one to the bench measures the very miss it is meant to be compared to.
    own.staticCss.process(options)
    return own.staticCss
  }

  // Large staticCss config with wildcards (expensive to process)
  const largeStaticCssConfig: StaticCssOptions = {
    css: [
      { properties: { fontSize: ['*'] } }, // 35 values
      { properties: { width: ['*'], height: ['*'] } }, // 200+ values each
      { properties: { padding: ['*'], margin: ['*'] } }, // 200+ values each
      { properties: { color: ['*'] } }, // 70 values
    ],
  }

  // Medium staticCss config (more realistic)
  const mediumStaticCssConfig: StaticCssOptions = {
    css: [
      {
        properties: {
          fontSize: Array.from({ length: 10 }, (_, i) => `${i + 1}`),
          padding: Array.from({ length: 20 }, (_, i) => `${i}`),
          margin: Array.from({ length: 20 }, (_, i) => `${i}`),
        },
      },
    ],
  }

  // Recipe-based config
  const recipeStaticCssConfig: StaticCssOptions = {
    recipes: {
      buttonStyle: [{ size: ['sm', 'md'] }, { variant: ['primary', 'secondary'] }],
    },
  }

  /**
   * The large-config pair allocates heavily enough that GC pauses, not the work, decide the
   * spread: at the default 500ms budget the warm arm read ±18% rme with a 41ms max against a
   * 2.4ms mean. A bench that noisy cannot show the 10% regression it exists to catch, so both
   * arms get a budget long enough to dilute the pauses — and the same one, so the pair stays
   * a fair comparison.
   */
  const LARGE_CONFIG_BUDGET = { time: 3000 }

  bench(
    'large config: initial processing (cache miss)',
    () => {
      // Fresh clone for each iteration to ensure cache miss
      const staticCss = ctx.staticCss.clone()
      staticCss.process(largeStaticCssConfig)
    },
    { warmupIterations: 2, iterations: 10, ...LARGE_CONFIG_BUDGET },
  )

  const warmLarge = warmed(largeStaticCssConfig)

  bench(
    'large config: subsequent processing (cache hit)',
    () => {
      // Its own already-primed instance, so this measures the cache rather than the
      // accumulated state of whatever ran before it. See `warmed`.
      warmLarge.process(largeStaticCssConfig)
    },
    { warmupIterations: 5, iterations: 50, ...LARGE_CONFIG_BUDGET },
  )

  bench(
    'medium config: initial processing (cache miss)',
    () => {
      const staticCss = ctx.staticCss.clone()
      staticCss.process(mediumStaticCssConfig)
    },
    { warmupIterations: 5, iterations: 20 },
  )

  const warmMedium = warmed(mediumStaticCssConfig)

  bench(
    'medium config: subsequent processing (cache hit)',
    () => {
      warmMedium.process(mediumStaticCssConfig)
    },
    { warmupIterations: 10, iterations: 100 },
  )

  bench(
    'recipe config: initial processing (cache miss)',
    () => {
      const staticCss = ctx.staticCss.clone()
      staticCss.process(recipeStaticCssConfig)
    },
    { warmupIterations: 10, iterations: 50 },
  )

  const warmRecipe = warmed(recipeStaticCssConfig)

  bench(
    'recipe config: subsequent processing (cache hit)',
    () => {
      warmRecipe.process(recipeStaticCssConfig)
    },
    { warmupIterations: 20, iterations: 200 },
  )

  // Benchmark cache invalidation scenarios
  const staticCssWithInvalidation = ctx.staticCss.clone()

  bench(
    'cache invalidation: recipe change detection',
    () => {
      staticCssWithInvalidation.process({
        recipes: {
          buttonStyle: [{ size: ['sm'] }],
        },
      })
      staticCssWithInvalidation.process({
        recipes: {
          buttonStyle: [{ size: ['md'] }],
        },
      })
    },
    { warmupIterations: 10, iterations: 50 },
  )

  // Benchmark wildcard expansion overhead
  bench(
    'wildcard expansion: fontSize wildcard',
    () => {
      const staticCss = ctx.staticCss.clone()
      staticCss.process({
        css: [{ properties: { fontSize: ['*'] } }],
      })
    },
    { warmupIterations: 5, iterations: 20 },
  )

  bench(
    'wildcard expansion: specific values (no expansion)',
    () => {
      const staticCss = ctx.staticCss.clone()
      staticCss.process({
        css: [
          {
            properties: {
              fontSize: ['1', '2', '3', '4', '5'],
            },
          },
        ],
      })
    },
    { warmupIterations: 10, iterations: 50 },
  )

  // New benchmarks to test Phase 1 optimizations
  bench(
    'optimized: decoder cache benefit (large config)',
    () => {
      // Reuse same instance to test decoder caching
      const staticCss = ctx.staticCss.clone()
      // First call populates decoder cache
      staticCss.process(largeStaticCssConfig)
      // Second call should benefit from decoder cache
      staticCss.process(largeStaticCssConfig)
    },
    { warmupIterations: 3, iterations: 20 },
  )

  bench(
    'optimized: wildcard memoization benefit',
    () => {
      const staticCss = ctx.staticCss.clone()
      // Multiple calls with wildcards should benefit from memoization
      staticCss.process({
        css: [{ properties: { fontSize: ['*'] } }],
      })
      staticCss.process({
        css: [{ properties: { fontSize: ['*'] } }],
      })
      staticCss.process({
        css: [{ properties: { fontSize: ['*'] } }],
      })
    },
    { warmupIterations: 5, iterations: 30 },
  )

  const warmFullPath = warmed(mediumStaticCssConfig)

  bench(
    'optimized: full cache hit path (all optimizations)',
    () => {
      // Test the full optimized path with decoder cache + wildcard memoization.
      // Its own primed instance, not `ctx`'s — see `warmed`.
      warmFullPath.process(mediumStaticCssConfig)
      warmFullPath.process(mediumStaticCssConfig)
      warmFullPath.process(mediumStaticCssConfig)
    },
    { warmupIterations: 10, iterations: 100 },
  )
})
