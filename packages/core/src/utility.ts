import { acceptsAuthorIdent, cssPropertyKeywords, isCssProperty } from '@bamboocss/is-valid-prop'
import { logger } from '@bamboocss/logger'
import {
  compact,
  FALLBACK_SEPARATOR,
  getArbitraryValue,
  hypenateProperty,
  isFallbackCall,
  isFunction,
  isString,
  mapToJson,
  memo,
  parseFallbackValue,
  toHash,
  withoutImportant,
  withoutSpace,
} from '@bamboocss/shared'
import type { TokenDictionary } from '@bamboocss/token-dictionary'
import type {
  AnyFunction,
  CssKeyframes,
  CssPropertyDefinition,
  Dict,
  PropertyConfig,
  PropertyTransform,
  TokenDataTypes,
  TransformArgs,
  UtilityConfig,
} from '@bamboocss/types'
import type { TransformResult } from './types'
import { colorMix } from './color-mix'
import { withCssUnit } from './stringify'

/**
 * A value shaped like a name rather than like CSS: `red.300`, `navH`, `flex`.
 *
 * Dot-separated segments, the first starting with a letter and the rest with a letter or digit,
 * and the dots are optional. `0.5`, `1.5rem`, `#fff`, `1px solid red` and `rgb(0 0 0)` all fail
 * it, which is what keeps a raw CSS value out of the check below — nothing here is about
 * rejecting raw values.
 *
 * The dots were mandatory until the check learned to read the CSS grammar. That made
 * `color: 'mutedd'` — the single typo this whole diagnostic is sold on — invisible to the build,
 * because with only the token names to compare against there was no way to tell it from
 * `display: 'flex'`.
 */
const IDENTIFIER = /^[a-zA-Z][\w-]*(?:\.[a-zA-Z0-9][\w-]*)*$/

/** A style value shaped like a token path that names no token. */
export interface UnresolvedTokenRef {
  /** The property, with any shorthand resolved. */
  prop: string
  /** The token path the value names, with `!important` and a `/opacity` modifier stripped. */
  value: string
  /** The token category the property draws from, when it draws from exactly one. */
  category?: string
  /**
   * The categories that do declare this name, where the mistake is a value on the wrong shelf.
   *
   * `top: 'navH'` against a theme declaring `navH` under `sizes` is the shape this exists for,
   * and it is the thing a type error structurally cannot say.
   */
  declaredIn?: string[]
}

export interface UtilityOptions {
  config?: UtilityConfig
  tokens: TokenDictionary
  separator?: string
  prefix?: string
  shorthands?: boolean
  strictTokens?: boolean | 'unknown-tokens'
  keyframes?: CssKeyframes
  unresolvedToken?: 'off' | 'warn' | 'error'
}

export class Utility {
  /**
   * The token map or dictionary of tokens
   */
  tokens: TokenDictionary

  /**
   * [cache] The map of property names to their resolved class names
   */
  classNames = new Map<string, string>()

  /**
   * [cache] The map of the property to their resolved styless
   */
  styles = new Map<string, Dict>()

  /**
   * Map of shorthand properties to their longhand properties
   */
  shorthands = new Map<string, string>()

  /**
   * The map of possible values for each property
   */
  types = new Map<string, Set<string>>()

  /**
   * The map of the property keys
   */
  propertyTypeKeys = new Map<string, Set<string>>()

  /**
   * The utility config
   */
  config: UtilityConfig = {}

  /**
   * The map of property names to their transform functions
   */
  private transforms = new Map<string, PropertyTransform>()

  /**
   * The map of property names to their config
   */
  private configs = new Map<string, PropertyConfig>()

  /**
   * The map of deprecated properties
   */
  private deprecated = new Set<string>()

  /**
   * The custom properties the configured utilities compose, registered with `@property`.
   *
   * Insertion-ordered, so the emitted rules follow the order the utilities declared them
   * rather than an object's key order — the CSS is stable across builds either way, but a
   * diff that tracks the source reads far better.
   */
  customProperties = new Map<string, CssPropertyDefinition>()

  separator = '_'

  prefix = ''

  /** @see UserConfig.strictTokens */
  strictTokens: boolean | 'unknown-tokens' = false

  /** @see UserConfig.unresolvedToken */
  unresolvedToken: 'off' | 'warn' | 'error' = 'warn'

  constructor(private options: UtilityOptions) {
    const { tokens, config = {}, separator, prefix, shorthands, strictTokens, unresolvedToken } = options

    if (unresolvedToken) {
      this.unresolvedToken = unresolvedToken
    }

    this.tokens = tokens
    this.config = this.normalizeConfig(config)

    if (separator) {
      this.separator = separator
    }

    if (prefix) {
      this.prefix = prefix
    }

    if (strictTokens) {
      this.strictTokens = strictTokens
    }

    if (shorthands) {
      this.assignShorthands()
    }

    this.assignColorPaletteProperty()

    this.assignProperties()
    this.assignPropertyTypes()
  }

