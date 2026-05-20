import { defineConfig } from '@bamboocss/dev'

export default defineConfig({
  preflight: true,
  include: [
    './node_modules/@sandbox-nuxt-lib-source/css-lib/src/**/*.{js,jsx,ts,tsx}',
    './pages/**/*.{vue,ts,tsx}',
    './components/**/*.{vue,ts,tsx}',
  ],
  exclude: [],
  outdir: '@sandbox-nuxt-lib-source/styled-system',
  jsxFramework: 'vue',
})
