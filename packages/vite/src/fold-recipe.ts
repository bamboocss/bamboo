import { classFormatter, type ClassFormatterContext } from '@bamboocss/core'
import { compact, getRecipeClassNames, getRecipeIdentity, withoutSpace } from '@bamboocss/shared'
import type { ParserResultInterface, ResultItem } from '@bamboocss/types'
import { Node, SyntaxKind } from 'ts-morph'
import { declaredAtModuleScope } from './fold-partial'
import type { StaticStyleSetCompiler, StyleSetRecipeConfig } from './style-set'

/**
 * Lowering a call of an inline recipe to the class string it produces.
 *
 * The prize is not the `cva` runtime, which is small. It is the *config*: `cva({ base, variants })`
 * ships the whole style object to the browser purely so the runtime can hash it into a name and
 * pick classes off it. Those styles are already in the stylesheet. Once every call of a binding
 * is lowered, the binding is unreferenced and a bundler drops the config with it — measured at
 * 81 kB gzipped across one application's 1,297 inline recipes, against 4.5 kB for the runtime.
 *
 * Correct by construction rather than by a matching reimplementation: the class names come from
 * `getRecipeIdentity` and `getRecipeClassNames`, the same functions the browser runs, and the
 * prefixing and hashing from `classFormatter`, which is what the encoder emitted rules under.
 */

type Dict = Record<string, unknown>

/** A recipe's config, as the extractor resolved it. */
export interface RecipeConfig {
  className?: string
  base?: Dict
  variants?: Record<string, Record<string, unknown>>
  defaultVariants?: Record<string, unknown>
  compoundVariants?: unknown[]
  /** Present on a slot recipe, which resolves to one class per slot rather than a string. */
  slots?: unknown
}

/**
 * A recipe the fold can lower against.
 *
 * `name` is hashed once here rather than per call site: `getRecipeIdentity` serialises the
 * whole config to hash it, which measured as 91% of the per-call work when it sat inside
 * `lowerRecipeCall`. The runtime does it once per `cva()` for the same reason.
 *
 * `box` is the *definition's* node, carried so the fold can register the module the config
 * came from as a watch dependency. Without it, editing a config in another module leaves
 * every literal folded against it stale — the stylesheet gets a new identity and the element
 * keeps the old class.
 */
export interface RecipeEntry {
  config: RecipeConfig
  name: string
  box: ResultItem['box']
}

/**
 * Binding name → the config it was declared with.
 *
 * Built from the definitions the parser already recorded, walking each one to the declaration
 * that names it. The parser records a definition under the name it was *imported* as (`cva`),
 * and a call under the name the file *bound* (`badge`); this is what joins the two.
 *
 * Slot recipes are included only for the symbolic compiler. The legacy fold cannot replace an
 * `sva` call (it returns an object), while the symbolic path can replace a direct `.slot` access
 * with that slot's shared StyleSet.
 */
export const collectRecipeConfigs = (
  parserResult: ParserResultInterface,
  includeSlotRecipes = false,
): Map<string, RecipeEntry> => {
  const configs = new Map<string, RecipeEntry>()

  const definitions = includeSlotRecipes ? [...parserResult.cva, ...parserResult.sva] : parserResult.cva
  for (const definition of definitions) {
    const node = definition.box?.getNode?.()
    if (!node) continue

    const call = Node.isCallExpression(node) ? node : node.getFirstAncestorByKind(SyntaxKind.CallExpression)
    const declaration = call?.getFirstAncestorByKind(SyntaxKind.VariableDeclaration)
    const nameNode = declaration?.getNameNode()
    if (!nameNode || !Node.isIdentifier(nameNode)) continue

    // One resolution only. `cva(dark ? A : B)` yields a candidate per branch, and folding
    // against the first silently picks a config the call site may never see.
    if (definition.data?.length !== 1) {
      configs.set(nameNode.getText(), AMBIGUOUS)
      continue
    }

    const config = definition.data[0] as RecipeConfig | undefined
    if (!config || typeof config !== 'object') continue

    // A name declared twice in one file cannot be resolved to one config, and guessing would
    // fold half the call sites against the wrong recipe.
    if (configs.has(nameNode.getText())) {
      configs.set(nameNode.getText(), AMBIGUOUS)
      continue
    }

    configs.set(nameNode.getText(), { config, name: getRecipeIdentity(config), box: definition.box })
  }

  return configs
}

