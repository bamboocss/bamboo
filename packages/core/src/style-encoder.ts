import {
  BambooError,
  getOrCreateSet,
  getRecipeIdentity,
  getSlotCompoundVariant,
  isObjectOrArray,
  normalizeStyleObject,
  traverse,
  uniq,
  viewTransitionClassName,
  viewTransitionSlots,
} from '@bamboocss/shared'
import type {
  Dict,
  EncoderJson,
  PartialBy,
  RecipeConfig,
  RecipeDefinition,
  ResultItem,
  SlotRecipeDefinition,
  StyleEntry,
  StyleProps,
  StyleResultObject,
} from '@bamboocss/types'
import { version } from '../package.json'
import type { Context } from './context'
import { COMPOUND_VARIANT, Recipes } from './recipes'

const urlRegex = /^https?:\/\//

/**
 * The subset of an encoder's work that a single `process*` call is responsible for.
 *
 * The encoder accumulates across calls — that is what lets one stylesheet be built
 * from many sources. A caller that wants the class names for *its* styles (rather
 * than for everything encoded so far) records a scope and resolves it against the
 * decoder. See `StyleDecoder.filterClassNames`.
 *
 * Membership is recorded even when the underlying hash was already present, since
 * the class name still belongs to this call's result.
 */
export interface EncoderScope {
  atomic: Set<string>
  /** recipe name -> variant hashes contributed by this call */
  recipes: Map<string, Set<string>>
  /** recipe keys (`name` or `name{slotSeparator}slot`) whose base belongs to this call */
  recipes_base: Set<string>
}

const createScope = (): EncoderScope => ({
  atomic: new Set(),
  recipes: new Map(),
  recipes_base: new Set(),
})

const mergeScope = (target: EncoderScope, source: EncoderScope) => {
  source.atomic.forEach((hash) => target.atomic.add(hash))
  source.recipes_base.forEach((key) => target.recipes_base.add(key))
  source.recipes.forEach((hashes, name) => {
    const set = getOrCreateSet(target.recipes, name)
    hashes.forEach((hash) => set.add(hash))
  })
}

export class StyleEncoder {
  static separator = ']___['
  static conditionSeparator = '<___>'

  atomic = new Set<string>()
  compound_variants = new Set<string>()
  //
  recipes = new Map<string, Set<string>>()
  recipes_base = new Map<string, Set<string>>()

  /**
   * Bag class -> the slot styles behind it.
   *
   * Keyed by class rather than hashed per declaration like everything above: a bag emits
   * whole rules against `::view-transition-*` pseudo-elements, which no atomic class can
   * carry, so there is nothing to deduplicate at the property level. Keying by the class
   * is what collapses two calls that wrote the same options.
   */
  view_transitions = new Map<string, StyleResultObject>()

  /**
   * Scope being recorded by the innermost `withScope` on the stack, if any.
   * Encoding is synchronous, so a single field is enough to thread this through
   * nested `process*` calls without changing their signatures.
   */
  private activeScope: EncoderScope | null = null

  /**
   * Run `fn` and report the work it encoded. Nested scopes merge into their parent,
   * so `processAtomicRecipe` recording through `processAtomic` still attributes
   * every hash to the outer call.
   */
  withScope = (fn: () => void): EncoderScope => {
    const parent = this.activeScope
    const scope = createScope()
    this.activeScope = scope
    try {
      fn()
    } finally {
      this.activeScope = parent
    }
    if (parent) mergeScope(parent, scope)
    return scope
  }

  constructor(private context: Pick<Context, 'isValidProperty' | 'recipes' | 'patterns' | 'conditions' | 'utility'>) {}

  filterStyleProps = (props: Dict): Dict => {
    return filterProps(this.context.isValidProperty, props)
  }

  clone = () => {
    return new StyleEncoder(this.context)
  }

  isEmpty = () => {
    return (
      !this.atomic.size &&
      !this.recipes.size &&
      !this.compound_variants.size &&
      !this.recipes_base.size &&
      !this.view_transitions.size
    )
  }

