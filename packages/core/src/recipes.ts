import {
  BambooError,
  capitalize,
  createRegex,
  dashCase,
  getSlotRecipes,
  isObject,
  memo,
  splitProps,
  withoutSpace,
} from '@bamboocss/shared'
import type {
  ArtifactFilters,
  Dict,
  PartialBy,
  RecipeConfig,
  SlotRecipeConfig,
  SlotRecipeDefinition,
  SystemStyleObject,
} from '@bamboocss/types'
import merge from 'lodash.merge'
import type { RecipeNode } from './types'
import { transformStyles, type SerializeContext } from './serialize'

/** The slot every other slot nests inside, by convention. */
const ROOT_SLOT = 'root'

/**
 * The synthetic variant key a compound variant is recorded under.
 *
 * A compound has no single variant/value pair to key on, but the encode/decode path is
 * built around one, so each gets an index under this key. The name cannot collide with a
 * real variant: `--` is what `getClassName` puts between a recipe and its variant, so no
 * declared key can contain it.
 */
export const COMPOUND_VARIANT = '--compound'

/** Every combination a compound variant's selection covers, expanded from its `OneOrMore` values. */
const compoundSelections = (selection: Record<string, unknown>): Array<Array<[string, string]>> => {
  let combinations: Array<Array<[string, string]>> = [[]]

  for (const [variant, value] of Object.entries(selection)) {
    if (variant === 'css' || value == null) continue
    const alternatives = Array.isArray(value) ? value : [value]
    combinations = combinations.flatMap((combination) =>
      alternatives.map((alternative) => [...combination, [variant, String(alternative)] as [string, string]]),
    )
  }

  return combinations
}

interface RecipeRecord {
  [key: string]: RecipeConfig | SlotRecipeConfig
}

type InlineRecipeConfig = RecipeConfig | SlotRecipeDefinition

interface RecipeNormalizationState {
  classNames: Map<string, string>
  styles: Map<string, SystemStyleObject>
  slotScopes: Map<string, Array<{ anchorVariantClasses: string[]; anchorClass: string; slotClass: string }>>
  compoundSelectors: Map<string, string[][]>
}

export interface PreparedInlineRecipe {
  name: string
  config: InlineRecipeConfig
  classNames: Map<string, string>
  styles: Map<string, SystemStyleObject>
  slots?: Map<string, RecipeConfig>
  slotScopes: Map<string, Array<{ anchorVariantClasses: string[]; anchorClass: string; slotClass: string }>>
  compoundSelectors: Map<string, string[][]>
  keys: Set<string>
}

const sharedState = {
  /**
   * The map of recipe names to their resolved class names
   */
  classNames: new Map<string, string>(),
  /**
   * The map of the property to their resolved styles
   */
  styles: new Map<string, SystemStyleObject>(),
  /**
   * The map of the recipes with their resolved styles
   */
  nodes: new Map<string, RecipeNode>(),
  /**
   * The map of recipe key to slot key + slot recipe
   */
  slots: new Map<string, Map<string, RecipeConfig>>(),
  /**
   * The selector a compound variant's rule is emitted against, keyed the same way as
   * `styles`. A selector list rather than a class, because a compound selection with an
   * `OneOrMore` value covers several combinations at once.
   */
  compoundSelectors: new Map<string, string[][]>(),
  /**
   * Where a non-anchor slot's variant rules are emitted, keyed the same way as `styles`.
   *
   * A slot recipe's variants are chosen at an anchor, but the slots that react to them are
   * authored by the consumer somewhere below it — in a compound component, arbitrarily
   * deep and out of reach of any prop. Rather than deliver the variant to each slot at
   * runtime, the rule is scoped by a class the anchor already carries, so the slot's own
   * class stays constant.
   *
   * A list, one entry per anchor, because a component can occupy more than one subtree: a
   * `<Select>` puts its listbox behind a portal, where no scope opened at `root` can reach
   * it. The rule is emitted under every anchor and only the one that is genuinely an
   * ancestor matches, so nothing has to describe the DOM.
   *
   * `to (.recipe__anchor)` bounds each scope at the next nested instance. Without it an
   * outer `<Tabs size="lg">` would style the triggers of an inner `<Tabs size="sm">`, and
   * at equal specificity the winner would be stylesheet order rather than proximity.
   */
  slotScopes: new Map<string, Array<{ anchorVariantClasses: string[]; anchorClass: string; slotClass: string }>>(),
}

