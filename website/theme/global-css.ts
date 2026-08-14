import { defineGlobalStyles } from '@bamboocss/dev'

export const globalCss = defineGlobalStyles({
  '*, *::before, *::after': {
    borderColor: 'border',
  },
  html: {
    fontFamily: 'sans',
    // Was 0.9em, which scaled the whole rem system to 14.4px and made body copy,
    // sidebar and table of contents all read a size small. Everything sized in rem
    // moves with it, which is why the page felt uniformly cramped rather than
    // obviously wrong in any one place.
    fontSize: '1em',
    '--nextra-primary-hue': '212deg',
    // Defined here, not on `main`. The navbar sizes itself from this and is
    // `position: fixed`, so `main` has to reserve exactly as much -- and the two are
    // siblings, so a value set on `main` is invisible to the navbar. It silently fell
    // back to 4rem while `main` reserved less, leaving anything directly in `main`
    // tucked under the bar.
    '--navbar-height': '4.5rem',
    // Where the three columns start. One value so they cannot drift apart.
    '--content-top': 'calc(var(--navbar-height) + 2rem)',
    scrollPaddingTop: 'calc(var(--navbar-height) + 1rem)',
  },
  body: {
    bg: 'bg',
    color: 'fg',
    minHeight: '100vh',
    scrollMarginTop: '80px',
  },
  "a, summary, button, input, [tabindex]:not([tabindex='-1'])": {
    outline: 'none',
    _focusVisible: {
      outline: '2px',
      outlineColor: 'blue.400',
      outlineOffset: '1px',
      outlineStyle: 'solid',
    },
  },
  /* Content Typography */
  'article details > summary': {
    '&::-webkit-details-marker': {
      display: 'none',
    },
    _before: {
      backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' class='h-5 w-5' viewBox='0 0 20 20' fill='currentColor'%3E%3Cpath fill-rule='evenodd' d='M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z' clip-rule='evenodd' /%3E%3C/svg%3E")`,
      height: '1.2em',
      width: '1.2em',
      verticalAlign: '-4px',
    },
  },

  "input[type='search']": {
    '&::-webkit-search-decoration, &::-webkit-search-cancel-button, &::-webkit-search-results-button, &::-webkit-search-results-decoration':
      {
        WebkitAppearance: 'none',
      },
  },
  '.contains-task-list': {
    ml: 0,
    listStyle: 'none',
    "& input[type='checkbox']": {
      mr: 1,
    },
  },
  '.scroll-area': {
    scrollbarWidth: 'thin',
    scrollbarColor: 'oklch(55.55% 0 0 / 40%) transparent',
    scrollbarGutter: 'auto',
    '&::-webkit-scrollbar': {
      w: '3',
      h: '3',
    },
    '&::-webkit-scrollbar-track': {
      bg: 'transparent',
    },
    '&::-webkit-scrollbar-thumb': {
      rounded: '10px',
    },
  },
  code: {
    boxDecorationBreak: 'clone',
    fontFeatureSettings: "'rlig' 1, 'calt' 1, 'ss01' 1",
    px: '0.3em',
    '&[data-line-numbers] > .line': {
      display: 'inline-flex',
      ps: 2,
      '&::before': {
        counterIncrement: 'line',
        content: 'counter(line)',
        h: 'full',
        float: 'left',
        pe: 4,
        textAlign: 'right',
        minW: '2.6rem',
        color: 'fg.subtle',
      },
    },
    '& .line': {
      px: 4,
      '&.highlighted': {
        bg: 'hsl(var(--nextra-primary-hue), 100%, 45%, 0.15)',
        color: 'hsl(var(--nextra-primary-hue), 100%, 45%, 0.5)',
        shadow: '2px 0 currentColor inset',
      },
      '& .highlighted': {
        rounded: 'md',
        bg: 'hsl(var(--nextra-primary-hue), 100%, 32%, 0.1)',
        shadow: '0 0 0 2px rgba(0,0,0,.3)',
        shadowColor: 'hsl(var(--nextra-primary-hue), 100%, 32%, 0.1)',
        _dark: {
          bg: 'hsl(var(--nextra-primary-hue), 100%, 77%, 0.1)',
          shadowColor: 'hsl(var(--nextra-primary-hue), 100%, 77%, 0.1)',
        },
      },
    },
  },
  pre: {
    '& code': {
      display: 'grid',
      minW: 'full',
      // `'0'`, not `'none'`: `border-radius: none` is not css, so this declaration was dropped
      // and the inline-code rounding leaked into fenced blocks.
      rounded: '0',
      border: 'none',
      bg: 'transparent!',
      p: '0!',
      mixin: 'sm',
      lineHeight: '1.25rem',
      color: 'currentcolor',
      _dark: {
        bg: 'transparent!',
      },
    },
    'html[data-word-wrap] &': {
      wordBreak: 'break-word',
      whiteSpace: 'pre-wrap',
      md: {
        whiteSpace: 'pre',
      },
      '& .line': {
        display: 'inline-block',
      },
    },
  },
  '.subheading-anchor': {
    opacity: 0,
    transition: 'opacity',
    ms: '1',
    'span:target + &, :hover > &, &:focus': {
      opacity: 1,
    },
    'span + &,&:hover > &': {
      textDecoration: 'none',
    },
    '&:after': {
      content: "'#'",
      px: 1,
      color: 'fg.subtle',
      'span:target + &': {
        color: 'fg.muted',
      },
    },
  },
})
