import type { RecipeRule } from './static-css'
import type { SystemStyleObject, DistributiveOmit, Pretty } from './system-types'

type StringToBoolean<T> = T extends 'true' | 'false' ? boolean : T

export type RecipeVariantRecord = Record<any, Record<any, SystemStyleObject>>

export type RecipeSelection<T extends RecipeVariantRecord> = keyof any extends keyof T
  ? {}
  : {
      [K in keyof T]?: StringToBoolean<keyof T[K]> | undefined
    }

export type RecipeVariantFn<T extends RecipeVariantRecord> = (props?: RecipeSelection<T>) => string

/**
 * Extract the variant as optional props from a `cva` function.
 * Intended to be used with a JSX component, prefer `RecipeVariant` for a more strict type.
 */
export type RecipeVariantProps<
  T extends RecipeVariantFn<RecipeVariantRecord> | SlotRecipeVariantFn<string, SlotRecipeVariantRecord<string>>,
> = Pretty<Parameters<T>[0]>

/**
 * Extract the variants from a `cva` function.
 */
export type RecipeVariant<
  T extends RecipeVariantFn<RecipeVariantRecord> | SlotRecipeVariantFn<string, SlotRecipeVariantRecord<string>>,
> = Exclude<Pretty<Required<RecipeVariantProps<T>>>, undefined>

type RecipeVariantMap<T extends RecipeVariantRecord> = {
  [K in keyof T]: Array<keyof T[K]>
}

/* -----------------------------------------------------------------------------
 * Recipe / Standard
 * -----------------------------------------------------------------------------*/

export interface RecipeRuntimeFn<T extends RecipeVariantRecord> extends RecipeVariantFn<T> {
  __type: RecipeSelection<T>
  variantKeys: (keyof T)[]
  variantMap: RecipeVariantMap<T>
  raw: (props?: RecipeSelection<T>) => SystemStyleObject
  config: RecipeConfig<T>
  splitVariantProps<Props extends RecipeSelection<T>>(
    props: Props,
  ): [RecipeSelection<T>, Pretty<DistributiveOmit<Props, keyof T>>]
  getVariantProps: (props?: RecipeSelection<T>) => RecipeSelection<T>
}

type OneOrMore<T> = T | Array<T>

export type RecipeCompoundSelection<T> = {
  [K in keyof T]?: OneOrMore<StringToBoolean<keyof T[K]>> | undefined
}

export type RecipeCompoundVariant<T> = T & {
  css: SystemStyleObject
}

export interface RecipeDefinition<T extends RecipeVariantRecord = RecipeVariantRecord> {
  /**
   * The base styles of the recipe.
   */
  base?: SystemStyleObject
  /**
   * The prefix every class this recipe emits is built from — `button` gives `button` for
   * the base styles and `button--size_sm` for a variant.
   *
   * Required for a recipe declared in `theme.recipes`, where it is the key it is declared
   * under. Optional for an inline `cva`, which is otherwise named by hashing its own
   * config: `cva_a1b2c3--size_sm`. Setting it buys readable class names and nothing else —
   * the CSS is identical either way.
   *
   * It has to be unique across every recipe in the build. Two recipes sharing a name emit
   * rules under the same selectors, and the later one wins for any variant they both
   * declare.
   */
  className?: string
  /**
   * Whether the recipe is deprecated.
   */
  deprecated?: boolean | string
  /**
   * The multi-variant styles of the recipe.
   */
  variants?: T
  /**
   * The default variants of the recipe.
   */
  defaultVariants?: RecipeSelection<T>
  /**
   * The styles to apply when a combination of variants is selected.
   */
  compoundVariants?: Pretty<RecipeCompoundVariant<RecipeCompoundSelection<T>>>[]
}

export type RecipeCreatorFn = <T extends RecipeVariantRecord>(config: RecipeDefinition<T>) => RecipeRuntimeFn<T>

interface RecipeConfigMeta {
  /**
   * The description of the recipe. This will be used in the JSDoc comment.
   */
  description?: string
  /**
   * The jsx elements to track for this recipe. Can be string or Regexp.
   *
   * @default capitalize(recipe.name)
   * @example ['Button', 'Link', /Button$/]
   */
  jsx?: Array<string | RegExp>
  /**
   * Variants to pre-generate, will be include in the final `config.staticCss`
   */
  staticCss?: RecipeRule[]
}

export interface RecipeConfig<T extends RecipeVariantRecord = RecipeVariantRecord>
  extends RecipeDefinition<T>, RecipeConfigMeta {
  /** Optional on `RecipeDefinition`, where an inline `cva` falls back to hashing its config. A recipe declared in `theme.recipes` always has one — the key it is declared under. */
  className: string
}

/* -----------------------------------------------------------------------------
 * Recipe / Slot
 * -----------------------------------------------------------------------------*/

type SlotRecord<S extends string, T> = Partial<Record<S, T>>

export type SlotRecipeVariantRecord<S extends string> = Record<any, Record<any, SlotRecord<S, SystemStyleObject>>>