  defaultHashFn = toHash

  toHash = (path: string[], hashFn: (str: string) => string): string => hashFn(path.join(':'))

  private normalizeConfig(config: UtilityConfig) {
    return Object.fromEntries(
      Object.entries(config).map(([property, propertyConfig]) => {
        return [property, this.normalize(propertyConfig)]
      }),
    )
  }

  private assignDeprecated = (property: string, config: PropertyConfig) => {
    if (!config.deprecated) return
    this.deprecated.add(property)
    if (isString(config.shorthand)) this.deprecated.add(config.shorthand)
    if (Array.isArray(config.shorthand)) {
      config.shorthand.forEach((shorthand) => this.deprecated.add(shorthand))
    }
  }

  register = (property: string, config: PropertyConfig) => {
    this.config[property] = this.normalize(config)
    this.assignProperty(property, config)
    this.assignPropertyType(property, config)
  }

  private assignShorthands = () => {
    for (const [property, config] of Object.entries(this.config)) {
      const { shorthand } = config ?? {}

      if (!shorthand) continue

      const values = Array.isArray(shorthand) ? shorthand : [shorthand]
      values.forEach((shorthandName) => {
        this.shorthands.set(shorthandName, property)
      })
    }
  }

  private assignColorPaletteProperty = () => {
    if (!this.tokens.view.colorPalettes.size) return

    const values = mapToJson(this.tokens.view.colorPalettes) as Record<string, any>
    this.config.colorPalette = {
      values: Object.keys(values),
      transform(value) {
        return values[value]
      },
    }
  }

  resolveShorthand = (prop: string) => {
    return this.shorthands.get(prop) ?? prop
  }

  public get hasShorthand() {
    return this.shorthands.size > 0
  }

  public get isEmpty() {
    return Object.keys(this.config).length === 0
  }

  public entries = () => {
    const value = Object.entries(this.config)
      .filter(([, value]) => !!value?.className)
      .map(([key, value]) => [key, value!.className])

    return value as [string, string][]
  }

  private getPropKey = (prop: string, value: string) => {
    return `(${prop} = ${value})`
  }

  private hash = (prop: string, value: string) => {
    // mb_40px, or mb=50px
    return `${prop}${this.separator}${value}`
  }

  /**
   * Get all the possible values for the defined property
   */
  public getPropertyValues = (config: PropertyConfig, resolveFn?: (key: string) => string) => {
    const { values } = config

    // convert `theme('spacing') => Tokens["spacing"]` to avoid too much type values
    const fn = (key: string) => {
      // skip empty values
      const categoryValues = this.getTokenCategoryValues(key)
      if (!categoryValues) return

      const prop = resolveFn?.(key)
      if (!prop) return

      return { [prop]: categoryValues }
    }

    if (isString(values)) {
      return fn?.(values) ?? this.tokens.view.getCategoryValues(values) ?? {}
    }

    if (Array.isArray(values)) {
      return values.reduce<Dict<string>>((result, value) => {
        result[value] = value
        return result
      }, {})
    }

    if (isFunction(values)) {
      return values(resolveFn ? fn : this.getTokenCategoryValues.bind(this))
    }

    return values
  }

  getPropertyRawValue(config: PropertyConfig, value: string) {
    const { values } = config
    if (!values) return value

    if (isString(values)) {
      return this.tokens.view.valuesByCategory.get(values as keyof TokenDataTypes)?.get(String(value)) || value
    }

    if (Array.isArray(values)) {
      return value
    }

    if (isFunction(values)) {
      return values(this.getTokenCategoryValues.bind(this))[value] || value
    }

    if (values.type) {
      return value
    }

    return values[value as keyof typeof values] || value
  }

  getToken = (path: string) => {
    return this.tokens.view.getVar(path)
  }

  getTokenCategoryValues = (category: string) => {
    return this.tokens.view.getCategoryValues(category)
  }

  /**
   * Normalize the property config
   */
  normalize = (propertyConfig: PropertyConfig | undefined): PropertyConfig | undefined => {
    const config = { ...propertyConfig }

    if (config.values === 'keyframes') {
      config.values = Object.keys(this.options.keyframes ?? {})
    }

    // set graceful defaults for className
    if (config.shorthand && !config.className) {
      config.className = Array.isArray(config.shorthand) ? config.shorthand[0] : config.shorthand
    }

    return config
  }

  private assignProperty = (property: string, config: PropertyConfig) => {
    this.setTransform(property, config?.transform)
    this.assignDeprecated(property, config)

    if (!config) return
    this.configs.set(property, config)
    this.assignCustomProperties(config)
  }

