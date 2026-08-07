import {
  BambooError,
  deepSet,
  esc,
  getOrCreateSet,
  groupClassName,
  isImportant,
  markImportant,
  viewTransitionPseudo,
  viewTransitionSlots,
  withoutImportant,
} from '@bamboocss/shared'
import type {
  AtomicStyleResult,
  ConditionDetails,
  Dict,
  GroupedResult,
  GroupedStyleResultDetails,
  MultiBlockCondition,
  RecipeBaseResult,
  StyleEntry,
  StyleResultObject,
  ViewTransitionResult,
} from '@bamboocss/types'
import type { Context } from './context'
import { sortStyleRules } from './sort-style-rules'
import { type EncoderScope, StyleEncoder } from './style-encoder'

import { Recipes } from './recipes'

export class StyleDecoder {
  constructor(private context: Pick<Context, 'conditions' | 'utility' | 'recipes' | 'hash'>) {}

  classNames = new Map<string, AtomicStyleResult | RecipeBaseResult | GroupedResult>()
  //
  atomic_cache = new Map<string, AtomicStyleResult>()
  group_cache = new Map<string, GroupedResult>()
  recipe_base_cache = new Map<string, RecipeBaseResult>()
  //
  atomic = new Set<AtomicStyleResult>()
  grouped = new Set<GroupedResult>()
  //
  recipes = new Map<string, Set<AtomicStyleResult>>()
  recipes_base = new Map<string, Set<RecipeBaseResult>>()
  //
  view_transitions = new Set<ViewTransitionResult>()

  clone = () => {
    return new StyleDecoder(this.context)
  }

  isEmpty = () => {
    return (
      !this.atomic.size &&
      !this.grouped.size &&
      !this.recipes.size &&
      !this.recipes_base.size &&
      !this.view_transitions.size
    )
  }

  get results() {
    return {
      atomic: this.atomic,
      grouped: this.grouped,
      recipes: this.recipes,
      recipes_base: this.recipes_base,
      view_transitions: this.view_transitions,
    }
  }

  private formatSelector = (conditions: string[], className: string) => {
    const { conditions: cond, hash, utility } = this.context

    const conds = cond.finalize(conditions)
    let result: string

    if (hash.className) {
      conds.push(className)
      result = utility.formatClassName(utility.toHash(conds, utility.defaultHashFn))
    } else {
      conds.push(utility.formatClassName(className))
      result = conds.join(':')
    }

    return esc(result)
  }

  private getRecipeName = (hash: string) => {
    const entry = getEntryFromHash(hash)
    if (!entry.recipe) return
    return entry.slot ? this.context.recipes.getSlotKey(entry.recipe, entry.slot) : entry.recipe
  }

  private getTransformResult = (hash: string) => {
    const entry = getEntryFromHash(hash)
    const recipeName = this.getRecipeName(hash)

    const transform = recipeName ? this.context.recipes.getTransform(recipeName) : this.context.utility.transform
    const transformed = transform(entry.prop, withoutImportant(entry.value) as string)

    if (!transformed.className) {
      return
    }

    const important = isImportant(entry.value)
    const styles = important ? markImportant(transformed.styles) : transformed.styles

    const parts = entry.cond ? entry.cond.split(StyleEncoder.conditionSeparator) : []
    const className = this.formatSelector(parts, transformed.className)
    const classSelector = important ? `.${className}\\!` : `.${className}`

    return {
      className,
      classSelector,
      styles,
      transformed,
      parts,
      // A non-anchor slot's variant rules. The selector is the slot's *constant* class, put
      // inside a scope an anchor's variant class opens — so nothing has to reach the slot
      // to style it. `className` is left alone: it still identifies the rule for
      // bookkeeping, it is just not what the rule selects on.
      //
      // One entry per anchor. A component that spans a portal has more than one enclosing
      // element, and only the anchor that is genuinely an ancestor of this slot matches at
      // runtime — which is what lets the build stay ignorant of the DOM shape.
      scopes: (
        transformed as { scope?: Array<{ anchorVariantClasses: string[]; anchorClass: string; slotClass: string }> }
      ).scope?.map((scope) => ({
        // Formatted here rather than where they are recorded, so `hash.className` and
        // `prefix` reach them. `formatSelector` is the one place that applies both.
        //
        // A list of classes rather than one, because a compound variant opens its scope on
        // every anchor class the selection names at once.
        prelude: `@scope (${scope.anchorVariantClasses
          .map((className) => `.${this.formatSelector([], className)}`)
          .join('')}) to (.${this.formatSelector([], scope.anchorClass)})`,
        selector: `.${this.formatSelector([], scope.slotClass)}`,
      })),
      // A compound variant. It selects on the variant classes the element already carries
      // — `.btn--size_sm.btn--tone_a` — so it needs a selector that is not a single class,
      // and it contributes no class of its own. `className` still identifies the rule for
      // bookkeeping; it is just not what the rule selects on, and never reaches the DOM.
      // Formatted here, so `hash.className` and `prefix` reach a compound's selector the
      // same way they reach every other class.
      selector: (transformed as { selector?: string[][] }).selector
        ?.map((combination) => combination.map((className) => `.${this.formatSelector([], className)}`).join(''))
        .join(', '),
    }
  }

