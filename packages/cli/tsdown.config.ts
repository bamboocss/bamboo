import { defineConfig } from 'tsdown'

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
  entries.map((entry) => ({
    entry: [entry],
    format: ['esm', 'cjs'] as const,
    shims: true,
  })),
)
