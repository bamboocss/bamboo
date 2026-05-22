import { type SemanticTokens } from '@bamboocss/types';

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
        _dark: { _highContrast: '{colors.red.700}' },
        base: '{colors.red.800}',
      },
    },
    primary: { value: { _dark: '{colors.red.400}', base: '{colors.red.500}' } },
    secondary: {
      value: { _dark: '{colors.red.700}', base: '{colors.red.800}' },
    },
    surface: {
      value: {
        _materialTheme: { _dark: '#m-d', base: '#m-b' },
        _pastelTheme: { _dark: { md: '#p-d' }, base: '#p-b' },
      },
    },
  },
  spacing: {
    gutter: { value: { base: '{spacing.4}', lg: '{spacing.5}' } },
  },
};
