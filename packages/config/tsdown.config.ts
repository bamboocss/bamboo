import { defineConfig, type UserConfig } from 'tsdown'

const entries = ['src/index.ts', 'src/merge-config.ts', 'src/diff-config.ts', 'src/resolve-ts-path-pattern.ts']

export default defineConfig(
  entries.map(
    (entry): UserConfig => ({
      entry: [entry],
      format: ['cjs', 'esm'],
      shims: true,
    }),
  ),
)