  get results() {
    return {
      atomic: this.atomic,
      recipes: this.recipes,
      recipes_base: this.recipes_base,
      view_transitions: this.view_transitions,
    }
  }
  /**
   * Hashes a style object and adds the resulting hashes to a set.
   * @param set - The set to add the resulting hashes to.
   * @param obj - The style object to hash.
   * @param baseEntry - An optional base style entry to use when hashing the style object.
   */
  hashStyleObject = (
    set: Set<string>,
    obj: ResultItem['data'][number],
    baseEntry?: Partial<Omit<StyleEntry, 'prop' | 'value' | 'cond'>>,
  ) => {
    const isCondition = this.context.conditions.isCondition
    const traverseOptions = { separator: StyleEncoder.conditionSeparator }

    // Is the final (leading to a raw value, not an object) property a condition ?
    // mx: { base: { p: 4, _hover: 5 } }
    //                            ^^^
    let prop = ''
    let prevProp = ''

    // { mx: 4 } => { marginX: 4 }
    const isRecipe = !!baseEntry?.variants
    const normalized = normalizeStyleObject(obj, this.context, !isRecipe)

    traverse(
      normalized,
      ({ key, value: rawValue, path }) => {
        if (rawValue === undefined) {
          return
        }

        // we don't want to extract and generate invalid CSS for urls
        if (urlRegex.test(rawValue)) {
          return
        }

        const value = rawValue

        prop = key

        // { _hover: { ... } }
        //   ^^^^^^
        if (isCondition(key)) {
          // { _hover: { ... } }
          //           ^^^^^^^
          if (isObjectOrArray(value)) {
            return
          }

          // { _hover: { base: 4 } }
          //             ^^^^^^^
          prop = prevProp
        } else if (isObjectOrArray(value)) {
          // { mx: { base: 4 } }
          //       ^^^^^^^^^^^
          prevProp = prop
          return
        }
        const resolvedCondition = getResolvedCondition(path, isCondition)

        const hashed = hashStyleEntry(Object.assign(baseEntry ?? {}, { prop, value, cond: resolvedCondition }))
        set.add(hashed)

        prevProp = prop
      },
      traverseOptions,
    )
  }

  processAtomic = (styles: StyleResultObject) => {
    const scope = this.activeScope
    if (!scope) {
      this.hashStyleObject(this.atomic, styles)
      return
    }

    // Hash into a local set first, so this call's contribution stays separable from
    // whatever the encoder already holds.
    const set = new Set<string>()
    this.hashStyleObject(set, styles)
    set.forEach((hash) => {
      this.atomic.add(hash)
      scope.atomic.add(hash)
    })
  }

  /**
   * Record a `viewTransition({ ... })` bag.
   *
   * The class is derived from the options alone, by the same function the generated
   * runtime calls, so the class the build emits CSS for is the class the call returns.
   */
  processViewTransition = (options: unknown) => {
    if (!options || typeof options !== 'object') return

    const slots: StyleResultObject = {}
    for (const slot of viewTransitionSlots) {
      const value = (options as StyleResultObject)[slot]
      // Nullish is dropped on the hashing side too, so skipping it here cannot make the
      // build disagree with the runtime about which class this call returns.
      if (value == null) continue
      // The emit path serializes a slot body whole rather than atomizing it, so it never
      // reaches the normalizing the atomic path does on the way in — which is where a
      // shorthand is renamed to its longhand and a nullish leaf is dropped.
      slots[slot] = normalizeStyleObject(value as StyleResultObject, this.context)
    }

    if (!Object.keys(slots).length) return

    this.view_transitions.set(viewTransitionClassName(options, this.context.utility.prefix), slots)
  }

