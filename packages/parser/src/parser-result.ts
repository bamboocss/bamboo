import type { ParserOptions } from '@bamboocss/core'
import { BambooError, getOrCreateSet } from '@bamboocss/shared'
import type { ParserResultInterface, ResultItem } from '@bamboocss/types'
import { findUnresolvedRecipeStyles, findUnresolvedStyles, type UnresolvedStyle } from './unresolved-styles'

export class ParserResult implements ParserResultInterface {
  /** Ordered list of all ResultItem */
  all: ResultItem[] = []
  css = new Set<ResultItem>()
  cva = new Set<ResultItem>()
  sva = new Set<ResultItem>()
  token = new Set<ResultItem>()
  viewTransition = new Set<ResultItem>()

  recipe = new Map<string, Set<ResultItem>>()
  pattern = new Map<string, Set<ResultItem>>()

  filePath: string | undefined
  encoder: ParserOptions['encoder']

  /**
   * `css()` calls whose styles the build could not fully see.
   *
   * A property the build cannot resolve has no rule behind it, so the declaration is simply
   * absent from the element — silently. Only the surprising half is collected; see `setCss`.
   */
  unresolved: UnresolvedStyle[] = []

  constructor(
    private context: ParserOptions,
    encoder?: ParserOptions['encoder'],
  ) {
    this.encoder = encoder ?? context.encoder
  }

  append(result: ResultItem) {
    this.all.push(result)
    return result
  }

  set(name: 'cva' | 'css' | 'sva' | 'token', result: ResultItem) {
    switch (name) {
      case 'css':
        this.setCss(result)
        break
      case 'cva':
        this.setCva(result)
        break
      case 'sva':
        this.setSva(result)
        break
      case 'token':
        this.setToken(result)
        break
      default:
        throw new BambooError(
          'UNKNOWN_RESULT_TYPE',
          `Unknown parser result type: "${name}". Expected one of: css, cva, sva, token`,
        )
    }
  }

  setCss(result: ResultItem) {
    this.css.add(this.append(Object.assign({ type: 'css' }, result)))

    const encoder = this.encoder

    // `css([a, b])` arrives as a single entry holding an array, and `mergeCss` flattens it
    // before merging. Hashing the array itself instead reads its indices as a responsive
    // array — `css([{ color }, { padding }])` emitted the padding at the `sm` breakpoint.
    // Flattened here so every path below sees the operands the runtime sees.
    //
    // Tested for before flattening: array arguments are rare, and `flatMap` allocates a
    // second array for every `css()` call in the codebase to serve them.
    const data = (
      result.data.some(Array.isArray) ? result.data.flatMap((obj) => (Array.isArray(obj) ? obj : [obj])) : result.data
    ) as Record<string, any>[]

    // Only the surprising half is reported. A spread the build could not read looks static
    // and is not — that is worth interrupting for. A value it could not evaluate is the
    // documented dynamic-styling shape, answered by `staticCss` and already linted by
    // `no-dynamic-styling`; warning on every one of those would bury the first.
    const unresolved = findUnresolvedStyles(result, 'atomic').filter((entry) => entry.reason === 'unenumerable-keys')
    if (unresolved.length) this.unresolved.push(...unresolved)

    data.forEach((obj) => encoder.processAtomic(obj))
  }

  setCva(result: ResultItem) {
    this.cva.add(this.append(Object.assign({ type: 'cva' }, result)))

    this.reportUnresolvedRecipe(result)

    const encoder = this.encoder
    result.data.forEach((data) => encoder.processAtomicRecipe(data))
  }

  setSva(result: ResultItem) {
    this.sva.add(this.append(Object.assign({ type: 'sva' }, result)))

    this.reportUnresolvedRecipe(result)

    const encoder = this.encoder
    result.data.forEach((data) => encoder.processAtomicSlotRecipe(data))
  }