  resolveCondition = (condition: ConditionDetails) => {
    if (condition.type === 'multi-block') return []

    if (Array.isArray(condition.raw)) {
      return condition.raw.map((c) => this.context.utility.tokens.resolveReference(c))
    }

    return this.context.utility.tokens.resolveReference(condition.raw)
  }

  /**
   * Expands multi-block conditions into separate sets of conditions.
   * Each block becomes an independent condition set that produces its own CSS block.
   * When multiple multi-block conditions are stacked (e.g. two custom multi-block
   * conditions used together), the cartesian product of all blocks is produced.
   * Returns null if no multi-block condition is found.
   */
  private expandMultiBlock(conditions: ConditionDetails[]): ConditionDetails[][] | null {
    if (!conditions.some((c) => c.type === 'multi-block')) return null

    // For each slot, list its alternative condition arrays.
    // - multi-block: one alternative per inner block (flatten the MixedCondition's value)
    // - others: a single alternative containing just that condition
    const alternatives: ConditionDetails[][][] = conditions.map((c) => {
      if (c.type === 'multi-block') {
        return (c as MultiBlockCondition).value.map((block) => block.value.filter(Boolean) as ConditionDetails[])
      }
      return [[c]]
    })

    // Cartesian product across all slots.
    let combos: ConditionDetails[][] = [[]]
    for (const slot of alternatives) {
      const next: ConditionDetails[][] = []
      for (const partial of combos) {
        for (const choice of slot) {
          next.push([...partial, ...choice])
        }
      }
      combos = next
    }

    // Sort each combo: at-rules first, pseudo-elements last, preserve relative order.
    return combos.map((combo) => sortConditionDetails(combo))
  }

  private getAtomic = (hash: string) => {
    const cached = this.atomic_cache.get(hash)
    if (cached) return cached

    const entry = getEntryFromHash(hash)

    const transformResult = this.getTransformResult(hash)
    if (!transformResult) return

    const { className, classSelector, styles, transformed, parts, scopes, selector } = transformResult

    // One base path per anchor when the rule is scoped, otherwise the single class it
    // selects on. Each anchor's prelude is a distinct key, so the paths never collide and
    // the result carries one `@scope` block per anchor.
    const basePaths = scopes?.length
      ? scopes.map((scope) => [scope.prelude, scope.selector])
      : [[selector ?? classSelector]]

    const obj: StyleResultObject = {}

    let conditions

    if (entry.cond) {
      conditions = this.context.conditions.sort(parts)

      // Expand multi-block conditions into separate CSS blocks
      const expanded = this.expandMultiBlock(conditions)
      if (expanded) {
        for (const basePath of basePaths) {
          for (const blockConditions of expanded) {
            const path = basePath.concat(blockConditions.flatMap((c) => this.resolveCondition(c)))
            deepSet(obj, path, styles)
          }
        }
      } else {
        const resolved = conditions.flatMap((c) => this.resolveCondition(c))
        for (const basePath of basePaths) {
          deepSet(obj, basePath.concat(resolved), styles)
        }
      }
    } else {
      for (const basePath of basePaths) {
        deepSet(obj, basePath, styles)
      }
    }

    const styleResult: AtomicStyleResult = {
      result: obj,
      entry,
      hash,
      conditions,
      className,
      layer: transformed.layer,
      scoped: Boolean(scopes?.length),
    }

    this.atomic_cache.set(hash, styleResult)

    return styleResult
  }

