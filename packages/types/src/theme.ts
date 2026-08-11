import type { Mixins } from './composition'
import type { RecipeConfig, SlotRecipeConfig } from './recipe'
import type { CssKeyframes } from './system-types'
import type { SemanticTokens, Tokens } from './tokens'

export interface ColorPaletteOptions {
  /**
   * Whether to enable color palette generation.
   * @default true
   */
  enabled?: boolean
  /**
   * List of color names to include in color palette generation.
   * When specified, only these colors will be used for color palettes.
   */
  include?: string[]
  /**
   * List of color names to exclude from color palette generation.
   * When specified, these colors will not be used for color palettes.
   */
  exclude?: string[]
}

export interface Theme {
  /**
   * The breakpoints for your project.
   */
  breakpoints?: Record<string, string>
  /**
   * The css animation keyframes definitions.
   */
  keyframes?: CssKeyframes
  /**
   * The design tokens for your project.
   */
  tokens?: Tokens
  /**
   * The semantic design tokens for your project.
   */
  semanticTokens?: SemanticTokens
  /**
   * Named bundles of declarations, applied by name through the `mixin` style property.
   */
  mixins?: Mixins
  /**
   * Multi-variant style definitions for your project.
   * Useful for defining component styles.
   */
  recipes?: Record<string, RecipeConfig>
  /**
   * Multi-variant style definitions for component slots.
   */
  slotRecipes?: Record<string, SlotRecipeConfig>
  /**
   * The predefined container names for your project.
   */
  containerNames?: string[]
  /**
   * The predefined container sizes for your project.
   */
  containerSizes?: Record<string, string>
  /**
   * The color palette configuration for your project.
   */
  colorPalette?: ColorPaletteOptions
  /**
   * Alternate token sets, selectable at runtime.
   *
   * Was a top-level `themes`, one character from `theme` and impossible for TypeScript to
   * tell apart — both spellings were valid keys, so the typo resolved to a different
   * feature rather than to an error. A variant is part of the theme, so it lives in it.
   */
  variants?: ThemeVariantsMap
}

export interface ThemeVariant extends Pick<Theme, 'tokens' | 'semanticTokens'> {}

export interface ThemeVariantsMap {
  [name: string]: ThemeVariant
}

interface ExtendableThemeVariantsMap {
  [name: string]: ThemeVariantsMap | ThemeVariant | undefined
  extend?: ThemeVariantsMap | undefined
}

interface PartialTheme extends Omit<Theme, 'recipes' | 'slotRecipes' | 'variants'> {
  /**
   * Multi-variant style definitions for your project.
   * Useful for defining component styles.
   */
  recipes?: Record<string, Partial<RecipeConfig>>
  /**
   * Multi-variant style definitions for component slots.
   */
  slotRecipes?: Record<string, Partial<SlotRecipeConfig>>
  /**
   * The color palette configuration for your project.
   */
  colorPalette?: Partial<ColorPaletteOptions>
  /**
   * Alternate token sets, selectable at runtime.
   */
  variants?: ExtendableThemeVariantsMap
}

export interface ExtendableTheme extends Omit<Theme, 'variants'> {
  variants?: ExtendableThemeVariantsMap
  extend?: PartialTheme | undefined
}