  /**
   * Collect the `@property` registrations a utility declares for the variables it composes.
   *
   * Merged across every configured utility rather than kept per utility, because more than
   * one legitimately names the same variable: `filter` reads `--blur` and `blur` writes it,
   * and both are entitled to say it exists. First declaration wins, so a preset extending
   * another cannot silently retype a variable the base preset already registered — that
   * would change how an existing value computes, at a distance.
   */
  private assignCustomProperties = (config: PropertyConfig) => {
    if (!config.customProperties) return

    for (const [name, definition] of Object.entries(config.customProperties)) {
      if (this.customProperties.has(name)) continue
      this.customProperties.set(name, definition)
    }
  }

  private assignProperties = () => {
    for (const [property, propertyConfig] of Object.entries(this.config)) {
      if (!propertyConfig) continue
      this.assignProperty(property, propertyConfig)
    }
  }

  assignPropertiesValues = () => {
    for (const [property, propertyConfig] of Object.entries(this.config)) {
      if (!propertyConfig) continue
      this.assignPropertyValues(property, propertyConfig)
    }

    return this
  }

  private assignPropertyValues = (property: string, config: PropertyConfig) => {
    const values = this.getPropertyValues(config)
    if (!values) return

    for (const [alias, raw] of Object.entries(values)) {
      const propKey = this.getPropKey(property, alias)
      this.setStyles(property, raw, alias, propKey)
      this.getOrCreateClassName(property, alias)
    }
  }

  getPropertyKeys = (prop: string) => {
    const propConfig = this.config[prop]
    if (!propConfig) return []

    const values = this.getPropertyValues(propConfig)
    if (!values) return []

    return Object.keys(values)
  }

  getPropertyTypeKeys = (property: string) => {
    const keys = this.propertyTypeKeys.get(property)
    return keys ? Array.from(keys) : []
  }

  private assignPropertyType = (property: string, config: PropertyConfig | undefined) => {
    if (!config) return

    const values = this.getPropertyValues(config, (key) => `type:Tokens["${key}"]`)

    if (typeof values === 'object' && values.type) {
      this.types.set(property, new Set([`type:${values.type}`]))
      return
    }

    if (values) {
      const keys = new Set(Object.keys(values))
      this.types.set(property, keys)
      this.propertyTypeKeys.set(property, keys)
    }

    const set = this.types.get(property) ?? new Set()

    // A custom utility that maps to a CSS property inherits that property's values, and how
    // much of them depends on the setting: everything, the keywords it enumerates, or nothing.
    //
    // `'unknown-tokens'` keeps the keywords and drops the open `string` csstype ends every
    // property with — which is the whole mechanism, here and in the generated style props. The
    // string is what makes a misspelled token type-check, and the keywords are what stop
    // `display: 'flex'` from needing to be a token to survive without it.
    if (config.property) {
      if (this.strictTokens === 'unknown-tokens') {
        // `type:` marks this as a type expression. Without it `getTypes` takes the branch that
        // quotes an unrecognised entry, and the generated `UtilityValues` gets the *string
        // literal* `"KnownKeywords<CssProperties[\"containerName\"]>"` — which then rejects
        // `containerName: 'sidebar'` and accepts that sentence as a value.
        this.types.set(property, set.add(`type:KnownKeywords<CssProperties["${config.property}"]>`))
      } else if (!this.strictTokens) {
        this.types.set(property, set.add(`CssProperties["${config.property}"]`))
      }
    }
  }

  private assignPropertyTypes = () => {
    for (const [property, propertyConfig] of Object.entries(this.config)) {
      if (!propertyConfig) continue
      this.assignPropertyType(property, propertyConfig)
    }
  }

  addPropertyType = (property: string, type: string[]) => {
    const set = this.types.get(property) ?? new Set()
    this.types.set(property, new Set([...set, ...type]))
  }

  /**
   * Returns the Typescript type for the define properties
   */
  getTypes = () => {
    const map = new Map<string, string[]>()

    for (const [prop, tokens] of this.types.entries()) {
      // When tokens does not exist in the config
      if (tokens.size === 0) {
        continue
      }

      const typeValues = Array.from(tokens).map((key) => {
        if (key.startsWith('CssProperties')) return key
        if (key.startsWith('type:')) return key.replace('type:', '')
        return JSON.stringify(key)
      })

      map.set(prop, typeValues)
    }

    return map
  }

  defaultTransform = memo((value: string, prop: string) => {
    const isCssVar = prop.startsWith('--')

    if (isCssVar) {
      const tokenValue = this.tokens.view.getVar(value)
      value = typeof tokenValue === 'string' ? tokenValue : value
    }

    return { [prop]: value }
  })

