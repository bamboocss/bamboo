// This sandbox exercises the PostCSS integration on purpose: it is how a project without a
// Bamboo compiler plugin emits the stylesheet, and something has to keep covering it. Vite is
// here because these framework templates ship it, so `runtimeStyling` says the choice is meant
// rather than the one the plugin otherwise warns about.
module.exports = {
  plugins: {
    '@bamboocss/dev/postcss': { runtimeStyling: true },
  },
}
