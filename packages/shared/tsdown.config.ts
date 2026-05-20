import { defineConfig } from 'tsdown'

const entries = ['src/index.ts', 'src/shared.ts', 'src/astish.ts', 'src/normalize-html.ts']

export default defineConfig(
  entries.map((entry) => ({
    entry: [entry],
    format: ['esm', 'cjs'] as const,
  })),
)
