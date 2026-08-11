import { defineMixins } from '@bamboocss/dev'

export const mixins = defineMixins({
  bamboo: {
    h1: {
      value: {
        fontSize: '14.5rem',
        lineHeight: '1',
        letterSpacing: 'tighter',
      },
    },
    h2: {
      value: {
        fontSize: { base: '2.5rem', lg: '3rem' },
        lineHeight: '1.2',
        letterSpacing: 'tight',
      },
    },
    h3: {
      value: {
        fontSize: { base: '1.875rem', lg: '2.25rem' },
        lineHeight: '1.2',
        letterSpacing: 'tight',
      },
    },
    h4: {
      value: {
        fontSize: '1.625rem',
        lineHeight: '1.2',
        letterSpacing: 'tight',
      },
    },
  },

  offShadow: {
    value: {
      border: '3px solid var(--shadow-color, black)',
      boxShadow: '4px 4px 0px 0px var(--shadow-color, black)',
    },
  },
})