export type SlotRecipeVariantFn<S extends string, T extends RecipeVariantRecord> = (
  props?: RecipeSelection<T>,
) => SlotRecord<S, string>

export interface SlotRecipeRuntimeFn<
  S extends string,
  T extends SlotRecipeVariantRecord<S>,
> extends SlotRecipeVariantFn<S, T> {
  raw: (props?: RecipeSelection<T>) => Record<S, SystemStyleObject>
  variantKeys: (keyof T)[]
  variantMap: RecipeVariantMap<T>
  /** The config this recipe was created from. */
  config: SlotRecipeDefinition<S, T>
  /** Each slot's constant class, for targeting a slot in the DOM. */
  classNameMap: Partial<Record<S, string>>
  /**
   * Which slots each variant writes styles for.
   *
   * A variant's styles reach a slot through a scope opened at an anchor, which covers every
   * slot in that anchor's subtree. A slot under no anchor — moved out by a portal, with no
   * second anchor named in `scopeRoots` — is not reached, and nothing at build time can
   * detect that. This says which slots a variant has to get to, so whatever a scope cannot
   * reach can be threaded by hand.
   */
  slotsAffectedBy: Record<keyof T, S[]>
  splitVariantProps<Props extends RecipeSelection<T>>(
    props: Props,
  ): [RecipeSelection<T>, Pretty<DistributiveOmit<Props, keyof T>>]
  getVariantProps: (props?: RecipeSelection<T>) => RecipeSelection<T>
}

export type SlotRecipeCompoundVariant<S extends string, T> = T & {
  css: SlotRecord<S, SystemStyleObject>
}

export interface SlotRecipeDefinition<
  S extends string = string,
  T extends SlotRecipeVariantRecord<S> = SlotRecipeVariantRecord<S>,
> {
  /**
   * The prefix every class this recipe emits is built from, and the name to target its
   * slots in the DOM by — `checkbox` gives `checkbox__control` for a slot and
   * `checkbox__control--size_md` for that slot under a variant.
   *
   * Required for a recipe declared in `theme.slotRecipes`, where it is the key it is
   * declared under. Optional for an inline `sva`, which is otherwise named by hashing its
   * own config. Setting it buys readable class names and nothing else — the CSS is
   * identical either way.
   *
   * It has to be unique across every recipe in the build.
   */
  className?: string
  /**
   * Whether the recipe is deprecated.
   */
  deprecated?: boolean | string
  /**
   * The parts/slots of the recipe.
   */
  slots: S[] | Readonly<S[]>
  /**
   * The slots that enclose other slots, used to scope their variant styles.
   *
   * A slot recipe's variants are chosen once, at the top, but the slots that react to them
   * are authored by the consumer somewhere below. Naming the enclosing slots lets the build
   * emit their variant styles as rules scoped by a class those slots already carry, so
   * nothing has to be delivered to a slot at runtime and every other slot's class is a
   * constant.
   *
   * A list, because a portal is a real discontinuity in the tree and no CSS mechanism
   * crosses one. A `<Select>` occupies two disjoint subtrees — the trigger side under
   * `root`, the listbox side under a portaled `positioner` — and a variant writes styles
   * into both. One anchor can only ever reach one of them.
   *
   * ```ts
   * scopeRoots: ['root', 'positioner']
   * ```
   *
   * Each named slot takes variant props; every other slot's class is a constant. The build
   * emits each non-anchor slot's variant rules under *every* anchor, and only the anchor
   * that is genuinely an ancestor matches — so the DOM shape never has to be declared.
   *
   * Defaults to `['root']` when a slot by that name exists. Set `[]` to turn scoping off
   * and give every slot a variant class of its own, which is what a recipe whose slots are
   * siblings wants.
   *
   * A slot under *no* anchor is still unreachable, and nothing at build time can detect
   * that — reachability is a fact about the DOM. `recipe.slotsAffectedBy` says which slots
   * a variant writes to, for whatever still needs threading by hand.
   */
  scopeRoots?: S[] | Readonly<S[]>
  /**
   * The base styles of the recipe.
   */
  base?: SlotRecord<S, SystemStyleObject>
  /**
   * The multi-variant styles of the recipe.
   */
  variants?: T
  /**
   * The default variants of the recipe.
   */
  defaultVariants?: RecipeSelection<T>
  /**
   * The styles to apply when a combination of variants is selected.
   */
  compoundVariants?: Pretty<SlotRecipeCompoundVariant<S, RecipeCompoundSelection<T>>>[]
}

export type SlotRecipeCreatorFn = <S extends string, T extends SlotRecipeVariantRecord<S>>(
  config: SlotRecipeDefinition<S, T>,
) => SlotRecipeRuntimeFn<S, T>

export type SlotRecipeConfig<
  S extends string = string,
  T extends SlotRecipeVariantRecord<S> = SlotRecipeVariantRecord<S>,
> = SlotRecipeDefinition<S, T> &
  RecipeConfigMeta & {
    /** Optional on `SlotRecipeDefinition`, where an inline `sva` falls back to hashing its config. A recipe declared in `theme.slotRecipes` always has one — the key it is declared under. */
    className: string
  }
