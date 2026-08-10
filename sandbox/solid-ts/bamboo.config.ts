import { defineConfig } from '@bamboocss/dev'

export default defineConfig({
  preflight: true,
  include: ['src/**/*.tsx'],
  theme: {
    extend: {
      tokens: {
        gradients: {
          simple: { value: 'linear-gradient(to right, red, blue)' },
          primary: {
            value: {
              type: 'linear',
              placement: 'to right',
              stops: ['pink', 'green'],
            },
          },
        },
        colors: {
          black: { value: 'black' },
          white: { value: 'white' },
        },
      },
      semanticTokens: {
        colors: {
          fg: {
            default: {
              value: { base: 'token(colors.black/87)', _dark: 'token(colors.white)' },
            },
          },
        },
      },
    },

    slotRecipes: {
      custom: {
        slots: ['root', 'label'],
        className: 'custom',
        base: {
          root: {
            color: 'red',
            bg: 'red.300',
          },
          label: {
            fontWeight: 'medium',
          },
        },
        variants: {
          size: {
            sm: {
              root: {
                padding: '10px',
              },
            },
            md: {
              root: {
                padding: '20px',
              },
            },
          },
        },
        defaultVariants: {
          size: 'sm',
        },
      },
    },
  },
  // strictTokens: true,
  global: {
    vars: {
      extend: {
        '--some-color': 'red',
        '--button-color': {
          syntax: '<color>',
          inherits: false,
          initialValue: 'blue',
        },
      },
    },
  },
})
