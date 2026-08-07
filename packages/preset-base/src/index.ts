import type { Preset } from '@bamboocss/types'
import { conditions } from './conditions'
import { patterns } from './patterns'
import { utilities } from './utilities'

const definePreset = <T extends Preset>(preset: T) => preset

// No `globalCss`. The composed custom properties used to be defaulted by a rule on
// `*, ::before, ::after, ::backdrop`, which is how they were kept from inheriting before
// `@property` existed. Each is now registered by the utility that composes it — see
// `customProperties` on `filter`, `translate`, `scale` and the rest.
export const preset = definePreset({
  name: '@bamboocss/preset-base',
  conditions,
  utilities,
  patterns,
})

export default preset
