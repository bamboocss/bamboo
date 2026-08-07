import {
  BambooError,
  capitalize,
  createRegex,
  dashCase,
  esc,
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
   * Configs for inline `cva`/`sva`, keyed by the identity derived from the config itself.
   *
   * Separate from `nodes` on purpose. `details` is `nodes`, and the generator turns every
   * entry there into a `styled-system/recipes` module — an inline recipe wants a name in
   * the stylesheet, not an artifact. The decoder resolves through `getConfig`, which reads
   * both.
   */
  inlineConfigs: new Map<string, RecipeConfig | SlotRecipeConfig>(),
  /**
   * The selector a compound variant's rule is emitted against, keyed the same way as
   * `styles`. A selector list rather than a class, because a compound selection with an
   * `OneOrMore` value covers several combinations at once.
   */
  compoundSelectors: new Map<string, string>(),
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
  slotScopes: new Map<string, Array<{ anchorVariantClass: string; anchorClass: string; slotClass: string }>>(),
}

export class Recipes {
  slotSeparator = '__'

  keys: string[] = []

  private deprecated = new Set<string>()

  /** Inline recipes this context has already normalized. See `registerInline`. */
  private inlineRegistered = new Set<string>()

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
  static getScopeRoots = (recipe: SlotRecipeConfig): string[] => {
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
      variantKeys,
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
      props: variantKeys,
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
  getConfig = (name: string): RecipeConfig | SlotRecipeConfig | undefined => {
    return this.recipes[name] ?? sharedState.inlineConfigs.get(name)
  }

  getConfigOrThrow = memo((name: string) => {
    const config = this.getConfig(name)
    if (!config) throw new BambooError('UNKNOWN_RECIPE', `Recipe "${name}" not found`)
    return config
  })

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
    return sharedState.slots.has(name)
  }

  static isSlotRecipeConfig = (config: RecipeConfig | SlotRecipeConfig): config is SlotRecipeConfig => {
    return 'slots' in config && Array.isArray(config.slots) && config.slots.length > 0
  }

