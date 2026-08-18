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
  /**
   * Recipe names whose compound-variant block this call is responsible for.
   *
   * Kept apart from `recipes` on purpose: a compound rule selects on the variant classes the
   * element already carries and contributes no class of its own, so `filterClassNames` must
   * not see it (see `hashCompoundVariants`). This field is read only by `withOwner`, which
   * needs to know what a re-parse is allowed to hand back.
   *
   * Lazily allocated, as are the two below. `withScope` runs once per call site and the
   * common one -- `css({ ... })` -- reaches none of the three.
   */
  compound_variants?: Set<string>
  /** `viewTransition()` classes this call encoded. */
  view_transitions?: Set<string>
  /** Recipe names this call observed, which is the list `atomizeObservedRecipes` walks. */
  observed_recipes?: Set<string>
}

const createScope = (): EncoderScope => ({
  atomic: new Set(),
  recipes: new Map(),
  recipes_base: new Set(),
})

const mergeSet = <T>(target: Set<T> | undefined, source: Set<T> | undefined) => {
  if (!source?.size) return target
  const set = target ?? new Set<T>()
  source.forEach((value) => set.add(value))
  return set
}

const mergeScope = (target: EncoderScope, source: EncoderScope) => {
  source.atomic.forEach((hash) => target.atomic.add(hash))
  source.recipes_base.forEach((key) => target.recipes_base.add(key))
  source.recipes.forEach((hashes, name) => {
    const set = getOrCreateSet(target.recipes, name)
    hashes.forEach((hash) => set.add(hash))
  })
  target.compound_variants = mergeSet(target.compound_variants, source.compound_variants)
  target.view_transitions = mergeSet(target.view_transitions, source.view_transitions)
  target.observed_recipes = mergeSet(target.observed_recipes, source.observed_recipes)
}

/** A key nothing may take away: encoded with no owner recording, so no owner can release it. */
const PINNED = -1

/**
 * How many owners hold each key of one collection.
 *
 * Refcounted rather than scanned. Two files routinely encode the same declaration, so
 * "does anyone else still want this" has to be answerable without walking the other owners
 * -- that walk is O(project) per edit, which is the cost this whole mechanism exists to
 * avoid.
 */
class Refs {
  private counts = new Map<string, number>()

  /** Mark a key as belonging to no owner. Nothing can release it afterwards. */
  pin = (key: string) => {
    this.counts.set(key, PINNED)
  }

  retain = (key: string) => {
    const count = this.counts.get(key)
    if (count === PINNED) return
    this.counts.set(key, (count ?? 0) + 1)
  }

  /** True when the last owner let go, and the key should leave its collection with it. */
  release = (key: string): boolean => {
    const count = this.counts.get(key)
    // Untracked: pinned, or put there before anything recorded ownership. Either way nothing
    // here is what added it, so nothing here may remove it.
    if (count === undefined || count === PINNED) return false
    if (count > 1) {
      this.counts.set(key, count - 1)
      return false
    }
    this.counts.delete(key)
    return true
  }
}

/**
 * The owner key for one entry point's reading of one file.
 *
 * Kinds are separate owners over the same path on purpose. A Vite dev server reads a module
 * twice -- once from disk in the extraction pass, once from the transform pipeline -- and the
 * two can legitimately see different source (an SFC's sub-modules, a plugin that ran first).
 * One shared key would let each replace the other's record, and a file's rules would disappear
 * on whichever read was narrower. Two keys let the refcounts hold the union instead.
 */
const ownerKey = (kind: OwnerKind, path: string) => `${kind}:${path.replace(/\\/g, '/')}`

/**
 * Which entry point read a file.
 *
 * `extract` is the CSS extraction pass, which reads every file in `include` off disk.
 * `parse` is a bundler transform, which reads the module source it is handed.
 */
export type FileOwnerKind = 'extract' | 'parse'

type OwnerKind = FileOwnerKind | 'recipe'

/** Every owner kind keyed by a file path, for releasing one whose file was deleted. */
const FILE_OWNER_KINDS: FileOwnerKind[] = ['extract', 'parse']

export class StyleEncoder {
  static separator = ']___['
  static conditionSeparator = '<___>'

  atomic = new Set<string>()
  compound_variants = new Set<string>()
  //
  recipes = new Map<string, Set<string>>()
  recipes_base = new Map<string, Set<string>>()

  /** Recipes observed by extraction, including an inline recipe with only a base. */
  private observedRecipes = new Set<string>()
  /** Recipes whose authored declarations have already been interned as utility atoms. */
  private atomizedRecipes = new Set<string>()

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