  private setTransform = (property: string, transform?: AnyFunction) => {
    const defaultTransform = (value: string) => this.defaultTransform(value, property)

    const transformFn = transform ?? defaultTransform
    this.transforms.set(property, transformFn)

    return this
  }

  private getTokenFn = () => {
    return Object.assign(this.getToken.bind(this), {
      raw: (path: string) => this.tokens.getByName(path),
    })
  }

  resolveColorMix = (value: string) => {
    const token = this.getTokenFn()
    return colorMix(value, token)
  }

  private getTransformArgs = (raw: string): TransformArgs => {
    return {
      token: this.getTokenFn(),
      raw,
      utils: {
        colorMix: this.resolveColorMix.bind(this),
      },
    }
  }

  private setStyles = (property: string, raw: string, alias: string, propKey?: string) => {
    propKey = propKey ?? this.getPropKey(property, raw)

    const defaultTransform = (value: string) => this.defaultTransform(value, property)
    const getStyles = this.transforms.get(property) ?? defaultTransform
    const styles = getStyles(raw, this.getTransformArgs(alias))

    this.styles.set(propKey, styles ?? {})

    return this
  }

  formatClassName = (className: string) => {
    return [this.prefix, className].filter(Boolean).join('-')
  }

  /**
   * Returns the resolved className for a given property and value
   */
  getClassName = (property: string, raw: string) => {
    const config = this.configs.get(property)

    if (!config || !config.className) {
      return this.hash(hypenateProperty(property), raw)
    }

    return this.hash(config.className, raw)
  }

  getOrCreateClassName = (property: string, raw: string) => {
    const propKey = this.getPropKey(property, raw)
    let className = this.classNames.get(propKey)

    if (!className) {
      className = this.getClassName(property, raw)
      this.classNames.set(propKey, className)
    }

    return className
  }

  /**
   * Whether a given property exists in the config
   */
  has = (prop: string) => {
    return this.configs.has(prop)
  }

  /**
   * Get or create the resolved styles for a given property and value
   */
  private getOrCreateStyle = (prop: string, value: string) => {
    const propKey = this.getPropKey(prop, value)
    const styles = this.styles.get(propKey)
    if (styles) return styles

    const config = this.configs.get(prop)
    const raw = config ? this.getPropertyRawValue(config, value) : value
    this.setStyles(prop, raw, value, propKey)
    return this.styles.get(propKey)!
  }

  /**
   * Returns the resolved className and styles for a given property and value
   */
  private resolveStyleValue = (value: string) => {
    const styleValue = getArbitraryValue(value)
    return isString(styleValue) ? this.tokens.expandReferenceInValue(styleValue) : styleValue
  }

  /**
   * Resolve each candidate of a `fallback(...)` value on its own, then stack the results into
   * one declaration list per property.
   *
   * Candidates are authored most-preferred first and emitted in reverse, because the CSS
   * mechanism this compiles to is the cascade: a browser keeps the last declaration it can
   * parse and discards the ones it cannot, so the preferred value has to come last.
   *
   * Each candidate goes through the ordinary single-value path, so tokens and arbitrary
   * values resolve inside a fallback exactly as they do outside one.
   *
   * ## Why every candidate has to resolve to exactly one declaration
   *
   * The cascade only arbitrates between declarations of the *same property*: the browser
   * keeps the last `height` it can parse. The moment a candidate resolves to more than one
   * declaration, the extras are not part of that contest and apply unconditionally —
   * whichever candidate won.
   *
   * That is not hypothetical. `transitionProperty` emits `--transition-prop` alongside
   * `transition-property`, and a custom property accepts any token sequence, so the
   * preferred `--transition-prop` always wins even in the browser that fell back. Anything
   * reading that variable then disagrees with the property beside it. `lineClamp` emits four
   * declarations for a number and one for `none`, leaving `display: -webkit-box` applying
   * when the author asked for no clamping at all. `divideX` emits a nested rule, where there
   * is no cascade between candidates whatsoever.
   *
   * A count of matching keys does not separate these from the honest cases — `transitionProperty`
   * has two keys in every candidate. Requiring a single declaration does, and it is a rule
   * that can be explained. Anything else is reported and resolved to the preferred candidate
   * alone: wrong-looking CSS nobody asked for is worse than a fallback quietly not applying.
   */
  private getFallbackStyles = (key: string, values: string[]) => {
    const decline = (reason: string) => {
      logger.warn('utility', `\`${key}: fallback(${values.join(', ')})\` ${reason} Only \`${values[0]}\` was applied.`)
    }

    // Checked before resolving, because a nested call resolves to itself and would be
    // emitted verbatim as a value that is not CSS.
    const nested = values.find(isFallbackCall)
    if (nested) {
      // Nothing to fall back to: the preferred candidate *is* the nested call, so resolving
      // it would emit `fallback(...)` as a value. Drop the declaration, as a malformed call
      // at the top level does.
      logger.warn(
        'utility',
        `\`${key}: fallback(${values.join(', ')})\` nests another \`fallback(...)\` in \`${nested}\`, which has no meaning as a candidate. The declaration was dropped.`,
      )
      return {}
    }

    const resolved = values.map((value) => this.getOrCreateStyle(key, this.resolveStyleValue(value)))
    const preferred = resolved[0]
    const prop = Object.keys(preferred)[0]

    const isStackable = resolved.every((styles) => {
      const props = Object.keys(styles)
      if (props.length !== 1 || props[0] !== prop) return false
      const value = styles[prop]
      // An array is a comma-separated list — a font stack, say — which stacks fine once
      // joined. An object is a nested rule, which does not stack at all.
      return isString(value) || typeof value === 'number' || Array.isArray(value)
    })

    if (!isStackable) {
      decline('does not resolve to a single declaration per candidate, so no fallback was emitted.')
      return preferred
    }

    const seen: string[] = []

    // Reverse order: least-preferred declaration first, so the preferred one wins.
    for (let i = resolved.length - 1; i >= 0; i--) {
      const value = resolved[i][prop]
      // The unit has to land before the join, which turns the number into a string that
      // `stringify` will no longer recognise as one.
      const declaration = Array.isArray(value) ? value.join(',') : String(withCssUnit(prop, value as string | number))
      // A candidate that resolves to the declaration already emitted adds nothing, and
      // repeating it would only make the rule bigger.
      if (seen[seen.length - 1] !== declaration) seen.push(declaration)
    }

    return { [prop]: seen.length > 1 ? seen.join(FALLBACK_SEPARATOR) : seen[0] }
  }

