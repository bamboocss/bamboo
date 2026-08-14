import { defineTokens } from '@bamboocss/dev'
import { colors } from './colors'

export const tokens = defineTokens({
  fontSizes: {
    xs: { value: '.75rem' },
    sm: { value: '.875rem' },
    base: { value: '1rem' },
    lg: { value: '1.125rem' },
    xl: { value: '1.25rem' },
    '2xl': { value: '1.5rem' },
    '3xl': { value: '1.875rem' },
    '4xl': { value: '2.25rem' },
    '5xl': { value: '3rem' },
    '6xl': { value: '4rem' },
  },
  fonts: {
    mono: { value: 'var(--font-mono), Menlo, monospace' },
    body: { value: 'var(--font-sans), sans-serif' },
    heading: { value: 'var(--font-sans), sans-serif' },
  },
  /**
   * The two layer names `drawer.tsx` already writes, which nothing declared.
   *
   * The recipe came from Chakra, where these are tokens; here they resolved to nothing and
   * shipped as `z-index: overlay` and `z-index: modal` — both of which parse, so no build
   * objected, and both of which the browser discards, leaving the drawer with no stacking
   * context at all.
   *
   * In the dialog's neighbourhood rather than Chakra's 1300/1400, because that is where this
   * site's own modal surfaces live: `dialog.tsx` sets `--dialog-z-index: 200` and stacks its
   * layers above it. The drawer is the same kind of surface and belongs on the same plane,
   * content over backdrop.
   */
  zIndex: {
    overlay: { value: '200' },
    modal: { value: '210' },
  },
  colors,
})
