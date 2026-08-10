import { definePreset, defineSemanticTokens } from '@bamboocss/dev'

export const tsImportPreset = definePreset({
  name: 'ts-import-preset',
  theme: {
    extend: {
      semanticTokens: defineSemanticTokens({
        colors: {
          placeholder: {
            value: { base: 'token(colors.gray.600)', _dark: 'token(colors.gray.400)' },
          },
          inverted: {
            default: { value: { base: 'white', _dark: 'token(colors.black)' } },
          },
        },
      }),
    },
  },
})
