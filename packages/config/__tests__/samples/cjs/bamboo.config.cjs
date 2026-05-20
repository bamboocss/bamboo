const { defineConfig } = require('@bamboocss/dev')
const { tokens } = require('../common/tokens')

module.exports = defineConfig({
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
