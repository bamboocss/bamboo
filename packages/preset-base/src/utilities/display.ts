import type { UtilityConfig } from '@bamboocss/types'

export const display: UtilityConfig = {
  display: {
    className: 'd',
    group: 'Display',
  },

  hideFrom: {
    className: 'hide',
    values: 'breakpoints',
    group: 'Display',
    transform(value, { raw, token }) {
      const bp = token.raw(`breakpoints.${raw}`)
      const media = bp ? `@breakpoint ${raw}` : `@media (width >= ${value})`
      return {
        [media]: {
          display: 'none',
        },
      }
    },
  },

  hideBelow: {
    className: 'show',
    values: 'breakpoints',
    group: 'Display',
    transform(value, { raw, token }) {
      const bp = token.raw(`breakpoints.${raw}`)
      // Exclusive, matching the `Down` range a token value resolves to. The arbitrary path used
      // an inclusive `max-width`, so `hideBelow="800px"` and a `800px` breakpoint disagreed at
      // exactly 800px.
      const media = bp ? `@breakpoint ${raw}Down` : `@media (width < ${value})`
      return {
        [media]: {
          display: 'none',
        },
      }
    },
  },
}