  /**
   * The value keys a property accepts, or `undefined` where it accepts anything.
   *
   * Built through `getPropertyValues`, which normalises all four shapes of `values` — a
   * category name, an array, a function, an object — to one map. Going through it rather
   * than reading `valuesByCategory` directly is what makes the check cover `margin` and
   * `width`, whose values are functions, and the compositions, whose values are arrays.
   * Reading the category directly covered `padding` and not `margin`, which is a worse
   * failure than covering neither: it teaches you the warning can be trusted.
   *
   * Memoised because `getPropertyValues` is not, and this sits on the hottest build path.
   */
  private knownValues = new Map<string, Set<string> | undefined>()

  private getKnownValues = (key: string): Set<string> | undefined => {
    const cached = this.knownValues.get(key)
    if (cached !== undefined || this.knownValues.has(key)) return cached

    const config = this.configs.get(key)
    const values = config?.values
    // `{ type: … }` declares a value space rather than enumerating one, so nothing is unknown.
    const enumerated = !!values && !(!isString(values) && !Array.isArray(values) && !isFunction(values) && values.type)

    const result = enumerated ? new Set(Object.keys(this.getPropertyValues(config!) ?? {})) : undefined
    this.knownValues.set(key, result)
    return result
  }

  /**
   * Every unresolved token path this utility has transformed, keyed on `property:path`.
   *
   * One structure for two jobs — the dedup set behind the warning, and the record
   * `unresolvedToken: 'error'` fails on — because two would be two chances for the modes to
   * disagree about what counts as one finding.
   *
   * `'error'` cannot read this off the finished sheet the way it reads atomic styles.
   * `globalCss`, the reset, config recipes and compositions all serialize through
   * `transformStyles`, which decodes into a *clone* of the decoder, so nothing they contain
   * ever reaches `decoder.atomic`. Transforming them is the only moment they are visible.
   *
   * Accumulating is safe here in a way it is not for atomic styles, and for a reason specific
   * to what is being recorded: all of it is config-derived, transformed once when the context
   * is built, and a config edit constructs a whole new context. So nothing here outlives the
   * config it describes — where a record cleared per build would report these on the first
   * build and pass every build after it.
   */
  unresolvedTokens = new Map<string, UnresolvedTokenRef>()