export class Recipes {
  slotSeparator = '__'

  keys: string[] = []

  private deprecated = new Set<string>()

  /** Inline recipes this context has already normalized. See `registerInline`. */
  private inlineRegistered = new Set<string>()

  /**
   * Inline-only runtime state. Configured recipes retain their historical shared registry,
   * but an inline owner must be releasable without deleting another live Context's recipe.
   */
  private inlineState = {
    inlineConfigs: new Map<string, InlineRecipeConfig>(),
    inlineKeys: new Map<string, Set<string>>(),
    keyOwners: new Map<string, string>(),
    classOwners: new Map<string, string>(),
    classNames: new Map<string, string>(),
    styles: new Map<string, SystemStyleObject>(),
    slots: new Map<string, Map<string, RecipeConfig>>(),
    slotScopes: new Map<string, Array<{ anchorVariantClasses: string[]; anchorClass: string; slotClass: string }>>(),
    compoundSelectors: new Map<string, string[][]>(),
  }

  private context!: SerializeContext

  get config() {
    return this.recipes
  }

  constructor(private recipes: RecipeRecord = {}) {
    this.prune()
  }

  private getPropKey = (recipe: string, variant: string, value: any) => {
    return `${recipe} (${variant} = ${value})`
  }

  private get separator() {
    return this.context.utility.separator ?? '_'
  }

  /**
   * `withoutSpace` to match the runtime, which has always applied it — `createRecipe`'s
   * transform does, and so does `getRecipeClassNames`. Without it a variant value with a
   * space in it named `--size-x\ large` here and `--size-x_large` in the browser, and the
   * element rendered unstyled. `checkNamingAgreement` covers it now.
   */
  private getClassName = (className: string, variant: string, value: string) => {
    return `${className}--${variant}${this.separator}${withoutSpace(value)}`
  }

  // check this.recipes against sharedState.nodes
  // and remove any recipes (in sharedState) that are no longer in use
  prune = () => {
    const recipeNames = Object.keys(this.recipes)
    const cachedRecipeNames = Array.from(sharedState.nodes.keys())
    const removedRecipes = cachedRecipeNames.filter((name) => !recipeNames.includes(name))
    removedRecipes.forEach((name) => {
      this.remove(name)
    })
  }

  save = (context: SerializeContext) => {
    this.context = context
    for (const [name, recipe] of Object.entries(this.recipes)) {
      this.saveOne(name, recipe)
    }
    this.keys = Object.keys(this.recipes)
  }

  /**
   * The slots that enclose other slots, and therefore anchor their variant rules.
   *
   * `scopeRoots` when it is set, otherwise a slot named `root`. By name rather than by
   * position: a recipe whose slots are siblings — `['title', 'body']` — has no ancestor to
   * scope by, and scoping one to another would emit rules that match nothing. Those keep a
   * variant class per slot, which `scopeRoots: []` also asks for explicitly.
   *
   * Read the list as a *cost* control rather than a description of the tree. Emitting every
   * slot's variant rules under every slot would be correct with nothing declared at all —
   * only the anchor that is really an ancestor ever matches — but it is quadratic in slot
   * count. Naming the enclosing slots prunes that to one copy per anchor.
   *
   * An anchor naming a slot the recipe does not declare is dropped rather than trusted;
   * validation reports it.
   */
  static getScopeRoots = (recipe: SlotRecipeDefinition): string[] => {
    const declared = (recipe as { scopeRoots?: readonly string[] }).scopeRoots
    if (declared) return declared.filter((slot) => recipe.slots.includes(slot))

    return recipe.slots.includes(ROOT_SLOT) ? [ROOT_SLOT] : []
  }

  saveOne = (name: string, recipe: RecipeConfig | SlotRecipeConfig) => {
    if (Recipes.isSlotRecipeConfig(recipe)) {
      // extract recipes for each slot
      const slots = getSlotRecipes(recipe)

      const slotsMap = new Map()
      const anchors = Recipes.getScopeRoots(recipe)
      const anchorClassNames = anchors.map((slot) => this.getSlotKey(recipe.className ?? name, slot))

      // normalize each recipe
      Object.entries(slots).forEach(([slot, slotRecipe]) => {
        const slotName = this.getSlotKey(name, slot)
        this.normalize(slotName, slotRecipe, anchors.includes(slot) ? [] : anchorClassNames)
        slotsMap.set(slotName, slotRecipe)
      })

      // save the root recipe
      this.assignRecipe(name, recipe)
      sharedState.slots.set(name, slotsMap)
      //
    } else {
      this.assignRecipe(name, this.normalize(name, recipe))
    }
  }

