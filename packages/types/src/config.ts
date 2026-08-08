import type { TSConfig } from 'pkg-types'
import type { Conditions, ExtendableConditions } from './conditions'
import type { BambooHooks } from './hooks'
import type { PatternConfig } from './pattern'
import type { Keys, LiteralUnion, PathIn, RequiredBy } from './shared'
import type { StaticCssOptions } from './static-css'
import type {
  ExtendableGlobalFontface,
  ExtendableGlobalStyleObject,
  GlobalFontface,
  GlobalStyleObject,
  SystemStyleObject,
} from './system-types'
import type { ExtendableTheme, Theme } from './theme'
import type { ExtendableUtilityConfig, UtilityConfig } from './utility'

export type { TSConfig }

export type CascadeLayer = 'reset' | 'base' | 'tokens' | 'recipes' | 'utilities'

export type CascadeLayers = Record<CascadeLayer, string>

export interface Patterns {
  [pattern: string]: PatternConfig
}

export interface PresetCore {
  /**
   * The css selectors or media queries shortcuts.
   * @example `{ hover: "&:hover" }`
   */
  conditions: Conditions
  /**
   * The global styles for your project.
   */
  globalCss: GlobalStyleObject
  /**
   * The global fontface for your project.
   */
  globalFontface?: GlobalFontface
  /**
   * The global custom position try fallback option
   */
  globalPositionTry?: GlobalPositionTry
  /**
   * Used to generate css utility classes for your project.
   */
  staticCss: StaticCssOptions
  /**
   * The theme configuration for your project.
   */
  theme: Theme
  /**
   * The css utility definitions.
   */
  utilities: UtilityConfig
  /**
   * Common styling or layout patterns for your project.
   */
  patterns: Record<string, PatternConfig>
  /**
   * Multiple themes for your project.
   */
  themes?: ThemeVariantsMap
}

interface ExtendablePatterns {
  [pattern: string]: PatternConfig | Patterns | undefined
  extend?: Patterns | undefined
}

interface ExtendableStaticCssOptions extends StaticCssOptions {
  extend?: StaticCssOptions | undefined
}

export type CssPropertySyntax =
  | '*'
  | '<length>'
  | '<number>'
  | '<percentage>'
  | '<length-percentage>'
  | '<color>'
  | '<image>'
  | '<url>'
  | '<integer>'
  | '<angle>'
  | '<time>'
  | '<resolution>'
  | '<transform-function>'
  | '<length> | <percentage>'

export interface CssPropertyDefinition {
  /**
   * Controls whether the custom property registration specified by @property inherits by default.
   * @see https://developer.mozilla.org/en-US/docs/Web/CSS/@property/inherits
   */
  inherits: boolean
  /**
   * Sets the initial value for the property.
   * @see https://developer.mozilla.org/en-US/docs/Web/CSS/@property/initial-value
   */
  initialValue?: string
  /**
   * Describes the allowable syntax for the property.
   * @see https://developer.mozilla.org/en-US/docs/Web/CSS/@property/syntax
   */
  syntax: LiteralUnion<CssPropertySyntax>
}

export interface GlobalVarsDefinition {
  [key: string]: string | CssPropertyDefinition
}

interface ExtendableGlobalVars {
  [key: string]: string | CssPropertyDefinition | GlobalVarsDefinition | undefined
  extend?: GlobalVarsDefinition
}

export interface GlobalPositionTry {
  [key: string]: SystemStyleObject
}

interface ExtendableGlobalPositionTry {
  [key: string]: SystemStyleObject | GlobalPositionTry | undefined
  extend?: GlobalPositionTry | undefined
}

export interface ThemeVariant extends Pick<Theme, 'tokens' | 'semanticTokens'> {}

export interface ThemeVariantsMap {
  [name: string]: ThemeVariant
}

interface ExtendableThemeVariantsMap {
  [name: string]: ThemeVariantsMap | ThemeVariant | undefined
  extend?: ThemeVariantsMap | undefined
}

