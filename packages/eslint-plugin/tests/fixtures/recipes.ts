import type { RecipeConfig } from '@bamboocss/types'

export const recipes: Record<string, RecipeConfig> = {
  buttonStyle: {
    base: {
      _hover: {
        backgroundColor: 'red.200',
        color: 'white',
        fontSize: '3xl',
      },
      alignItems: 'center',
      display: 'inline-flex',
      justifyContent: 'center',
    },
    className: 'buttonStyle',
    defaultVariants: {
      size: 'md',
      variant: 'solid',
    },
    variants: {
      size: {
        md: {
          height: '3rem',
          minWidth: '3rem',
          padding: '0 0.75rem',
        },
        sm: {
          height: '2.5rem',
          minWidth: '2.5rem',
          padding: '0 0.5rem',
        },
      },
      variant: {
        outline: {
          '&[data-disabled]': {
            backgroundColor: 'transparent',
            border: '1px solid gray',
            color: 'gray',
          },
          _hover: {
            backgroundColor: 'blue',
            color: 'white',
          },
          backgroundColor: 'transparent',
          border: '1px solid blue',
          color: 'blue',
        },
        solid: {
          '&[data-disabled]': {
            backgroundColor: 'gray',
            color: 'black',
            fontSize: '2xl',
          },
          _hover: {
            backgroundColor: 'darkblue',
          },
          backgroundColor: 'blue',
          color: 'white',
        },
      },
    },
  },
  cardStyle: {
    className: 'card',
    variants: {
      rounded: {
        true: {
          borderRadius: '0.375rem',
        },
      },
    },
  },
  textStyle: {
    base: {
      divideX: '20px',
      fontFamily: 'mono',
    },
    className: 'textStyle',
    variants: {
      size: {
        h1: {
          fontSize: '5rem',
          fontWeight: 800,
          lineHeight: '1em',
        },
        h2: {
          fontSize: '3rem',
          fontWeight: 700,
          letterSpacing: '-0.03em',
          lineHeight: '1.2em',
        },
      },
    },
  },
  tooltipStyle: {
    base: {
      '&[data-tooltip], & [data-tooltip]': {
        color: { _dark: 'red' },
      },
    },
    className: 'tooltipStyle',
  },
}
