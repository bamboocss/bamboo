import type { Preset } from '@bamboocss/types'
import { breakpoints } from './breakpoints'
import { containerSizes } from './containers'
import { keyframes } from './keyframes'
import { tokens } from './tokens'
import { mixins } from './typography'

const definePreset = <T extends Preset>(config: T) => config

export const preset = definePreset({
  name: '@bamboocss/preset-bamboo',
  theme: {
    keyframes,
    breakpoints,
    tokens,
    mixins,
    containerSizes,
  },
})

export default preset