  /**
   * Whether a style value is shaped like a token path and names no token.
   *
   * The whole of the test, exposed because the build asserts on the *finished sheet* rather
   * than on the transforms that filled it — see `assertNoUnresolvedTokens`. Keeping one
   * predicate is what stops the warning and the error disagreeing about the same value.
   *
   * Membership rather than "did the resolver hand it back unchanged": for an array of values
   * the resolver returns the value either way, so identity would report every valid
   * composition — `mixin: 'headline.h9'` — as a mistake.
   *
   * A property with an empty set is left alone. Nothing is enumerated, so every value is a
   * literal and none of them can be wrong.
   */
  isUnresolvedTokenValue = (prop: string, value: string) => {
    // Cheapest test first: this runs for every value the build transforms, and a CSS value
    // mostly opens with a digit, a `#`, a `-` or a quote. Only a leading letter can be a name.
    const first = value.charCodeAt(0)
    if (!((first >= 97 && first <= 122) || (first >= 65 && first <= 90))) return false

    const key = this.resolveShorthand(prop)
    const bare = this.bareTokenPath(key, value)
    if (!IDENTIFIER.test(bare)) return false

    // Whatever the utility itself enumerates — token names, an array of compositions, the map a
    // `values` function returns. A hit here is the ordinary case and settles it.
    const known = this.getKnownValues(key)
    if (known?.has(bare)) return false

    // A dotted path can only be a token path; nothing in CSS is spelled that way. So the
    // question is just whether this utility enumerates anything to have missed.
    if (bare.includes('.')) return !!known && known.size > 0

    return this.isUnknownKeyword(key, bare)
  }

  /**
   * A bare identifier that is neither a token nor anything the CSS property accepts.
   *
   * This is the half the type layer used to own, and the half it could never do well. csstype
   * describes `top` and `animationName` identically — both end in `(string & {})`, one because
   * it takes lengths and the other because it takes a `<custom-ident>` — so narrowing types had
   * to carry a hand-written list of the properties where an invented name is ordinary. The
   * grammar says it outright, and `acceptsAuthorIdent` reads the grammar.
   *
   * Three ways to be fine, and a value has to fail all of them:
   *
   * - it is a keyword the property enumerates, `display: 'flex'`;
   * - the property takes an identifier the author invents, `animationName: 'fadeIn'`,
   *   `transitionProperty: 'color'`, `gridArea: 'sidebar'`;
   * - nothing describes the property at all — a custom utility mapping to a CSS variable — in
   *   which case there is nothing to be wrong against.
   *
   * What is left is the mistake: `top: 'navH'`, `zIndex: 'overlay'`, `color: 'mutedd'`. Each
   * ships a declaration that parses and that the browser discards.
   */
  private isUnknownKeyword = (key: string, bare: string) => {
    const property = this.getCssProperty(key)
    if (!property) return false

    if (acceptsAuthorIdent(property)) return false

    const keywords = cssPropertyKeywords(property)
    // Empty is "csstype does not describe this property", which is not the same as "it takes
    // nothing" — reading it as a rejection would fail every custom utility named after
    // something CSS has never heard of.
    if (keywords.size === 0) return false

    // Folded, because a CSS keyword is ASCII case-insensitive: `color: currentcolor` is valid
    // and csstype spells it `currentColor`. The token lookup above is *not* folded — those names
    // are the author's.
    return !keywords.has(bare.toLowerCase())
  }

  /**
   * The CSS property a utility declares, for asking the grammar about it.
   *
   * `property` where the utility names one — `spaceX` is `marginInlineStart` — and the key
   * otherwise, which is how `top` and `display` are declared. Verified against the property
   * list rather than trusted: a utility may be named anything, and `mixin` or `textStyle`
   * must reach the grammar as "no such property" rather than as an empty keyword set that
   * happens to behave the same way today.
   */
  private cssProperties = new Map<string, string | undefined>()

  private getCssProperty = (key: string) => {
    const cached = this.cssProperties.get(key)
    if (cached !== undefined || this.cssProperties.has(key)) return cached

    const declared = this.configs.get(key)?.property ?? key
    const property = isCssProperty(declared) ? declared : undefined
    this.cssProperties.set(key, property)
    return property
  }

  /**
   * A style value reduced to the token path it names, with the modifiers that may decorate
   * one stripped off.
   *
   * `red.300!` and `red.300/50` resolve through the token `red.300`, so a typo in the path
   * is a typo whether or not a modifier follows it. Tested as written, both fail
   * `TOKEN_PATH` on the modifier's own punctuation and are reported as fine — which is how
   * `color: red.3000!` shipped a declaration the browser drops with nothing said about it.
   *
   * Here rather than at each caller, which is the whole point. The normalization used to
   * live in `assertNoUnresolvedTokens`, so `unresolvedToken: 'error'` saw through `!` and
   * `unresolvedToken: 'warn'` did not — the two modes disagreeing about the same value,
   * which is exactly what one shared predicate exists to prevent. Neither saw through `/`.
   *
   * The opacity modifier is stripped only for a property that draws on `colors`, since that
   * is the only place the modifier means anything. Elsewhere a slash is ordinary syntax —
   * `font: 12px/1.5 serif`, `gridArea: 1 / 2 / 3 / 4` — and must not be cut. `TOKEN_PATH`
   * would reject those remainders anyway; gating on the category means this does not have
   * to depend on that for its correctness.
   */
  bareTokenPath = (prop: string, value: string) => {
    // `withoutImportant` also trims, which matters: ` red.300 !important` reaches here from a
    // template literal and has to reduce to the same path as `red.300`.
    const bare = value.includes('!') ? withoutImportant(value) : value

    if (!bare.includes('/') || this.getTokenCategory(prop) !== 'colors') return bare

    // The first slash, matching `colorMix`, which reads `path/opacity` and ignores the rest.
    return bare.slice(0, bare.indexOf('/'))
  }

