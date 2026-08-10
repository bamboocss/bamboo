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

/**
 * Everything emitted at the document level rather than against a class.
 *
 * These were four top-level keys — `globalCss`, `globalFontface`, `globalPositionTry` and
 * `globalVars`. Grouping them is not only tidier: `globalVars` was the one of the four that
 * `PresetCore` never listed, so it kept its `extend` wrapper in the *resolved* config while
 * its three siblings lost theirs. One key cannot disagree with itself that way.
 */
export interface GlobalCore {
  /**
   * The global styles for your project.
   */
  css: GlobalStyleObject
  /**
   * The global fontface for your project.
   */
  fontface?: GlobalFontface
  /**
   * The global custom position try fallback option
   */
  positionTry?: GlobalPositionTry
  /**
   * The css variables for your project.
   */
  vars?: GlobalVarsDefinition
}

interface ExtendableGlobal {
  css?: ExtendableGlobalStyleObject
  fontface?: ExtendableGlobalFontface
  positionTry?: ExtendableGlobalPositionTry
  vars?: ExtendableGlobalVars
}

export interface PresetCore {
  /**
   * The css selectors or media queries shortcuts.
   * @example `{ hover: "&:hover" }`
   */
  conditions: Conditions
  /**
   * Styles, fontfaces, position-try fallbacks and css variables emitted at the document level.
   */
  global: GlobalCore
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

export interface ExtendableOptions {
  /**
   * The css selectors or media queries shortcuts.
   * @example `{ hover: "&:hover" }`
   */
  conditions?: ExtendableConditions
  /**
   * Styles, fontfaces, position-try fallbacks and css variables emitted at the document level.
   */
  global?: ExtendableGlobal
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
   *    tokens: 'styled-system/tokens',
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
  /**
   * Show only the log types matching this pattern, at debug level.
   *
   * Log types are namespaced — `vite:transform`, `tokens:unresolved`, `prune:tokens`,
   * `config` — so `'prune:*'` follows one subsystem without raising `logLevel` and
   * un-silencing everything else.
   *
   * The matcher already existed and was reachable only through the `BAMBOO_DEBUG`
   * environment variable, which put it out of reach of a checked-in config.
   *
   * @example 'vite:*, prune:tokens'
   */
  logFilter?: string
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
   *
   * Worth about 21% of the raw stylesheet and 5–7% gzipped on the example apps here. The
   * gzip figure is the smaller one because compression has already collapsed the indentation
   * before you get there — but unlike renaming what is emitted, it never comes out negative.
   *
   * Off by default so the generated stylesheet stays readable, and because most projects
   * hand it to a bundler that minifies css in production anyway. Worth turning on if you
   * ship `styled-system/styles.css` directly, or pass `--minify` to the CLI for one build.
   *
   * @default false
   */
  minify?: boolean
  /**
   * What to drop from the generated stylesheet. See `PruneOptions`.
   */
  prune?: PruneOptions
  /**
   * The root selector for the css variables.
   * @default ':where(:root, :host)'
   */
  cssVarRoot?: string
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
  hash?: boolean | { cssVar?: boolean; className?: boolean }
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
   * Emit `.d.mts` declarations beside `.mjs`, and import them by their `.mjs` specifier.
   *
   * Off by default, which looks like the wrong default and is not. `moduleResolution:
   * bundler` — Vite, Next, and most of what consumes this — resolves a directory import
   * like `styled-system/css` by probing `index.ts`, `index.tsx`, `index.d.ts`, `index.js`.
   * That list has no `.d.mts` in it, so turning this on makes every such import fail with
   * `TS2307: Cannot find module`. It is for `node16`/`nodenext` consumers, who need the
   * extensions to agree and who import by full specifier anyway.
   *
   * So this is a real fork in resolution behaviour rather than a flag with a correct
   * setting, which is why it survived an attempt to delete it: making it unconditional
   * broke every bundler-mode project in this repo.
   *
   * Only meaningful when `outExtension` is `mjs`.
   *
   * @default false
   */
  forceConsistentTypeExtension?: boolean
}

interface PresetOptions {
  /**
   * The complete list of presets, in order. Reusable across a project or team.
   *
   * Authoritative: what you write is what is loaded. Import `defaultPresets` to keep the
   * defaults alongside your own.
   *
   * ```ts
   * import { defaultPresets } from '@bamboocss/dev/presets'
   * presets: [...defaultPresets, myPreset]
   * ```
   *
   * Leaving it unset loads `defaultPresets`. Setting it to `[]` loads nothing — which is
   * what the removed `eject: true` meant. Previously neither was true of a config that
   * merely *listed* a preset: doing so kept `@bamboocss/preset-base` and silently dropped
   * `@bamboocss/preset-bamboo`, so `presets` was neither additive nor replacing.
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

/**
 * What to drop from the generated stylesheet, and how to account for it.
 *
 * These were three top-level options — `pruneUnusedTokens`, `pruneUnusedKeyframes` and
 * `prunePreflight` — which disagreed with each other on all three of naming, default and
 * value type. Grouping them is what makes one default reading of "prune" possible.
 */
export interface PruneOptions {
  /**
   * How to decide which token css variables to keep.
   *
   * The token layer declares every token in the theme, and an app typically uses a small
   * fraction of them, so this is usually the largest single saving in render-blocking css.
   *
   * - `off` keeps every token declaration.
   * - `reachable` keeps what the generated css reaches. Because `token()` can name any
   *   token, a project that calls it from javascript *anywhere* keeps every declaration —
   *   on the default preset that is 468 names against the 68 a narrower exemption kept, and
   *   a token layer of 442 declarations rather than 2. The exemption is skipped entirely for
   *   a project that never reaches for a token from javascript, so the saving is
   *   all-or-nothing: one caller keeps every declaration.
   * - `accounted` reads the token paths out of your source and keeps only those. `token()`
   *   and `token.value()` calls are resolved through a constant or a template literal the
   *   extractor can follow, not only through a path spelled at the call, as is any literal
   *   `var(--x)` written by hand.
   *
   * Under `accounted`, a path the build cannot follow makes the keep set fall back to
   * `reachable`'s blanket keep rather than silently dropping a declaration — which is why
   * `unresolvedPath` exists, and why setting it to `error` is what makes `accounted` worth
   * asking for: it guarantees you are shipping the exact set rather than the fallback.
   *
   * Three things stay invisible to `accounted`: a token named by a path assembled from a
   * value that only exists at runtime, one referenced only from a stylesheet outside
   * `include`, and one used by a separate package consuming the output as design tokens. The
   * scan reads `include`, which scopes style extraction rather than everything that may
   * import — so a script, a config, or a sibling workspace package that calls `token()` is
   * not covered, nor is a binding renamed away from `token`, as in `const t = token`. Use
   * `staticCss` to keep those.
   *
   * A custom property declared by `global.css` or `global.vars` is not one of these cases:
   * the declaration ships whether or not anything in the stylesheet reads it, so whatever it
   * references is kept alongside it.
   *
   * @default 'reachable'
   */
  tokens?: 'off' | 'reachable' | 'accounted'
  /**
   * What to do about a token path `accounted` cannot follow.
   *
   * A path spelled at the call resolves; one assembled at runtime does not. An unfollowable
   * path is what forces `accounted` back onto the blanket keep, so this decides whether that
   * happens quietly, loudly, or not at all.
   *
   * - `off` falls back and says nothing.
   * - `warn` falls back and reports what it could not follow.
   * - `error` fails the build, so the fallback can never ship unnoticed.
   *
   * Inert under `tokens: 'off'` and `tokens: 'reachable'`, which run no accounting pass.
   *
   * Named for what it checks rather than `strict`, which already means something unrelated
   * here: `strictTokens` and `strictPropertyValues` narrow generated *typescript*, and
   * neither implies nor is implied by this.
   *
   * @default 'warn'
   */
  unresolvedPath?: 'off' | 'warn' | 'error'
  /**
   * Drop an `@property` registration the finished stylesheet neither declares nor reads.
   *
   * A preset registers what its utilities compose — filters, gradients, transforms,
   * transitions — and ships the whole set regardless of what the app draws, so an app using
   * none of them carries all of it for nothing.
   *
   * Its own flag rather than a side effect of `tokens`, which is what it used to be: the
   * registrations were dropped even under the old `tokens: false`, so an option documented
   * as keeping every token declaration quietly removed something else. These are not tokens
   * — nothing hands one to javascript and none appear in the `token()` surface — so the
   * reachability problem that makes `tokens` cautious does not apply to them.
   *
   * Registrations declared through `global.vars` are yours and are never removed.
   *
   * @default true
   */
  propertyRegistrations?: boolean
  /**
   * Drop `@keyframes` rules nothing can reach.
   *
   * A preset declares every animation it offers and an app uses a handful, so the rest
   * are dead weight in the stylesheet that blocks first paint. Only keyframes the theme
   * declares are ever removed — one emitted by `global.css` is left alone.
   *
   * A name is kept when any declaration in the generated css names it, and when it
   * appears anywhere under `include`, which covers an animation assembled at runtime or
   * applied through an inline `style` rather than through bamboo. That textual fallback
   * is deliberately over-inclusive: keeping an unused keyframe costs bytes, dropping a
   * used one breaks the animation.
   *
   * @default true
   */
  keyframes?: boolean
  /**
   * Whether to drop the parts of the reset that style elements your source never renders.
   *
   * Two thirds of the reset is bound to specific elements — 41 of them, covering `table`,
   * `pre`, `kbd`, `optgroup` and the rest of the long tail. The reset is a fixed size, so it
   * dominates a small stylesheet: a third of one sandbox's css here and four fifths of
   * another's, of which 13% and 34% respectively is for elements those projects never render.
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
   * The blind spot to check first is your own entry template. The scan reads `include`, and
   * `include` conventionally covers components rather than markup — a glob rooted at `./src`
   * does not match `index.html`, so an element appearing only there is dropped. Add the
   * template to `include` to cover it — the scan reads any file listed, not only ones the
   * parser understands, and reads it from disk rather than from the build's parsed copy, so
   * a single-file component's markup survives the transform to tsx.
   *
   * A scoped reset is handled: `preflight: { scope: '.app' }` writes `.app table`, and the
   * scope is stripped before an element is read out. `bamboo cssgen preflight` prunes too.
   *
   * @default false
   */
  preflight?: boolean
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
   * What to do when the config does not validate.
   *
   * - `off` performs no validation.
   * - `warn` logs what failed.
   * - `error` throws.
   *
   * A retired spelling is checked ahead of this and is not silenceable by it — that is
   * output which is already broken rather than an opinion about a config that still
   * builds. Neither is a removed option: `off` used to switch off the one mechanism that
   * tells an upgrader their setting is no longer read.
   *
   * @default 'warn'
   */
  validation?: 'off' | 'warn' | 'error'
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
  | Exclude<NonNullable<Keys<ReqConf>>, 'theme' | 'global' | 'prune'>
  | PathIn<ReqConf, 'theme'>
  | PathIn<ReqConf, 'global'>
  | PathIn<ReqConf, 'prune'>
  | PathIn<ReqConf, 'patterns'>
  | PathIn<ReqConf, 'staticCss'>
  | (string & {}),
  undefined
>