  remove(name: string) {
    sharedState.nodes.delete(name)
    sharedState.classNames.delete(name)
    sharedState.styles.delete(name)
  }

  inferJsxSlots = (name: string, recipe: RecipeConfig | SlotRecipeConfig) => {
    const capitalized = capitalize(name)
    const jsx = Array.from(recipe.jsx ?? [capitalized])

    if (Recipes.isSlotRecipeConfig(recipe)) {
      const jsxRootName = capitalize(ROOT_SLOT)
      const rootNames: string[] = [`${capitalized}.${jsxRootName}`, `${capitalized}${jsxRootName}`]
      jsx.push(...rootNames)
    }

    return jsx
  }

  private assignRecipe = (name: string, recipe: RecipeConfig | SlotRecipeConfig) => {
    if (recipe.deprecated) this.deprecated.add(name)

    const variantKeys = Object.keys(recipe.variants ?? {})
    const jsx = this.inferJsxSlots(name, recipe)

    sharedState.nodes.set(name, {
      ...this.getNames(name),
      className: recipe.className ?? name,
      jsx,
      type: 'recipe' as const,
      variantKeyMap: Object.fromEntries(
        Object.entries(recipe.variants ?? {}).map(([key, value]) => {
          return [key, Object.keys(value)]
        }),
      ),
      match: createRegex(jsx),
      config: recipe,
      splitProps: (props) => {
        return splitProps(props, variantKeys) as [Dict, Dict]
      },
    })
  }

  getSlotKey = (name: string, slot: string) => {
    return `${name}${this.slotSeparator}${slot}`
  }

  isEmpty = () => {
    return sharedState.nodes.size === 0
  }

  isDeprecated = (name: string) => {
    return this.deprecated.has(name)
  }

  getNames = memo((name: string) => {
    return {
      baseName: name,
      upperName: capitalize(name),
      dashName: dashCase(name),
      jsxName: capitalize(name),
    }
  })

  getRecipe = memo((name: string) => {
    return sharedState.nodes.get(name)
  })

  /**
   * Not memoized, and not because it is cheap — `this.recipes[name]` is a property access,
   * which memoizing makes slower rather than faster. An inline recipe is registered while
   * its file is being encoded, so a memo that ran before then would cache the miss and keep
   * returning it for every later build of the same name.
   */
  getConfig = (name: string): InlineRecipeConfig | undefined => {
    return (
      (Object.hasOwn(this.recipes, name) ? this.recipes[name] : undefined) ?? this.inlineState.inlineConfigs.get(name)
    )
  }

  /** Exact inline registration, without the configured-recipe precedence of `getConfig`. */
  getInlineConfig = (name: string): InlineRecipeConfig | undefined => {
    return this.inlineState.inlineConfigs.get(name)
  }

  getConfigOrThrow = (name: string) => {
    const config = this.getConfig(name)
    if (!config) throw new BambooError('UNKNOWN_RECIPE', `Recipe "${name}" not found`)
    return config
  }

  find = memo((jsxName: string) => {
    return this.details.find((node) => node.match.test(jsxName))
  })

  filter = memo((jsxName: string) => {
    return this.details.filter((node) => node.match.test(jsxName))
  })

  get details() {
    return Array.from(sharedState.nodes.values())
  }

  /**
   * The node for a recipe, by name.
   *
   * `details` is a getter that materializes the whole node list, so finding one by name that
   * way allocates an array of every recipe in the theme and then scans it — and `baseName` is
   * the key the node is already stored under.
   *
   * Not memoized, unlike `getRecipe`. The node map is module-level state that `saveOne` and
   * `remove` write to, so a cached answer can outlive the node it names; reading through gives
   * the same freshness the scan had.
   */
  getNode = (name: string): RecipeNode | undefined => {
    return sharedState.nodes.get(name)
  }

  splitProps = (recipeName: string, props: Dict) => {
    const recipe = this.getNode(recipeName)
    if (!recipe) return [{}, props]
    return recipe.splitProps(props)
  }

  isSlotRecipe = (name: string) => {
    const config = this.getConfig(name)
    return !!config && Recipes.isSlotRecipeDefinition(config)
  }

