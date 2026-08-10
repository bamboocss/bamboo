import { preset as presetBase } from '@bamboocss/preset-base'
import { preset as presetBamboo } from '@bamboocss/preset-bamboo'

const bundledPresets = {
  '@bamboocss/preset-base': presetBase,
  '@bamboocss/preset-bamboo': presetBamboo,
  '@bamboocss/dev/presets': presetBamboo,
}

const bundledPresetsNames = Object.keys(bundledPresets)

const isBundledPreset = (preset: string): preset is keyof typeof bundledPresets => bundledPresetsNames.includes(preset)

export const getBundledPreset = (preset: unknown) => {
  return typeof preset === 'string' && isBundledPreset(preset) ? bundledPresets[preset] : undefined
}

/**
 * What `presets` loads when a config does not list any.
 *
 * Exported so a config that adds a preset can keep them without restating them:
 * `presets: [...defaultPresets, myPreset]`. Spread it — the array is shared.
 */
export const defaultPresets = [presetBase, presetBamboo]

export { presetBase, presetBamboo }