export interface ExtendableOptions {
  /**
   * The css selectors or media queries shortcuts.
   * @example `{ hover: "&:hover" }`
   */
  conditions?: ExtendableConditions
  /**
   * The global styles for your project.
   */
  globalCss?: ExtendableGlobalStyleObject
  /**
   * The global fontface for your project.
   */
  globalFontface?: ExtendableGlobalFontface
  /**
   * The global custom position try fallback option
   */
  globalPositionTry?: ExtendableGlobalPositionTry
  /**
   * Used to generate css utility classes for your project.
   */
  staticCss?: ExtendableStaticCssOptions
  /**
   * The theme configuration for your project.
   */
  theme?: ExtendableTheme
  /**
   * The css utility definitions.
   */
  utilities?: ExtendableUtilityConfig
  /**
   * Common styling or layout patterns for your project.
   */
  patterns?: ExtendablePatterns
  /**
   * The css variables for your project.
   */
  globalVars?: ExtendableGlobalVars
  /**
   * The theme variants for your project.
   */
  themes?: ExtendableThemeVariantsMap
}

export interface ImportMapInput {
  css?: string | string[]
  recipes?: string | string[]
  patterns?: string | string[]
  tokens?: string | string[]
}

export interface ImportMapOutput<T = string> {
  css: T[]
  recipe: T[]
  pattern: T[]
  tokens: T[]
}

type ImportMapOption = string | ImportMapInput

interface FileSystemOptions {
  /**
   * Whether to clean the output directory before generating the css.
   * @default false
   */
  clean?: boolean
  /**
   * The output directory.
   * @default 'styled-system'
   */
  outdir?: string
  /**
   * Allows you to customize the import paths for the generated outdir.
   * @default
   * ```js
   * {
   *    css: 'styled-system/css',
   *    recipes: 'styled-system/recipes',
   *    patterns: 'styled-system/patterns',
   *    jsx: 'styled-system/jsx',
   * }
   * ```
   */
  importMap?: ImportMapOption | Array<ImportMapOption>
  /**
   * List of files glob to watch for changes.
   * @default []
   */
  include?: string[]
  /**
   * List of files glob to ignore.
   * @default []
   */
  exclude?: string[]
  /**
   * List of globs or files that will trigger a config reload when changed.
   *
   * We automatically track the config file and (transitive) files imported by the config file as much as possible, but sometimes we might miss some.
   * Use this option as a workaround.
   */
  dependencies?: string[]
  /**
   * Whether to watch for changes and regenerate the css.
   * @default false
   */
  watch?: boolean
  /**
   * Whether to use polling instead of filesystem events when watching.
   * @default false
   */
  poll?: boolean
  /**
   * The current working directory.
   * @default 'process.cwd()'
   */
  cwd?: string
  /**
   * The log level for the built-in logger.
   * @default 'info'
   */
  logLevel?: 'debug' | 'info' | 'warn' | 'error' | 'silent'
}

