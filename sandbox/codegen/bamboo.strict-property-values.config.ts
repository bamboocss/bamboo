import { defineConfig } from '@bamboocss/dev'
import { defaultPresets } from '@bamboocss/dev/presets'
import codegenPreset from './preset'

export default defineConfig({
  presets: [...defaultPresets, codegenPreset],
  // Whether to use css reset
  preflight: true,

  // Where to look for your css declarations
  include: ['./src/**/*.{js,jsx,ts,tsx}', './pages/**/*.{js,jsx,ts,tsx}'],

  // Files to exclude
  exclude: [],

  // The output directory for your css system
  outdir: 'styled-system-strict-property-values',

  strictPropertyValues: true,
})