  processStyleProps = (styleProps: StyleProps) => {
    const processFn = this.processAtomic
    const styles = this.filterStyleProps(styleProps)
    const rest = {} as Dict

    for (const [key, value] of Object.entries(styles)) {
      // css and *Css props (e.g. inputCss, wrapperCss) are style objects
      if (key === 'css' || key.endsWith('Css')) {
        if (Array.isArray(value)) {
          value.forEach((style) => processFn(style))
        } else if (value) {
          processFn(value)
        }
      } else {
        rest[key] = value
      }
    }

    processFn(rest)
  }

  processConfigSlotRecipeBase = (recipeName: string, config: SlotRecipeDefinition) => {
    config.slots.forEach((slot) => {
      const recipeKey = this.context.recipes.getSlotKey(recipeName, slot)

      const slotBase = config.base?.[slot]
      if (!slotBase) return

      // Record before the early return: the base class belongs to this call's result
      // whether or not this call is the one that encoded it.
      this.activeScope?.recipes_base.add(recipeKey)
      if (this.recipes_base.has(recipeKey)) return

      const base_set = getOrCreateSet(this.recipes_base, recipeKey)
      this.hashStyleObject(base_set, slotBase, { recipe: recipeName, slot })
    })
  }

  processConfigSlotRecipe = (recipeName: string, variants: Record<string, any>, unresolved?: Set<string>) => {
    const config = this.context.recipes.getConfig(recipeName)
    if (!config || !Recipes.isSlotRecipeConfig(config)) return

    // process base styles
    this.processConfigSlotRecipeBase(recipeName, config)

    // process variants
    const computedVariants = Object.assign({}, config.defaultVariants, variants)
    this.hashVariants(recipeName, computedVariants, { recipe: recipeName, variants: true })

    // See `processConfigRecipe`: a slot recipe names a class per slot, so an axis the call site
    // left dynamic leaves *every* slot short rather than one.
    this.hashUnresolvedVariants(recipeName, config.variants, unresolved, { recipe: recipeName, variants: true })

    // process compound variants
    if (!config.compoundVariants || this.compound_variants.has(recipeName)) return
    this.compound_variants.add(recipeName)
    this.hashCompoundVariants(
      recipeName,
      config.compoundVariants as Array<Record<string, any>>,
      config.slots as string[],
    )
  }

  /**
   * Hash a recipe's compound variants, one synthetic variant per compound.
   *
   * Deliberately *not* recorded on the active scope, unlike every other hash here. A
   * compound rule selects on the variant classes the element already carries —
   * `.btn--size_sm.btn--tone_a` — so it contributes no class of its own, and `scope` is
   * what `filterClassNames` reads to answer "which classes does this call return". Putting
   * it there would hand the runtime a class no element ever gets, and the fold would bake
   * that into a literal.
   *
   * Slot recipes hash per slot, through the same `getSlotCompoundVariant` that `normalize`
   * used. It filters out compounds that do not touch a slot, so both sides have to walk the
   * filtered list or the indices they key on stop lining up.
   */
  private hashCompoundVariants = (
    recipeName: string,
    compoundVariants: Array<Record<string, any>>,
    slots?: string[],
  ) => {
    const hash = (list: Array<Record<string, any>>, slot?: string) => {
      const set = getOrCreateSet(this.recipes, recipeName)
      list.forEach((compoundVariant, index) => {
        if (!compoundVariant?.css) return
        this.hashStyleObject(set, { [COMPOUND_VARIANT]: index }, { recipe: recipeName, slot, variants: true })
      })
    }

    if (!slots) {
      hash(compoundVariants)
      return
    }

    slots.forEach((slot) => hash(getSlotCompoundVariant(compoundVariants as Array<{ css: any }>, slot), slot))
  }

