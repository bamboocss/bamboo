// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  telemetry: false,
  postcss: {
    plugins: { '@bamboocss/dev/postcss': {} },
  },
  css: ['~/assets/main.css'],
})
