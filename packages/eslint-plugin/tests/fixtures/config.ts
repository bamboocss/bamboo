import { recipes } from './recipes.ts'
import { semanticTokens } from './semantic-tokens.ts'
import { slotRecipes } from './slot-recipes.ts'
import presetBase from '@bamboocss/preset-base'
import presetBamboo from '@bamboocss/preset-bamboo'
import type { PresetCore, Theme } from '@bamboocss/types'

const conditions = {
  ...presetBase.conditions,
  dark: '[data-theme=dark] &, .dark &, &.dark, &[data-theme=dark]',
  light: '[data-theme=light] &, .light &, &.light, &[data-theme=light]',
  materialTheme: '[data-color=material] &',
  pastelTheme: '[data-color=pastel] &',
}

const theme = presetBamboo.theme
const tokens = {
  ...theme.tokens,
  colors: {
    ...theme.tokens?.colors,
    deep: {
      test: {
        pool: {
          poller: {
            value: '#fff',
          },
          tall: {
            value: '$dfdf',
          },
        },
        yam: {
          value: '%555',
        },
      },
    },
  },
} as Theme['tokens']

const textStyles = {
  headline: {
    h1: {
      value: {
        fontSize: '2rem',
        fontWeight: 'bold',
      },
    },
    h2: {
      value: {
        fontSize: { base: '1.5rem', lg: '2rem' },
        fontWeight: 'bold',
      },
    },
  },
}

export const fixturePreset: Omit<PresetCore, 'globalCss' | 'staticCss'> = {
  ...presetBase,
  conditions,
  theme: {
    ...theme,
    recipes,
    semanticTokens,
    slotRecipes,
    textStyles,
    tokens,
  },
}