/** The generated binding a lowered dynamic axis calls. Lives in `cx`, which pulls no engine. */
export const RECIPE_PICK_HELPER = 'cvaPick'

/** Pick a complete precompiled StyleSet for one or more runtime recipe axes. */
export const RECIPE_MAP_HELPER = 'cvaMap'

/** Guard the exact compiler against accidentally materialising an enormous Cartesian product. */
export const DEFAULT_MAX_RECIPE_STATES = 65_536

/** What `recipe.splitVariantProps` calls, reached directly once the call is lowered. */
export const SPLIT_PROPS_HELPER = 'splitProps'

const HELPER = RECIPE_PICK_HELPER

/** Marker for a binding the fold must never resolve — declared twice, or unresolvable. */
export const AMBIGUOUS: RecipeEntry = Object.freeze({ config: {}, name: '', box: undefined })

/** `.size`, or `["x-large"]` when the variant is not a valid identifier. */
const IDENTIFIER = /^[A-Za-z_$][\w$]*$/
const propertyAccess = (key: string) => (IDENTIFIER.test(key) ? `.${key}` : `[${JSON.stringify(key)}]`)

const LITERAL_KINDS = new Set([
  SyntaxKind.StringLiteral,
  SyntaxKind.NoSubstitutionTemplateLiteral,
  SyntaxKind.NumericLiteral,
  SyntaxKind.TrueKeyword,
  SyntaxKind.FalseKeyword,
])

/**
 * The value a literal node denotes, or `undefined` for anything else.
 *
 * Read off the node rather than from the extractor's resolved data, because that data is lossy
 * in the direction that matters: a property it could not resolve is *dropped*, so `badge({ tone })`
 * and `badge({})` are identical there. Folding the first as if it were the second emits a class
 * string missing the variant — the element renders, wrongly, with no report.
 */
const literalValue = (node: Node | undefined): string | number | boolean | undefined => {
  if (!node || !LITERAL_KINDS.has(node.getKind())) return undefined
  if (Node.isStringLiteral(node) || Node.isNoSubstitutionTemplateLiteral(node)) return node.getLiteralValue()
  if (Node.isNumericLiteral(node)) return node.getLiteralValue()
  if (node.getKind() === SyntaxKind.TrueKeyword) return true
  if (node.getKind() === SyntaxKind.FalseKeyword) return false
  return undefined
}

/**
 * The property name a key node denotes.
 *
 * Read off the node rather than unquoted from its text. `{ '\\u0074one': 'a' }` names the
 * variant `tone`, and stripping the surrounding quotes leaves the escape uninterpreted — so
 * the variant did not match, its class was dropped, and the element rendered without it. A
 * numeric key normalises the same way: `{ 0x10: 'a' }` is the key `16`.
 */
const propertyKey = (nameNode: Node): string | undefined => {
  if (Node.isIdentifier(nameNode)) return nameNode.getText()
  if (Node.isStringLiteral(nameNode) || Node.isNoSubstitutionTemplateLiteral(nameNode)) {
    return nameNode.getLiteralValue()
  }
  if (Node.isNumericLiteral(nameNode)) return String(nameNode.getLiteralValue())
  return undefined
}

