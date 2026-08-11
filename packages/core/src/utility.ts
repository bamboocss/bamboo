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
 * A value shaped like a token path: dot-separated segments, the first starting with a letter
 * and the rest with a letter or digit. `red.300` matches, `0.5` and `1.5rem` do not, which is
 * the distinction that keeps numeric values out of `warnUnresolvedToken`.
 */
const TOKEN_PATH = /^[a-zA-Z][\w-]*(?:\.[a-zA-Z0-9][\w-]*)+$/

export interface UtilityOptions {
  config?: UtilityConfig
  tokens: TokenDictionary
  separator?: string
  prefix?: string
  shorthands?: boolean
  strictTokens?: boolean
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

  strictTokens = false

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

    if (!this.strictTokens && config.property) {
      this.types.set(property, set.add(`CssProperties["${config.property}"]`))
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

  private warnedTokens = new Set<string>()

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
    // Cheapest test first: this runs for every value the build transforms, and most of them
    // have no dot at all.
    if (!value.includes('.') || !TOKEN_PATH.test(value)) return false

    const known = this.getKnownValues(this.resolveShorthand(prop))
    return !!known && known.size > 0 && !known.has(value)
  }

  /** The token category a property draws from, when it draws from exactly one. */
  getTokenCategory = (prop: string) => {
    const category = this.configs.get(this.resolveShorthand(prop))?.values
    return isString(category) ? category : undefined
  }

  /**
   * Report a value shaped like a token path that resolved to nothing.
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
   */
  private warnUnresolvedToken = (key: string, value: string) => {
    // `off` says nothing, and `error` reports the whole set at the end of the build instead —
    // warning here as well would print every finding twice and bury the line that failed it.
    if (this.unresolvedToken !== 'warn') return

    if (!this.isUnresolvedTokenValue(key, value)) return

    // One report per mistake. `transform` runs once per condition, so a single bad token
    // under `base`, `_hover` and two breakpoints is one typo and four identical warnings.
    const id = `${key}:${value}`
    if (this.warnedTokens.has(id)) return
    this.warnedTokens.add(id)

    const category = this.getTokenCategory(key)
    const where = category ? ` Check the path against your \`${category}\` tokens.` : ''
    logger.warn(
      'utility',
      `Unknown token \`${value}\` in \`${key}: ${value}\`. It is emitted as written, which the browser will drop.${where} Write \`[${value}]\` if it is meant as a literal.`,
    )
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
      if (isString(candidate)) this.warnUnresolvedToken(key, candidate)
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
