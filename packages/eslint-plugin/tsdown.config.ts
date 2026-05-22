import { defineConfig } from 'tsdown'

export default defineConfig([
  {
    entry: ['src/index.ts'],
    external: [/tests\/fixtures/],
    format: ['esm', 'cjs'] as const,
    shims: true,
  },
  {
    entry: ['src/utils/worker.ts'],
    external: [/tests\/fixtures/],
    format: ['esm', 'cjs'] as const,
    outDir: 'dist/utils',
    shims: true,
  },
])