/**
 * Make `cvaPick` callable at this call site, by whatever name the file gives it.
 *
 * Not `ensureCxImport`: that one resolves `cx` and finds the declaration to extend by
 * matching the *callee* against an import. An inline recipe's callee is a local binding, so
 * there is nothing to match — the host here is any import of the generated css module, which
 * a file defining a recipe necessarily has, since `cva` came from it.
 */
export const ensureRecipeHelperImport = (
  imported: string,
  call: Node,
  isBambooCssModule: (mod: string) => boolean,
  isGeneratedCssModule: (mod: string) => boolean,
  isShadowed: (call: Node, name: string) => boolean,
  /**
   * The specifier to write a *new* import declaration with, when the file has none to extend.
   *
   * Only supplied for a recipe declared in another module, which is the case where the
   * premise above stops holding: such a file imports the binding, not the factory, so it
   * need not import the css module at all — and before this it declined for that reason
   * alone, having resolved everything else.
   */
  newImportModule?: string,
): { name: string; insert?: { pos: number; names: string[]; module?: string } } | undefined => {
  const sourceFile = call.getSourceFile()
  let host: ReturnType<typeof sourceFile.getImportDeclarations>[number] | undefined

  for (const declaration of sourceFile.getImportDeclarations()) {
    const mod = declaration.getModuleSpecifierValue()
    if (declaration.isTypeOnly()) continue

    for (const named of declaration.getNamedImports()) {
      if (named.isTypeOnly()) continue

      if (named.getNameNode().getText() === imported) {
        // Somebody else's `cvaPick`, or one shadowed here, is not the one this calls.
        if (!isBambooCssModule(mod)) return undefined
        const local = (named.getAliasNode() ?? named.getNameNode()).getText()
        return isShadowed(call, local) ? undefined : { name: local }
      }
    }

    if (!host && isGeneratedCssModule(mod) && declaration.getNamedImports().length > 0) host = declaration
  }

  if (!host && !newImportModule) return undefined

  // A module-scope binding of this name would collide with the one being added, and one in
  // scope at the call site would be reached instead of it.
  if (declaredAtModuleScope(sourceFile).has(imported)) return undefined
  if (isShadowed(call, imported)) return undefined

  if (!host) {
    // After the last import rather than at the top of the file. A directive prologue —
    // `'use client'`, which is exactly what a component file calling a recipe tends to
    // open with — stops being a directive the moment a statement precedes it.
    const declarations = sourceFile.getImportDeclarations()
    const anchor = declarations.at(-1)
    if (!anchor) return undefined

    return { name: imported, insert: { pos: anchor.getEnd(), names: [imported], module: newImportModule } }
  }

  const last = host.getNamedImports().at(-1)
  if (!last) return undefined

  return { name: imported, insert: { pos: last.getEnd(), names: [imported] } }
}

export type LowerResult =
  | { kind: 'class'; className: string; styles?: Dict }
  | {
      kind: 'slots'
      expression: string
      classNames: string[]
      helper?: typeof RECIPE_MAP_HELPER
      dynamic: boolean
    }
  /**
   * An expression, for a selection with an axis the build could not resolve.
   *
   * `badge({ tone })` becomes `"cva_x" + cvaPick(tone, {a:" cva_x--tone_a"}, " cva_x--tone_b")`.
   * Every class the recipe can produce is known — only which of them applies is not — so the
   * choice is what ships rather than the config it would have been derived from.
   *
   * `classNames` is every class the expression can emit, so a consumer checking that the CSS
   * backs what was folded sees all of them rather than only the branch taken. `staticClasses`
   * is the part that is unconditionally present — what `className` means elsewhere, where the
   * whole call resolved.
   */
  | {
      kind: 'expression'
      expression: string
      classNames: string[]
      staticClasses: string
      helper: typeof RECIPE_PICK_HELPER | typeof RECIPE_MAP_HELPER
    }
  | { kind: 'dynamic-style'; map: DynamicStyleMap }
  | { kind: 'decline'; reason: 'dynamic' | 'unsupported-shape' | 'unknown-recipe' }