interface CssgenOptions {
  /**
   * Whether to include css reset styles in the generated css.
   * @default false
   */
  preflight?: boolean | { scope: string; level?: 'element' | 'parent' }
  /**
   * The namespace prefix for the generated css classes and css variables.
   * @default ''
   */
  prefix?: string | { cssVar?: string; className?: string }
  /**
   * The value separator used in the generated class names.
   * @default '_'
   */
  separator?: '_' | '=' | '-'
  /**
   * Whether to minify the generated css.
   * @default false
   */
  minify?: boolean
  /**
   * Whether to drop token css variables that nothing in the generated css can reach.
   *
   * The token layer declares every token in the theme, and an app typically uses a small
   * fraction of them, so this is usually the largest single saving in render-blocking css.
   *
   * The same walk also drops an `@property` registration for a custom property the finished
   * stylesheet neither declares nor reads. A preset registers what its utilities compose —
   * filters, gradients, transforms, transitions — and ships the whole set regardless of what
   * the app draws, so an app using none of them carries all of it for nothing. Registrations
   * declared through `globalVars` are yours and are never removed.
   *
   * It is opt-in because reachability cannot be proven for every reference. `token()` and
   * `token.var()` calls are read out of the source, as is any literal `var(--x)` written
   * by hand. Three things stay invisible: a token named by a path the source does not
   * spell out as a string literal, one referenced only from a stylesheet outside
   * `include`, and one used by a separate package consuming the output as design tokens.
   * Use `staticCss` to keep those.
   *
   * Only the *second* form of the first case is a risk. `token(key)` is safe for any path,
   * because javascript receives a literal for a plain token rather than a reference. It is
   * `token.var(key)` — the form that hands back `var(--x)` — that needs the declaration to
   * still be there, so that is the one to hold with `staticCss`.
   *
   * A custom property declared by `globalCss` or `globalVars` is not one of these cases:
   * the declaration ships whether or not anything in the stylesheet reads it, so whatever
   * it references is kept alongside it.
   *
   * Tokens that javascript receives as a `var()` rather than a literal are always kept, so
   * that `token()` answers correctly for any path at runtime. That covers virtual tokens
   * and any token carrying a condition, and it has one cost worth knowing about: a
   * negative token resolves to `calc(var(--spacing-4) * -1)`, so every token with a
   * negative counterpart pins its own declaration. Spacing scales generate one per entry,
   * which keeps the whole scale whether or not the app uses it — on the default preset
   * that is roughly a third of what survives pruning.
   *
   * That exemption is now skipped entirely for a project that never reaches for a token from
   * javascript. `styled-system/tokens` is generated into the project, so nothing outside it
   * can import the artifact and a scan of `include` is a complete answer rather than a guess.
   * Worth 13% of the stylesheet on one sandbox here, and nothing at all on another whose
   * tokens the css genuinely reads.
   *
   * Setting this to `false` keeps every token declaration, but still drops the `@property`
   * registrations. Those are not tokens — nothing hands one to javascript and none appear
   * in the `token()` surface — so the reachability problem above does not apply to them,
   * and opting out of token pruning should not mean shipping a preset's whole filter and
   * gradient set for nothing.
   *
   * @default true
   */
  pruneUnusedTokens?: boolean
  /**
   * Drop `@keyframes` rules nothing can reach.
   *
   * A preset declares every animation it offers and an app uses a handful, so the rest
   * are dead weight in the stylesheet that blocks first paint. Only keyframes the theme
   * declares are ever removed — one emitted by `globalCss` is left alone.
   *
   * A name is kept when any declaration in the generated css names it, and when it
   * appears anywhere under `include`, which covers an animation assembled at runtime or
   * applied through an inline `style` rather than through bamboo. That textual fallback
   * is deliberately over-inclusive: keeping an unused keyframe costs bytes, dropping a
   * used one breaks the animation.
   *
   * @default true
   */
  pruneUnusedKeyframes?: boolean
  /**
   * Whether to drop the parts of the reset that style elements your source never renders.
   *
   * Two thirds of the reset is bound to specific elements — 41 of them, covering `table`,
   * `pre`, `kbd`, `optgroup` and the rest of the long tail. The reset is a fixed size, so it
   * dominates a small stylesheet: a third of one sandbox's css here and nearly half of
   * another's, of which 11% and 30% respectively is for elements those projects never render.
   *
   * A selector list loses only the parts naming unrendered elements, so a rule shared between
   * `button` and `::file-selector-button` keeps the half that still applies. `html` and `body`
   * are never removed.
   *
   * Off by default, and it cannot be made safe by default. Unlike the token and keyframe
   * passes there is nothing to prove this against: an element rendered by a dependency's
   * component, by `dangerouslySetInnerHTML`, or by markdown is invisible to a scan of your own
   * source. What you get wrong is an element quietly losing its reset — no error, no warning.
   * Reach for it when you control the markup and have measured that it pays.
   *
   * @default false
   */
  prunePreflight?: boolean
  /**
   * The root selector for the css variables.
   * @default ':where(:host, :root)'
   */
  cssVarRoot?: string
  /**
   * Whether to use `lightningcss` instead of `postcss` for css optimization.
   * @default false
   */
  lightningcss?: boolean
  /**
   * Browserslist query to target specific browsers.
   * @see https://www.npmjs.com/package/browserslist
   */
  browserslist?: string[]
  /**
   * Layer mappings used in the generated css.
   * @default 'true'
   */
  layers?: Partial<CascadeLayers>
  /**
   * Polyfill CSS @layers at-rules for older browsers.
   * @default 'false'
   * @see https://www.npmjs.com/package/@csstools/postcss-cascade-layers
   */
  polyfill?: boolean
}

