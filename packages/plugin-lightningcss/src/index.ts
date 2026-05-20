import type { BambooPlugin } from '@bamboocss/types'
import { optimizeLightCss } from './optimize-lightningcss'

export { optimizeLightCss }

export function pluginLightningcss(): BambooPlugin {
  return {
    name: '@bamboocss/plugin-lightningcss',
    hooks: {
      'css:optimize': ({ css, minify, browserslist }) => {
        return optimizeLightCss(css, { minify, browserslist })
      },
    },
  }
}