  /**
   * Record a recipe config the build could not fully read.
   *
   * Reported in full, unlike the `css()` check in `setCss`, which keeps only the surprising
   * half. A recipe is named from a *hash of its config*: a declaration the build cannot see
   * changes the hash, so the build emits rules under one name and the browser asks for
   * another, and the element renders with no styles at all.
   *
   * There is no fallback to pair with it either. Grouped can emit atomic rules alongside the
   * group and let the runtime's degraded naming land on them; nothing can rescue a diverged
   * hash except an explicit `className`, which is what the message says to reach for.
   */
  private reportUnresolvedRecipe(result: ResultItem) {
    // A recipe that names itself is immune: `getRecipeIdentity` short-circuits on
    // `className` and never hashes the styles, so extraction fidelity stops deciding the
    // name and the loss degrades to the missing declarations alone.
    //
    // Spelled the way `getRecipeIdentity` spells it — a non-empty string — because an empty
    // one falls through to hashing there and would be exempted here for a safety it does
    // not have. `every`, not `some`: one entry naming itself does not cover the rest.
    const named = result.data.every((data) => {
      const className = (data as { className?: unknown })?.className
      return typeof className === 'string' && className !== ''
    })
    if (named) return

    const unresolved = findUnresolvedRecipeStyles(result)
    if (unresolved.length) this.unresolved.push(...unresolved)
  }

  setToken(result: ResultItem) {
    this.token.add(this.append(Object.assign({ type: 'token' }, result)))
    // Token calls are tracked but don't need encoding like CSS/CVA/SVA
    // They're runtime functions that reference design tokens
  }

  setViewTransition(result: ResultItem) {
    this.viewTransition.add(this.append(Object.assign({ type: 'viewTransition' }, result)))

    const encoder = this.encoder
    result.data.forEach((obj) => encoder.processViewTransition(obj))
  }

  setPattern(name: string, result: ResultItem) {
    const set = getOrCreateSet(this.pattern, name)
    set.add(this.append(Object.assign({ type: 'pattern', name }, result)))

    result.data.forEach((obj) => this.encoder.processPattern(name, obj))
  }

  setRecipe(recipeName: string, result: ResultItem) {
    const set = getOrCreateSet(this.recipe, recipeName)
    set.add(this.append(Object.assign({ type: 'recipe' }, result)))

    const encoder = this.encoder
    const recipes = this.context.recipes

    const recipeConfig = recipes.getConfig(recipeName)
    if (!recipeConfig) return

    const recipe = result
    // treat recipe jsx like regular recipe + atomic
    if (result.type) {
      recipe.data.forEach((data) => {
        const [recipeProps, styleProps] = recipes.splitProps(recipeName, data)
        encoder.processStyleProps(styleProps)
        encoder.processRecipe(recipeName, recipeProps)
      })
    } else {
      recipe.data.forEach((data) => {
        encoder.processRecipe(recipeName, data)
      })
    }
  }

  isEmpty() {
    return this.all.length === 0
  }

  setFilePath(filePath: string) {
    this.filePath = filePath
    return this
  }

  merge(result: ParserResult) {
    result.css.forEach((item) => this.css.add(this.append(item)))
    result.cva.forEach((item) => this.cva.add(this.append(item)))
    result.sva.forEach((item) => this.sva.add(this.append(item)))
    result.token.forEach((item) => this.token.add(this.append(item)))
    result.viewTransition.forEach((item) => this.viewTransition.add(this.append(item)))

    result.recipe.forEach((items, name) => {
      const set = getOrCreateSet(this.recipe, name)
      items.forEach((item) => set.add(this.append(item)))
    })
    result.pattern.forEach((items, name) => {
      const set = getOrCreateSet(this.pattern, name)
      items.forEach((item) => set.add(this.append(item)))
    })

    // Carried for the same reason every other field is: an aggregate that dropped it would
    // report nothing. Nothing in this repo calls `merge` today — the build reports per file
    // as it parses — but this is public API on an exported class, and a consumer that does
    // merge should not silently lose the diagnostics.
    if (result.unresolved.length) this.unresolved.push(...result.unresolved)

    return this
  }

  toArray() {
    return this.all
  }

  toJSON() {
    return {
      css: Array.from(this.css),
      cva: Array.from(this.cva),
      sva: Array.from(this.sva),
      token: Array.from(this.token),
      viewTransition: Array.from(this.viewTransition),
      recipe: Object.fromEntries(Array.from(this.recipe.entries()).map(([key, value]) => [key, Array.from(value)])),
      pattern: Object.fromEntries(Array.from(this.pattern.entries()).map(([key, value]) => [key, Array.from(value)])),
    }
  }
}