  normalize = (name: string, config: RecipeConfig, scopedByAnchorClasses?: string[]) => {
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

    sharedState.styles.set(name, recipe.base)
    sharedState.classNames.set(name, recipe.className)

    for (const [key, variant] of Object.entries(variants)) {
      for (const [variantKey, styles] of Object.entries(variant)) {
        const propKey = this.getPropKey(name, key, variantKey)
        const className = this.getClassName(recipe.className, key, variantKey)

        const styleObject = transformStyles(this.context, styles, className)

        sharedState.styles.set(propKey, styleObject)
        sharedState.classNames.set(propKey, className)

        if (scopedByAnchorClasses?.length) {
          // Stored raw. `hash.className` and `prefix` are applied by the decoder's
          // `formatSelector`, and building the selector here skipped both — so under either
          // option the prelude named an anchor class no element carried and the rule
          // selected a slot class the runtime never returned. Every non-anchor slot then
          // rendered unstyled, silently.
          sharedState.slotScopes.set(
            propKey,
            scopedByAnchorClasses.map((anchorClass) => ({
              anchorVariantClass: this.getClassName(anchorClass, key, variantKey),
              anchorClass,
              slotClass: recipe.className,
            })),
          )
        } else {
          // Cleared rather than left alone. This map is module-global and outlives a
          // context, so a recipe that *stops* being scoped — `scopeRoots` removed in a
          // watch rebuild — would otherwise keep emitting rules under an anchor nothing
          // renders any more.
          sharedState.slotScopes.delete(propKey)
        }

        merge(recipe.variants, {
          [key]: { [variantKey]: styleObject },
        })
      }
    }

    compoundVariants.forEach((compoundVariant, index) => {
      if (!compoundVariant?.css) return

      const selectors = compoundSelections(compoundVariant)
        .map((combination) =>
          combination
            .map(([variant, value]) => `.${esc(this.getClassName(recipe.className, variant, value))}`)
            .join(''),
        )
        .filter(Boolean)

      if (!selectors.length) return

      const propKey = this.getPropKey(name, COMPOUND_VARIANT, index)
      // Never reaches the DOM — the rule selects on the variant classes the element already
      // carries. This only has to be stable and distinct, so the decoder can key on it.
      const className = `${recipe.className}--compound${this.separator}${index}`

      sharedState.styles.set(propKey, transformStyles(this.context, compoundVariant.css, className))
      sharedState.classNames.set(propKey, className)
      sharedState.compoundSelectors.set(propKey, selectors.join(', '))
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
   * Nothing prunes these: `prune` walks `nodes`, which this does not touch. That is bounded
   * rather than unbounded, because the name is a hash of the config — a rebuild of an
   * unchanged recipe writes the same key rather than a new one.
   */
  registerInline = (name: string, config: RecipeConfig | SlotRecipeConfig) => {
    // Guarded per instance, not on the module-global map. Class names depend on `hash`,
    // `prefix` and `separator`, so two contexts with different configs derive different
    // ones from the same recipe — and a guard on the shared map would let the second reuse
    // the first's, emitting rules under names its own runtime never asks for.
    if (this.inlineRegistered.has(name)) return
    this.inlineRegistered.add(name)
    sharedState.inlineConfigs.set(name, config)

    if (Recipes.isSlotRecipeConfig(config)) {
      const anchors = Recipes.getScopeRoots(config)
      const anchorClassNames = anchors.map((slot) => this.getSlotKey(config.className ?? name, slot))
      const slotsMap = new Map<string, RecipeConfig>()

      // The identity has to be the className before the split. `getSlotRecipes` builds each
      // slot's class as `className__slot`, and with no className that collapses to the bare
      // slot name — `root` rather than `sva_hAcRla__root`, which would collide with every
      // other anonymous recipe that happens to have a slot called `root`. The runtime's
      // `sva` injects it the same way, for the same reason.
      const withName = { ...config, className: config.className ?? name }

      Object.entries(getSlotRecipes(withName)).forEach(([slot, slotRecipe]) => {
        const slotName = this.getSlotKey(name, slot)
        this.normalize(slotName, slotRecipe, anchors.includes(slot) ? [] : anchorClassNames)
        slotsMap.set(slotName, slotRecipe)
      })

      // `isSlotRecipe` is this map, and the decoder branches on it to expand a variant
      // hash across slots. Without it an inline `sva` decodes as a plain recipe and every
      // slot but the first is dropped.
      sharedState.slots.set(name, slotsMap)
      return
    }

    this.normalize(name, config)
  }

  /**
   * The class a recipe's base rule is emitted under, for a config recipe or an inline one.
   *
   * A config recipe carries it on its node; an inline recipe has no node, and falls back to
   * the identity it was registered under — which is exactly what `normalize` used as its
   * `className`, so the two agree by construction.
   */
  getRecipeClassName = (name: string, slot?: string): string => {
    const declared = sharedState.nodes.get(name)?.className ?? sharedState.inlineConfigs.get(name)?.className ?? name
    return slot ? this.getSlotKey(declared, slot) : declared
  }

  getTransform = (name: string, slot?: boolean) => {
    return (variant: string, value: string) => {
      if (value === '__ignore__') {
        return {
          layer: slot ? 'recipes_slots_base' : 'recipes_base',
          className: sharedState.classNames.get(name)!,
          styles: sharedState.styles.get(name) ?? {},
        }
      }

      const propKey = this.getPropKey(name, variant, value)

      return {
        className: sharedState.classNames.get(propKey)!,
        styles: sharedState.styles.get(propKey) ?? {},
        scope: sharedState.slotScopes.get(propKey),
        selector: sharedState.compoundSelectors.get(propKey),
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
