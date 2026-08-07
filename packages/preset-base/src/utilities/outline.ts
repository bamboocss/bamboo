import type { UtilityConfig } from '@bamboocss/types'
import { createColorMixTransform } from '../color-mix-transform'

export const outline: UtilityConfig = {
  outlineWidth: {
    className: 'ring-w',
    shorthand: 'ringWidth',
    values: 'borderWidths',
    group: 'Border',
  },
  outlineColor: {
    className: 'ring-c',
    values: 'colors',
    group: 'Color',
    shorthand: 'ringColor',
    transform: createColorMixTransform('outlineColor'),
  },
  outline: {
    className: 'ring',
    shorthand: 'ring',
    values: 'borders',
    group: 'Border',
    // Read from `raw`, the value as written, rather than from `value`. A utility with `values`
    // has its token resolved *before* the transform runs, so `value` arrives as
    // `var(--borders-none)` and a comparison against `'none'` can never match. It never did:
    // `outline: 'none'` emitted a reference to a token no preset defines, which is invalid at
    // computed-value time, so the declaration was dropped and the outline was not reset at all
    // — the opposite of what was asked for, and silent.
    //
    // `2px solid transparent` rather than `outline: none` so the ring survives forced-colors
    // mode, where a transparent outline is repainted and `none` leaves nothing to repaint.
    transform(value, { raw }) {
      if (raw === 'none') {
        return { outline: '2px solid transparent', outlineOffset: '2px' }
      }
      return { outline: value }
    },
  },
  outlineOffset: {
    className: 'ring-o',
    shorthand: 'ringOffset',
    values: 'spacing',
    group: 'Border',
  },
}
