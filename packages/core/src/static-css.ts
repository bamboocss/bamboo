import type { RecipeNode, Stylesheet } from '@bamboocss/core'
import { logger } from '@bamboocss/logger'
import type { CssRule, Dict, PatternRule, RecipeRule, StaticCssOptions } from '@bamboocss/types'
import type { Context } from './context'
import { pushAll } from './push-all'
import { StyleDecoder } from './style-decoder'
import { StyleEncoder } from './style-encoder'

interface StaticCssResults {
  css: Record<string, any>[]
  recipes: Record<string, any>[]
  patterns: Record<string, any>[]
}

type StaticCssContext = Pick<
  Context,
  'encoder' | 'decoder' | 'utility' | 'patterns' | 'recipes' | 'createSheet' | 'config'
>

interface StaticCssEngine {
  results: StaticCssResults
  sheet: Stylesheet
}

export class StaticCss {
  encoder: StyleEncoder
  decoder: StyleDecoder

  private breakpointKeys: string[]
  // A set rather than the key array: `formatCondition` asks this once per condition per value,
  // and the base preset alone declares 107 conditions to scan past.
  private conditionKeys: Set<string>

  // Wildcard expansion cache - this is the main performance optimization
  // Memoizing wildcard expansions avoids redundant token lookups
  private wildcardCache = new Map<string, (string | number)[]>()

  constructor(private context: StaticCssContext) {
    this.encoder = context.encoder
    this.decoder = context.decoder

    this.breakpointKeys = Object.keys(context.config.theme?.breakpoints ?? {})
    this.conditionKeys = new Set(Object.keys(context.config.conditions ?? {}))
  }

  /**
   * An independent instance, so one caller's `process()` cannot be seen by another's.
   *
   * This used to reassign its own encoder and decoder and hand back `this`, which left every
   * caller sharing one object — and, more quietly, one `wildcardCache`. Callers reach for it to
   * get isolation (`ctx.staticCss.clone().process(…)` is the idiom in every test and bench), so
   * a "cold" instance that inherited a warm cache measured and asserted the wrong thing: the
   * cold and warm process benches sat within 2% of each other because they were the same cache.
   *
   * The cloned encoder and decoder are also what `process` reads to tell a clone from the
   * context's own instance, so they have to differ from `context.encoder`/`context.decoder`
   * rather than being rebuilt from them.
   */
  clone() {
    const cloned = new StaticCss(this.context)
    cloned.encoder = this.encoder.clone()
    cloned.decoder = this.decoder.clone()
    return cloned
  }

  /**
   * The rule's conditions, with the breakpoints appended when it asked to be responsive.
   *
   * Returns a new array rather than pushing into the one it was handed. `conditions` there is
   * the array in the user's config — the `|| []` default only stands in when the field is
   * absent — and both callers of `process` pass `ctx.config.staticCss` itself, so appending
   * in place grew the config's own array by a full set of breakpoints on every call.
   */
  // `responsive` is `unknown` because the `'*'` form destructures a recipe's variant key map,
  // where a variant named `responsive` lands here as its array of values. Testing it for
  // truthiness is what this has always done, so it stays that way.
  private withBreakpoints = (conditions: string[] | undefined, responsive: unknown) => {
    if (!responsive) return conditions ?? []
    return conditions ? [...conditions, ...this.breakpointKeys] : this.breakpointKeys.slice()
  }

  private formatCondition = (condition: string) => {
    return this.conditionKeys.has(condition) ? `_${condition}` : condition
  }

  /**
   * `{ base: value, ...one key per condition }`.
   *
   * Assigns into one object rather than spreading the accumulator per condition, which built a
   * fresh object of growing size for each. Runs once per computed value, and a rule that is
   * responsive over five breakpoints carries six conditions.
   *
   * `__proto__` is defined rather than assigned. A computed key in an object literal is a
   * data property, so the spread this replaced created an own key for it; plain assignment
   * would instead run the setter on `Object.prototype` and reparent the result. The same guard
   * is why `mergeProps`, `cloneStyles` and `splitProps` all name that key.
   */
  private getConditionalValues = (conditions: string[], value: any) => {
    const result: Record<string, any> = { base: value }

    for (let i = 0; i < conditions.length; i++) {
      const key = this.formatCondition(conditions[i])
      if (key === '__proto__') {
        Object.defineProperty(result, key, { value, writable: true, enumerable: true, configurable: true })
      } else {
        result[key] = value
      }
    }

    return result
  }

