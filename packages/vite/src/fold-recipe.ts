import { classFormatter, type ClassFormatterContext } from '@bamboocss/core'
import { compact, getRecipeClassNames, getRecipeIdentity } from '@bamboocss/shared'
import type { ParserResultInterface, ResultItem } from '@bamboocss/types'
import { Node, SyntaxKind } from 'ts-morph'

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
 * Reads `cva` and not `sva`, which is load-bearing rather than an omission. The parser records
 * a call of *either* as a recipe call, but an `sva` invocation returns one class per slot — an
 * object, not a string — so there is no literal to substitute. Leaving slot recipes out of this
 * map is what makes them decline as `unknown-recipe` instead of folding to a string that would
 * break every consumer reading `.root` off it.
 */
export const collectRecipeConfigs = (parserResult: ParserResultInterface): Map<string, RecipeEntry> => {
  const configs = new Map<string, RecipeEntry>()

  for (const definition of parserResult.cva) {
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

/** Marker for a binding the fold must never resolve — declared twice, or unresolvable. */
export const AMBIGUOUS: RecipeEntry = Object.freeze({ config: {}, name: '', box: undefined })

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

export type LowerResult =
  | { kind: 'class'; className: string }
  | { kind: 'decline'; reason: 'dynamic' | 'unsupported-shape' | 'unknown-recipe' }

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
   * The selection as the extractor resolved it, when there is exactly one resolution.
   *
   * Used only to *supply* values, never to decide which properties exist — a property the
   * extractor could not resolve is dropped from this object rather than flagged, so the
   * property names always come from the source. A name written at the call site but missing
   * here was dropped, and the call declines.
   */
  resolvedSelection?: Dict,
): LowerResult => {
  if (!entry || entry === AMBIGUOUS) return { kind: 'decline', reason: 'unknown-recipe' }

  const { config, name } = entry

  // A slot recipe returns one class per slot — an object, not a string. `collectRecipeConfigs`
  // already keeps these out by reading `cva` definitions only, but that is a coupling between
  // two files and this is the check that states the rule where it applies.
  if (config.slots !== undefined) return { kind: 'decline', reason: 'unsupported-shape' }

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

  if (args.length === 1) {
    const arg = args[0]
    if (!arg || !Node.isObjectLiteralExpression(arg)) return { kind: 'decline', reason: 'dynamic' }

    for (const property of arg.getProperties()) {
      // A spread contributes keys the build cannot enumerate; a computed key is one it cannot
      // name. Either way the selection is not fully known.
      if (!Node.isPropertyAssignment(property)) return { kind: 'decline', reason: 'dynamic' }

      const nameNode = property.getNameNode()
      if (Node.isComputedPropertyName(nameNode)) return { kind: 'decline', reason: 'dynamic' }

      const key = propertyKey(nameNode)
      if (key === undefined) return { kind: 'decline', reason: 'dynamic' }
      const literal = literalValue(property.getInitializer())

      if (literal !== undefined) {
        selection[key] = literal
        continue
      }

      // Not a literal, but the extractor may still have resolved it — a module constant, an
      // imported one, a helper's return value. Trusted only when this exact key survived,
      // which is what separates `badge({ tone: t })` with `const t = 'a'` above it from
      // `badge({ tone: t })` with a parameter. (Shorthand never reaches here: `{ tone }` is
      // not a PropertyAssignment and declines above.)
      if (!resolvedSelection || !Object.hasOwn(resolvedSelection, key)) {
        return { kind: 'decline', reason: 'dynamic' }
      }

      const value = resolvedSelection[key]
      // A nested object is not a variant selection, and `undefined` is `compact`'s job.
      if (value !== null && typeof value === 'object') return { kind: 'decline', reason: 'dynamic' }

      selection[key] = value
    }
  }

  // Exactly what `cvaFn` does: defaults first, then the selection with `undefined` dropped.
  const merged = { ...(config.defaultVariants ?? {}), ...compact(selection) }

  const className = getRecipeClassNames(name, config.variants, merged, ctx.utility.separator, classFormatter(ctx))

  return { kind: 'class', className }
}
