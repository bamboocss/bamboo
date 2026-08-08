import bamboocss from '@bamboocss/vite'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

const ANALYZE = !!process.env.ANALYZE

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [bamboocss(), react()],
  build: {
    sourcemap: ANALYZE,
  },
  resolve: {
    conditions: ['source'],
  },
})
