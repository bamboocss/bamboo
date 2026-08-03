import { defineConfig, type UserConfig } from 'tsdown'

const entries = [
  'src/cli-default.ts',
  'src/cli-main.ts',
  'src/errors.ts',
  'src/index.ts',
  'src/interactive.ts',
  'src/presets.ts',
  'src/types.ts',
]

export default defineConfig(
  entries.map(
    (entry): UserConfig => ({
      entry: [entry],
      format: ['esm', 'cjs'],
      shims: true,
    }),
  ),
)
