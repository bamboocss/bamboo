import { defineConfig } from '@bamboocss/dev'

export default defineConfig({
  outExtension: 'js',
  preflight: true,
  include: ['./app/routes/**/*.{tsx,jsx}', './app/components/**/*.{tsx,jsx}'],
  exclude: [],
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
    fontface: {
      Dosis: {
        src: "url(/Dosis-VariableFont_wght.ttf) format('truetype')",
        fontWeight: '100 800',
        fontDisplay: 'swap',
      },
    },
  },
})
