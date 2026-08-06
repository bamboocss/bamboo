import { defineConfig } from '@bamboocss/dev'
import codegenPreset from './preset'

export default defineConfig({
  presets: ['@bamboocss/dev/presets', codegenPreset],
  preflight: false,

  // Only this scenario's source, so the emitted CSS is exactly what these call sites
  // produce and an assertion about it cannot be satisfied by some other file's styles.
  include: ['./src/grouped.tsx'],
  exclude: [],

  outdir: 'styled-system-grouped',
  jsxFramework: 'react',

  // The point of the scenario. Nothing else in this repo builds with it, so every bug in
  // grouped mode has had to be found by hand.
  cssMode: 'grouped',
})
