import { preset as presetBamboo } from '@bamboocss/preset-bamboo'
import { preset as presetBase } from '@bamboocss/preset-base'

/**
 * The presets a config loads when it lists none.
 *
 * `presets` is authoritative, so a config that adds one has to say what it is adding to:
 *
 * ```ts
 * import { defaultPresets } from '@bamboocss/dev/presets'
 * export default defineConfig({ presets: [...defaultPresets, myPreset] })
 * ```
 *
 * Spread it — the array is shared.
 */
export const defaultPresets = [presetBase, presetBamboo]

export { presetBamboo, presetBase }

export default presetBamboo
