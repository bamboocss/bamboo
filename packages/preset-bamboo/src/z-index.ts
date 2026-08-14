import type { Tokens } from '@bamboocss/types'

/**
 * A layering scale, so stacking is named rather than guessed.
 *
 * There was no `zIndex` category at all, which meant every project invented one — usually as raw
 * numbers scattered across components, occasionally as semantic names copied from another design
 * system. The second is worse: `zIndex: 'overlay'` against a theme that declares nothing resolves
 * to nothing and ships `z-index: overlay`, which parses, so no build objects, and which the
 * browser discards — leaving the element with no stacking context at all. That is a real bug this
 * repo's own documentation site shipped, in a drawer copied from Chakra.
 *
 * The gaps are the point. Values are spaced so a project can slot its own layer between two of
 * these without renumbering anything, and the names describe *what is stacking* rather than how
 * high — `modal` over `overlay` is a fact about modals, where `z400` over `z300` is a fact about
 * nothing.
 */
export const zIndex: Tokens['zIndex'] = {
  hide: { value: -1 },
  base: { value: 0 },
  docked: { value: 10 },
  dropdown: { value: 1000 },
  sticky: { value: 1100 },
  banner: { value: 1200 },
  overlay: { value: 1300 },
  modal: { value: 1400 },
  popover: { value: 1500 },
  skipNav: { value: 1600 },
  toast: { value: 1700 },
  tooltip: { value: 1800 },
}