  static isSlotRecipeConfig = (config: RecipeConfig | SlotRecipeConfig): config is SlotRecipeConfig => {
    return 'slots' in config && Array.isArray(config.slots) && config.slots.length > 0
  }

  static isSlotRecipeDefinition = (config: RecipeConfig | SlotRecipeDefinition): config is SlotRecipeDefinition => {
    return 'slots' in config && Array.isArray(config.slots) && config.slots.length > 0
  }

  normalize = (
    name: string,
    config: RecipeConfig,
    scopedByAnchorClasses?: string[],
    state: RecipeNormalizationState = sharedState,
  ) => {
    const {
      jsx = [capitalize(name)],
      base = {},
      variants = {},
      defaultVariants = {},
      description = '',
      compoundVariants = [],
      staticCss = [],
    } = config

    const className = config.className ?? name
    const recipe: Required<RecipeConfig> = {
      ...config,
      deprecated: config.deprecated == null ? false : config.deprecated,
      jsx,
      className,
      description,
      base: {},
      variants: {},
      defaultVariants,
      compoundVariants,
      staticCss,
    }

    recipe.base = transformStyles(this.context, base, name)

    state.styles.set(name, recipe.base)
    state.classNames.set(name, recipe.className)

    for (const [key, variant] of Object.entries(variants)) {
      for (const [variantKey, styles] of Object.entries(variant)) {
        const propKey = this.getPropKey(name, key, variantKey)
        const className = this.getClassName(recipe.className, key, variantKey)

        const styleObject = transformStyles(this.context, styles, className)

        state.styles.set(propKey, styleObject)
        state.classNames.set(propKey, className)

        if (scopedByAnchorClasses?.length) {
          // Stored raw. `hash.className` and `prefix` are applied by the decoder's
          // `formatSelector`, and building the selector here skipped both — so under either
          // option the prelude named an anchor class no element carried and the rule
          // selected a slot class the runtime never returned. Every non-anchor slot then
          // rendered unstyled, silently.
          state.slotScopes.set(
            propKey,
            scopedByAnchorClasses.map((anchorClass) => ({
              anchorVariantClasses: [this.getClassName(anchorClass, key, variantKey)],
              anchorClass,
              slotClass: recipe.className,
            })),
          )
        } else {
          // Cleared rather than left alone. This map is module-global and outlives a
          // context, so a recipe that *stops* being scoped — `scopeRoots` removed in a
          // watch rebuild — would otherwise keep emitting rules under an anchor nothing
          // renders any more.
          state.slotScopes.delete(propKey)
        }

        merge(recipe.variants, {
          [key]: { [variantKey]: styleObject },
        })
      }
    }

    compoundVariants.forEach((compoundVariant, index) => {
      // Both maps cleared before anything can return. They are module-global and outlive a
      // context, and a compound can move between the scoped and unscoped branches — a watch
      // rebuild that removes `scopeRoots`, say — or lose its `css` entirely. Without this
      // the stale branch's entry survives, `getAtomic` prefers a scope over a selector, and
      // the recipe emits a rule naming an anchor nothing renders while losing its own
      // compound. The variant loop above clears its entry for the same reason.
      const propKey = this.getPropKey(name, COMPOUND_VARIANT, index)
      state.slotScopes.delete(propKey)
      state.compoundSelectors.delete(propKey)

      if (!compoundVariant?.css) return

      // Raw class names, one list per combination. `hash.className` and `prefix` are applied
      // by the decoder's `formatSelector` — building the selector string here skipped both,
      // so the rule selected `.btn--size_sm` while the element carried `bam-btn--size_sm`,
      // and every compound variant was dead under either option.
      const selectors = compoundSelections(compoundVariant)
        .map((combination) =>
          combination.map(([variant, value]) => this.getClassName(recipe.className, variant, value)),
        )
        .filter((combination) => combination.length > 0)

      if (!selectors.length) return

      // A scoped slot carries only its constant class, so a compound selecting on that
      // slot's variant classes matches nothing — the variants reach it through an anchor's
      // scope, and so must the compound. One scope per anchor per combination, with the
      // compound's classes taken from the *anchor*.
      if (scopedByAnchorClasses?.length) {
        state.styles.set(propKey, transformStyles(this.context, compoundVariant.css, recipe.className))
        state.classNames.set(propKey, `${recipe.className}--compound${this.separator}${index}`)
        state.slotScopes.set(
          propKey,
          scopedByAnchorClasses.flatMap((anchorClass) =>
            compoundSelections(compoundVariant).map((combination) => ({
              anchorVariantClasses: combination.map(([variant, value]) =>
                this.getClassName(anchorClass, variant, value),
              ),
              anchorClass,
              slotClass: recipe.className,
            })),
          ),
        )
        return
      }
      // Never reaches the DOM — the rule selects on the variant classes the element already
      // carries. This only has to be stable and distinct, so the decoder can key on it.
      const className = `${recipe.className}--compound${this.separator}${index}`

      state.styles.set(propKey, transformStyles(this.context, compoundVariant.css, className))
      state.classNames.set(propKey, className)
      state.compoundSelectors.set(propKey, selectors)
    })

    return recipe
  }

