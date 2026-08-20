import { defineConfig } from 'tsdown'

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['esm', 'cjs'],
  shims: true,
  // Internal dynamic imports are published files, not disposable application assets. Stable
  // format-specific names make the pack closure reproducible and avoid teaching exports or
  // consumers about a content hash which changes independently in ESM and CommonJS output.
  hash: false,
})
