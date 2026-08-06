import {
  BambooError,
  getOrCreateSet,
  getSlotRecipes,
  isObjectOrArray,
  mergeProps,
  normalizeStyleObject,
  toResponsiveObject,
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
  ResultItem,
  SlotRecipeDefinition,
  StyleEntry,
  StyleProps,
  StyleResultObject,
} from '@bamboocss/types'
import { version } from '../package.json'
import type { Context } from './context'
import { Recipes } from './recipes'

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
  grouped: Set<string>
  /** recipe name -> variant hashes contributed by this call */
  recipes: Map<string, Set<string>>
  /** recipe keys (`name` or `name{slotSeparator}slot`) whose base belongs to this call */
  recipes_base: Set<string>
}

const createScope = (): EncoderScope => ({
  atomic: new Set(),
  grouped: new Set(),
  recipes: new Map(),
  recipes_base: new Set(),
})

const mergeScope = (target: EncoderScope, source: EncoderScope) => {
  source.atomic.forEach((hash) => target.atomic.add(hash))
  source.grouped.forEach((id) => target.grouped.add(id))
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
  grouped = new Map<string, Set<string>>()

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
      !this.grouped.size &&
      !this.view_transitions.size
    )
  }

  get results() {
    return {
      atomic: this.atomic,
      recipes: this.recipes,
      recipes_base: this.recipes_base,
      grouped: this.grouped,
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

        // { mx: [1, 2, 3] } => { mx: { base: 1, sm: 2, md: 3 } }
        const value = Array.isArray(rawValue)
          ? toResponsiveObject(rawValue, this.context.conditions.breakpoints.keys)
          : rawValue

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
   * Group several style objects as the one call the runtime will make of them.
   *
   * `css(a, b)` and a reconstructed ternary branch are both several objects that become a
   * single class, and the runtime names that class off `mergeCss(a, b)` — which normalizes
   * each operand and *then* deep-merges. Combining them any other way names a different
   * class: `Object.assign` keeps only the last of two condition objects under a shared key,
   * and merging before normalizing lets `p` and `padding` survive as two properties when
   * the runtime has already collapsed them into one.
   *
   * Shared with `processStyleProps`, which folds a `css` prop into an element's style props
   * for exactly the same reason.
   */
  processGroupedMerge = (styles: StyleResultObject[]) => {
    if (styles.length === 1) return this.processGrouped(styles[0] as StyleResultObject)
    this.processGrouped(mergeProps(...styles.map((style) => normalizeStyleObject(style, this.context))))
  }

  processGrouped = (styles: StyleResultObject) => {
    const groupSet = new Set<string>()
    this.hashStyleObject(groupSet, styles)

    if (groupSet.size === 0) return

    const sortedHashes = Array.from(groupSet).sort()
    const groupId = sortedHashes.join('|')

    this.activeScope?.grouped.add(groupId)

    const existing = this.grouped.get(groupId)
    if (existing) return

    this.grouped.set(groupId, groupSet)
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
      // reaches the normalizing the atomic path does on the way in. Without this a
      // responsive array stays an array, and `serializeStyles` walks it into `0:`/`1:`
      // declarations instead of a breakpoint object.
      slots[slot] = normalizeStyleObject(value as StyleResultObject, this.context)
    }

    if (!Object.keys(slots).length) return

    this.view_transitions.set(viewTransitionClassName(options, this.context.utility.prefix), slots)
  }

  processStyleProps = (styleProps: StyleProps, grouped = false) => {
    const processFn = grouped ? this.processGrouped : this.processAtomic
    const styles = this.filterStyleProps(styleProps)
    const rest = {} as Dict

    // Grouped mode names a class after a whole `css()` call, and the JSX factory makes one:
    // `css(propStyles, cssStyles)`. Hashing the `css` prop apart from the rest would name a
    // class the runtime never asks for, leaving the element with no styles at all. A `*Css`
    // prop is a different slot's element and keeps its own call.
    const ownCss: Dict[] = []

    for (const [key, value] of Object.entries(styles)) {
      // css and *Css props (e.g. inputCss, wrapperCss) are style objects
      if (key === 'css' || key.endsWith('Css')) {
        const mergesWithRest = grouped && key === 'css'
        if (Array.isArray(value)) {
          value.forEach((style) => (mergesWithRest ? ownCss.push(style) : processFn(style)))
        } else if (value) {
          mergesWithRest ? ownCss.push(value) : processFn(value)
        }
      } else {
        rest[key] = value
      }
    }

    // Mirror `mergeCss` exactly: normalize each operand, *then* deep-merge. Merging raw and
    // normalizing once afterwards is not the same function — `p` and `padding` only collide
    // after normalization, and `walkObject` assigns rather than merges when it renames, so
    // one of the two would be dropped from the stylesheet entirely. `Object.assign` is wrong
    // for the same reason one level up: a shared key holding a condition object would keep
    // only whichever came last.
    processFn(
      ownCss.length ? mergeProps(...[rest, ...ownCss].map((style) => normalizeStyleObject(style, this.context))) : rest,
    )
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

  processConfigSlotRecipe = (recipeName: string, variants: Record<string, any>) => {
    const config = this.context.recipes.getConfig(recipeName)
    if (!Recipes.isSlotRecipeConfig(config)) return

    // process base styles
    this.processConfigSlotRecipeBase(recipeName, config)

    // process variants
    const computedVariants = Object.assign({}, config.defaultVariants, variants)
    this.hashVariants(recipeName, computedVariants, { recipe: recipeName, variants: true })

    // process compound variants
    if (!config.compoundVariants || this.compound_variants.has(recipeName)) return
    this.compound_variants.add(recipeName)
    config.compoundVariants.forEach((compoundVariant) => {
      if (!compoundVariant) return
      Object.values(compoundVariant.css).forEach((values) => {
        if (!values) return
        this.processAtomic(values)
      })
    })
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

  processConfigRecipe = (recipeName: string, variants: Record<string, any>) => {
    const config = this.context.recipes.getConfig(recipeName)
    if (!config) return

    // process base styles
    this.processConfigRecipeBase(recipeName, config)

    // process variants
    const computedVariants = Object.assign({}, config.defaultVariants, variants)
    this.hashVariants(recipeName, computedVariants, { recipe: recipeName, variants: true })

    // process compound variants
    if (!config.compoundVariants || this.compound_variants.has(recipeName)) return
    this.compound_variants.add(recipeName)
    config.compoundVariants.forEach((compoundVariant) => {
      if (!compoundVariant) return
      this.processAtomic(compoundVariant.css)
    })
  }

  processRecipe = (recipeName: string, variants: Record<string, any>) => {
    if (this.context.recipes.isSlotRecipe(recipeName)) {
      this.processConfigSlotRecipe(recipeName, variants)
    } else {
      this.processConfigRecipe(recipeName, variants)
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

  processPattern = (name: string, patternProps: StyleResultObject, grouped = false) => {
    const styleProps = this.context.patterns.transform(name, patternProps)
    // A pattern is a `css()` call with the transform already applied — `css(stackStyles(props))` —
    // so grouped mode names it the same way it names any other one.
    this.processStyleProps(styleProps, grouped)
  }

  processAtomicRecipe = (recipe: Pick<RecipeConfig, 'base' | 'variants' | 'compoundVariants'>) => {
    const { base = {}, variants = {}, compoundVariants = [] } = recipe

    this.processAtomic(base)

    for (const variant of Object.values(variants)) {
      for (const styles of Object.values(variant)) {
        this.processAtomic(styles)
      }
    }

    compoundVariants.forEach((compoundVariant) => {
      if (!compoundVariant) return
      this.processAtomic(compoundVariant.css)
    })
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

    const slots = getSlotRecipes(withSlots)

    for (const slotRecipe of Object.values(slots)) {
      this.processAtomicRecipe(slotRecipe)
    }
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

    if (this.grouped.size) {
      styles.grouped = Object.fromEntries(Array.from(this.grouped.entries()).map(([id, set]) => [id, Array.from(set)]))
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

    Object.entries(styles.grouped ?? {}).forEach(([groupId, hashes]) => {
      const set = getOrCreateSet(this.grouped, groupId)
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
