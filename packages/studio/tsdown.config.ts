import { defineConfig } from 'tsdown'

export default defineConfig({
  entry: ['scripts/studio.ts'],
  format: ['esm', 'cjs'],
  splitting: false,
  shims: true,
  dts: true,
})