  getGroup = (hashSet: Set<string>, key: string) => {
    const cached = this.group_cache.get(key)
    if (cached) return cached

    let obj = {}
    const basePath = [] as string[]
    const details = [] as GroupedStyleResultDetails[]
    const transform = this.context.utility.transform.bind(this.context.utility)

    hashSet.forEach((hash) => {
      const entry = getEntryFromHash(hash)

      const transformed = transform(entry.prop, withoutImportant(entry.value) as string)
      if (!transformed.className) return

      const important = isImportant(entry.value)
      const result = important ? markImportant(transformed.styles) : transformed.styles

      const parts = entry.cond ? entry.cond.split(StyleEncoder.conditionSeparator) : []

      let conditions
      if (entry.cond) {
        conditions = this.context.conditions.sort(parts)
      }

      details.push({ hash, entry, conditions, result })
    })

    // sorting here prevents postcss-nested from creating multiple rules with the same selector
    // if we have a rule without a condition, then one with a condition, then one without a condition
    // if not sorted, the object would look like
    // 1. `{ lineHeight: '1.2', _hover: { boxShadow: 'outline' }, outline: 'none', }`
    // instead of
    // 2. `{ lineHeight: '1.2', outline: 'none', _hover: { boxShadow: 'outline' } }`
    //
    // which would result in a CSS like
    // 1. `.class { line-height: 1.2; } .class:hover { box-shadow: outline; } .class { outline: none }`
    // instead of:
    // 2. `.class { line-height: 1.2; outline: none; } .class:hover { box-shadow: outline; }`
    const sorted = sortStyleRules(details)
    sorted.forEach((value) => {
      if (value.conditions) {
        // Expand multi-block conditions into separate CSS blocks
        const expanded = this.expandMultiBlock(value.conditions)
        if (expanded) {
          for (const blockConditions of expanded) {
            const path = basePath.concat(blockConditions.flatMap((c) => this.resolveCondition(c)))
            obj = deepSet(obj, path, value.result)
          }
        } else {
          const path = basePath.concat(value.conditions.flatMap((c) => this.resolveCondition(c)))
          obj = deepSet(obj, path, value.result)
        }
      } else {
        obj = deepSet(obj, basePath, value.result)
      }
    })

    const result: GroupedResult = { result: obj, hashSet, details, className: key }

    this.group_cache.set(key, result)

    return result
  }

  private getRecipeBase = (hashSet: Set<string>, recipeName: string, slot?: string): RecipeBaseResult | undefined => {
    const recipeConfig = this.context.recipes.getConfig(recipeName)
    if (!recipeConfig) return

    const className = this.context.recipes.getRecipeClassName(
      recipeName,
      'slots' in recipeConfig && slot ? slot : undefined,
    )

    const cached = this.recipe_base_cache.get(className)
    if (cached) return cached

    const selector = this.formatSelector([], className)
    const style = this.getGroup(hashSet, className)

    const result = Object.assign({}, style, {
      result: { ['.' + selector]: style.result },
      recipe: recipeName,
      // The formatted name, not the raw one. `formatSelector` is what applies `prefix` and
      // `hash.className`, and the rule is emitted against that — so reporting the raw name
      // handed the fold a literal for a class no rule exists under. The variants have
      // always reported the formatted name; this is the base catching up.
      className: selector,
      slot,
    })

    this.recipe_base_cache.set(className, result)

    return result
  }

  collectAtomic = (encoder: StyleEncoder) => {
    const atomic = [] as AtomicStyleResult[]
    encoder.atomic.forEach((item) => {
      const result = this.getAtomic(item)
      if (!result) return

      atomic.push(result)
    })

    const sorted = sortStyleRules(atomic)
    sorted.forEach((styleResult) => {
      this.atomic.add(styleResult)
      this.classNames.set(styleResult.className, styleResult)
    })

    return this
  }

  private processClassName = (recipeName: string, hash: string) => {
    const result = this.getAtomic(hash)
    if (!result) return

    const styleSet = getOrCreateSet(this.recipes, recipeName)
    styleSet.add(result)

    this.classNames.set(result.className, result)
  }

  collectRecipe = (encoder: StyleEncoder) => {
    // no need to sort, each recipe is scoped using recipe.className
    encoder.recipes.forEach((hashSet, recipeName) => {
      const recipeConfig = this.context.recipes.getConfig(recipeName)
      if (!recipeConfig) return

      hashSet.forEach((hash) => {
        if ('slots' in recipeConfig) {
          recipeConfig.slots.forEach((slot) => {
            const slotHash = hash + StyleEncoder.separator + 'slot:' + slot
            this.processClassName(recipeName, slotHash)
          })
        } else {
          this.processClassName(recipeName, hash)
        }
      })
    })
  }

