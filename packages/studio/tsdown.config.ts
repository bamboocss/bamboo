import { defineConfig } from 'tsdown'

export default defineConfig({
  entry: ['scripts/studio.ts'],
  format: ['esm', 'cjs'],
  shims: true,
  dts: true,
})