  /**
   * Make an inline `cva`/`sva` resolvable by name, the way a config recipe is.
   *
   * Deliberately `normalize` without `assignRecipe`. `normalize` populates the two maps
   * `getTransform` reads — the styles and class name behind each `name--variant_value` —
   * which is all the decoder needs to emit a rule. `assignRecipe` populates
   * `sharedState.nodes`, and `details` is that map, so registering there would make the
   * generator emit a `styled-system/recipes` module for every anonymous `cva` in the
   * codebase. An inline recipe wants the naming, not the artifact.
   *
   * Preparation targets detached maps, so a complete owner contribution can validate every
   * registration before committing any of them. The encoder unregisters the prepared keys
   * when their last file owner releases them; `nodes` remains untouched throughout.
   */
  prepareInline = (name: string, config: InlineRecipeConfig): PreparedInlineRecipe => {
    const state: RecipeNormalizationState = {
      classNames: new Map(),
      styles: new Map(),
      slotScopes: new Map(),
      compoundSelectors: new Map(),
    }
    let slots: Map<string, RecipeConfig> | undefined
    if ('slots' in config && Array.isArray(config.slots) && config.slots.length > 0) {
      const slotConfig = config as SlotRecipeDefinition
      const anchors = Recipes.getScopeRoots(slotConfig)
      const anchorClassNames = anchors.map((slot) => this.getSlotKey(slotConfig.className ?? name, slot))
      slots = new Map<string, RecipeConfig>()

      // The identity has to be the className before the split. `getSlotRecipes` builds each
      // slot's class as `className__slot`, and with no className that collapses to the bare
      // slot name — `root` rather than `sva_hAcRla__root`, which would collide with every
      // other anonymous recipe that happens to have a slot called `root`. The runtime's
      // `sva` injects it the same way, for the same reason.
      const withName = { ...slotConfig, className: slotConfig.className ?? name }

      Object.entries(getSlotRecipes(withName as SlotRecipeConfig)).forEach(([slot, slotRecipe]) => {
        const slotName = this.getSlotKey(name, slot)
        this.normalize(slotName, slotRecipe, anchors.includes(slot) ? [] : anchorClassNames, state)
        slots!.set(slotName, slotRecipe)
      })
    } else {
      this.normalize(name, config as RecipeConfig, undefined, state)
    }

    const prepared = {
      name,
      config,
      ...state,
      slots,
      keys: new Set([
        ...state.classNames.keys(),
        ...state.styles.keys(),
        ...state.slotScopes.keys(),
        ...state.compoundSelectors.keys(),
      ]),
    }
    for (const key of prepared.keys) {
      if (this.hasConfiguredNormalizationKey(key)) {
        throw new BambooError(
          'INVALID_RECIPE',
          `Inline recipe "${name}" conflicts with configured normalized unit "${key}"`,
        )
      }
    }
    for (const className of prepared.classNames.values()) {
      if (this.hasConfiguredClassName(className)) {
        throw new BambooError(
          'INVALID_RECIPE',
          `Inline recipe "${name}" conflicts with configured emitted class "${className}"`,
        )
      }
    }
    return prepared
  }

