import type { DeadImport, ParserOptions } from '@bamboocss/core'
import { type BoxNode, box } from '@bamboocss/extractor'
import { BambooError, getOrCreateSet } from '@bamboocss/shared'
import type { ParserResultInterface, ResultItem } from '@bamboocss/types'
import { findUnresolvedRecipeStyles, findUnresolvedStyles, type UnresolvedStyle } from './unresolved-styles'

export class ParserResult implements ParserResultInterface {
  /** Ordered list of all ResultItem */
  all: ResultItem[] = []
  css = new Set<ResultItem>()
  cva = new Set<ResultItem>()
  cvaCall = new Set<ResultItem>()
  sva = new Set<ResultItem>()
  token = new Set<ResultItem>()
  viewTransition = new Set<ResultItem>()

  recipe = new Map<string, Set<ResultItem>>()
  pattern = new Map<string, Set<ResultItem>>()

  filePath: string | undefined
  encoder: ParserOptions['encoder']
  /** Resolver targets crossed while extracting values which contributed CSS. */
  private dependencies = new Set<string>()

  /**
   * `css()` calls whose styles the build could not fully see.
   *
   * A property the build cannot resolve has no rule behind it, so the declaration is simply
   * absent from the element — silently. Only the surprising half is collected; see `setCss`.
   */
  unresolved: UnresolvedStyle[] = []

  /**
   * Inline recipe bindings this module imported, whether or not it ever calls one.
   *
   * `origin` on a `cva-call` only exists for a call. A module that merely *reads* an imported
   * recipe — `export const alias = badge`, `badge.raw(...)` — produces no call, so nothing
   * downstream could tell that the binding was a recipe at all. The declaring module used to
   * answer for those reads through a project-wide symbol search; now that each module answers
   * only about its own text, the consumer needs to know which of its imports are recipes.
   */
  importedRecipes: Map<string, { filePath: string; name: string }> = new Map()

  /**
   * Calls to a name the pattern or recipe entrypoint no longer exports.
   *
   * Separate from `unresolved`, which grades a call the build *did* see and could only
   * partly resolve. These it saw and could not resolve at all: the binding is dead, so every
   * rule the call would have contributed is absent rather than incomplete. Reported by
   * `assertNoDeadCalls` rather than warned about, for that reason.
   */
  deadCalls: DeadImport[] = []

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

    // `css([a, b])` used to arrive as a single entry holding an array, flattened here to match
    // what `mergeCss` did. Both are gone: one spelling of a call is the point, and every
    // `css()` in the codebase was paying a `flatMap` to serve a shape almost nothing wrote.
    //
    // Caught here rather than left to the runtime because the two disagree about what an
    // array is. `walkObject` would read its indices as property names and emit a rule per
    // index — junk classes, no error. This runs inside the per-file parse, so the failure
    // names the file it came from.
    if (result.data.some(Array.isArray)) {
      throw new BambooError('INVALID_STYLE_ARGUMENT', 'An array is not a style argument.', {
        hint: 'Spread it instead, e.g. css(...styles) rather than css(styles).',
      })
    }

    const data = result.data as Record<string, any>[]

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

