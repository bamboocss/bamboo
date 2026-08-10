import type { CssProperty, SystemStyleObject } from './system-types'
import type { TokenCategory } from './tokens'

type Primitive = string | number | boolean | null | undefined
type LiteralUnion<T, K extends Primitive = string> = T | (K & Record<never, never>)

export type PatternProperty =
  | { type: 'property'; value: CssProperty; description?: string }
  | { type: 'enum'; value: string[]; description?: string }
  | { type: 'token'; value: TokenCategory; property?: CssProperty; description?: string }
  | { type: 'string' | 'boolean' | 'number'; description?: string }

export interface PatternHelpers {
  map: (value: any, fn: (value: string) => string | undefined) => any
  /**
   * The css variable reference for a token path, or `fallback` when the path names no token.
   *
   * `token('spacing.4', '4')` is `var(--spacing-4)` where that token exists and `'4'` where it
   * does not — so a pattern can accept either a token name or a raw css value without knowing
   * the theme.
   */
  token: (path: string, fallback?: string) => string | undefined
  isCssUnit: (value: any) => boolean
  isCssVar: (value: any) => boolean
  isCssFunction: (value: any) => boolean
}

export interface PatternProperties {
  [key: string]: PatternProperty
}

type InferProps<T> = Record<LiteralUnion<keyof T>, any>

export type PatternDefaultValue<T> = Partial<InferProps<T>>

export type PatternDefaultValueFn<T> = (props: InferProps<T>) => PatternDefaultValue<T>

export interface PatternConfig<T extends PatternProperties = PatternProperties> {
  /**
   * The description of the pattern. This will be used in the JSDoc comment.
   */
  description?: string
  /**
   * The properties of the pattern.
   */
  properties?: T
  /**
   * The default values of the pattern.
   */
  defaultValues?: PatternDefaultValue<T> | PatternDefaultValueFn<T>
  /**
   * The css object this pattern will generate.
   */
  transform?: (props: InferProps<T>, helpers: PatternHelpers) => SystemStyleObject
  /**
   * Whether the pattern is deprecated.
   */
  deprecated?: boolean | string
  /**
   * Which css properties this pattern accepts alongside its own `properties`.
   *
   * - `all` accepts any css property.
   * - `none` accepts only the pattern's declared `properties`.
   * - `{ except }` accepts any css property but the ones listed.
   *
   * One option because these were two — `strict: true` for "none" and an `@experimental`
   * `blocklist` for "all but these" — and the pair had an unrepresentable combination that
   * silently did nothing: the blocklist is applied only to the type that lists css
   * properties, which `strict: true` does not emit, so setting both dropped the blocklist.
   *
   * Types only. Nothing strips a blocked property at runtime — one passed anyway reaches
   * `transform` and emits css.
   *
   * @default 'all'
   */
  cssProps?: 'all' | 'none' | { except: LiteralUnion<CssProperty>[] }
}
