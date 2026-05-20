import { defineConfig } from 'tsdown'

const entries = ['src/index.ts', 'src/merge-config.ts', 'src/diff-config.ts', 'src/resolve-ts-path-pattern.ts']

export default defineConfig(
  entries.map((entry) => ({
    entry: [entry],
    format: ['cjs', 'esm'] as const,
    shims: true,
  })),
)