  /**
   * A call of a locally-bound inline recipe -- `const badge = cva(...)`, then `badge({...})`.
   *
   * Recorded, not encoded. The rules already exist: `setCva` emitted them from the config,
   * and a recipe's classes are named semantically from that config rather than from this
   * call. What this adds is *visibility* -- the call site becomes something the fold can see
   * and report on, where before it was indistinguishable from code nobody had parsed.
   */
  setCvaCall(name: string, result: ResultItem) {
    this.cvaCall.add(this.append(Object.assign({ type: 'cva-call', name }, result)))
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

  /**
   * `kind` separates the variable reference — `token()` — from `token.value()`, the resolved
   * literal. They share this set deliberately: everything that
   * reads a result for the token *path* — `collectTokenReferences`, keeping a declaration
   * alive through pruning — wants both, and only the fold cares which half was asked for.
   */
  setToken(result: ResultItem, kind: 'token' | 'tokenValue' = 'token') {
    this.token.add(this.append(Object.assign({ type: kind }, result)))
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

  /**
   * The variant axes a call site passed and the build could not read.
   *
   * `button({ size })` with a dynamic `size` and `button()` both unbox to `{}`, so the encoder
   * cannot tell "you named an axis I could not resolve" from "you named nothing" — and the
   * difference decides whether a class it is about to emit has a rule behind it. The box still
   * holds the distinction: the key is present, carrying an `unresolvable`.
   */
  private unresolvedVariants(result: ResultItem) {
    const boxNode = result.box
    if (!boxNode || !box.isMap(boxNode)) return undefined

    const keys = new Set<string>()
    for (const [key, value] of boxNode.value.entries()) {
      if (box.isUnresolvable(value)) keys.add(key)
    }

    return keys.size ? keys : undefined
  }

  setRecipe(recipeName: string, result: ResultItem) {
    const set = getOrCreateSet(this.recipe, recipeName)
    set.add(this.append(Object.assign({ type: 'recipe' }, result)))

    const encoder = this.encoder
    const recipes = this.context.recipes

    const recipeConfig = recipes.getConfig(recipeName)
    if (!recipeConfig) return

    const recipe = result
    const unresolved = this.unresolvedVariants(result)

    // treat recipe jsx like regular recipe + atomic
    if (result.type) {
      recipe.data.forEach((data) => {
        const [recipeProps, styleProps] = recipes.splitProps(recipeName, data)
        encoder.processStyleProps(styleProps)
        encoder.processRecipe(recipeName, recipeProps, unresolved)
      })
    } else {
      recipe.data.forEach((data) => {
        encoder.processRecipe(recipeName, data, unresolved)
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

  /** @internal Called only by the extractor-facing resolver, not by import classification. */
  addDependency(filePath: string) {
    this.dependencies.add(filePath.replaceAll('\\', '/'))
  }

  /** Cross-file value reads this extraction performed, with the digests read at parse time. */
  private exportReads: Array<{ file: string; name: string; digest: string | undefined }> = []

  /** @internal Set once by the parser after extraction, digests computed on warm caches. */
  setExportReads(reads: Array<{ file: string; name: string; digest: string | undefined }>) {
    this.exportReads = reads
  }

  /** @internal The reads a consumer can verify instead of re-folding; see the Vite plugin. */
  getExportReads(): ReadonlyArray<{ file: string; name: string; digest: string | undefined }> {
    return this.exportReads
  }

  /**
   * Local source paths crossed while resolving values this extraction actually encoded.
   *
   * The Project ledger deliberately records every local import, including ordinary runtime
   * bindings. Box nodes retain the declaration node followed while resolving a style value,
   * so this is the narrow semantic target set consumers can feed back to that ledger to recover
   * re-export/barrel paths without watching unrelated imports.
   */
  getDependencies() {
    const own = this.filePath?.replaceAll('\\', '/')
    const paths = new Set(this.dependencies)
    const seen = new Set<BoxNode>()
    const visit = (node: BoxNode | undefined) => {
      if (!node || seen.has(node)) return
      seen.add(node)

      const path = node.getNode?.()?.getSourceFile().getFilePath().replaceAll('\\', '/')
      if (path && path !== own) paths.add(path)

      if (box.isMap(node)) {
        for (const child of node.value.values()) visit(child)
      } else if (box.isArray(node)) {
        for (const child of node.value) visit(child)
      }
    }

    for (const item of this.all) {
      // A call of an imported inline recipe records compiler visibility but encodes no CSS;
      // the declaring file owns those rules and is watched by its own extraction result.
      if (item.type !== 'cva-call') visit(item.box)
    }

    return [...paths].sort()
  }

  merge(result: ParserResult) {
    result.css.forEach((item) => this.css.add(this.append(item)))
    result.cva.forEach((item) => this.cva.add(this.append(item)))
    result.sva.forEach((item) => this.sva.add(this.append(item)))
    result.cvaCall.forEach((item) => this.cvaCall.add(this.append(item)))
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
    for (const dependency of result.dependencies) this.dependencies.add(dependency)

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
      cvaCall: Array.from(this.cvaCall),
      token: Array.from(this.token),
      viewTransition: Array.from(this.viewTransition),
      recipe: Object.fromEntries(Array.from(this.recipe.entries()).map(([key, value]) => [key, Array.from(value)])),
      pattern: Object.fromEntries(Array.from(this.pattern.entries()).map(([key, value]) => [key, Array.from(value)])),
    }
  }
}