  collectRecipeBase = (encoder: StyleEncoder) => {
    encoder.recipes_base.forEach((hashSet, recipeKey) => {
      const [recipeName, slot] = recipeKey.split(this.context.recipes.slotSeparator)

      const recipeConfig = this.context.recipes.getConfig(recipeName)
      if (!recipeConfig) return

      const result = this.getRecipeBase(hashSet, recipeName, slot)
      if (!result) return

      const styleSet = getOrCreateSet(this.recipes_base, recipeKey)
      styleSet.add(result)

      this.classNames.set(result.className, result)
    })
  }

  collectGrouped = (encoder: StyleEncoder) => {
    encoder.grouped.forEach((hashSet, groupId) => {
      const groupKey = 'grouped:' + groupId
      const style = this.getGroup(hashSet, groupKey)

      // Not `formatSelector`: that hashes again under `hash.className`, and a group id is
      // already a digest. Shared with the runtime so the two cannot name it differently.
      const className = esc(groupClassName(groupId, this.context.utility.toHash, this.context.utility.formatClassName))

      const result: GroupedResult = {
        ...style,
        className,
        result: { ['.' + className]: style.result },
      }

      this.grouped.add(result)
      this.classNames.set(className, result)
    })
  }

  collectViewTransitions = (encoder: StyleEncoder) => {
    encoder.view_transitions.forEach((slots, className) => {
      const styles: StyleResultObject = {
        // What carries the bag onto an element. `view-transition-class` is shared, unlike
        // `view-transition-name`, which is why a class can stand for a transition at all.
        ['.' + esc(className)]: { viewTransitionClass: className },
      }

      for (const slot of viewTransitionSlots) {
        const body = slots[slot]
        if (body == null) continue
        // `::view-transition-*` are top-level pseudo-elements matched by class, not
        // descendants of the element carrying it — so no `&` here.
        styles[`::${viewTransitionPseudo[slot]}(.${esc(className)})`] = body
      }

      this.view_transitions.add({ className, styles })
    })

    return this
  }

  /**
   * Collect and re-create all styles and recipes objects from the style encoder
   * So that we can just iterate over them and transform resulting CSS objects into CSS strings
   */
  collect = (encoder: StyleEncoder) => {
    this.collectAtomic(encoder)
    this.collectGrouped(encoder)
    this.collectRecipe(encoder)
    this.collectRecipeBase(encoder)
    this.collectViewTransitions(encoder)
    return this
  }

  /**
   * Class names produced by one `process*` call.
   *
   * The decoder accumulates across calls, so reading `classNames` directly returns
   * everything encoded so far. Callers that need one call's result — the build-time
   * fold in particular, which must not attribute a neighbouring call's atoms to this
   * one — pass the `EncoderScope` recorded for that call.
   *
   * Membership and order both come from the scope, never from the decoder's own
   * accumulated state — otherwise the same call site would resolve differently
   * depending on what was encoded before it, and a build would stop being
   * reproducible under a change in module traversal order.
   *
   * Within that, ordering matches what a single-call processor produces today:
   * atomic styles go through the same `sortStyleRules` pass `collectAtomic` applies,
   * and the remaining categories follow the order `collect` inserts them (grouped,
   * recipe variants, recipe base). Class order on an element has no cascade meaning
   * — the stylesheet decides that — so this is about determinism, not correctness.
   */
  filterClassNames = (scope: EncoderScope): string[] => {
    const resultsByHash = new Map<string, AtomicStyleResult[]>()
    const byGroupId = new Map<string, string>()
    const byRecipeKey = new Map<string, string>()

    for (const [className, entry] of this.classNames) {
      if ('hash' in entry) {
        // Slot recipes record one variant hash but `collectRecipe` expands it per
        // slot (`<hash>]___[slot:<slot>`), so several results share a base hash.
        // Insertion order within a hash is slot order.
        const key = stripSlotSegment(entry.hash)
        const list = resultsByHash.get(key)
        if (list) list.push(entry)
        else resultsByHash.set(key, [entry])
        continue
      }

      if ('recipe' in entry) {
        const key = entry.slot ? this.context.recipes.getSlotKey(entry.recipe, entry.slot) : entry.recipe
        byRecipeKey.set(key, className)
        continue
      }

      byGroupId.set(Array.from(entry.hashSet).sort().join('|'), className)
    }

    const out: string[] = []
    const seen = new Set<string>()

    const push = (className: string | undefined) => {
      if (!className || seen.has(className)) return
      seen.add(className)
      out.push(className)
    }

    const collectResults = (hashes: Iterable<string>) => {
      const found: AtomicStyleResult[] = []
      for (const hash of hashes) {
        const results = resultsByHash.get(hash)
        if (results) found.push(...results)
      }
      return found
    }

    // Atomic styles are sorted, matching `collectAtomic`.
    sortStyleRules(collectResults(scope.atomic)).forEach((result) => push(result.className))

    scope.grouped.forEach((groupId) => push(byGroupId.get(groupId)))

    // Recipe variants are not sorted — each is already scoped by its recipe class. A
    // `@scope`-selected slot is skipped: the root's variant class is what opens the scope,
    // so this slot's own variant class would style nothing.
    scope.recipes.forEach((hashes) =>
      collectResults(hashes).forEach((result) => {
        if (!result.scoped) push(result.className)
      }),
    )

    scope.recipes_base.forEach((key) => push(byRecipeKey.get(key)))

    return out
  }