  /**
   * Get property keys with memoization for wildcard expansion
   * This is the main performance optimization - avoids redundant token lookups
   */
  private getCachedPropertyKeys = (property: string): (string | number)[] => {
    const cached = this.wildcardCache.has(property)
    if (!cached) {
      const keys = this.context.utility.getPropertyKeys(property)
      this.wildcardCache.set(property, keys)
      logger.debug('static_css:wildcard', `${property} -> ${keys.length} values (memoized)`)
    } else {
      logger.debug('static_css:wildcard', `${property} (cache hit)`)
    }
    return this.wildcardCache.get(property)!
  }

  /**
   * Get pattern property values with memoization
   */
  private getCachedPatternPropertyValues = (patternName: string, property: string): (string | number)[] => {
    const cacheKey = `${patternName}:${property}`
    const cached = this.wildcardCache.has(cacheKey)
    if (!cached) {
      const values = this.context.patterns.getPropertyValues(patternName, property) ?? []
      this.wildcardCache.set(cacheKey, values)
      logger.debug('static_css:wildcard', `Pattern ${patternName}.${property} -> ${values.length} values (memoized)`)
    } else {
      logger.debug('static_css:wildcard', `Pattern ${patternName}.${property} (cache hit)`)
    }
    return this.wildcardCache.get(cacheKey)!
  }

  private getCssObjects = (entry: [string, Array<string | number>], conditions: string[]) => {
    const [property, values] = entry

    const propKeys = this.getCachedPropertyKeys(property)
    const computedValues = values.flatMap((value) => (value === '*' ? propKeys : value))

    return computedValues.map((value) => ({
      [property]: conditions.length ? this.getConditionalValues(conditions, value) : value,
    }))
  }

  getCssRuleObjects = (rule: CssRule) => {
    const conditions = this.withBreakpoints(rule.conditions, rule.responsive)
    const entries = Object.entries(rule.properties)
    return entries.flatMap((entry) => this.getCssObjects(entry, conditions))
  }

  private getPatternObjects = (name: string, entry: [string, Array<string | number>], conditions: string[]): Dict[] => {
    const [property, values] = entry

    const propValues = this.getCachedPatternPropertyValues(name, property)
    const computedValues = values.flatMap((value) => (value === '*' ? propValues : value))

    return computedValues.map((patternValue) => {
      const value = this.context.patterns.transform(name, { [property]: patternValue })
      const conditionalValues = this.getConditionalValues(conditions, value)
      return conditions.length ? conditionalValues : value
    })
  }

  getPatternRuleObjects = (name: string, pattern: PatternRule): Dict[] => {
    const details = this.context.patterns.details.find((d) => d.baseName === name)
    if (!details) return []

    const useAllKeys = pattern === '*'

    let props = {} as CssRule['properties']
    if (useAllKeys) {
      props = Object.fromEntries((details.props ?? []).map((key) => [key, ['*']]))
    }

    const { conditions: ruleConditions, responsive = false, properties = props } = useAllKeys ? {} : pattern

    const conditions = this.withBreakpoints(ruleConditions, responsive)
    const entries = Object.entries(properties)
    return entries.flatMap((entry) => this.getPatternObjects(name, entry, conditions))
  }

  private getRecipeNode = (name: string) => {
    return this.context.recipes.getNode(name)
  }

  getRecipeRuleObjects = (name: string, recipe: RecipeRule, recipeNode: RecipeNode): Dict[] => {
    const recipeKeys = recipeNode.variantKeyMap
    if (!recipeKeys) return []

    const useAllKeys = recipe === '*'
    const { conditions: ruleConditions, responsive, ...variants } = useAllKeys ? recipeKeys : recipe

    const conditions = this.withBreakpoints(ruleConditions, responsive)

    return Object.entries(variants).flatMap(([variant, values]) => {
      if (!Array.isArray(values)) return []
      const computedValues = values.flatMap((value) => (value === '*' ? recipeKeys[variant] : value))
      return computedValues.map((value) => {
        const conditionalValues = this.getConditionalValues(conditions, value)
        return { [name]: { [variant]: conditions.length ? conditionalValues : value } }
      })
    })
  }

