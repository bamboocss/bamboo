import type { SemanticTokens } from '@bamboocss/types'

export const semanticTokens: SemanticTokens = {
  colors: {
    button: {
      card: {
        body: {
          value: { _dark: '#000', base: '#fff' },
        },
        heading: {
          value: { _dark: '#000', base: '#fff' },
        },
      },
      thick: {
        value: { _dark: '#000', base: '#fff' },
      },
    },
    complex: {
      value: {
        _dark: { _highContrast: 'token(colors.red.700)' },
        base: 'token(colors.red.800)',
      },
    },
    primary: { value: { _dark: 'token(colors.red.400)', base: 'token(colors.red.500)' } },
    secondary: {
      value: { _dark: 'token(colors.red.700)', base: 'token(colors.red.800)' },
    },
    surface: {
      value: {
        _materialTheme: { _dark: '#m-d', base: '#m-b' },
        _pastelTheme: { _dark: { md: '#p-d' }, base: '#p-b' },
      },
    },
  },
  spacing: {
    gutter: { value: { base: 'token(spacing.4)', lg: 'token(spacing.5)' } },
  },
}