interface CodegenOptions {
  /**
   * Whether to only emit the `tokens` directory
   * @default false
   */
  emitTokensOnly?: boolean
  /**
   * Whether to hash the generated class names / css variables.
   * This is useful if want to shorten the class names or css variables.
   * @default false
   */
  hash?: boolean | { cssVar: boolean; className: boolean }
  /**
   * Change generated typescript definitions to be more strict for property having a token or utility.
   */
  strictTokens?: boolean
  /**
   * Change generated typescript definitions to be more strict for built-in CSS properties to only allow valid CSS values.
   */
  strictPropertyValues?: boolean
  /**
   * Whether to update the .gitignore file.
   * @default 'true'
   */
  gitignore?: boolean
  /**
   * Whether to allow shorthand properties
   * @default 'true'
   */
  shorthands?: boolean
  /**
   * File extension for generated javascript files.
   * @default 'mjs'
   */
  outExtension?: 'mjs' | 'js'
  /**
   * Whether to force consistent type extensions for generated typescript .d.ts files.
   * If set to `true` and `outExtension` is set to `mjs`, the generated typescript .d.ts files will have the extension `.d.mts`.
   * @default false
   */
  forceConsistentTypeExtension?: boolean
  /**
   * Controls how CSS utility classes are generated.
   * - `'atomic'` (default): one class per property (e.g. `c_red p_8px`)
   * - `'grouped'`: one class per `css()` call, grouping all properties together
   *
   * Grouped mode reduces the number of classes in the HTML at the cost of potential CSS duplication.
   *
   * A grouped class names a whole call, so the build has to have seen that exact call to emit its rule.
   * Where it cannot, the runtime falls back to atomic class names — and a few shapes lose their styles
   * entirely, without a warning. Read https://bamboocss.com/docs/references/config#cssmode before enabling it.
   * @default 'atomic'
   */
  cssMode?: 'atomic' | 'grouped'
}

interface PresetOptions {
  /**
   * Used to create reusable config presets for your project or team.
   */
  presets?: (string | Preset | Promise<Preset>)[]
}

export interface HooksOptions {
  hooks?: Partial<BambooHooks>
}

export interface BambooPlugin extends HooksOptions {
  name: string
}

export interface PluginsOptions {
  plugins?: BambooPlugin[]
}

export interface Config
  extends
    ExtendableOptions,
    CssgenOptions,
    CodegenOptions,
    FileSystemOptions,
    PresetOptions,
    HooksOptions,
    PluginsOptions {
  /**
   * Whether to opt-out of the defaults config presets: [`@bamboocss/preset-base`, `@bamboocss/preset-bamboo`]
   * @default 'false'
   */
  eject?: boolean
  /**
   * The validation strictness to use when validating the config.
   * - When set to 'none', no validation will be performed.
   * - When set to 'warn', warnings will be logged when validation fails.
   * - When set to 'error', errors will be thrown when validation fails.
   *
   * @default 'warn'
   */
  validation?: 'none' | 'warn' | 'error'
}

export interface Preset extends ExtendableOptions, PresetOptions {
  name: string
}

export interface UserConfig
  extends Partial<PresetCore>, RequiredBy<Omit<Config, keyof PresetCore>, 'outdir' | 'cwd' | 'include'> {}

export interface PathMapping {
  pattern: RegExp
  paths: string[]
}

export interface ConfigTsOptions {
  baseUrl?: string | undefined
  pathMappings: PathMapping[]
}

export interface LoadTsConfigResult {
  tsconfig?: TSConfig
  tsOptions?: ConfigTsOptions
  tsconfigFile?: string
}

export interface LoadConfigResult extends LoadTsConfigResult {
  /** Config path */
  path: string
  config: UserConfig
  serialized: string
  deserialize: () => Config
  dependencies: string[]
  hooks: Partial<BambooHooks>
}

export interface HashOptions {
  tokens: boolean | undefined
  className: boolean | undefined
}

export interface PrefixOptions {
  tokens: string | undefined
  className: string | undefined
}

type ReqConf = Required<UserConfig>

export type ConfigPath = Exclude<
  | Exclude<NonNullable<Keys<ReqConf>>, 'theme'>
  | PathIn<ReqConf, 'theme'>
  | PathIn<ReqConf, 'patterns'>
  | PathIn<ReqConf, 'staticCss'>
  | (string & {}),
  undefined
>
