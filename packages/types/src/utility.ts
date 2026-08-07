import type { CssPropertyDefinition } from './config'
import type { LiteralUnion } from './shared'
import type { CssProperty, NestedCssProperties } from './system-types'
import type { Token, TokenCategory } from './tokens'

interface TokenFn {
  (path: string): string | undefined
  raw: (path: string) => Token | undefined
}

type ThemeFn = (token: (path: string) => any) => Record<string, string>

export type PropertyValues =
  | LiteralUnion<TokenCategory | 'keyframes'>
  | string[]
  | { type: string }
  | Record<string, string>
  | ThemeFn

export interface ColorMixResult {
  invalid: boolean
  value: string
  color?: string
}

export interface TransformUtils {
  colorMix(value: string): ColorMixResult
}

export interface TransformArgs<T = any> {
  token: TokenFn
  raw: T
  utils: TransformUtils
}

export type PropertyTransform = (value: any, args: TransformArgs) => NestedCssProperties | undefined

export interface PropertyConfig {
  /**
   * @internal
   * The cascade layer to which the property belongs
   */
  layer?: string
  /**
   * The classname this property will generate.
   */
  className?: string
  /**
   * The css style object this property will generate.
   */
  transform?: PropertyTransform
  /**
   * The possible values this property can have.
   */
  values?: PropertyValues
  /**
   * The css property this utility maps to.
   */
  property?: CssProperty
  /**
   * The shorthand of the property.
   */
  shorthand?: string | string[]
  /**
   * The CSS semantic group this property belongs
   */
  group?: CssSemanticGroup
  /**
   * Whether this utility is deprecated or not.
   */
  deprecated?: boolean
  /**
   * Custom properties this utility composes its value from, registered with `@property`.
   *
   * Several utilities build one declaration out of many variables — `filter` out of nine,
   * `translate` out of its axes — while a sibling utility sets each variable on its own. The
   * ones nobody set still have to resolve to something harmless, and they must not be
   * inherited: a parent's `--blur` reaching its children is a leak, not a default.
   *
   * Declaring them here is what registers them, so the utility that reads a variable is the
   * thing that guarantees it exists. Keeping the two together is deliberate — a default kept
   * in a separate list drifts from the composition it serves, in both directions: it outlives
   * the utility that needed it, and it is forgotten for the utility added later.
   *
   * Registration is merged across every configured utility, so more than one may name the
   * same variable — the utility that writes it and the one that reads it will often both
   * want to.
   *
   * ```ts
   * filter: {
   *   className: 'filter',
   *   values: { auto: 'var(--blur, ) var(--brightness, )' },
   *   customProperties: {
   *     '--blur': { syntax: '*', inherits: false },
   *     '--brightness': { syntax: '*', inherits: false },
   *   },
   * }
   * ```
   *
   * Omitting `initialValue` gives the property the guaranteed-invalid value, which is what a
   * `var(--x, )` reference expects — it falls back to its own empty value and composes to
   * nothing. A variable read *without* a fallback needs one declared here instead, or the
   * whole declaration is invalid at computed-value time.
   */
  customProperties?: Record<string, CssPropertyDefinition>
}

export type CssSemanticGroup =
  | 'Animation'
  | 'Background Gradient'
  | 'Background'
  | 'Border Radius'
  | 'Border'
  | 'Color'
  | 'Container'
  | 'Display'
  | 'Focus Ring'
  | 'Effect'
  | 'Flex Layout'
  | 'Grid Layout'
  | 'Height'
  | 'Interactivity'
  | 'Layout'
  | 'List'
  | 'Margin'
  | 'Other'
  | 'Padding'
  | 'Position'
  | 'Scroll'
  | 'Shadow'
  | 'System'
  | 'Table'
  | 'Transform'
  | 'Transition'
  | 'Typography'
  | 'Visibility'
  | 'Width'

export type UtilityConfig = {
  [property in LiteralUnion<CssProperty>]?: PropertyConfig
}

type UtilityConfigWithExtend = {
  [pattern in LiteralUnion<CssProperty>]?: PropertyConfig | UtilityConfig | undefined
}

export type ExtendableUtilityConfig = UtilityConfigWithExtend & {
  extend?: UtilityConfig | undefined
}
