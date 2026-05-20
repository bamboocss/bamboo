import { preset as presetBase } from '@bamboocss/preset-base'
import { preset as presetBamboo } from '@bamboocss/preset-bamboo'

const bundledPresets = {
  '@bamboocss/preset-base': presetBase,
  '@bamboocss/preset-bamboo': presetBamboo,
  '@bamboocss/dev/presets': presetBamboo,
}

const bundledPresetsNames = Object.keys(bundledPresets)

export const isBundledPreset = (preset: string): preset is keyof typeof bundledPresets =>
  bundledPresetsNames.includes(preset)

export const getBundledPreset = (preset: unknown) => {
  return typeof preset === 'string' && isBundledPreset(preset) ? bundledPresets[preset] : undefined
}

export { presetBase, presetBamboo }