export interface CompiledStyleMap {
  expression: string
  classNames: string[]
  staticClasses: string
  outputKind: 'class' | 'slots'
}

/** A finite recipe state space kept symbolic until an enclosing `cx()` has composed it. */
export interface DynamicStyleMap {
  outputKind: 'class' | 'slots'
  compile(before?: Dict[], after?: Dict[]): CompiledStyleMap
}

/**
 * Lower one invocation, or say why not.
 *
 * Every property written at the call site has to be a literal. A selection is not additive —
 * an unresolved variant does not merely omit a class, it can change which of several the
 * recipe applies — so a partially-known selection is not foldable at all.
 */
export const lowerRecipeCall = (
  call: Node,
  entry: RecipeEntry | undefined,
  ctx: ClassFormatterContext,
  /**
   * Whether an expression can be evaluated without doing anything observable.
   *
   * Passed in rather than imported, because `fold` already imports this module. Required, not
   * defaulted: it decides which properties may be resolved to a literal or dropped, and a
   * default in either direction is a decision a caller should have to make.
   */
  isInert: (node: Node) => boolean,
  /**
   * The selection as the extractor resolved it, when there is exactly one resolution.
   *
   * Used only to *supply* values, never to decide which properties exist — a property the
   * extractor could not resolve is dropped from this object rather than flagged, so the
   * property names always come from the source. A name written at the call site but missing
   * here was dropped, and the call declines.
   */
  resolvedSelection?: Dict,
  /**
   * The strict build compiler. When present, a fully-known recipe resolves to the same
   * global utility atoms as `css()` instead of materialising recipe-specific selectors.
   */
  styleCompiler?: StaticStyleSetCompiler,
  /** A directly-accessed slot of an inline `sva()` invocation. */
  slot?: string,
  /** Maximum complete selections an exact runtime decision table may inspect. */
  maxRecipeStates = DEFAULT_MAX_RECIPE_STATES,
): LowerResult => {
  if (!entry || entry === AMBIGUOUS) return { kind: 'decline', reason: 'unknown-recipe' }

  const { config, name } = entry

  // A slot recipe call itself returns an object. A direct `.slot` access is a string and the
  // static compiler can resolve it; the legacy fold deliberately keeps its old behaviour.
  if (config.slots !== undefined) {
    if (!styleCompiler || !Array.isArray(config.slots) || (slot !== undefined && !config.slots.includes(slot))) {
      return { kind: 'decline', reason: 'unsupported-shape' }
    }
  } else if (slot) {
    return { kind: 'decline', reason: 'unsupported-shape' }
  }

  // A config the extractor could not read is not an empty config. Folding against one emits
  // the bare identity of `{}` and deletes the call that would have produced real classes,
  // leaving the element permanently unstyled with nothing to report it.
  if (!config.base && !config.variants && !config.className) {
    return { kind: 'decline', reason: 'unknown-recipe' }
  }
  if (!Node.isCallExpression(call)) return { kind: 'decline', reason: 'unsupported-shape' }

  const args = call.getArguments()
  // `cvaFn` takes one selection. A second argument is a shape this does not model.
  if (args.length > 1) return { kind: 'decline', reason: 'unsupported-shape' }

  const selection: Dict = {}
  /** Variant → the source expression selecting it, for axes that stay runtime decisions. */
  const dynamicAxes = new Map<string, string>()
  /**
   * Variants whose expression could run something, in the order the source evaluates them.
   *
   * The text is kept, not just the key: a later property writing the same key replaces the
   * entry in `dynamicAxes`, and the expression recorded here would then never be emitted.
   */
  const effectful: Array<{ key: string; text: string }> = []

  if (args.length === 1) {
    const arg = args[0]
    if (!arg) return { kind: 'decline', reason: 'dynamic' }

    /**
     * `input(variantProps)` — a selection the build cannot see inside.
     *
     * Inline recipes only. `cva` resolves a selection with `getRecipeClassNames`, which reads
     * a variant value as a key and so cannot take a conditional — a `{ base, md }` object finds
     * no entry and names no class, exactly as `cvaPick` does. A **config** recipe routes its
     * selection through `createCss`, which *expands* conditions into one class per breakpoint,
     * so a scalar lookup silently drops them. That is why this lowering is not applied to
     * config recipes: for a dynamic axis the build cannot know which kind of value arrives.
     *
     * The classes are still knowable: a recipe emits one per declared variant, so the call is
     * one term per variant reading that binding. This is the shape a wrapper component takes,
     * where the variants are the component's public API and cannot be literals by definition.
     *
     * An identifier only. Each variant reads the binding again, and re-reading anything else —
     * a call, a property access — would evaluate it once per axis instead of once.
     */
    if (Node.isIdentifier(arg)) {
      const binding = arg.getText()

      for (const key of Object.keys(config.variants ?? {})) {
        dynamicAxes.set(key, `${binding}${propertyAccess(key)}`)
      }
    } else if (!Node.isObjectLiteralExpression(arg)) {
      return { kind: 'decline', reason: 'dynamic' }
    } else {
      for (const property of arg.getProperties()) {
        // A spread contributes keys the build cannot enumerate, and a computed key is one it
        // cannot name — neither leaves a knowable set of classes.
        if (Node.isSpreadAssignment(property)) return { kind: 'decline', reason: 'dynamic' }

        // `{ tone }`, the idiomatic spelling. The name is the expression.
        if (Node.isShorthandPropertyAssignment(property)) {
          // Last write wins, as the object literal itself would evaluate.
          dynamicAxes.set(property.getName(), property.getName())
          delete selection[property.getName()]
          continue
        }

        if (!Node.isPropertyAssignment(property)) return { kind: 'decline', reason: 'dynamic' }

        const nameNode = property.getNameNode()
        if (Node.isComputedPropertyName(nameNode)) return { kind: 'decline', reason: 'dynamic' }

        const key = propertyKey(nameNode)
        if (key === undefined) return { kind: 'decline', reason: 'dynamic' }

        const initializer = property.getInitializer()

        // An expression that could run something has to survive into the output, so it takes
        // the runtime path whatever its value resolves to. Folding it to a literal would delete
        // the call as surely as declining to fold would have kept the whole recipe.
        if (initializer && !isInert(initializer)) {
          // `hasOwn`, for the same reason the value side of these tables uses it: a key of
          // `toString` or `__proto__` reaches `Object.prototype`, so a plain lookup says the
          // variant exists, the emission loop over `Object.keys` then never emits it, and the
          // expression is deleted along with whatever it would have run.
          if (!Object.hasOwn(config.variants ?? {}, key)) {
            // Nowhere to re-emit it: this variant has no table, and dropping the property would
            // drop the call with it.
            return { kind: 'decline', reason: 'dynamic' }
          }

          effectful.push({ key, text: initializer.getText() })
          dynamicAxes.set(key, initializer.getText())
          delete selection[key]
          continue
        }

        const literal = literalValue(initializer)

        if (literal !== undefined) {
          selection[key] = literal
          dynamicAxes.delete(key)
          continue
        }

        // Not a literal, but the extractor may still have resolved it — a module constant, an
        // imported one, a helper's return value. Trusted only when this exact key survived,
        // which is what separates `badge({ tone: t })` with `const t = 'a'` above it from
        // `badge({ tone: t })` with a parameter. (Shorthand never reaches here: `{ tone }` is
        // not a PropertyAssignment and declines above.)
        if (!resolvedSelection || !Object.hasOwn(resolvedSelection, key)) {
          // Not resolvable, but still knowable: the config declares every value this variant
          // can take, so the choice among them is what ships.
          if (!initializer) return { kind: 'decline', reason: 'dynamic' }
          dynamicAxes.set(key, initializer.getText())
          delete selection[key]
          continue
        }

        const value = resolvedSelection[key]
        // A nested object is not a variant selection, and `undefined` is `compact`'s job.
        if (value !== null && typeof value === 'object') return { kind: 'decline', reason: 'dynamic' }

        selection[key] = value
        dynamicAxes.delete(key)
      }
    }
  }

  /**
   * Every expression that could run something has to reach the output carrying its own text.
   *
   * A later property writing the same key replaces it in `dynamicAxes` — `badge({ tone: a(),
   * tone: 'b' })` is last-wins for the *value*, but `a()` still runs, and emitting only the
   * literal would delete it. Duplicate keys are a type error in TypeScript; the fold does not
   * typecheck and does transform `.js`, so this is reachable.
   */
  const everyEffectSurvives = () => effectful.every(({ key, text }) => dynamicAxes.get(key) === text)

  // Exactly what `cvaFn` does: defaults first, then the selection with `undefined` dropped.
  const merged = { ...(config.defaultVariants ?? {}), ...compact(selection) }
  const format = classFormatter(ctx)

  const compiledSelection = (selected: Dict) => {
    if (!styleCompiler) return undefined

    if (Array.isArray(config.slots) && slot === undefined) {
      const slots: Record<string, string> = {}
      const classNames = new Set<string>()
      for (const slotName of config.slots) {
        const styles = styleCompiler.resolveRecipe(config as StyleSetRecipeConfig, selected, slotName)
        if (!styles) return undefined
        const className = styleCompiler.className(styles)
        slots[slotName] = className
        for (const token of className.split(' ')) if (token) classNames.add(token)
      }
      return { value: slots, classNames: [...classNames] }
    }

    const styles = styleCompiler.resolveRecipe(config as StyleSetRecipeConfig, selected, slot)
    if (!styles) return undefined
    const className = styleCompiler.className(styles)
    return { value: className, classNames: className.split(' ').filter(Boolean), styles }
  }

  if (dynamicAxes.size === 0) {
    if (!everyEffectSurvives()) return { kind: 'decline', reason: 'dynamic' }

    if (styleCompiler) {
      const compiled = compiledSelection(selection)
      if (!compiled) return { kind: 'decline', reason: 'dynamic' }
      if (typeof compiled.value === 'string') {
        return { kind: 'class', className: compiled.value, styles: compiled.styles }
      }
      return {
        kind: 'slots',
        expression: JSON.stringify(compiled.value),
        classNames: compiled.classNames,
        dynamic: false,
      }
    }

    return {
      kind: 'class',
      className: getRecipeClassNames(name, config.variants, merged, ctx.utility.separator, format),
    }
  }

  // Terms are emitted in the config's variant order, so two properties that could both run
  // something would evaluate in that order rather than the source's. One effectful property
  // cannot be reordered against itself; more than one has to already agree.
  if (!everyEffectSurvives()) return { kind: 'decline', reason: 'dynamic' }

  if (effectful.length > 1) {
    const variantOrder = Object.keys(config.variants ?? {})
    const keys = effectful.map((entry) => entry.key)
    const reordered = [...keys].sort((a, b) => variantOrder.indexOf(a) - variantOrder.indexOf(b))
    if (reordered.join('\u0000') !== keys.join('\u0000')) return { kind: 'decline', reason: 'dynamic' }
  }

  // Axes the config declares no values for contribute nothing at runtime either — `cvaFn`
  // looks one up and skips it — so they are dropped rather than declining the call.
  for (const key of [...dynamicAxes.keys()]) {
    if (!Object.hasOwn(config.variants ?? {}, key)) dynamicAxes.delete(key)
  }

  if (dynamicAxes.size === 0) {
    if (styleCompiler) {
      const compiled = compiledSelection(selection)
      if (!compiled) return { kind: 'decline', reason: 'dynamic' }
      if (typeof compiled.value === 'string') {
        return { kind: 'class', className: compiled.value, styles: compiled.styles }
      }
      return {
        kind: 'slots',
        expression: JSON.stringify(compiled.value),
        classNames: compiled.classNames,
        dynamic: false,
      }
    }

    return {
      kind: 'class',
      className: getRecipeClassNames(name, config.variants, merged, ctx.utility.separator, format),
    }
  }

  if (styleCompiler) {
    /**
     * Compile the finite recipe state space into a reduced decision table.
     *
     * Each leaf is a *complete* final StyleSet. This matters for declarations overridden by
     * variants and compounds: selecting independent per-axis atoms would put both values in
     * the utility layer and let stylesheet order, rather than the recipe's merge order, pick
     * the winner. Complete leaves retain the same precedence while sharing their atoms with
     * every `css()` and recipe in the build.
     *
     * `undefined` is its own edge because it restores a default variant. `null` and any
     * undeclared value take the miss edge and explicitly suppress that default. Declared
     * values use string keys, matching JavaScript's property-key coercion in the recipe
     * runtime. A flat alternating key/value array avoids the special `__proto__` semantics
     * of an object literal.
     */
    const axes = Object.keys(config.variants ?? {}).filter((key) => dynamicAxes.has(key))
    const stateCount = axes.reduce(
      (product, axis) => product * (Object.keys(config.variants?.[axis] ?? {}).length + 2),
      1,
    )
    if (stateCount > maxRecipeStates) {
      throw new Error(
        `Static recipe compilation would inspect ${stateCount.toLocaleString('en-US')} selections across ` +
          `${axes.length} runtime variant axes, above maxRecipeStates=${maxRecipeStates.toLocaleString('en-US')}. ` +
          `Make one or more axes statically known, split the recipe, or raise the limit explicitly.`,
      )
    }
    type SlotClasses = Record<string, string>
    type Leaf = string | SlotClasses
    type Ref = number

    const expressions = axes.map((axis) => dynamicAxes.get(axis)!)
    const wholeSlots = Array.isArray(config.slots) && slot === undefined

    const map: DynamicStyleMap = {
      outputKind: wholeSlots ? 'slots' : 'class',
      compile(before = [], after = []) {
        const nodes: Array<[Ref, Ref, Array<string | Ref>]> = []
        const nodeByShape = new Map<string, number>()
        const leaves: Leaf[] = []
        const leafByShape = new Map<string, number>()
        const emittedClasses = new Set<string>()

        const leaf = (dynamicSelection: Dict): Ref => {
          const selected = { ...selection, ...dynamicSelection }

          if (wholeSlots) {
            const compiled = compiledSelection(selected)
            if (!compiled || typeof compiled.value === 'string') return internLeaf('')
            for (const token of compiled.classNames) emittedClasses.add(token)
            return internLeaf(compiled.value)
          }

          const styles = styleCompiler.resolveRecipe(config as StyleSetRecipeConfig, selected, slot)
          if (!styles) return internLeaf('')
          const className = styleCompiler.className(styleCompiler.compose(...before, styles, ...after))
          for (const token of className.split(' ')) if (token) emittedClasses.add(token)
          return internLeaf(className)
        }

        // Leaves are referenced as bitwise-complemented indices (-1, -2, ...), while node
        // indices are non-negative. Complete class strings therefore appear once even when
        // many variant combinations resolve to the same StyleSet.
        function internLeaf(value: Leaf): Ref {
          const shape = JSON.stringify(value)
          const known = leafByShape.get(shape)
          if (known !== undefined) return ~known
          const id = leaves.length
          leaves.push(value)
          leafByShape.set(shape, id)
          return ~id
        }

        const buildNode = (index: number, dynamicSelection: Dict): Ref => {
          if (index === axes.length) return leaf(dynamicSelection)

          const axis = axes[index]!
          const values = Object.keys(config.variants?.[axis] ?? {})
          const miss = buildNode(index + 1, { ...dynamicSelection, [axis]: null })
          const absentSelection = { ...dynamicSelection }
          delete absentSelection[axis]
          const absent = buildNode(index + 1, absentSelection)

          const byValue: Array<string | Ref> = []
          for (const value of values) {
            byValue.push(value, buildNode(index + 1, { ...dynamicSelection, [axis]: value }))
          }

          const refs = [miss, absent, ...byValue.filter((_, valueIndex) => valueIndex % 2 === 1)] as Ref[]
          if (refs.every((ref) => ref === refs[0])) return refs[0]!

          const node: [Ref, Ref, Array<string | Ref>] = [miss, absent, byValue]
          const shape = JSON.stringify(node)
          const known = nodeByShape.get(shape)
          if (known !== undefined) return known

          const id = nodes.length
          nodes.push(node)
          nodeByShape.set(shape, id)
          return id
        }

        const root = buildNode(0, {})
        return {
          expression: `${RECIPE_MAP_HELPER}([${expressions.join(', ')}], ${JSON.stringify(nodes)}, ${JSON.stringify(leaves)}, ${root})`,
          classNames: [...emittedClasses],
          staticClasses: root < 0 && typeof leaves[~root] === 'string' ? (leaves[~root] as string) : '',
          outputKind: wholeSlots ? 'slots' : 'class',
        }
      },
    }

    return { kind: 'dynamic-style', map }
  }

  // Emitted in the config's variant order, which is the order `getRecipeClassNames` appends
  // in. Grouping the static classes first and the runtime ones after would put a dynamic axis
  // declared before a static one on the wrong side, so the same element would carry a
  // different `class` string in dev — where `cva` still runs — than in the build.
  const ownClass = format(name)
  const parts: string[] = [JSON.stringify(ownClass)]
  const classNames: string[] = [ownClass]

  for (const key of Object.keys(config.variants ?? {})) {
    const expression = dynamicAxes.get(key)

    if (expression === undefined) {
      // Resolved: the same three conditions `getRecipeClassNames` applies before appending.
      const value = merged[key]
      if (value == null) continue

      // The same three conditions `getRecipeClassNames` applies, including its own-key check —
      // without it a value of `'toString'` names a class the runtime never emits and no rule
      // backs, which is exactly the dev-versus-build divergence this ordering exists to avoid.
      const declared = config.variants?.[key]
      if (!declared || !Object.hasOwn(declared, value as string) || declared[value as string] == null) continue

      const className = format(`${name}--${key}${ctx.utility.separator}${withoutSpace(value as string)}`)
      parts.push(JSON.stringify(` ${className}`))
      classNames.push(className)
      continue
    }

    const values = config.variants![key]!
    const table: Record<string, string> = {}

    for (const value of Object.keys(values)) {
      const className = format(`${name}--${key}${ctx.utility.separator}${withoutSpace(value)}`)
      table[value] = ` ${className}`
      classNames.push(className)
    }

    // What the default contributes when the property is absent at runtime, resolved here.
    const fallbackValue = config.defaultVariants?.[key]
    const fallback =
      fallbackValue != null && values[fallbackValue as string] != null
        ? ` ${format(`${name}--${key}${ctx.utility.separator}${withoutSpace(fallbackValue as string)}`)}`
        : undefined

    parts.push(
      `${HELPER}(${expression}, ${JSON.stringify(table)}${fallback === undefined ? '' : `, ${JSON.stringify(fallback)}`})`,
    )
  }

  // Every axis turned out to name no variant, so nothing runtime survived.
  if (parts.length === 1) return { kind: 'class', className: ownClass }

  return {
    kind: 'expression',
    expression: parts.join(' + '),
    classNames,
    staticClasses: ownClass,
    helper: RECIPE_PICK_HELPER,
  }
}
