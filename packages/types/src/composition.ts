import type { Nested } from './conditions'
import type { CssVarProperties, SystemProperties } from './style-props'

interface Token<T> {
  value: T
  description?: string
}

interface Recursive<T> {
  [key: string]: Recursive<T> | T
}

/* -----------------------------------------------------------------------------
 * Mixins
 * -----------------------------------------------------------------------------*/

/**
 * A named bundle of declarations, applied by name through the `mixin` style property.
 *
 * This was three theme keys — `textStyles`, `layerStyles` and `animationStyles` — with three
 * `define*` helpers, three spec artifacts and three style properties, all running through the
 * same registration and differing only in which css properties the value was allowed to set.
 *
 * That partition was not a guard worth three concepts. It was arbitrary at the edges (`color`
 * was legal in both a text style and a layer style, `transform` in a layer style but
 * `transformOrigin` only in an animation style), and it cost something real in the middle: a
 * bundle wanting a font *and* a border had to be split across two keys and applied twice,
 * because neither key would accept the other's half.
 *
 * What the three allowlists did buy was rejecting a property that does not exist, and that is
 * kept here rather than thrown away with them — which is why this is not simply
 * `SystemStyleObject`. That type unions in an index signature so a style object can carry an
 * arbitrary selector or at-rule, and an index signature accepts anything, including a typo.
 * `TextStyleProperty` once listed `hypens` instead of `hyphens` and nothing could notice; under
 * an index signature nothing would notice again. Conditions and nested selectors still work,
 * because `Nested` supplies those keys itself.
 */
export type Mixin = Nested<SystemProperties & CssVarProperties>

export type Mixins = Recursive<Token<Mixin>>

export interface CompositionStyles {
  mixins: Mixins
}