  /**
   * Hash a recipe's computed variants into the shared per-recipe set, recording the
   * hashes this call contributed when a scope is active.
   */
  private hashVariants = (
    recipeName: string,
    computedVariants: Record<string, any>,
    baseEntry: Partial<Omit<StyleEntry, 'prop' | 'value' | 'cond'>>,
  ) => {
    const set = getOrCreateSet(this.recipes, recipeName)
    const scope = this.activeScope

    if (!scope) {
      this.hashStyleObject(set, computedVariants, baseEntry)
      return
    }

    const local = new Set<string>()
    this.hashStyleObject(local, computedVariants, baseEntry)

    const scoped = getOrCreateSet(scope.recipes, recipeName)
    local.forEach((hash) => {
      set.add(hash)
      scoped.add(hash)
    })
  }

  processConfigRecipeBase = (recipeName: string, config: RecipeConfig) => {
    if (!config.base) return

    // Record before the early return, for the same reason as the slot variant.
    this.activeScope?.recipes_base.add(recipeName)
    if (this.recipes_base.has(recipeName)) return

    const base_set = getOrCreateSet(this.recipes_base, recipeName)
    this.hashStyleObject(base_set, config.base, { recipe: recipeName })
  }

  processConfigRecipe = (recipeName: string, variants: Record<string, any>, unresolved?: Set<string>) => {
    const config = this.context.recipes.getConfig(recipeName)
    if (!config) return

    // process base styles
    this.processConfigRecipeBase(recipeName, config)

    // process variants
    const computedVariants = Object.assign({}, config.defaultVariants, variants)
    this.hashVariants(recipeName, computedVariants, { recipe: recipeName, variants: true })

    // An axis the call site did not name statically — `button({ size: props.size })`. The
    // selection carries no value for it, so the loop above emits only the default's rule and
    // the runtime then asks for `button--size_sm`, which nothing backs. A class on an element
    // with no rule behind it is silently unstyled, which is the failure the comment on
    // `hashInlineRecipe` describes and which the inline path avoids by emitting every declared
    // value. This does the same, for the axes that need it.
    //
    // Narrower than the inline rule, deliberately: only an axis some call site left dynamic is
    // enumerated, so a project whose recipe calls are all static emits exactly what it did
    // before.
    this.hashUnresolvedVariants(recipeName, config.variants, unresolved, { recipe: recipeName, variants: true })

    // process compound variants
    if (!config.compoundVariants || this.compound_variants.has(recipeName)) return
    this.compound_variants.add(recipeName)
    this.hashCompoundVariants(recipeName, config.compoundVariants as Array<Record<string, any>>)
  }

  /**
   * `unresolved` names the variant axes the call site passed but the build could not read.
   * Absent from the selection is indistinguishable from never passed — `button({ size })` and
   * `button()` both arrive as `{}` — so the parser has to say which it was.
   */
  processRecipe = (recipeName: string, variants: Record<string, any>, unresolved?: Set<string>) => {
    if (this.context.recipes.isSlotRecipe(recipeName)) {
      this.processConfigSlotRecipe(recipeName, variants, unresolved)
    } else {
      this.processConfigRecipe(recipeName, variants, unresolved)
    }
  }

  /** Every value a dynamic axis can take, so no call site can name a class with no rule. */
  private hashUnresolvedVariants = (
    recipeName: string,
    variants: Record<string, Record<string, any>> | undefined,
    unresolved: Set<string> | undefined,
    baseEntry: Partial<Omit<StyleEntry, 'prop' | 'value' | 'cond'>>,
  ) => {
    if (!unresolved?.size || !variants) return

    for (const key of unresolved) {
      // `hasOwn`, so a key of `toString` or `__proto__` does not reach `Object.prototype` and
      // enumerate nothing.
      if (!Object.hasOwn(variants, key)) continue

      for (const value of Object.keys(variants[key] ?? {})) {
        this.hashVariants(recipeName, { [key]: value }, baseEntry)
      }
    }
  }

  processRecipeBase(recipeName: string) {
    const config = this.context.recipes.getConfig(recipeName)
    if (!config) return

    if (this.context.recipes.isSlotRecipe(recipeName)) {
      this.processConfigSlotRecipeBase(recipeName, config as any)
    } else {
      this.processConfigRecipeBase(recipeName, config)
    }
  }

