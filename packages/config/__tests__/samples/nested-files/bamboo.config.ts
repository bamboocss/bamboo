import { defineConfig } from '@bamboocss/dev'
import { themeTokens } from './src'

export default defineConfig({
  preflight: true,
  presets: ['@bamboocss/dev/presets'],
  include: ['./src/**/*.{ts,tsx,jsx}'],
  exclude: [],
  hash: false,
  jsxFramework: 'react',
  theme: {
    extend: {
      tokens: themeTokens,
    },
  },
})