  /** The token category a property draws from, when it draws from exactly one. */
  getTokenCategory = (prop: string) => {
    const category = this.configs.get(this.resolveShorthand(prop))?.values
    return isString(category) ? category : undefined
  }

  /**
   * Record a value shaped like a token path that resolved to nothing, and say so under `warn`.
   *
   * Every branch of `getPropertyRawValue` ends in `|| value`, so an unknown path is handed
   * straight through and `background: 'accent.default'` ships as `background: accent.default`.
   * That parses, so nothing downstream objects; the browser drops the declaration at compute
   * time and the style is simply absent. It surfaces as "this colour never applied", a long
   * way from the typo that caused it.
   *
   * Membership rather than "did the resolver hand it back unchanged": for an array of
   * values the resolver returns the value either way, so identity would report every valid
   * composition — `textStyle: 'headline.h9'` — as a mistake.
   *
   * A property with an empty set is left alone. Nothing is enumerated, so every value is a
   * literal and none of them can be wrong.
   *
   * Recording under `error` too is what stops that mode being *quieter* than the default.
   * It used to return here on anything but `warn` and leave the whole question to
   * `assertNoUnresolvedTokens`, which reads `decoder.atomic` — a set the config-derived
   * styles never enter. A bad token in `globalCss` warned with the option unset and then
   * went silent, exit 0, the dead declaration still in `styles.css`, the moment the option
   * was set to the value that exists to escalate it.
   */
  private recordUnresolvedToken = (key: string, value: string) => {
    if (this.unresolvedToken === 'off') return

    if (!this.isUnresolvedTokenValue(key, value)) return

    // One record per mistake, keyed on the path rather than on the value as written: the same
    // typo reached through `red.3000`, `red.3000!` and `red.3000/50` is one thing to fix.
    // `transform` also runs once per condition, so a single bad token under `base`, `_hover`
    // and two breakpoints is four identical findings without this.
    const bare = this.bareTokenPath(key, value)
    const id = `${key}:${bare}`
    if (this.unresolvedTokens.has(id)) return

    const ref = this.unresolvedTokenRef(key, bare)
    this.unresolvedTokens.set(id, ref)

    // `error` reports the whole set at the end of the build instead — warning here as well
    // would print every finding twice and bury the line that failed it.
    if (this.unresolvedToken !== 'warn') return

    logger.warn('utility', this.explainUnresolvedToken(ref))
  }

  /**
   * Everything known about one finding, built in one place.
   *
   * Both modes describe the same mistakes — `warn` as it transforms, `error` from the finished
   * sheet — and they used to assemble their own descriptions. That is how they came to disagree
   * about whether `!` was part of the value.
   */
  unresolvedTokenRef = (key: string, bare: string): UnresolvedTokenRef => {
    const category = this.getTokenCategory(key)
    return { prop: key, value: bare, category, declaredIn: this.categoriesDeclaring(bare, category) }
  }

  /**
   * The token categories that *do* declare this name, other than the one being read.
   *
   * This is the whole of what a build-time check can say and a type error cannot. `top: 'navH'`
   * is not a name nobody has heard of — `navH` is a real token, declared under `sizes`, used on
   * a property that reads `spacing`. A type error can only report that a string is not
   * assignable to a union of two hundred members and guess a near-miss by spelling; the
   * resolver knows exactly where the name lives.
   *
   * Bounded and only reached when something is already wrong, so the scan is not on any hot
   * path.
   */
  private categoriesDeclaring = (name: string, exclude: string | undefined) => {
    const found: string[] = []
    for (const [category, values] of this.tokens.view.valuesByCategory) {
      if (category === exclude) continue
      if (values.has(name)) found.push(category)
    }
    return found.length ? found : undefined
  }