  getRecipeCompoundVariantCssObjects = (recipeNode: RecipeNode) => {
    const cssRules: Dict[] = []
    const { compoundVariants } = recipeNode.config

    if (!compoundVariants) return cssRules

    compoundVariants.forEach((compoundVariant) => {
      const css = compoundVariant.css
      const isSlot = 'slots' in recipeNode.config && recipeNode.config.slots.length

      if (isSlot) {
        Object.values(css).forEach((styles) => {
          Object.entries(styles).forEach(([prop, value]) => {
            cssRules.push({ [prop]: value })
          })
        })
      } else {
        Object.entries(css).forEach(([prop, value]) => {
          cssRules.push({ [prop]: value })
        })
      }
    })

    return cssRules
  }

  /**
   * This transforms a static css config into the same format as in the ParserResult,
   * so that it can be processed by the same logic as styles found in app code.
   *
   * e.g.
   * @example { css: [{ color: ['red', 'blue'] }] } => { css: [{ color: 'red }, { color: 'blue }] }
   * @example { css: [{ color: ['red'], conditions: ['md'] }] } => { css: [{ color: { base: 'red', md: 'red' } }] }
   *
   */
  getStyleObjects(options: StaticCssOptions) {
    const { css = [], patterns = {} } = options

    const results: StaticCssResults = {
      css: [],
      recipes: [],
      patterns: [],
    }

    css.forEach((rule) => {
      const cssObjects = this.getCssRuleObjects(rule)
      pushAll(results.css, cssObjects)
    })

    const recipes = (options.recipes ?? {}) as Record<string, RecipeRule[]>

    Object.entries(recipes).forEach(([recipe, rules]) => {
      const recipeNode = this.getRecipeNode(recipe)
      if (!recipeNode) return

      // adds the recipe.base to the results
      results.recipes.push({ [recipe]: {} })

      if (recipeNode.config.compoundVariants) {
        pushAll(results.css, this.getRecipeCompoundVariantCssObjects(recipeNode))
      }

      rules.forEach((rule) => {
        pushAll(results.recipes, this.getRecipeRuleObjects(recipe, rule, recipeNode))
      })
    })

    Object.entries(patterns).forEach(([pattern, rules]) => {
      rules.forEach((rule) => {
        pushAll(results.patterns, this.getPatternRuleObjects(pattern, rule))
      })
    })

    return results
  }

  process = (options: StaticCssOptions, stylesheet?: Stylesheet): StaticCssEngine => {
    const { context } = this

    const sheet = stylesheet ?? context.createSheet()

    // Determine which encoder/decoder to use
    // If this is a cloned instance (encoder !== context.encoder), use fresh instances each time
    // to avoid state accumulation across multiple process() calls
    const isClonedInstance = this.encoder !== context.encoder
    const encoder = isClonedInstance ? context.encoder.clone() : this.encoder
    const decoder = isClonedInstance ? context.decoder.clone() : this.decoder

    // Normalize the staticCss config
    const staticCss = {
      ...options,
      recipes: { ...(typeof options.recipes === 'string' ? {} : options.recipes) },
    } satisfies StaticCssOptions

    const { theme = {} } = context.config

    const recipeConfigs = Object.assign({}, theme.recipes, theme.slotRecipes)
    const useAllRecipes = options.recipes === '*'

    Object.entries(recipeConfigs).forEach(([name, recipe]) => {
      if (useAllRecipes) {
        // When recipes: "*" is set globally, always use ['*'] for all recipes
        // This should NOT be overridden by individual recipe.staticCss configs
        staticCss.recipes[name] = ['*']
      } else if (recipe.staticCss) {
        // Only use recipe-level staticCss when not using global wildcard
        staticCss.recipes[name] = recipe.staticCss
      }
    })

    logger.debug('static_css:process', `Processing staticCss`)

    const results = this.getStyleObjects(staticCss)

    logger.debug(
      'static_css:process',
      `Generated style objects: ${results.css.length} css, ${results.recipes.length} recipes, ${results.patterns.length} patterns`,
    )

    results.css.forEach((css) => {
      encoder.hashStyleObject(encoder.atomic, css)
    })

    results.recipes.forEach((result) => {
      Object.entries(result).forEach(([name, value]) => {
        encoder.processRecipe(name, value)
      })
    })

    results.patterns.forEach((result) => {
      encoder.hashStyleObject(encoder.atomic, result)
    })

    sheet.processDecoder(decoder.collect(encoder))

    return {
      results,
      sheet,
    }
  }
}
