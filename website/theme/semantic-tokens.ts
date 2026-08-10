import { defineSemanticTokens } from '@bamboocss/dev'

export const semanticTokens = defineSemanticTokens({
  colors: {
    // Background tokens
    bg: {
      DEFAULT: {
        value: { base: 'token(colors.white)', _dark: 'token(colors.dark)' },
      },
      subtle: {
        value: { base: 'token(colors.neutral.50)', _dark: 'token(colors.neutral.900)' },
      },
      muted: {
        value: { base: 'token(colors.neutral.100)', _dark: 'token(colors.neutral.800)' },
      },
      surface: {
        value: { base: 'token(colors.white)', _dark: 'token(colors.neutral.900)' },
      },
      inverted: {
        value: { base: 'token(colors.black)', _dark: 'token(colors.neutral.700)' },
      },
      main: {
        value: { base: 'token(colors.yellow.300)', _dark: 'token(colors.neutral.700)' },
      },
      emphasized: {
        value: { base: 'token(colors.white)', _dark: 'token(colors.yellow.300)' },
      },
      'emphasized.hover': {
        value: { base: 'token(colors.neutral.100)', _dark: 'token(colors.neutral.800)' },
      },
    },

    // Foreground tokens
    fg: {
      DEFAULT: {
        value: { base: 'token(colors.neutral.900)', _dark: 'token(colors.neutral.50)' },
      },
      muted: {
        value: { base: 'token(colors.neutral.600)', _dark: 'token(colors.neutral.300)' },
      },
      subtle: {
        value: { base: 'token(colors.neutral.500)', _dark: 'token(colors.neutral.500)' },
      },
      inverted: {
        value: { base: 'token(colors.white)', _dark: 'token(colors.black)' },
      },
      headline: {
        value: { base: 'token(colors.black)', _dark: 'token(colors.yellow.300)' },
      },
    },

    // Accent tokens
    accent: {
      DEFAULT: {
        value: { base: 'token(colors.yellow.400)', _dark: 'token(colors.yellow.300)' },
      },
      emphasis: {
        value: { base: 'token(colors.yellow.500)', _dark: 'token(colors.yellow.200)' },
      },
      subtle: {
        value: { base: 'token(colors.yellow.200)', _dark: '#414012' },
      },
    },

    // Link tokens
    link: {
      DEFAULT: {
        value: { base: 'token(colors.blue.600)', _dark: 'token(colors.blue.400)' },
      },
      emphasized: {
        value: { base: 'token(colors.blue.700)', _dark: 'token(colors.blue.300)' },
      },
    },

    // Border tokens
    border: {
      DEFAULT: {
        value: { base: 'token(colors.neutral.200)', _dark: 'token(colors.neutral.700)' },
      },
      muted: {
        value: { base: 'token(colors.neutral.100)', _dark: 'token(colors.neutral.900)' },
      },
    },
  },
})