  /**
   * Say what is wrong, where the name actually lives, and what to write instead.
   *
   * Shared by the warning and by the error `assertNoUnresolvedTokens` throws, so the two cannot
   * describe the same finding differently — which they did once before, over whether `!` was
   * part of the value.
   */
  explainUnresolvedToken = ({ prop, value, category, declaredIn }: UnresolvedTokenRef) => {
    const dropped = `It is emitted as written, and the browser will drop it.`
    // Two spellings rather than one lowercased on the fly: `literal.toLowerCase()` also folded
    // the value inside it, so a token named `navH` was reported with the fix written `[navh]` —
    // advice that does not work.
    const literal = `Write \`[${value}]\` to mean it literally.`
    const orLiteral = `or write \`[${value}]\` to mean it literally.`

    // The good case: the name exists, on another shelf. Saying which shelf *is* the fix, and it
    // is the thing a type error cannot reach — it can only report that a string is not
    // assignable to a union of two hundred members and guess a near-miss by spelling.
    if (declaredIn?.length) {
      // Two is enough to place it. A name declared under six categories is a common word like
      // `sm`, where listing all six only pushes the useful half of the sentence off the line.
      const shown = declaredIn.slice(0, 2).map((name) => `\`${name}\``)
      const rest = declaredIn.length - shown.length
      const where = rest > 0 ? `${shown.join(', ')} and ${rest} more` : shown.join(' and ')
      const reads = category ? `\`${prop}\` reads \`${category}\`` : `\`${prop}\` reads no token category`

      return (
        `\`${prop}: ${value}\` — \`${value}\` is declared under ${where}, but ${reads}. ${dropped} ` +
        `Use a ${category ? `\`${category}\`` : 'valid'} token, ${orLiteral}`
      )
    }

    if (category) {
      return `\`${prop}: ${value}\` — no such \`${category}\` token. ${dropped} ${literal}`
    }

    return `\`${prop}: ${value}\` — \`${prop}\` accepts no such value, and it is not a token. ${dropped} ${literal}`
  }

  transform = (prop: string, value: string | undefined): TransformResult => {
    if (value == null) {
      return { className: '', styles: {} }
    }

    // NUL is what this method joins fallback candidates with on the way out. It cannot
    // appear in CSS, but it can appear in a JS string, and one arriving from pasted or
    // generated content would be split into declarations nobody wrote — and would put a raw
    // NUL in the class name, which the CSS parser rewrites to U+FFFD so the rule stops
    // matching the element it is on.
    // Numbers reach here too, despite the signature.
    if (isString(value) && value.includes(FALLBACK_SEPARATOR)) {
      value = value.replaceAll(FALLBACK_SEPARATOR, '')
    }

    const key = this.resolveShorthand(prop)
    const fallbackValues = parseFallbackValue(value)

    // A value that opens with `fallback(` and does not parse is a typo, not a plain value.
    // Emitted verbatim it is not CSS, and PostCSS rejects the declaration — which in a
    // grouped rule takes its neighbours down with it, reported only as a syntax error that
    // never names the property. Drop the declaration and say what happened instead.
    if (!fallbackValues && isFallbackCall(value)) {
      logger.warn('utility', `Malformed \`fallback(...)\` in \`${key}: ${value}\`. Check for an unbalanced ( or [.`)
      return { className: this.getOrCreateClassName(key, withoutSpace(value)), styles: {} }
    }

    // Each candidate separately, or `fallback(accent.default, red.300)` reports nothing: the
    // whole string has parentheses so it is not path-shaped, and the working candidate hides
    // the broken one for good. That is the same silent failure as the bare case, wearing a
    // fallback that makes it look deliberate.
    for (const candidate of fallbackValues ?? [value]) {
      if (isString(candidate)) this.recordUnresolvedToken(key, candidate)
    }

    return compact({
      layer: this.configs.get(key)?.layer,
      className: this.getOrCreateClassName(key, withoutSpace(value)),
      styles: fallbackValues
        ? this.getFallbackStyles(key, fallbackValues)
        : this.getOrCreateStyle(key, this.resolveStyleValue(value)),
    })
  }

  /**
   * All keys including shorthand keys
   */
  keys = () => {
    const shorthands = Array.from(this.shorthands.keys())
    const properties = Object.keys(this.config)
    return [...shorthands, ...properties]
  }

  /**
   * Returns a map of the property keys and their shorthands
   */
  getPropShorthandsMap = () => {
    const shorthandsByProp = new Map<string, string[]>()

    this.shorthands.forEach((prop, shorthand) => {
      const list = shorthandsByProp.get(prop) ?? []
      list.push(shorthand)
      shorthandsByProp.set(prop, list)
    })

    return shorthandsByProp
  }

  /**
   * Returns the shorthands for a given property
   */
  getPropShorthands = (prop: string) => {
    return this.getPropShorthandsMap().get(prop) ?? []
  }

  /**
   * Whether a given property is deprecated
   */
  isDeprecated = (prop: string) => {
    return this.deprecated.has(prop)
  }

  /**
   * Returns the token type for a given property
   */
  getTokenType = (prop: string) => {
    const set = this.types.get(prop)
    if (!set) return
    for (const type of set) {
      const match = type.match(TOKEN_TYPE_PATTERN)
      if (match) return match[1]
    }
  }
}

const TOKEN_TYPE_PATTERN = /type:Tokens\["([^"]+)"\]/
