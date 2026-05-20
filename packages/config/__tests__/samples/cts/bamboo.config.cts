import { defineConfig } from '@bamboocss/dev'
import { tokens } from '../common/tokens'

export default defineConfig({
  preflight: true,
  presets: ['@bamboocss/dev/presets'],
  include: ['./src/**/*.{ts,tsx,jsx}'],
  exclude: [],
  hash: false,
  jsxFramework: 'react',
  theme: {
    extend: {
      tokens: tokens,
    },
  },
})
