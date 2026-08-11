import type { Mixin } from '../src/composition'

/**
 * Type-level assertions about what a mixin value accepts.
 *
 * Not a `.test.ts`: there is nothing to run. `tsc --noEmit` covers `packages/**` and is part of
 * `pnpm check`, so a wrong entry fails the build from here.
 *
 * It exists because a hand-maintained allowlist was wrong for a long time and nothing could
 * notice. `TextStyleProperty` listed `hypens`, which is not a css property, and so did not list
 * `hyphens`, which is — and which bamboo defines a utility for, complete with the
 * `-webkit-hyphens` polyfill. A text style could set a property that does nothing and could not
 * set the one it meant.
 *
 * The three allowlists are gone, but the guard they were meant to be is not: `Mixin` is built on
 * `SystemProperties` rather than `SystemStyleObject`, whose index signature would accept the
 * typo again. That is the single thing this file now pins.
 */

export const hyphens: Mixin = { hyphens: 'auto' }
export const hyphenateCharacter: Mixin = { hyphenateCharacter: '-' }
export const hyphenateLimitChars: Mixin = { hyphenateLimitChars: '6 3 2' }

// @ts-expect-error `hypens` is not a css property
export const misspelled: Mixin = { hypens: 'auto' }

/**
 * The partition itself is what went away: one bundle may now set a font, a border and an
 * animation, which previously needed three theme keys and three applications.
 */
export const spansFormerCategories: Mixin = {
  fontWeight: 'bold',
  backgroundColor: 'red',
  boxShadow: 'sm',
  animationName: 'fade-in',
}

/** Conditions and nested selectors come from `Nested`, so narrowing the leaf keeps them. */
export const conditional: Mixin = {
  color: 'red',
  _hover: { color: 'blue' },
  '& > p': { fontWeight: 'bold' },
}

/** Custom properties are still declarable, which `CssVarProperties` is there for. */
export const cssVar: Mixin = { '--ring': '2px' }