  /** What each owner contributed the last time it was read. @see withOwner */
  private owners = new Map<string, EncoderScope>()
  /** The owner `withOwner` is recording for, if any. Nested calls defer to the outermost. */
  private activeOwner: string | null = null

  private atomicRefs = new Refs()
  private recipeRefs = new Refs()
  private recipeBaseRefs = new Refs()
  private compoundRefs = new Refs()
  private viewTransitionRefs = new Refs()
  private observedRefs = new Refs()

  /** A recipe's compound-variant hashes, so releasing the block can find them again. */
  private compoundHashes = new Map<string, Set<string>>()

  /**
   * How many times something has actually left a collection.
   *
   * Read by `StyleDecoder.collect`, which accumulates the results it decodes: a hash that is
   * gone from here has to leave there too, or the sheet keeps emitting its rule. Nothing is
   * ever removed during a build, so this stays at zero and the decoder never rebuilds.
   */
  removals = 0

  /**
   * Attribute everything `fn` encodes to `owner`, replacing whatever it encoded last time.
   *
   * This is what keeps a long-lived context from growing forever. The encoder only ever
   * accumulated, so a dev server's stylesheet kept every class every version of every edited
   * file had ever produced -- each save added the new atoms and left the old ones behind, for
   * the life of the process.
   *
   * Retain-then-release, rather than a diff of the two scopes. A key held by both readings
   * goes 1 -> 2 -> 1 and is never briefly absent, which matters because "absent" is what
   * deletes it; and both halves cost the size of *this owner's* contribution, never the size
   * of the project.
   *
   * Anything encoded outside an owner is pinned instead (see `Refs.pin`) -- `staticCss`
   * safelists, a restored encoder dump, a `RuleProcessor` call. Those answer to config rather
   * than to a file, so no file may take them away.
   *
   * Reconciled in a `finally`: a parse that throws has still put hashes in the collections,
   * and leaving them unattributed would make them permanent. The owner ends up holding what
   * the partial parse reached, and the next successful read replaces it.
   */
  withOwner = <T>(kind: FileOwnerKind, path: string, fn: () => T): T => {
    return this.withOwnerKey(ownerKey(kind, path), fn)
  }

  private withOwnerKey = <T>(owner: string, fn: () => T): T => {
    // An outer owner is already accounting for this. Nesting arises where an entry point that
    // scopes a file calls another that would scope it again, and double-counting would leave
    // the inner owner holding hashes that only its own next parse could release.
    if (this.activeOwner !== null) return fn()

    const parent = this.activeScope
    const scope = createScope()
    this.activeScope = scope
    this.activeOwner = owner

    try {
      return fn()
    } finally {
      this.activeScope = parent
      this.activeOwner = null
      if (parent) mergeScope(parent, scope)

      const previous = this.owners.get(owner)
      this.owners.set(owner, scope)
      this.retainScope(scope)
      if (previous) this.releaseScope(previous)
    }
  }

  /** Drop everything an owner contributed. Its keys leave the collections with it. */
  releaseOwner = (owner: string) => {
    const scope = this.owners.get(owner)
    if (!scope) return
    this.owners.delete(owner)
    this.releaseScope(scope)
  }

  /**
   * Drop everything a file contributed, whichever entry point read it.
   *
   * The deletion half of the same problem: nothing re-parses a file that is gone, so without
   * this its rules outlive it exactly as an edited file's old rules used to.
   */
  releaseFile = (filePath: string) => {
    for (const kind of FILE_OWNER_KINDS) this.releaseOwner(ownerKey(kind, filePath))
  }

  private retainScope = (scope: EncoderScope) => {
    scope.atomic.forEach(this.atomicRefs.retain)
    scope.recipes.forEach((hashes) => hashes.forEach(this.recipeRefs.retain))
    scope.recipes_base.forEach(this.recipeBaseRefs.retain)
    scope.compound_variants?.forEach(this.compoundRefs.retain)
    scope.view_transitions?.forEach(this.viewTransitionRefs.retain)
    scope.observed_recipes?.forEach(this.observedRefs.retain)
  }

