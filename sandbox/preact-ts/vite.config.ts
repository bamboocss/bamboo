import bamboocss from '@bamboocss/vite'
import { defineConfig } from 'vite'
import preact from '@preact/preset-vite'
import tsconfigPaths from 'vite-tsconfig-paths'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [bamboocss(), tsconfigPaths(), preact()],
  resolve: {
    conditions: ['source'],
  },
})
