import type { Preset } from '@bamboocss/types'
import { breakpoints } from './breakpoints'
import { containerSizes } from './containers'
import { keyframes } from './keyframes'
import { tokens } from './tokens'
import { textStyles } from './typography'

const definePreset = <T extends Preset>(config: T) => config

export const preset = definePreset({
  name: '@bamboocss/preset-bamboo',
  theme: {
    keyframes,
    breakpoints,
    tokens,
    textStyles,
    containerSizes,
  },
})

export default preset
