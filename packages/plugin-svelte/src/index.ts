import type { BambooPlugin } from '@bamboocss/types'
import { svelteToTsx } from './svelte-to-tsx'

export { svelteToTsx }

export function pluginSvelte(): BambooPlugin {
  return {
    name: '@bamboocss/plugin-svelte',
    hooks: {
      'parser:before': ({ filePath, content }) => {
        if (filePath.endsWith('.svelte')) {
          return svelteToTsx(content)
        }
      },
    },
  }
}
