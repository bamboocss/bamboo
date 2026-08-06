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
   * Where a non-root slot's variant rule is emitted, keyed the same way as `styles`.
   *
   * A slot recipe's variants are chosen at the root, but the slots that react to them are
   * authored by the consumer somewhere below it — in a compound component, arbitrarily
   * deep and out of reach of any prop. Rather than deliver the variant to each slot at
   * runtime, the rule is scoped by the class the root already carries, so the slot's own
   * class stays constant.
   *
   * `to (.recipe__root)` bounds the scope at the next nested instance. Without it an outer
   * `<Tabs size="lg">` would style the triggers of an inner `<Tabs size="sm">`, and at
   * equal specificity the winner would be stylesheet order rather than proximity.
   */
  slotScopes: new Map<string, { prelude: string; selector: string }>(),
}

export class Recipes {
  slotSeparator = '__'

  keys: string[] = []

  private deprecated = new Set<string>()

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

  private getClassName = (className: string, variant: string, value: string) => {
    return `${className}--${variant}${this.separator}${value}`
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
   * The slot every other slot is nested inside, if the recipe has one.
   *
   * `scopeRoot` when it is set, otherwise a slot named `root`. By name rather than by
   * position: a recipe whose slots are siblings — `['title', 'body']` — has no ancestor to
   * scope by, and scoping one to another would emit rules that match nothing. Those keep a
   * variant class per slot.
   *
   * A `scopeRoot` naming a slot the recipe does not declare is ignored rather than
   * trusted; validation reports it.
   */
  static getRootSlot = (recipe: SlotRecipeConfig): string | undefined => {
    const declared = (recipe as { scopeRoot?: string }).scopeRoot
    if (declared) return recipe.slots.includes(declared) ? declared : undefined

    return recipe.slots.includes(ROOT_SLOT) ? ROOT_SLOT : undefined
  }

  saveOne = (name: string, recipe: RecipeConfig | SlotRecipeConfig) => {
    if (Recipes.isSlotRecipeConfig(recipe)) {
      // extract recipes for each slot
      const slots = getSlotRecipes(recipe)

      const slotsMap = new Map()
      const rootSlot = Recipes.getRootSlot(recipe)
      const rootClassName = rootSlot ? this.getSlotKey(recipe.className ?? name, rootSlot) : undefined

      // normalize each recipe
      Object.entries(slots).forEach(([slot, slotRecipe]) => {
        const slotName = this.getSlotKey(name, slot)
        this.normalize(slotName, slotRecipe, rootSlot && slot !== rootSlot ? rootClassName : undefined)
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

  getConfig = memo((name: string) => {
    return this.recipes[name]
  })

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

  normalize = (name: string, config: RecipeConfig, scopedByRootClass?: string) => {
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

        if (scopedByRootClass) {
          sharedState.slotScopes.set(propKey, {
            prelude: `@scope (.${esc(this.getClassName(scopedByRootClass, key, variantKey))}) to (.${esc(scopedByRootClass)})`,
            selector: `.${esc(recipe.className)}`,
          })
        }

        merge(recipe.variants, {
          [key]: { [variantKey]: styleObject },
        })
      }
    }

    return recipe
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
