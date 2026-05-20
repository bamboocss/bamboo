import type { BambooPlugin } from '@bamboocss/types'
import { vueToTsx } from './vue-to-tsx'

export { vueToTsx }

export function pluginVue(): BambooPlugin {
  return {
    name: '@bamboocss/plugin-vue',
    hooks: {
      'parser:before': ({ filePath, content }) => {
        if (filePath.endsWith('.vue')) {
          return vueToTsx(content)
        }
      },
    },
  }
}
