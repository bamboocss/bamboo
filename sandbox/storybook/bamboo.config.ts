import { defineConfig } from '@bamboocss/dev'

export default defineConfig({
  preflight: true,
  include: ['./stories/**/*.{jsx,tsx}'],
  exclude: [],
  outdir: 'styled-system',
})