  processPattern = (name: string, patternProps: StyleResultObject) => {
    // A pattern is a `css()` call with the transform already applied — `css(stackStyles(props))`.
    this.processStyleProps(this.context.patterns.transform(name, patternProps))
  }

  /**
   * An inline `cva`, emitted the way a config recipe is: `name--size_sm` in the `recipes`
   * layer rather than atomic classes in `utilities`.
   *
   * The two differ only in where the name comes from — a config recipe is named by the key
   * it is declared under, an inline one by `getRecipeIdentity` — so a consumer's `css()`
   * wins by cascade layer against either.
   *
   * Every variant value is hashed, not just the ones some call site selected. A config
   * recipe can emit only what is used because its call sites name their variants
   * statically; an inline recipe's `button({ size: props.size })` does not, and a rule the
   * build declined to emit is an element with no styles rather than a missing override.
   */
  processAtomicRecipe = (recipe: Pick<RecipeDefinition, 'base' | 'variants' | 'compoundVariants' | 'className'>) => {
    const name = getRecipeIdentity(recipe)
    this.context.recipes.registerInline(name, recipe as RecipeConfig)
    this.hashInlineRecipe(name, recipe)
  }

  private hashInlineRecipe = (
    name: string,
    recipe: Pick<RecipeDefinition, 'base' | 'variants' | 'compoundVariants'>,
    slots?: string[],
  ) => {
    const { base, variants = {}, compoundVariants = [] } = recipe

    if (base) {
      this.activeScope?.recipes_base.add(name)
      if (!this.recipes_base.has(name)) {
        this.hashStyleObject(getOrCreateSet(this.recipes_base, name), base, { recipe: name })
      }
    }

    for (const [variantKey, values] of Object.entries(variants)) {
      for (const variantValue of Object.keys(values ?? {})) {
        this.hashVariants(name, { [variantKey]: variantValue }, { recipe: name, variants: true })
      }
    }

    if (compoundVariants.length) {
      this.hashCompoundVariants(name, compoundVariants as Array<Record<string, any>>, slots)
    }
  }

  processAtomicSlotRecipe = (recipe: PartialBy<SlotRecipeDefinition, 'slots'>) => {
    const inferredSlots = Recipes.inferSlots(recipe)

    // Copied rather than assigned back. `recipe` is the extractor's own `ResultItem.data`,
    // and writing to it left the config permanently changed for everything downstream —
    // including anything deriving an identity from it, which would then digest a config the
    // runtime never had.
    const withSlots = Object.assign({}, recipe, {
      slots: uniq([...(recipe.slots ?? []), ...inferredSlots].filter(Boolean)),
    })

    // Hashed from the config as written, not from `withSlots`. The runtime derives the same
    // identity from the same object, and it does not infer slots — so hashing the inferred
    // set here gave the two sides different names, and an `sva` that omits `slots` rendered
    // with no styles at all.
    const name = getRecipeIdentity(recipe, 'sva')
    this.context.recipes.registerInline(name, withSlots as never)

    // Base is per slot, so each gets its own `name__slot` rule. Variants are hashed against
    // the recipe rather than against each slot, the way `processConfigSlotRecipe` does it —
    // the decoder is what expands a variant across slots, and doing it here too would emit
    // every slot's rule once per slot.
    this.processConfigSlotRecipeBase(name, withSlots as SlotRecipeDefinition)
    this.hashInlineRecipe(
      name,
      {
        compoundVariants: withSlots.compoundVariants as never,
        variants: withSlots.variants as never,
      },
      withSlots.slots,
    )
  }

  getConfigRecipeHash = (recipeName: string) => {
    return {
      atomic: this.atomic,
      base: this.recipes_base.get(recipeName)!,
      variants: this.recipes.get(recipeName)!,
    }
  }

