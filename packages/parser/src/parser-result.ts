import type { ParserOptions } from '@bamboocss/core'
import { BambooError, getOrCreateSet } from '@bamboocss/shared'
import type { ParserResultInterface, ResultItem } from '@bamboocss/types'
import { Node } from 'ts-morph'
import { findUnresolvedRecipeStyles, findUnresolvedStyles, type UnresolvedStyle } from './unresolved-styles'

function cartesian<T>(arrays: T[][]): T[][] {
  if (arrays.length === 0) return [[]]
  const [first, ...rest] = arrays
  const restProduct = cartesian(rest)
  return first.flatMap((item) => restProduct.map((combo) => [item, ...combo]))
}

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
   * Only collected under `cssMode: 'grouped'`, where one class names the whole call, so a
   * property the build cannot resolve changes the class rather than dropping a declaration
   * from it — and the element renders with no styles at all. Under `atomic` the same call
   * keeps everything the build did resolve, which is not worth interrupting a build over.
   */
  unresolved: UnresolvedStyle[] = []

  constructor(
    private context: ParserOptions,
    encoder?: ParserOptions['encoder'],
  ) {
    this.encoder = encoder ?? context.encoder
  }

  /**
   * Record a call whose styles the build could not fully see, at the call's own position.
   *
   * Used for losses the box tree cannot show — a ternary past the combination cap emits
   * fragments rather than whole objects, and every individual box in it resolved fine.
   */
  private reportUnresolved(result: ResultItem, reason: UnresolvedStyle['reason']) {
    const node = result.box?.getNode()
    const sourceFile = node?.getSourceFile()
    if (!node || !sourceFile) return

    const { line, column } = sourceFile.getLineAndColumnAtPos(node.getStart())
    this.unresolved.push({ filePath: sourceFile.getFilePath(), kind: 'grouped', line, column, reason })
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
    const grouped = this.context.config.cssMode === 'grouped'

    // `css([a, b])` arrives as a single entry holding an array, and `mergeCss` flattens it
    // before merging. Hashing the array itself instead reads its indices as a responsive
    // array — `css([{ color }, { padding }])` emitted the padding at the `sm` breakpoint,
    // in both modes. Flattened here so every path below sees the operands the runtime sees.
    //
    // Tested for before flattening: array arguments are rare, and `flatMap` allocates a
    // second array for every `css()` call in the codebase to serve them.
    const data = (
      result.data.some(Array.isArray) ? result.data.flatMap((obj) => (Array.isArray(obj) ? obj : [obj])) : result.data
    ) as Record<string, any>[]

    // Detection runs in both modes. It was gated on `grouped` because that is where a loss
    // is *fatal* to the call — one class names the whole thing. Under `atomic` the loss is
    // partial rather than total, but it is no less silent: the declarations the build could
    // not see have no rule, and the element renders without them.
    const unresolved = findUnresolvedStyles(result, grouped ? 'grouped' : 'atomic').filter(
      // Under `atomic`, only the surprising half. A spread the build could not read looks
      // static and is not — that is worth interrupting for. A value it could not evaluate
      // is the documented dynamic-styling shape, answered by `staticCss` and already linted
      // by `no-dynamic-styling`; warning on every one of those would bury the first.
      //
      // Grouped keeps both, because there a loss of either kind costs the whole call.
      (entry) => grouped || entry.reason === 'unenumerable-keys',
    )
    if (unresolved.length) {
      this.unresolved.push(...unresolved)

      if (grouped) {
        // Emit atomic rules for this call as well as its group.
        //
        // The runtime cannot name the group for a call the build could not fully see, so it
        // falls back to naming each declaration — and that only helps if rules for those
        // names exist. Grouped builds emit none, so without this the fallback lands on
        // nothing and the element is as unstyled as before.
        //
        // Gated on the call actually being at risk, so the duplication is bounded by how
        // many call sites are unresolvable rather than by the size of the stylesheet. The
        // declarations the build *did* resolve are the ones that end up applying, which is
        // exactly what `cssMode: 'atomic'` would have given for the same source.
        data.forEach((obj) => encoder.processAtomic(obj))
      }
    }

    if (!grouped || data.length <= 1) {
      data.forEach((obj) => (grouped ? encoder.processGrouped(obj) : encoder.processAtomic(obj)))
      return
    }

    // Multiple entries in grouped mode (ternaries, css.raw merging):
    // reconstruct the combinations the runtime would evaluate to.
    const keyCounts = new Map<string, number>()
    for (const obj of data) {
      for (const key of Object.keys(obj)) {
        keyCounts.set(key, (keyCounts.get(key) || 0) + 1)
      }
    }

    const hasOverlap = Array.from(keyCounts.values()).some((c) => c > 1)

    if (!hasOverlap) {
      // No overlapping keys (css.raw merge): combine all entries into one group
      encoder.processGroupedMerge(data)
      return
    }

    // A shared key means one of two things, and the extracted entries look identical either
    // way: alternatives to enumerate (a ternary's branches) or operands to merge (a second
    // argument overriding the first). The reconstruction below assumes alternatives, which
    // is right for `css({ color: on ? 'red' : 'blue' })` and wrong for
    // `css({ color: { base: 'red' } }, { color: { _hover: 'blue' } })` — where the runtime
    // deep-merges the two into a group this never emits.
    //
    // Telling them apart needs the source: a ternary lives inside one argument. So a
    // multi-argument call that overlaps is treated as at-risk and emits its atomic rules
    // too, leaving the element with every declaration rather than none.
    if (this.callArgumentCount(result) > 1) {
      this.reportUnresolved(result, 'ambiguous-merge')
      data.forEach((obj) => encoder.processAtomic(obj))
    }

    // Overlapping keys (ternary branches): separate base from branches,
    // then generate cartesian product of branch groups merged with base
    const overlappingKeys = new Set<string>()
    keyCounts.forEach((count, key) => {
      if (count > 1) overlappingKeys.add(key)
    })

    const baseEntries: Record<string, any>[] = []
    const branchEntries: Record<string, any>[] = []

    for (const obj of data) {
      if (Object.keys(obj).some((k) => overlappingKeys.has(k))) {
        branchEntries.push(obj)
      } else {
        baseEntries.push(obj)
      }
    }

    // Group branch entries by sorted key set (entries with same keys are alternatives)
    const branchGroups = new Map<string, Record<string, any>[]>()
    for (const entry of branchEntries) {
      const keySet = Object.keys(entry).sort().join('\0')
      const group = branchGroups.get(keySet) || []
      group.push(entry)
      branchGroups.set(keySet, group)
    }

    const groupArrays = Array.from(branchGroups.values())
    const totalCombinations = groupArrays.reduce((acc, g) => acc * g.length, 1)

    if (totalCombinations > 32) {
      // Past the cap the branches are emitted as fragments rather than as whole objects,
      // so the runtime asks for a class none of them named. This *is* a loss, and it is
      // reported here rather than by the box walk because only this knows the count.
      // Atomic rules go out alongside them so the runtime's fallback has somewhere to land.
      this.reportUnresolved(result, 'too-many-combinations')
      data.forEach((obj) => {
        encoder.processGrouped(obj)
        encoder.processAtomic(obj)
      })
      return
    }

    for (const combo of cartesian(groupArrays)) {
      encoder.processGroupedMerge([...baseEntries, ...combo])
    }
  }

  /**
   * How many arguments the call this result came from was written with.
   *
   * Returns 1 for anything that is not a call — a JSX element, or a box that lost its node —
   * since the question only separates operands from branches and neither has operands.
   */
  private callArgumentCount(result: ResultItem) {
    const node = result.box?.getNode()
    return node && Node.isCallExpression(node) ? node.getArguments().length : 1
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
   * Not gated on `cssMode`, unlike the `css()` check in `setCss`. That one exists because
   * grouping names a whole call with one class; this one exists because a recipe is named
   * from a *hash of its config*, which is true in every mode. A declaration the build cannot
   * see changes the hash, so the build emits rules under one name and the browser asks for
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

    const encoder = this.encoder
    const grouped = this.context.config.cssMode === 'grouped'
    result.data.forEach((obj) => encoder.processPattern(name, obj, grouped))

    // A pattern resolves to a single `css()` call, but the build never recombines the
    // entries a conditional value splits it into — `stack({ gap: on ? '2' : '4', padding: '2' })`
    // encodes a group per entry and the runtime asks for the merge of them. Only `setCss`
    // enumerates combinations, so the rest degrade instead: atomic rules go out alongside
    // the groups, and the element keeps every declaration.
    if (grouped && !this.groupIsExact(result)) {
      result.data.forEach((obj) => encoder.processPattern(name, obj, false))
    }
  }

  /**
   * Whether the group encoded for this result is the one the runtime will ask for.
   *
   * True only when the build saw the whole thing at once: one style object, with every
   * value in it resolved. Several objects means the runtime merges them into a call this
   * never encoded — `setCss` reconstructs those combinations, and nothing else does — and
   * an unresolved value means the merge would not have matched anyway.
   *
   * Answering "no" costs a call site its atomic rules, which is CSS that duplicates the
   * group. Answering a wrong "yes" costs the element every style it has, so this is
   * deliberately conservative.
   */
  private groupIsExact(result: ResultItem) {
    if (result.data.length !== 1) return false
    return findUnresolvedStyles(result, 'grouped').length === 0
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