  /** Whether a normalized map key belongs to one of this context's configured recipes. */
  private hasConfiguredNormalizationKey = (key: string) => {
    for (const [name, config] of Object.entries(this.recipes)) {
      const units: Array<[string, RecipeConfig]> = Recipes.isSlotRecipeConfig(config)
        ? Object.entries(getSlotRecipes(config)).map(([slot, recipe]) => [this.getSlotKey(name, slot), recipe])
        : [[name, config]]
      for (const [unit, recipe] of units) {
        if (key === unit) return true
        for (const [variant, values] of Object.entries(recipe.variants ?? {})) {
          for (const value of Object.keys(values ?? {})) {
            if (key === this.getPropKey(unit, variant, value)) return true
          }
        }
        for (const [index, compound] of (recipe.compoundVariants ?? []).entries()) {
          if (compound?.css && key === this.getPropKey(unit, COMPOUND_VARIANT, index)) return true
        }
      }
    }
    return false
  }

  private configuredUnits = function* (this: Recipes): Generator<[string, RecipeConfig]> {
    for (const [name, config] of Object.entries(this.recipes)) {
      if (Recipes.isSlotRecipeConfig(config)) {
        for (const [slot, recipe] of Object.entries(getSlotRecipes(config))) {
          yield [this.getSlotKey(name, slot), recipe]
        }
      } else {
        yield [name, config]
      }
    }
  }

  private hasConfiguredClassName = (className: string) => {
    for (const [unit, recipe] of this.configuredUnits()) {
      const base = recipe.className ?? unit
      if (className === base) return true
      for (const [variant, values] of Object.entries(recipe.variants ?? {})) {
        for (const value of Object.keys(values ?? {})) {
          if (className === this.getClassName(base, variant, value)) return true
        }
      }
      for (const [index, compound] of (recipe.compoundVariants ?? []).entries()) {
        if (compound?.css && className === `${base}--compound${this.separator}${index}`) return true
      }
    }
    return false
  }

  /** Current inline owner of one normalized map key, for transaction validation. */
  getInlineKeyOwner = (key: string) => this.inlineState.keyOwners.get(key)

  /** Current inline owner of one raw emitted class, for transaction validation. */
  getInlineClassOwner = (className: string) => this.inlineState.classOwners.get(className)

  commitInline = (prepared: PreparedInlineRecipe) => {
    const { name } = prepared
    this.inlineState.inlineKeys.get(name)?.forEach((key) => {
      if (this.inlineState.keyOwners.get(key) !== name) return
      const className = this.inlineState.classNames.get(key)
      if (className !== undefined && this.inlineState.classOwners.get(className) === name) {
        this.inlineState.classOwners.delete(className)
      }
      this.inlineState.keyOwners.delete(key)
      this.inlineState.classNames.delete(key)
      this.inlineState.styles.delete(key)
      this.inlineState.slotScopes.delete(key)
      this.inlineState.compoundSelectors.delete(key)
    })

    prepared.classNames.forEach((value, key) => this.inlineState.classNames.set(key, value))
    prepared.styles.forEach((value, key) => this.inlineState.styles.set(key, value))
    prepared.slotScopes.forEach((value, key) => this.inlineState.slotScopes.set(key, value))
    prepared.compoundSelectors.forEach((value, key) => this.inlineState.compoundSelectors.set(key, value))
    if (prepared.slots) this.inlineState.slots.set(name, prepared.slots)
    else this.inlineState.slots.delete(name)

    this.inlineState.inlineConfigs.set(name, prepared.config)
    this.inlineState.inlineKeys.set(name, prepared.keys)
    prepared.keys.forEach((key) => this.inlineState.keyOwners.set(key, name))
    prepared.classNames.forEach((className) => this.inlineState.classOwners.set(className, name))
    this.inlineRegistered.add(name)
  }

  registerInline = (name: string, config: InlineRecipeConfig) => {
    if (this.inlineRegistered.has(name) && sameValue(this.inlineState.inlineConfigs.get(name), config)) return false
    const prepared = this.prepareInline(name, config)
    for (const key of prepared.keys) {
      const owner = this.inlineState.keyOwners.get(key)
      if (owner !== undefined && owner !== name) {
        throw new BambooError(
          'INVALID_RECIPE',
          `Inline recipe "${name}" conflicts with normalized unit "${key}" owned by "${owner}"`,
        )
      }
    }
    for (const className of prepared.classNames.values()) {
      const owner = this.inlineState.classOwners.get(className)
      if (owner !== undefined && owner !== name) {
        throw new BambooError(
          'INVALID_RECIPE',
          `Inline recipe "${name}" conflicts with emitted class "${className}" owned by "${owner}"`,
        )
      }
    }
    this.commitInline(prepared)
    return true
  }

