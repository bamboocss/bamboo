import { defineConfig } from '@bamboocss/dev'
import { defaultPresets } from '@bamboocss/dev/presets'
import codegenPreset from './preset'

/**
 * The base config with `leafFallback` off, for the fold tests that need a context saying so.
 *
 * Not a codegen scenario — `cli.ts` lists those explicitly and this is not among them, so it
 * generates no `styled-system-*` directory and adds nothing to that matrix. The vite fold
 * builds its own context from a config and never reads the generated output, so a config on
 * its own is the whole fixture.
 */
export default defineConfig({
  presets: [...defaultPresets, codegenPreset],
  preflight: true,
  include: ['./src/**/*.{js,jsx,ts,tsx}', './pages/**/*.{js,jsx,ts,tsx}'],
  exclude: [],
  outdir: 'styled-system',
  leafFallback: false,
})