  private releaseScope = (scope: EncoderScope) => {
    scope.atomic.forEach((hash) => {
      if (this.atomicRefs.release(hash)) this.drop(this.atomic.delete(hash))
    })

    scope.recipes.forEach((hashes, name) => {
      const set = this.recipes.get(name)
      hashes.forEach((hash) => {
        if (this.recipeRefs.release(hash)) this.drop(set?.delete(hash))
      })
      // An empty entry is not merely tidiness: `toJSON` would write the recipe with no
      // hashes, and `fromJSON` re-encodes a base for every name it reads.
      if (set && !set.size) this.recipes.delete(name)
    })

    scope.recipes_base.forEach((key) => {
      if (this.recipeBaseRefs.release(key)) this.drop(this.recipes_base.delete(key))
    })

    scope.compound_variants?.forEach((name) => {
      if (!this.compoundRefs.release(name)) return
      this.compound_variants.delete(name)
      // The block's own hashes, which live in the recipe's variant set beside the variants.
      // Nothing else produces them -- they hash a synthetic `COMPOUND_VARIANT` prop -- so they
      // are the block's to take back.
      const hashes = this.compoundHashes.get(name)
      const set = this.recipes.get(name)
      hashes?.forEach((hash) => this.drop(set?.delete(hash)))
      this.compoundHashes.delete(name)
      if (set && !set.size) this.recipes.delete(name)
    })

    scope.view_transitions?.forEach((className) => {
      if (this.viewTransitionRefs.release(className)) this.drop(this.view_transitions.delete(className))
    })

    scope.observed_recipes?.forEach((name) => {
      if (!this.observedRefs.release(name)) return
      this.observedRecipes.delete(name)
      this.atomizedRecipes.delete(name)
      // The atoms `atomizeObservedRecipes` interned for it. Held by the recipe rather than by
      // the files that use it, because that pass runs once per recipe and after extraction.
      this.releaseOwner(ownerKey('recipe', name))
    })
  }

  private drop = (removed: boolean | undefined) => {
    if (removed) this.removals++
  }

  /**
   * Note that the active call encoded `key`.
   *
   * With no owner recording, the key is pinned: nothing put it there on a file's behalf, so
   * no file's next parse may take it away.
   */
  private ownRecipeBase = (key: string) => {
    if (this.activeOwner === null) this.recipeBaseRefs.pin(key)
    this.activeScope?.recipes_base.add(key)
  }

  private ownCompound = (name: string) => {
    if (this.activeOwner === null) this.compoundRefs.pin(name)
    const scope = this.activeScope
    if (scope) (scope.compound_variants ??= new Set()).add(name)
  }