  unregisterInline = (name: string, expected: InlineRecipeConfig) => {
    if (!this.inlineRegistered.has(name)) return false
    if (!sameValue(this.inlineState.inlineConfigs.get(name), expected)) return false
    this.inlineRegistered.delete(name)

    this.inlineState.inlineKeys.get(name)?.forEach((key) => {
      if (this.inlineState.keyOwners.get(key) !== name) return
      const className = this.inlineState.classNames.get(key)
      if (className !== undefined && this.inlineState.classOwners.get(className) === name) {
        this.inlineState.classOwners.delete(className)
      }
      this.inlineState.keyOwners.delete(key)
      this.inlineState.classNames.delete(key)
      this.inlineState.styles.delete(key)
      this.inlineState.slotScopes.delete(key)
      this.inlineState.compoundSelectors.delete(key)
    })
    this.inlineState.inlineKeys.delete(name)
    this.inlineState.inlineConfigs.delete(name)
    this.inlineState.slots.delete(name)
    return true
  }

  /**
   * The class a recipe's base rule is emitted under, for a config recipe or an inline one.
   *
   * A config recipe carries it on its node; an inline recipe has no node, and falls back to
   * the identity it was registered under — which is exactly what `normalize` used as its
   * `className`, so the two agree by construction.
   */
  getRecipeClassName = (name: string, slot?: string): string => {
    const declared = this.getConfig(name)?.className ?? name
    return slot ? this.getSlotKey(declared, slot) : declared
  }

  getTransform = (name: string, slot?: boolean) => {
    return (variant: string, value: string) => {
      if (value === '__ignore__') {
        const state = this.inlineState.keyOwners.has(name) ? this.inlineState : sharedState
        return {
          layer: slot ? 'recipes_slots_base' : 'recipes_base',
          className: state.classNames.get(name)!,
          styles: state.styles.get(name) ?? {},
        }
      }

      const propKey = this.getPropKey(name, variant, value)
      const state = this.inlineState.keyOwners.has(propKey) ? this.inlineState : sharedState

      return {
        className: state.classNames.get(propKey)!,
        styles: state.styles.get(propKey) ?? {},
        scope: state.slotScopes.get(propKey),
        selector: state.compoundSelectors.get(propKey),
      }
    }
  }

  filterDetails = (filters?: ArtifactFilters) => {
    const recipeDiffs = filters?.affecteds?.recipes
    return recipeDiffs ? this.details.filter((recipe) => recipeDiffs.includes(recipe.dashName)) : this.details
  }

  static inferSlots = (recipe: PartialBy<SlotRecipeDefinition, 'slots'>) => {
    const slots = new Set<string>()
    Object.keys(recipe.base ?? {}).forEach((name) => {
      slots.add(name)
    })

    // `variants` nests one level deeper than `base` does: `{ size: { sm: { root: {…} } } }`.
    // Reading the keys of `{ sm: … }` collects the variant *value* as a slot, so a recipe
    // with a `size.sm` variant grew a phantom `sm` slot — and then had rules emitted for it.
    Object.values(recipe.variants ?? {}).forEach((values) => {
      Object.values(values ?? {}).forEach((slotStyles) => {
        Object.keys(slotStyles ?? {}).forEach((name) => {
          slots.add(name)
        })
      })
    })

    recipe.compoundVariants?.forEach((compoundVariant) => {
      if (!compoundVariant) return
      Object.keys(compoundVariant.css ?? {}).forEach((name) => {
        slots.add(name)
      })
    })

    return Array.from(slots)
  }

  static isValidNode = (node: unknown): node is RecipeNode => {
    return isObject(node) && 'type' in node && node.type === 'recipe'
  }
}

const sameValue = (left: unknown, right: unknown): boolean => {
  if (Object.is(left, right)) return true
  if (!left || !right || typeof left !== 'object' || typeof right !== 'object') return false
  if (Array.isArray(left) || Array.isArray(right)) {
    return (
      Array.isArray(left) &&
      Array.isArray(right) &&
      left.length === right.length &&
      left.every((value, index) => sameValue(value, right[index]))
    )
  }
  const leftRecord = left as Record<string, unknown>
  const rightRecord = right as Record<string, unknown>
  const leftKeys = Object.keys(leftRecord)
  const rightKeys = Object.keys(rightRecord)
  return (
    leftKeys.length === rightKeys.length &&
    leftKeys.every((key, index) => rightKeys[index] === key && sameValue(leftRecord[key], rightRecord[key]))
  )
}
