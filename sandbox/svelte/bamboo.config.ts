import { defineConfig } from '@bamboocss/dev'

export default defineConfig({
  preflight: true,
  include: ['./src/**/*.{js,svelte,ts}'],
  outdir: 'styled-system',
  theme: {
    semanticTokens: {
      colors: {
        text: { value: { base: 'token(colors.gray.600)', _osDark: 'token(colors.gray.400)' } },
      },
    },
    recipes: {
      button: {
        className: 'button',
        description: 'A button styles',
        base: {
          fontSize: 'lg',
        },
        variants: {
          size: {
            sm: {
              padding: '2',
              borderRadius: 'sm',
            },
            md: {
              padding: '4',
              borderRadius: 'md',
            },
          },
          variant: {
            primary: {
              color: 'white',
              backgroundColor: 'blue.500',
            },
            danger: {
              color: 'white',
              backgroundColor: 'red.500',
            },
          },
        },
      },
    },
  },
  global: {
    css: {
      '*': {
        fontFamily: 'Inter',
        margin: '0',
      },
      a: {
        color: 'inherit',
        textDecoration: 'none',
      },
    },
  },
})