  private observeRecipe = (name: string) => {
    this.observedRecipes.add(name)
    if (this.activeOwner === null) this.observedRefs.pin(name)
    const scope = this.activeScope
    if (scope) (scope.observed_recipes ??= new Set()).add(name)
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
    // Hashed into a local set first, so this call's contribution stays separable from whatever
    // the encoder already holds. Insertion order into `atomic` is unchanged by the detour: a
    // hash already there does not move, and a new one still arrives in traversal order.
    const set = new Set<string>()
    this.hashStyleObject(set, styles)

    const scope = this.activeScope
    const unowned = this.activeOwner === null

    set.forEach((hash) => {
      this.atomic.add(hash)
      if (scope) scope.atomic.add(hash)
      if (unowned) this.atomicRefs.pin(hash)
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

    const className = viewTransitionClassName(options, this.context.utility.prefix)
    this.view_transitions.set(className, slots)

    if (this.activeOwner === null) this.viewTransitionRefs.pin(className)
    const scope = this.activeScope
    if (scope) (scope.view_transitions ??= new Set()).add(className)
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
      this.ownRecipeBase(recipeKey)
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
    if (!config.compoundVariants) return
    // Recorded before the early return, for the same reason the base is: the block belongs to
    // this call's result whether or not this call is the one that hashed it.
    this.ownCompound(recipeName)
    if (this.compound_variants.has(recipeName)) return
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
      const memo = getOrCreateSet(this.compoundHashes, recipeName)
      list.forEach((compoundVariant, index) => {
        if (!compoundVariant?.css) return
        // Through a local set, so releasing the block can find its hashes again -- they share
        // a set with the variants, which answer to a different owner.
        const local = new Set<string>()
        this.hashStyleObject(local, { [COMPOUND_VARIANT]: index }, { recipe: recipeName, slot, variants: true })
        local.forEach((hashed) => {
          set.add(hashed)
          memo.add(hashed)
        })
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

    const local = new Set<string>()
    this.hashStyleObject(local, computedVariants, baseEntry)

    const scope = this.activeScope
    const scoped = scope ? getOrCreateSet(scope.recipes, recipeName) : undefined
    const unowned = this.activeOwner === null

    local.forEach((hash) => {
      set.add(hash)
      scoped?.add(hash)
      if (unowned) this.recipeRefs.pin(hash)
    })
  }

  processConfigRecipeBase = (recipeName: string, config: RecipeConfig) => {
    if (!config.base) return

    // Record before the early return, for the same reason as the slot variant.
    this.ownRecipeBase(recipeName)
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
    if (!config.compoundVariants) return
    this.ownCompound(recipeName)
    if (this.compound_variants.has(recipeName)) return
    this.compound_variants.add(recipeName)
    this.hashCompoundVariants(recipeName, config.compoundVariants as Array<Record<string, any>>)
  }

  /**
   * `unresolved` names the variant axes the call site passed but the build could not read.
   * Absent from the selection is indistinguishable from never passed — `button({ size })` and
   * `button()` both arrive as `{}` — so the parser has to say which it was.
   */
  processRecipe = (recipeName: string, variants: Record<string, any>, unresolved?: Set<string>) => {
    this.observeRecipe(recipeName)
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
    this.observeRecipe(name)
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
      this.ownRecipeBase(name)
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
    this.observeRecipe(name)
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

  /**
   * Intern every declaration of every observed recipe in the ordinary atomic pool.
   *
   * This is the emission half of static style-set compilation. The Vite fold resolves a
   * recipe selection to authored styles and asks the ordinary `css()` compiler for classes;
   * those classes need rules even though the source declared the styles through `cva`/`sva`.
   * Recipe identity is deliberately absent from the hashes written here, so a declaration
   * already reached through `css()` is reused rather than emitted again.
   *
   * Kept explicit rather than run during normal extraction: CLI/PostCSS extraction still emits
   * named recipe rules. The Vite compiler calls this once after extraction, when it also erases
   * that layer.
   */
  atomizeObservedRecipes = () => {
    const atomize = (value: unknown) => {
      if (!value || typeof value !== 'object' || Array.isArray(value)) return
      this.processAtomic(value as StyleResultObject)
    }

    for (const name of this.observedRecipes) {
      if (this.atomizedRecipes.has(name)) continue
      const config = this.context.recipes.getConfig(name)
      if (!config) continue

      const slots = Recipes.isSlotRecipeConfig(config) ? config.slots : undefined
      const take = (value: unknown) => {
        if (!slots) {
          atomize(value)
          return
        }
        if (!value || typeof value !== 'object' || Array.isArray(value)) return
        for (const slot of slots) atomize((value as Dict)[slot])
      }

      // Owned by the recipe, not by the files that use it: this runs once per recipe and after
      // extraction, so a file's own scope is long closed. `releaseScope` hands the owner back
      // when the last file to name the recipe stops -- which for an inline `cva` is every edit
      // of it, since its identity is derived from its styles.
      this.withOwnerKey(ownerKey('recipe', name), () => {
        take(config.base)
        for (const values of Object.values(config.variants ?? {})) {
          for (const value of Object.values(values ?? {})) take(value)
        }
        for (const compound of config.compoundVariants ?? []) take((compound as { css?: unknown })?.css)
      })

      this.atomizedRecipes.add(name)
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

    // process atomic styles + compound variants. Pinned: a restored dump is a safelist rather
    // than a file's work, so no file's re-parse may take it away.
    styles.atomic?.forEach((hash) => {
      this.atomic.add(hash)
      this.atomicRefs.pin(hash)
    })

    Object.entries(styles.recipes ?? {}).forEach(([recipeName, hashes]) => {
      // process base styles
      this.processRecipeBase(recipeName)
      // process variants hashes
      const set = getOrCreateSet(this.recipes, recipeName)
      hashes.forEach((hash) => {
        set.add(hash)
        this.recipeRefs.pin(hash)
      })
    })

    // Keyed by the finalized class, so this restores the prefix the producing build
    // applied rather than re-deriving it from the consuming config.
    //
    // Pinned like the two above, and not merely for symmetry. Nothing could release a restored
    // transition while nothing counted it -- `Refs.release` declines an untracked key -- but a
    // local file declaring the *same* transition is what starts counting it, and that file's
    // next reading then takes the count to zero and deletes it. The dump would lose a rule to
    // an edit in a file that had nothing to do with it.
    Object.entries(styles.viewTransitions ?? {}).forEach(([className, slots]) => {
      this.view_transitions.set(className, slots)
      this.viewTransitionRefs.pin(className)
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