  getConfigSlotRecipeHash = (recipeName: string) => {
    const recipeConfig = this.context.recipes.getConfigOrThrow(recipeName)

    if (!Recipes.isSlotRecipeConfig(recipeConfig)) {
      throw new BambooError('INVALID_RECIPE', `Recipe "${recipeName}" is not a slot recipe`)
    }

    const base: Dict = {}

    recipeConfig.slots.map((slot) => {
      const recipeKey = this.context.recipes.getSlotKey(recipeName, slot)
      base[slot] = this.recipes_base.get(recipeKey)!
    })

    return {
      atomic: this.atomic,
      base,
      variants: this.recipes.get(recipeName)!,
    }
  }

  getRecipeHash = (recipeName: string) => {
    if (this.context.recipes.isSlotRecipe(recipeName)) {
      return this.getConfigSlotRecipeHash(recipeName)
    }

    return this.getConfigRecipeHash(recipeName)
  }

  toJSON = () => {
    const styles: Record<string, any> = {
      atomic: Array.from(this.atomic),
      recipes: Object.fromEntries(Array.from(this.recipes.entries()).map(([name, set]) => [name, Array.from(set)])),
    }

    // The slot styles, not a hash: the class is already the key, and rebuilding the rule
    // bodies from hashed declarations is not something the decoder can do for a pseudo
    // element it never atomized.
    if (this.view_transitions.size) {
      styles.viewTransitions = Object.fromEntries(this.view_transitions)
    }

    return {
      schemaVersion: version,
      styles,
    }
  }

  fromJSON = (json: EncoderJson) => {
    const { styles } = json

    // process atomic styles + compound variants
    styles.atomic?.forEach((hash) => this.atomic.add(hash))

    Object.entries(styles.recipes ?? {}).forEach(([recipeName, hashes]) => {
      // process base styles
      this.processRecipeBase(recipeName)
      // process variants hashes
      const set = getOrCreateSet(this.recipes, recipeName)
      hashes.forEach((hash) => set.add(hash))
    })

    // Keyed by the finalized class, so this restores the prefix the producing build
    // applied rather than re-deriving it from the consuming config.
    Object.entries(styles.viewTransitions ?? {}).forEach(([className, slots]) => {
      this.view_transitions.set(className, slots)
    })

    return this
  }
}

const filterProps = (isValidProperty: (key: string) => boolean, props: Dict) => {
  const clone = {} as Dict
  for (const [key, value] of Object.entries(props)) {
    if ((isValidProperty(key) || key === 'css' || key.endsWith('Css')) && value !== undefined) {
      clone[key] = value
    }
  }
  return clone
}

const hashStyleEntry = (entry: StyleEntry) => {
  const parts = [`${entry.prop}${StyleEncoder.separator}value:${entry.value}`]

  if (entry.cond) {
    parts.push(`cond:${entry.cond}`)
  }

  if (entry.recipe) {
    parts.push(`recipe:${entry.recipe}`)
  }

  if (entry.layer) {
    parts.push(`layer:${entry.layer}`)
  }

  if (entry.slot) {
    parts.push(`slot:${entry.slot}`)
  }

  return parts.join(StyleEncoder.separator)
}

/**
 * Returns the final condition string after filtering out irrelevant parts. ('base' and props)
 * @example
 * 'marginTop<___>md' => 'md'
 * 'marginTop<___>md<___>lg' => 'md<___>lg'
 * '_hover' => '_hover'
 * '& > p<___>base', => '& > p'
 * '@media base' => '@media base'
 * '_hover<___>base<___>_dark' => '_hover<___>_dark'
 *
 */
const getResolvedCondition = (cond: string, isCondition: (key: string) => boolean): string => {
  if (!cond) {
    return ''
  }

  const parts = cond.split(StyleEncoder.conditionSeparator)
  const relevantParts = parts.filter((part) => part !== 'base' && isCondition(part))

  if (parts.length !== relevantParts.length) {
    return relevantParts.join(StyleEncoder.conditionSeparator)
  }

  return cond
}
