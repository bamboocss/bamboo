import { definePreset, defineSemanticTokens } from '@bamboocss/dev'

export const requiredPreset = definePreset({
  name: 'required-preset',
  theme: {
    extend: {
      semanticTokens: defineSemanticTokens({
        colors: {
          muted: {
            value: { base: 'token(colors.gray.500)', _dark: 'token(colors.gray.400)' },
          },
          subtle: {
            value: { base: 'token(colors.gray.400)', _dark: 'token(colors.gray.500)' },
          },
        },
      }),
    },
  },
})
