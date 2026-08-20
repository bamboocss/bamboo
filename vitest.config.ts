import { defineConfig } from 'vitest/config'
import tsconfigPaths from 'vite-tsconfig-paths'

const resolve = (val: string) => new URL(val, import.meta.url).pathname

export default defineConfig({
  root: process.cwd(),
  plugins: [tsconfigPaths()],
  test: {
    globals: true,
    testTimeout: 15_000,
    setupFiles: ['tests-setup.ts'],
    // Tells @bamboocss/eslint-plugin's synckit worker to build its context from
    // the test fixtures instead of discovering a real bamboo config on disk.
    env: {
      BAMBOO_ESLINT_TEST_CONTEXT: new URL('./packages/eslint-plugin/tests/fixtures/create-context.ts', import.meta.url)
        .href,
    },
    hideSkippedTests: true,
    environment: 'happy-dom',
    // `pnpm bench`. Benchmarks are reported, not asserted — wall-clock numbers are
    // machine- and load-dependent, so they are not part of `pnpm check` or CI. To
    // measure a change, take a baseline on the same machine and compare against it:
    //
    //   pnpm bench:baseline   # on the unchanged tree
    //   pnpm bench:compare    # on the changed tree
    //
    // The bench scripts pass --no-file-parallelism: the default worker pool runs
    // bench files concurrently, and the resulting CPU contention inflates rme far
    // past the effect sizes these are meant to catch.
    benchmark: {
      include: ['{packages,sandbox}/*/__tests__/**/*.bench.ts'],
      outputJson: 'bench/latest.json',
    },
  },
  resolve: {
    alias: [
      {
        find: '@bamboocss/config/ts-path',
        replacement: resolve('./packages/config/src/resolve-ts-path-pattern.ts'),
      },
      {
        find: '@bamboocss/node/static-compiler',
        replacement: resolve('./packages/node/src/static-compiler.ts'),
      },
      {
        find: '@bamboocss/dev',
        replacement: resolve('./packages/cli/src'),
      },
      {
        find: /^@bamboocss\/(.*)$/,
        replacement: resolve('./packages/$1/src'),
      },
    ],
  },
})
