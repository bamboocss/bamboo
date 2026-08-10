import type { AnimationStyle, LayerStyle, TextStyle } from '../src/composition'

/**
 * Type-level assertions about the composition property allowlists.
 *
 * Not a `.test.ts`: there is nothing to run. `tsc --noEmit` covers `packages/**` and is part of
 * `pnpm check`, so a wrong entry in one of these unions fails the build from here.
 *
 * It exists because one of them was wrong for a long time and nothing could notice.
 * `TextStyleProperty` listed `hypens`, which is not a css property, and so did not list
 * `hyphens`, which is — and which bamboo defines a utility for, complete with the
 * `-webkit-hyphens` polyfill. A `textStyle` could set a property that does nothing and could
 * not set the one it meant. A hand-maintained allowlist of 72 names has no other guard.
 */

/* -----------------------------------------------------------------------------
 * Text styles
 * -----------------------------------------------------------------------------*/

export const hyphens: TextStyle = { hyphens: 'auto' }

/** Its siblings were always spelled correctly, which is what made the gap odd. */
export const hyphenateCharacter: TextStyle = { hyphenateCharacter: '-' }
export const hyphenateLimitChars: TextStyle = { hyphenateLimitChars: '6 3 2' }

// @ts-expect-error `hypens` is not a css property and is no longer accepted
export const misspelled: TextStyle = { hypens: 'auto' }

// @ts-expect-error a layer-style property is not a text-style property
export const notTextStyle: TextStyle = { backgroundColor: 'red' }

/* -----------------------------------------------------------------------------
 * The other two, so the same class of mistake is pinned there as well
 * -----------------------------------------------------------------------------*/

export const layer: LayerStyle = { backgroundColor: 'red', boxShadow: 'sm' }

// @ts-expect-error a text-style property is not a layer-style property
export const notLayerStyle: LayerStyle = { fontWeight: 'bold' }

export const animation: AnimationStyle = { animationName: 'fade-in', animationDuration: '1s' }

// @ts-expect-error a layer-style property is not an animation-style property
export const notAnimationStyle: AnimationStyle = { color: 'red' }
