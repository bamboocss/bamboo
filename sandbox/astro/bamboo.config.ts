import { defineConfig } from '@bamboocss/dev'

export default defineConfig({
  preflight: true,
  include: ['./src/**/*.{astro,tsx}'],
  outdir: 'styled-system',
})