  getConfigRecipeResult = (recipeName: string) => {
    return {
      atomic: this.atomic,
      base: this.recipes_base.get(recipeName)!,
      variants: this.recipes.get(recipeName)!,
    }
  }

  getConfigSlotRecipeResult = (recipeName: string) => {
    const recipeConfig = this.context.recipes.getConfigOrThrow(recipeName)

    if (!Recipes.isSlotRecipeConfig(recipeConfig)) {
      throw new BambooError('UNKNOWN_RECIPE', `Recipe "${recipeName}" is not a slot recipe`)
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

  getRecipeResult = (recipeName: string) => {
    if (this.context.recipes.isSlotRecipe(recipeName)) {
      return this.getConfigSlotRecipeResult(recipeName)
    }

    return this.getConfigRecipeResult(recipeName)
  }
}

const slotSegment = StyleEncoder.separator + 'slot:'

/** Drop a trailing `]___[slot:<slot>` segment, if present. Always appended last. */
const stripSlotSegment = (hash: string) => {
  const at = hash.lastIndexOf(slotSegment)
  return at === -1 ? hash : hash.slice(0, at)
}

const entryKeys = ['cond', 'recipe', 'layer', 'slot'] as const

const getEntryFromHash = (hash: string) => {
  const parts = hash.split(StyleEncoder.separator)
  const prop = parts[0]

  const rawValue = parts[1].replace('value:', '')
  const value = parseValue(rawValue)

  const entry = { prop, value } as StyleEntry

  parts.forEach((part) => {
    const key = entryKeys.find((k) => part.startsWith(k))
    if (key) {
      entry[key] = part.slice(key.length + 1)
    }
  })

  return entry
}

const startsWithZero = /^0\d+$/
const parseValue = (value: string) => {
  // Check if value starts with '0' and is followed by a number
  // like '01', '02', etc. If so, return the value as is, it's meant to be a string
  if (startsWithZero.test(value)) {
    return value
  }

  const asNumber = Number(value)
  if (!Number.isNaN(asNumber)) return asNumber
  return castBoolean(value)
}

const castBoolean = (value: string) => {
  if (value === 'true') return true
  if (value === 'false') return false
  return value
}

const pseudoElementRegex = /::[\w-]/

/**
 * Sort flattened condition details (at-rules and selectors only):
 * at-rules first, pseudo-elements last, preserve relative order.
 *
 * Note: This only operates on individual at-rule and selector conditions
 * (not mixed or multi-block), so checking `raw` as string is sufficient
 * for pseudo-element detection.
 */
const sortConditionDetails = (conditions: ConditionDetails[]): ConditionDetails[] => {
  const indexed = conditions.map((cond, i) => ({ cond, i }))
  indexed.sort((a, b) => {
    const aIsAtRule = a.cond.type === 'at-rule'
    const bIsAtRule = b.cond.type === 'at-rule'
    if (aIsAtRule && !bIsAtRule) return -1
    if (!aIsAtRule && bIsAtRule) return 1

    const aIsPseudo = typeof a.cond.raw === 'string' && pseudoElementRegex.test(a.cond.raw)
    const bIsPseudo = typeof b.cond.raw === 'string' && pseudoElementRegex.test(b.cond.raw)
    if (aIsPseudo !== bIsPseudo) return aIsPseudo ? 1 : -1

    return a.i - b.i
  })
  return indexed.map((item) => item.cond)
}
