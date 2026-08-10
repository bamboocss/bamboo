import type { SemanticTokens } from '@bamboocss/types'

export const semanticTokens: SemanticTokens = {
  colors: {
    primary: { value: { base: 'token(colors.red.500)', _dark: 'token(colors.red.400)' } },
    secondary: { value: { base: 'token(colors.red.800)', _dark: 'token(colors.red.700)' } },
    complex: { value: { base: 'token(colors.red.800)', _dark: { _highContrast: 'token(colors.red.700)' } } },
    surface: {
      value: {
        _materialTheme: { base: '#m-b', _dark: '#m-d' },
        _pastelTheme: { base: '#p-b', _dark: { md: '#p-d' } },
      },
    },
    button: {
      thick: {
        value: { base: '#fff', _dark: '#000' },
      },
      card: {
        body: {
          value: { base: '#fff', _dark: '#000' },
        },
        heading: {
          value: { base: '#fff', _dark: '#000' },
        },
      },
    },
  },
  spacing: {
    gutter: { value: { base: 'token(spacing.4)', lg: 'token(spacing.5)' } },
  },
}
