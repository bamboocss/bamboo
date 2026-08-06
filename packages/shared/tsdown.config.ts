import { defineConfig, type UserConfig } from 'tsdown'

const entries = ['src/index.ts', 'src/shared.ts']

export default defineConfig(
  entries.map(
    (entry): UserConfig => ({
      entry: [entry],
      format: ['esm', 'cjs'],
    }),
  ),
)
