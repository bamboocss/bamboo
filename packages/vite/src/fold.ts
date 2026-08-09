import { resolveTsPathPattern } from '@bamboocss/config/ts-path'
import type { Context } from '@bamboocss/core'
import { type BoxNode, box, unbox } from '@bamboocss/extractor'
import type { Dict, ParserResultInterface, ResultItem } from '@bamboocss/types'
import MagicString from 'magic-string'
import { dirname, relative, resolve as resolvePath } from 'node:path'
import { Node, type SourceFile, SyntaxKind } from 'ts-morph'
import {
  AMBIGUOUS,
  collectRecipeConfigs,
  ensureRecipeHelperImport,
  lowerRecipeCall,
  RECIPE_PICK_HELPER,
  SPLIT_PROPS_HELPER,
  type RecipeEntry,
} from './fold-recipe'
import {
  accountsForSource,
  ensureCxImport,
  findBambooBinding,
  isStaticBox,
  LEAF_HELPER,
  planPartialFold,
} from './fold-partial'
import {
  createConstantSlotCheck,
  createRuntimeCss,
  createRuntimeRecipe,
  createRuntimeToken,
  createRuntimeTokenVar,
  type RuntimeCss,
} from './runtime-css'

/**
 * Why a call site was left alone. Surfaced through `panda`-style diagnostics so a
 * user can tell the difference between "this folded" and "this silently didn't".
 */
export type SkipReason =
  | 'dynamic' // some part of the arguments could not be resolved at build time
  | 'raw-call' // `css.raw(...)` returns a style object, not a class string
  | 'not-foldable' // the call cannot evaluate to a class string at all (cva/sva)
  | 'recipe-call' // an inline recipe call whose selection the build could not fully resolve
  | 'unsupported-kind' // could fold in principle, but this phase does not (config recipes)
  | 'not-imported' // the callee is not a Bamboo import — a local function of the same name
  | 'no-call-expression' // could not locate the enclosing call to replace
  | 'overlapping' // nested inside another fold
  | 'empty' // resolved to no class names at all
  | 'unresolved-token' // `token(...)` resolves to no usable string, so its fallback decides
  | 'runtime-binding' // a bamboo import still referenced after the rewrite, whoever left it

export interface FoldedCall {
  name: string
  /**
   * What the call collapsed to.
   *
   * `class` is every style surface: a class string bound for a `class` attribute. `value`
   * is `token()`, which resolves to a CSS *value* (`var(--colors-red-300)`). The two are
   * not interchangeable, and a consumer that checks folded classes against the emitted
   * stylesheet has to skip the latter — there is no rule named after a variable reference.
   */
  kind: 'class' | 'value'
  /** The class string resolved outright, empty when the whole call lowered to ternaries. */
  className: string
  /**
   * Every class literal the replacement emits, including both arms of each ternary — so a
   * consumer checking that folded classes have CSS behind them sees the branches too,
   * which `className` alone does not carry.
   */
  classNames: string[]
  /** The literal written in place of the call, for a `value` fold. */
  value?: string
  start: number
  end: number
}

export interface SkippedCall {
  name: string
  reason: SkipReason
  start: number
  end: number
}

export interface FoldResult {
  code: string
  /** Null when nothing was folded, so callers can return the original module untouched. */
  map: ReturnType<MagicString['generateMap']> | null
  folded: FoldedCall[]
  skipped: SkippedCall[]
  /**
   * Other modules a folded value came from.
   *
   * The extractor resolves values across files, so `css(importedStyles, { … })` folds
   * to a string that depends on a file this module only imports. Without registering
   * that edge, editing the imported module leaves a stale literal behind in every
   * consumer. Bundlers need these as watch files.
   */
  dependencies: string[]
}

export interface FoldOptions {
  ctx: Context
  code: string
  parserResult: ParserResultInterface
  filePath: string
  /** Reuse one runtime `css` across files in a build. */
  runtimeCss?: RuntimeCss
  /**
   * Split a `css()` call that is only partly static, keeping the dynamic half at runtime.
   * On by default.
   */
  partial?: boolean
  /**
   * Parse another module, for a recipe whose `cva` config lives outside this one.
   *
   * Threaded in rather than read off `ctx`, because the project belongs to the node
   * context and this signature takes the core one. Its absence is a supported state:
   * without it a cross-module recipe call is still *reported*, which is the half that
   * used to be missing entirely — it simply cannot be lowered.
   *
   * Pulling the module on demand is also what makes the fold order-independent. A
   * bundler transforms a consumer before the module it imports, so a registry built
   * from what has been transformed so far would fold or decline the same file
   * depending on discovery order.
   */
  parseModule?: (filePath: string) => ParserResultInterface | undefined
  /**
   * Configs of modules other than this one, shared across a build.
   *
   * Owned by the caller because it has to outlive one call: the declaring module would
   * otherwise be re-parsed once per module that imports it, which is `consumers x module
   * size` on the transform path — measured at 909ms against 8.3ms for fifty consumers of a
   * hundred-recipe module. The caller clears an entry when the file changes, which is the
   * only place that knows.
   */
  recipeConfigCache?: Map<string, ForeignRecipes>
  /**
   * Also report bamboo bindings the rewrite left behind, whatever the skip ledger says.
   *
   * The ledger holds only calls something recognised, so it answers "of the calls I looked
   * at, which survived" — and a guarantee built on it is worth exactly what the recogniser
   * is. A cross-module recipe call used to appear in neither column, so a build could report
   * a clean sweep while shipping hundreds of them.
   *
   * This asks what the guarantee actually claims: after the rewrite, is anything from a
   * bamboo module still referenced? Off by default because it costs an identifier walk, and
   * only `strict` needs an answer it can fail a build on.
   */
  reportSurvivors?: boolean
  /**
   * The module's own AST, when the caller already holds it.
   *
   * Only `reportSurvivors` needs it, and only for the case it exists to catch: a module whose
   * bamboo usage produced no parser result at all has no call to reach the AST through.
   */
  sourceFile?: SourceFile
}

/**
 * `cva`/`sva` return a function, so neither *definition* can collapse to a class string.
 * `token` also resolves to no class, but it does resolve to a literal, so it folds through
 * its own path rather than being declined outright.
 *
 * Their invocations are a different matter and do fold — `cva`'s through `fold-recipe`,
 * which is a separate set because the call is recorded under the name the file bound rather
 * than the name it imported. `sva`'s do not: a slot recipe resolves to one class per slot.
 */
const FOLDABLE_TYPES = new Set(['css', 'pattern', 'recipe'])

/**
 * The class strings inside a lowered ternary — `e ? "c_red" : "c_blue"` gives both arms.
 *
 * They are read back out of the emitted text rather than threaded through the planner,
 * because the planner's product *is* that text: anything it did not write cannot appear
 * here, and anything it did cannot be missed.
 */
const literalsIn = (expression: string): string[] =>
  [...expression.matchAll(/"((?:[^"\\]|\\.)*)"/g)].flatMap((match) => JSON.parse(match[0]).split(' ')).filter(Boolean)

/**
 * The kinds reported as `not-foldable`, which is permanent rather than a limit of this
 * phase — hence separate from `unsupported-kind`, where a slot recipe lands because it
 * resolves to one class per slot rather than to a single string.
 */
const UNFOLDABLE_TYPES = new Set(['cva', 'sva'])

/**
 * The skip reasons that leave a `css()`-family call in the output.
 *
 * `overlapping` is handled by the enclosing fold, and `not-imported` is somebody else's
 * function of the same name — neither leaves a call of ours. `not-foldable` is a `cva`/`sva`
 * definition, which keeps the recipe runtime rather than the css engine; see `strict`.
 */
export const SURVIVES_TO_RUNTIME = new Set<SkipReason>([
  'dynamic',
  // Not a declined call at all: a binding the rewrite left referenced. It is the one entry
  // here that does not depend on something having recognised a call, which is what makes the
  // guarantee independent of the recogniser rather than a restatement of it.
  'runtime-binding',
  'raw-call',
  'unsupported-kind',
  'no-call-expression',
  'empty',
  'unresolved-token',
])

/**
 * A call of a recipe the file bound itself: `const badge = cva(...)`, then `badge({ tone })`.
 *
 * Folded when the whole selection resolves, reported under this reason when it does not.
 * Deliberately all-or-nothing: an unresolved variant does not merely omit its own class, so a
 * partially-known selection is not foldable at all.
 *
 * Visible at all because it used to not be. The parser matched calls by imported name, so a
 * local binding was never recorded, and an unfoldable invocation looked identical to code
 * nothing had parsed.
 */
const RECIPE_CALL_TYPE = 'cva-call'

/**
 * An identifier that actually reads the binding.
 *
 * `getDescendantsOfKind(Identifier)` yields every name in the file, and most of them bind or
 * label rather than read: a JSX tag (`<button/>` against a recipe called `button`), an object
 * key, a property name, a declaration. Counting those failed builds on modules that had
 * folded completely — and `button`, `input`, `label`, `select`, `table`, `dialog` and `form`
 * are all ordinary recipe names as well as intrinsic elements.
 *
 * A type position is excluded for a different reason: it is erased, and with it the import.
 */
const isValueReference = (identifier: Node): boolean => {
  const parent = identifier.getParent()
  if (!parent) return false

  // The declaration naming it, not a use of it.
  if (Node.isImportSpecifier(parent) || Node.isExportSpecifier(parent)) return false
  if (Node.isImportClause(parent) || Node.isNamespaceImport(parent)) return false

  // `o.css` and `a.b.css` name a member. The left of either is a read and reaches here as its
  // own identifier.
  if (Node.isPropertyAccessExpression(parent) && parent.getNameNode() === identifier) return false
  if (Node.isQualifiedName(parent) && parent.getRight() === identifier) return false

  // `{ css: 1 }` is a key. `{ css }` is a ShorthandPropertyAssignment and *is* a read, so it
  // is deliberately not matched here.
  if (Node.isPropertyAssignment(parent) && parent.getNameNode() === identifier) return false
  if (
    Node.isMethodDeclaration(parent) ||
    Node.isPropertyDeclaration(parent) ||
    Node.isGetAccessorDeclaration(parent) ||
    Node.isSetAccessorDeclaration(parent) ||
    Node.isMethodSignature(parent) ||
    Node.isPropertySignature(parent) ||
    Node.isEnumMember(parent)
  ) {
    if (parent.getNameNode() === identifier) return false
  }

  // `label: for (…) break label` names a target, not a value.
  if (Node.isLabeledStatement(parent) || Node.isBreakStatement(parent) || Node.isContinueStatement(parent)) {
    return false
  }

  // `<button />` is an intrinsic element, named by a string as far as the runtime is
  // concerned. `<Button />` is not: it reads the binding, so a recipe kept alive only as a
  // component tag has to count. The case of the first character is the whole distinction JSX
  // draws, and it is what TypeScript resolves on too.
  if (Node.isJsxOpeningElement(parent) || Node.isJsxSelfClosingElement(parent) || Node.isJsxClosingElement(parent)) {
    const tag = parent.getTagNameNode()
    if (tag === identifier) return identifier.getText()[0] === identifier.getText()[0]?.toUpperCase()
  }
  if (Node.isJsxAttribute(parent)) return false

  // `({ css: local }) => …` — the key is the *property* read off the argument, not the
  // imported binding. Only `getNameNode` is the local one, so both have to be asked.
  if (Node.isBindingElement(parent) && parent.getPropertyNameNode() === identifier) return false

  // A binding of the name shadows the import rather than reading it.
  if (
    (Node.isVariableDeclaration(parent) ||
      Node.isParameterDeclaration(parent) ||
      Node.isBindingElement(parent) ||
      Node.isFunctionDeclaration(parent) ||
      Node.isClassDeclaration(parent)) &&
    parent.getNameNode() === identifier
  ) {
    return false
  }

  // `typeof css`, `Foo<typeof css>`, an interface member — all erased with the type.
  return !identifier.getFirstAncestor(
    (ancestor) =>
      Node.isTypeNode(ancestor) || Node.isTypeAliasDeclaration(ancestor) || Node.isInterfaceDeclaration(ancestor),
  )
}

/**
 * Imports a surviving reference to is not a failure.
 *
 * The first four are what the fold itself writes; all live in `cx` and pull no engine, so a
 * reference to one is the fold having worked.
 *
 * `cva` and `sva` are there for the reason `SURVIVES_TO_RUNTIME` omits `not-foldable`: a
 * recipe *definition* cannot fold to a class string and never could, and what it keeps is the
 * recipe runtime rather than the css engine — which `strict` accepts. Their unfoldable
 * invocations are reported separately, as `recipe-call`.
 */
const PERMITTED_BINDINGS = new Set(['cx', 'cva', 'sva', RECIPE_PICK_HELPER, SPLIT_PROPS_HELPER, LEAF_HELPER])

/** Where an imported recipe was declared, as the parser recorded it on the call. */
type RecipeOrigin = NonNullable<ResultItem['origin']>

/**
 * What one foreign module contributes, in a form that outlives it.
 *
 * Plain data only. Anything holding a ts-morph node would be read after the next
 * `addSourceFile` forgets that module's tree.
 */
export interface ForeignRecipes {
  configs: Map<string, RecipeEntry>
  /** How that module spelled the css module, for a helper import written into a consumer. */
  cssSpecifier?: string
}

/**
 * The pieces `trim` reduces a module specifier by, hoisted because a regex literal
 * constructs a new object every time it is evaluated and `trim` runs per specifier per
 * import declaration per module.
 */
const LEADING_RELATIVE = /^(?:\.\.?\/)+/
const TRAILING_SLASH = /\/$/
const MODULE_EXTENSION = /\.[mc]?[jt]sx?$/
const TRAILING_INDEX = /\/index$/

/**
 * An argument that cannot run anything when it is evaluated.
 *
 * `token(path, fallback)` evaluates both arguments before the call, so a fold that drops
 * the fallback also drops whatever evaluating it would have done. `token('x', compute())`
 * is pathological, but the fold's contract is behaviour preservation and a literal is the
 * cheap way to prove it: no call, no property read, no getter.
 */
const isInertArgument = (node: Node): boolean =>
  Node.isStringLiteral(node) ||
  Node.isNumericLiteral(node) ||
  Node.isNoSubstitutionTemplateLiteral(node) ||
  node.getKind() === SyntaxKind.TrueKeyword ||
  node.getKind() === SyntaxKind.FalseKeyword ||
  node.getKind() === SyntaxKind.NullKeyword ||
  (Node.isIdentifier(node) && node.getText() === 'undefined')

/**
 * An expression whose evaluation cannot do anything observable, so deleting it preserves
 * behaviour.
 *
 * `isInertArgument` covers the leaves; this walks the object and array literals a recipe
 * call is actually written with. A spread runs the source's getters, a computed key runs an
 * expression, a getter or method definition is a function — none of those are safe to
 * delete, so they are declined rather than enumerated.
 */
export const isInertExpression = (node: Node): boolean => {
  if (isInertArgument(node)) return true

  // A bare identifier is a binding read, which cannot run anything — and this check is
  // about *inertness*, not about knowing the value. That is the whole point for a constant
  // slot: `checkbox({ size: dyn }).control` resolves the same whatever `dyn` holds. A
  // property access is excluded on purpose, since reading one can run a getter — Solid
  // compiles props to accessors, so `props.size` is exactly that case.
  //
  // Not strictly true of a binding in its temporal dead zone, which throws on read. Folding
  // past `checkbox({ size: later }).control` before `const later` turns a ReferenceError
  // into a class — but the code is broken either way, and proving initialisation order
  // costs far more than that is worth.
  if (Node.isIdentifier(node)) return true

  // Type-only wrappers are erased before anything runs, so they cannot add an effect. These
  // are how a variant prop is normally written in TypeScript — `dyn as 'sm'`, `dyn!`,
  // `dyn satisfies Size` — and rejecting them lost folds that used to land.
  if (
    Node.isAsExpression(node) ||
    Node.isSatisfiesExpression(node) ||
    Node.isNonNullExpression(node) ||
    Node.isTypeAssertion(node) ||
    Node.isParenthesizedExpression(node)
  ) {
    return isInertExpression(node.getExpression())
  }

  // A function is inert to *define*; only calling one runs anything, and nothing here does.
  if (Node.isArrowFunction(node) || Node.isFunctionExpression(node)) return true
  if (Node.isRegularExpressionLiteral(node) || Node.isBigIntLiteral(node)) return true

  if (Node.isPrefixUnaryExpression(node)) {
    const operator = node.getOperatorToken()
    return (
      (operator === SyntaxKind.MinusToken ||
        operator === SyntaxKind.PlusToken ||
        operator === SyntaxKind.ExclamationToken ||
        operator === SyntaxKind.TildeToken) &&
      isInertExpression(node.getOperand())
    )
  }

  // `??`, `||` and `&&` only ever evaluate their operands. Arithmetic and comparison are
  // excluded because they coerce, which can reach `valueOf`/`Symbol.toPrimitive`.
  if (Node.isBinaryExpression(node)) {
    const operator = node.getOperatorToken().getKind()
    return (
      (operator === SyntaxKind.QuestionQuestionToken ||
        operator === SyntaxKind.BarBarToken ||
        operator === SyntaxKind.AmpersandAmpersandToken) &&
      isInertExpression(node.getLeft()) &&
      isInertExpression(node.getRight())
    )
  }

  if (Node.isObjectLiteralExpression(node)) {
    return node.getProperties().every((property) => {
      // A shorthand `{ size }` is a variable read, which is inert.
      if (Node.isShorthandPropertyAssignment(property)) return true
      if (!Node.isPropertyAssignment(property)) return false
      if (Node.isComputedPropertyName(property.getNameNode())) return false

      const initializer = property.getInitializer()
      return initializer !== undefined && isInertExpression(initializer)
    })
  }

  if (Node.isArrayLiteralExpression(node)) return node.getElements().every(isInertExpression)

  return false
}

/**
 * Source files a box tree reaches, other than the one being folded.
 *
 * When the extractor resolves an imported identifier it boxes the *declaration's*
 * node, which lives in the defining module. Walking the tree and reading each node's
 * source file therefore recovers exactly the files a fold depended on — narrower and
 * more accurate than treating every import of the module as a dependency.
 */
const collectSourceFiles = (node: BoxNode | undefined, ctx: DependencyScan, seen = new Set<BoxNode>()) => {
  if (!node || seen.has(node)) return
  seen.add(node)

  ctx.record(node.getNode?.())

  if (box.isMap(node)) {
    for (const child of node.value.values()) collectSourceFiles(child, ctx, seen)
    return
  }

  if (box.isArray(node)) {
    for (const child of node.value) collectSourceFiles(child, ctx, seen)
  }
}

/**
 * Resolving a node to its file path is the expensive part of the scan, so paths are
 * memoized per `SourceFile` and the module's own file is short-circuited — which is
 * the overwhelmingly common case, since most folds read nothing but their own source.
 */
interface DependencyScan {
  record: (node: Node | undefined) => void
  results: Set<string>
}

const createDependencyScan = (ownFile: SourceFile): DependencyScan => {
  const results = new Set<string>()
  const paths = new Map<SourceFile, string | null>()

  return {
    results,
    record(node) {
      if (!node) return

      const sourceFile = node.getSourceFile()
      if (sourceFile === ownFile) return

      let path = paths.get(sourceFile)
      if (path === undefined) {
        path = sourceFile.getFilePath()
        paths.set(sourceFile, path)
      }
      if (path) results.add(path)
    },
  }
}

/**
 * The call expression to replace.
 *
 * `extractCallExpressionArguments` boxes the argument list against the call node and
 * pushes `[callNode, argNode]` onto each argument's stack, so the call is reachable
 * from either shape the parser stores: the argument array (multi-arg) or the first
 * argument's map (single-arg).
 */
const findCallExpression = (node: BoxNode): Node | undefined => {
  const own = node.getNode?.()
  if (own && Node.isCallExpression(own)) return own

  const stack = node.getStack?.() ?? []
  for (const entry of stack) {
    if (Node.isCallExpression(entry)) return entry
  }

  // Single-argument calls box the object literal directly; its parent is the call.
  let current: Node | undefined = own
  for (let depth = 0; current && depth < 3; depth++) {
    if (Node.isCallExpression(current)) return current
    current = current.getParent()
  }

  return undefined
}

/**
 * `css.raw(...)` must keep returning a style object — folding it to a class string
 * breaks every caller composing those styles. The file matcher strips `.raw` when it
 * normalizes function names, so the parser result cannot tell us; the callee text can.
 */
const isRawCall = (call: Node): boolean => {
  if (!Node.isCallExpression(call)) return false
  const callee = call.getExpression().getText()
  return callee === 'raw' || callee.endsWith('.raw')
}

/** The identifier a callee is rooted at: `css` for `css(…)`, `panda` for `panda.css(…)`. */
const calleeRootName = (call: Node): string | undefined => {
  if (!Node.isCallExpression(call)) return undefined

  let current: Node = call.getExpression()
  while (Node.isPropertyAccessExpression(current)) {
    current = current.getExpression()
  }

  return Node.isIdentifier(current) ? current.getText() : undefined
}

/**
 * Local names a module binds to an import of bamboo's own generated system.
 *
 * The parser matches by name and asks neither question this does — deliberately, since
 * for CSS extraction the worst case is a few unused rules. A transform cannot be that
 * relaxed, and it needs both halves:
 *
 * - imported at all, or a user's `const css = (s) => JSON.stringify(s)` gets rewritten
 * - imported *from bamboo*, or `import { css } from '@emotion/css'` does, which is the
 *   likelier accident of the two since a migrating project has both in the tree
 *
 * Answered together and once per file, because the scan is the expensive part and both
 * answers fall out of the same pass. Per call site instead of per file, this scan
 * measured +74% on the largest sandbox module.
 */
const bambooImportedNames = (sourceFile: SourceFile, ctx: Context): Set<string> => {
  const names = new Set<string>()

  for (const declaration of sourceFile.getImportDeclarations()) {
    const mod = declaration.getModuleSpecifierValue()

    for (const named of declaration.getNamedImports()) {
      const name = named.getNameNode().getText()
      const alias = named.getAliasNode()?.getText() ?? name
      if (ctx.imports.match({ mod, name, alias })) names.add(alias)
    }

    const namespace = declaration.getNamespaceImport()
    if (namespace) {
      const alias = namespace.getText()
      if (ctx.imports.match({ mod, name: alias, alias, kind: 'namespace' })) names.add(alias)
    }
  }

  return names
}

/**
 * Is the callee the imported binding, or a local one that shadows it?
 *
 * A block-scoped binding of the same name is legal alongside the import, and it is
 * the one the call actually reaches. Walking ancestors is the precise answer; the
 * cost is kept off the common path by only inspecting the two node kinds that can
 * introduce a binding. Ancestors of a call in JSX are overwhelmingly elements and
 * attributes, which match neither and cost nothing.
 */
const isShadowed = (call: Node, name: string): boolean => {
  for (let node: Node | undefined = call.getParent(); node; node = node.getParent()) {
    if (Node.isSourceFile(node)) return false
    if (bindsName(node, name)) return true
  }
  return false
}

/**
 * Does a binding name introduce `name`?
 *
 * A plain identifier check is not enough: destructuring is the likeliest way a
 * same-named local reaches a call, since `({ css }) => css(…)` is what a component
 * taking a `css` prop looks like. Nested and rest elements bind too, so the pattern
 * is walked rather than inspected at the top level.
 */
const bindingIntroduces = (nameNode: Node | undefined, name: string): boolean => {
  if (!nameNode) return false
  if (Node.isIdentifier(nameNode)) return nameNode.getText() === name

  if (Node.isObjectBindingPattern(nameNode) || Node.isArrayBindingPattern(nameNode)) {
    return nameNode
      .getElements()
      .some((element) => Node.isBindingElement(element) && bindingIntroduces(element.getNameNode(), name))
  }

  return false
}

const declarationsBind = (list: Node | undefined, name: string): boolean =>
  Node.isVariableDeclarationList(list) &&
  list.getDeclarations().some((declaration) => bindingIntroduces(declaration.getNameNode(), name))

const bindsName = (scope: Node, name: string): boolean => {
  if (Node.isBlock(scope)) {
    return scope.getStatements().some((statement) => statementBinds(statement, name))
  }

  if (
    Node.isFunctionDeclaration(scope) ||
    Node.isArrowFunction(scope) ||
    Node.isFunctionExpression(scope) ||
    Node.isMethodDeclaration(scope)
  ) {
    return scope.getParameters().some((parameter) => bindingIntroduces(parameter.getNameNode(), name))
  }

  // `catch` and the three `for` heads bind in their own scope rather than in the
  // block they enclose, so walking blocks alone never sees them.
  if (Node.isCatchClause(scope)) {
    return bindingIntroduces(scope.getVariableDeclaration()?.getNameNode(), name)
  }

  if (Node.isForStatement(scope) || Node.isForOfStatement(scope) || Node.isForInStatement(scope)) {
    return declarationsBind(scope.getInitializer(), name)
  }

  return false
}

const statementBinds = (statement: Node, name: string): boolean => {
  if (Node.isVariableStatement(statement)) {
    return statement.getDeclarations().some((declaration) => bindingIntroduces(declaration.getNameNode(), name))
  }

  if (Node.isFunctionDeclaration(statement) || Node.isClassDeclaration(statement)) {
    return statement.getNameNode()?.getText() === name
  }

  return false
}

const hasStyles = (data: ResultItem['data']): data is Dict[] =>
  data.length > 0 && data.every((entry) => entry != null && typeof entry === 'object')

/**
 * Pair each source argument with the box the parser stored for it, and require the
 * box to account for all of it. The parser keeps either the whole argument array
 * (multi-arg calls) or just the first argument's map (single-arg calls).
 */
const argumentsAccountedFor = (call: Node, boxNode: BoxNode): boolean => {
  if (!Node.isCallExpression(call)) return false

  const args = call.getArguments()
  // Nothing written is nothing to account for. `buttonStyle()` means every default, which is
  // exactly what the extractor recorded — declining it left a call that folds when spelled
  // `buttonStyle({})` and does not when spelled `buttonStyle()`.
  if (args.length === 0) return true

  if (box.isArray(boxNode) && boxNode.getNode() === call) {
    if (boxNode.value.length !== args.length) return false
    return args.every((arg, index) => accountsForSource(arg, boxNode.value[index]))
  }

  // Single-argument shape: the stored box is the argument itself.
  if (args.length !== 1) return false
  return accountsForSource(args[0], boxNode)
}

export const foldSource = (options: FoldOptions): FoldResult => {
  const {
    ctx,
    code,
    parserResult,
    partial: partial_ = true,
    runtimeCss = createRuntimeCss(ctx),
    parseModule,
    recipeConfigCache,
    reportSurvivors,
    sourceFile: ownSourceFile,
  } = options

  /**
   * Recover the static half of a call the whole-call path gave up on. Only a
   * single-argument `css()` qualifies: a pattern or recipe call takes props rather than a
   * style object, and a multi-argument `css` is later-wins across the whole object.
   */
  const tryPartial = (item: ResultItem, call: Node, rootName: string | undefined) => {
    if (item.type !== 'css' || !rootName) return undefined
    if (!Node.isCallExpression(call)) return undefined

    const args = call.getArguments()
    if (args.length !== 1) return undefined

    // `item.data` is `[...conditions, raw, ...spreadConditions]`, so `data[0]` is a
    // *condition projection* rather than the object as written whenever a ternary is
    // present. The partition therefore reads `raw` directly rather than trusting the
    // first entry — attributing one branch's values to the static half is exactly the
    // bug that made ternaries unsafe here before.
    const unboxed = box.isMap(item.box) ? (unbox(item.box) as { raw?: Dict; spreadConditions?: unknown[] }) : undefined
    if (!unboxed?.raw) return undefined
    // Bound so the narrowing survives into the planning closure below.
    const raw = unboxed.raw

    // A spread whose contribution could not be attributed is still out of reach.
    if (unboxed.spreadConditions?.length) return undefined

    const argument = args[0]
    if (!argument || !Node.isObjectLiteralExpression(argument)) return undefined

    // The local name an already-imported leaf helper goes by, so a plan can call it by the
    // name this file gave it. A scan of the import declarations only — no binder — because
    // this runs for every candidate, foldable or not.
    const leafName = findBambooBinding(call, LEAF_HELPER, isBambooCssModule, isShadowed)

    const plan_ = (allowLeaf: boolean) => {
      try {
        return planPartialFold(argument, item.box, raw, {
          ctx,
          runtimeCss,
          isAccounted: accountsForSource,
          isStatic: (boxNode) => isStaticBox(boxNode),
          allowLeaf,
          leafName: leafName ?? LEAF_HELPER,
        })
      } catch {
        // The whole-call path downgrades a throwing resolve to a skip; do the same here
        // rather than letting one call take down the file.
        return undefined
      }
    }

    // Planned before the bindings are resolved, because resolving them can mean adding one,
    // and that decision is only needed once a plan exists. The rare case where a lowered
    // leaf turns out to be unimportable re-plans without it, which keeps the static half
    // rather than abandoning the split.
    let plan = plan_(true)
    if (!plan) return undefined

    const usesLeaf = () => plan!.finite.some((entry) => !entry.emitsLiterals)

    let cx = ensureCxImport(
      call,
      rootName,
      isBambooCssModule,
      isGeneratedCssModule,
      isShadowed,
      usesLeaf() ? [LEAF_HELPER] : [],
    )

    if (!cx && usesLeaf()) {
      plan = plan_(false)
      if (!plan) return undefined
      cx = ensureCxImport(call, rootName, isBambooCssModule, isGeneratedCssModule, isShadowed)
    }

    if (!cx) return undefined

    const callee = call.getExpression().getText()

    // Static literal, then one ternary per finite property, then whatever is genuinely
    // left for the runtime. Each part is omitted when it has nothing to contribute, so a
    // call that is entirely static plus finite emits no `css()` at all.
    const runtimePart = plan.dynamicText ? `${callee}(${plan.dynamicText})` : undefined
    const runtimeParts = runtimePart ? [runtimePart] : []
    const lowered = plan.finite.map((entry) => entry.expression)
    const parts = [
      // The literal first: it holds no expressions, so it cannot be observed out of order.
      ...(plan.className ? [JSON.stringify(plan.className)] : []),
      // The rest keeps the order the properties were written in, since a condition and a
      // dynamic value are both arbitrary expressions.
      ...(plan.finiteFirst ? [...lowered, ...runtimeParts] : [...runtimeParts, ...lowered]),
    ]

    // Nothing gained if the only thing produced is the call that was already there. A
    // lone ternary is a gain, though: it is the call, removed.
    if (!parts.length || (parts.length === 1 && runtimePart)) return undefined

    // `cx` is kept even around a single ternary. Splicing a bare conditional in would put
    // it wherever the call sat, and `css(x) + y` does not mean `a ? b : c + y`.

    return {
      className: plan.className,
      // Both arms of every ternary, so nothing the fold wrote is invisible downstream. A
      // lowered leaf contributes nothing: its literals are a class prefix and a property
      // name, and the class it builds is only known at runtime.
      classNames: [
        plan.className,
        ...plan.finite.filter((entry) => entry.emitsLiterals).flatMap((entry) => literalsIn(entry.expression)),
      ].filter(Boolean),
      replacement: `${cx.name}(${parts.join(', ')})`,
      insert: cx.insert,
      // The half that stays a call. A split is a real gain — the static properties become a
      // literal — but this is still `css(...)` in the output, so the engine is still in the
      // bundle. It reaches the module through magic-string rather than the AST, which is why
      // the identifier walk cannot see it and why the plan has to say so here.
      runtimeCallee: runtimePart ? callee : undefined,
    }
  }
  const runtimeRecipe = createRuntimeRecipe(ctx)
  const isConstantSlot = createConstantSlotCheck(ctx)
  const runtimeToken = createRuntimeToken(ctx)
  const runtimeTokenVar = createRuntimeTokenVar(ctx)

  /**
   * Does this specifier name a module that exports the css API, exactly?
   *
   * `ImportMap.match` is substring-based, which is right for deciding whether a call is
   * bamboo's and wrong for deciding whether a module can be imported *from*:
   * `styled-system/css/css` matches while exporting no `cx`. So the comparison is
   * equality, not containment.
   *
   * A tsconfig path alias is resolved first, the same way `ImportMap.match` does. Without
   * that, `@site/styled-system/css` — the spelling this repo's own website uses — fails
   * the check and silently loses partial folding, which is indistinguishable in the
   * diagnostics from a genuinely dynamic call.
   */
  const cssModules = ctx.imports.matchers.css?.mods ?? []

  /**
   * The generated css module, the only one whose exports are known.
   *
   * A configured `importMap.css` points at the user's own wrapper, and a wrapper that
   * re-exports `css` need not re-export `cx` — adding one there imports a binding that
   * may not exist. Reusing a `cx` the user already imported from it stays fine, since
   * that binding demonstrably resolves; only *adding* one is restricted.
   */
  const generatedCssModule = [ctx.imports.outdir, 'css'].join('/')
  const pathMappings = ctx.conf.tsOptions?.pathMappings
  /**
   * The spelling reduced to the module it names.
   *
   * The extension and `/index` are stripped because bamboo's own output makes a file
   * import them: `outExtension: 'js'` under NodeNext resolution is written
   * `styled-system/css/index.js`, which is neither equal to `styled-system/css` nor a
   * tail of it. Extraction admitted such a file anyway — `ImportMap.match` is
   * substring-based — so the call was folded while the *insert* was refused, and the
   * result was reported as `dynamic`: the same silent downgrade the alias case above
   * describes, reached through the extension instead.
   *
   * This does not weaken the equality the comment above insists on. `styled-system/css/css`
   * still names neither, because only a trailing `/index` is a module's own directory.
   *
   * `.d.ts` is deliberately not stripped. A declaration file exports no runtime binding, so
   * matching one would authorise inserting an import that resolves to nothing — and a value
   * import cannot name one anyway, which is what makes leaving it out free.
   */
  const trim = (value: string) =>
    value
      .replaceAll('\\', '/')
      .replace(LEADING_RELATIVE, '')
      .replace(TRAILING_SLASH, '')
      .replace(MODULE_EXTENSION, '')
      .replace(TRAILING_INDEX, '')

  const matchesModule = (mod: string, entries: string[]) => {
    const candidates = [mod]

    if (pathMappings) {
      const resolved = resolveTsPathPattern(pathMappings, mod)
      if (resolved) candidates.push(resolved)
    }

    return candidates.some((candidate) => {
      const normalized = trim(candidate)

      return entries.some((entry) => {
        const target = trim(entry)
        // An alias resolves to a path rather than the configured entry, so the entry is
        // compared as its tail rather than as the whole string.
        return normalized === target || normalized.endsWith(`/${target}`)
      })
    })
  }

  const isBambooCssModule = (mod: string) => matchesModule(mod, cssModules)
  const isGeneratedCssModule = (mod: string) => matchesModule(mod, [generatedCssModule])

  /**
   * How *this* module would have to spell the css module, learnt from one that already does.
   *
   * A file calling an imported recipe need not import the css module at all, so when the
   * lowering needs `cvaPick` there is no spelling in the file to copy. The declaring module
   * necessarily has one — `cva` came from it — and that is the spelling reused here.
   *
   * A bare or aliased specifier resolves identically from any file, so it is taken as
   * written. A relative one is re-based: resolved against the module that wrote it, then
   * expressed from the module being folded.
   */
  const cssModuleSpecifierFrom = (declaring: SourceFile): string | undefined => {
    for (const declaration of declaring.getImportDeclarations()) {
      if (declaration.isTypeOnly()) continue

      const mod = declaration.getModuleSpecifierValue()
      if (isGeneratedCssModule(mod)) return mod
    }

    return undefined
  }

  /**
   * That spelling, said from the module being folded.
   *
   * A bare or aliased specifier resolves identically from any file, so it is taken as
   * written. A relative one is re-based: resolved against the module that wrote it, then
   * expressed from the module being folded. Pure path arithmetic, so it holds a string
   * rather than a node — a cached node does not survive the next `addSourceFile`, which
   * ts-morph implements by forgetting the file's whole tree.
   */
  const rebaseSpecifier = (specifier: string, declaringPath: string, consumingPath: string): string | undefined => {
    if (!specifier.startsWith('.')) return specifier

    const absolute = resolvePath(dirname(declaringPath), specifier)
    const rebased = relative(dirname(consumingPath), absolute).replaceAll('\\', '/')
    if (!rebased) return undefined

    return rebased.startsWith('.') ? rebased : `./${rebased}`
  }

  /**
   * Configs of one foreign module, parsed once however many of its recipes are called.
   *
   * Falls back to a per-call map when the caller supplies none, so the fold stays correct
   * standalone — only repeated, which is what the shared cache exists to avoid.
   */
  const configsByModule = recipeConfigCache ?? new Map<string, ForeignRecipes>()
  /** The specifier each imported recipe's module used for the css module, when it needs one. */
  const helperModules = new Map<string, string | undefined>()
  /** Declaring modules a fold read, recorded as paths because their nodes do not persist. */
  const foreignDependencies = new Set<string>()
  /** Resolutions for this module's own call sites, keyed by the name the call site writes. */
  const importedRecipes = new Map<string, RecipeEntry | undefined>()

  /**
   * The config of a recipe this module imports.
   *
   * The binding is followed with ts-morph's symbol aliasing rather than by re-reading import
   * declarations, because that is what already understands the shapes these are reached
   * through: `export { badge } from './styles'`, `export * from './styles'`, and an alias at
   * either end. Each hop is an alias symbol, so following them to a non-alias lands on the
   * declaration wherever it lives.
   *
   * The class names do not depend on which module the call is in — `getRecipeIdentity` hashes
   * the config — so a recipe lowered here produces exactly the string its own module's call
   * sites produce, and exactly the one the runtime would have.
   */
  const resolveImportedRecipe = (call: Node, name: string, origin: RecipeOrigin): RecipeEntry | undefined => {
    if (importedRecipes.has(name)) return importedRecipes.get(name)

    const resolve = (): RecipeEntry | undefined => {
      if (!parseModule) return undefined

      // Declared here after all — the local pass owns it, and parsing this module again
      // from inside its own fold would recurse.
      const consuming = call.getSourceFile()
      if (origin.filePath === consuming.getFilePath()) return undefined

      let foreign = configsByModule.get(origin.filePath)

      if (!foreign) {
        const result = parseModule(origin.filePath)
        if (!result) return undefined

        const collected = collectRecipeConfigs(result)
        const declaring = [...collected.values()]
          .find((entry) => entry.box)
          ?.box?.getNode?.()
          ?.getSourceFile()

        // Stripped of `box` on the way in. A `RecipeEntry` carries the definition's node so
        // the fold can register a watch dependency, and a node does not survive the next
        // `addSourceFile` — ts-morph implements overwriting by forgetting the file's whole
        // tree, so a second consumer would read a forgotten node and throw. The dependency
        // is registered from the path below, which is what it needed the node for.
        const configs = new Map<string, RecipeEntry>()
        for (const [key, entry] of collected) {
          configs.set(key, entry === AMBIGUOUS ? entry : { config: entry.config, name: entry.name, box: undefined })
        }

        foreign = { configs, cssSpecifier: declaring ? cssModuleSpecifierFrom(declaring) : undefined }
        configsByModule.set(origin.filePath, foreign)
      }

      // Under the name the *declaring* module gave it, which an alias at any hop makes
      // different from the name written here.
      const entry = foreign.configs.get(origin.name)
      if (!entry || entry === AMBIGUOUS) return undefined

      // The class is hashed from the config, so editing that module renames the rule and
      // leaves this literal pointing at one that no longer exists.
      foreignDependencies.add(origin.filePath)

      helperModules.set(
        name,
        foreign.cssSpecifier
          ? rebaseSpecifier(foreign.cssSpecifier, origin.filePath, consuming.getFilePath())
          : undefined,
      )
      return entry
    }

    const resolved = resolve()
    importedRecipes.set(name, resolved)
    return resolved
  }

  const folded: FoldedCall[] = []
  const skipped: SkippedCall[] = []

  interface Candidate {
    item: ResultItem
    /** The call to replace. */
    call?: Node
    className?: string
    /** Every class literal emitted, when that is more than `className` — see FoldedCall. */
    classNames?: string[]
    /** Replacement text for a partially folded call, in place of a bare class string. */
    replacement?: string
    /**
     * The node of the *definition* a recipe call was folded against.
     *
     * Registered as a watch dependency alongside the call's own module: an inline recipe's
     * class names are hashed from its config, so a config living in another file has to
     * re-transform this one when it changes.
     */
    configBox?: ResultItem['box']
    /** The resolved value, for a `token()` call. Its presence is what marks one. */
    value?: string
    /** Bindings to add to an existing import, by name so duplicates can be dropped. */
    insert?: { pos: number; names: string[]; module?: string }
    node: Node
    start: number
    end: number
    /**
     * The slot of a `recipe(props).slot` access, and the end of that whole member
     * expression. A slot recipe call returns one class per slot, so what resolves to a
     * string — and what gets replaced — is the property access rather than the call.
     */
    slot?: string
    /** The slot's class does not depend on the props, so the call folds however dynamic they are. */
    constantSlot?: boolean
  }

  const candidates: Candidate[] = []
  const seenRanges = new Set<string>()
  /** Built on first use: most modules declare no inline recipe. */
  let recipeConfigs: Map<string, RecipeEntry> | undefined

  /**
   * Per inline recipe binding: calls seen, calls lowered.
   *
   * A binding whose every call lowered is no longer read, so its `cva({ … })` config can leave
   * the bundle — which is the whole point, the config being far larger than the runtime. But a
   * bundler will not drop the call on its own: `cva` closes over the config and builds an
   * object, and Rollup cannot prove that is side-effect free, so it keeps the expression and
   * the module ends up *larger* than before folding. The annotation below is what makes the
   * saving real, and it is only correct to claim it once nothing reads the binding.
   */
  const recipeCalls = new Map<string, { seen: number; lowered: number }>()

  /** Bindings whose `splitVariantProps` was rewritten, so that access no longer reads them. */
  const loweredSplitProps = new Set<string>()

  /** Ranges already reported as declined, so one call is never counted twice. */
  const reportedRanges = new Set<string>()

  // One import scan per file, shared by every call site and element in it.
  const importCache = new Map<SourceFile, Set<string>>()
  const importsFor = (sourceFile: SourceFile) => {
    let names = importCache.get(sourceFile)
    if (!names) {
      names = bambooImportedNames(sourceFile, ctx)
      importCache.set(sourceFile, names)
    }
    return names
  }

  for (const item of parserResult.toArray()) {
    const type = item.type ?? ''
    const name = item.name ?? type

    if (!item.box) continue

    const call = findCallExpression(item.box)

    // `token()` resolves to a CSS value rather than a class, so it takes its own path:
    // none of the class-producing machinery below has anything to say about it. Folding it
    // is worth the separate path because the alternative is shipping the whole token map —
    // every token in the project — to resolve a handful of string lookups at runtime.
    //
    // `token.var()` shares the path because every guard below is the same question. It only
    // resolves differently at the end, reading the variable reference where `token()` reads
    // the value.
    if (type === 'token' || type === 'tokenVar') {
      if (!call) {
        skipped.push({ name, reason: 'no-call-expression', start: 0, end: 0 })
        continue
      }

      const start = call.getStart()
      const end = call.getEnd()

      // The same foreign-module guard the call path applies, for the same reason: a box
      // can carry nodes from any module the extractor resolved through, and offsets only
      // mean something against the module being rewritten.
      if (code.slice(start, end) !== call.getText()) {
        skipped.push({ name, reason: 'no-call-expression', start: 0, end: 0 })
        continue
      }

      const rangeKey = `${start}:${end}`
      if (seenRanges.has(rangeKey)) continue
      seenRanges.add(rangeKey)

      const rootName = calleeRootName(call)
      if (!rootName || !importsFor(call.getSourceFile()).has(rootName) || isShadowed(call, rootName)) {
        skipped.push({ name, reason: 'not-imported', start, end })
        continue
      }

      // The recorded kind and the callee have to name the same half of the entry.
      // `token(path)` resolves to the value and `token.var(path)` to the variable
      // reference, so inlining one as the other swaps a themeable reference for a fixed
      // colour — the one difference a fold can make that no class-name check would catch.
      //
      // Only a property access can name a half at all, so only one is asked. A bare callee
      // is whatever the file bound the import to, which `token as t` makes some name the
      // matcher has never heard of.
      const callee = Node.isCallExpression(call) ? call.getExpression() : undefined
      const propertyName = Node.isPropertyAccessExpression(callee) ? callee.getNameNode().getText() : undefined
      const wantsVar = type === 'tokenVar'

      if (wantsVar !== (propertyName === 'var')) {
        skipped.push({ name, reason: 'unsupported-kind', start, end })
        continue
      }

      // `ns.token(path)` puts `token` in that same position, so the non-var side tests the
      // matcher rather than merely testing for absence — anything else named there is a
      // method of somebody's object, not ours.
      if (!wantsVar && propertyName !== undefined && !ctx.imports.matchers.tokens.match(propertyName)) {
        skipped.push({ name, reason: 'unsupported-kind', start, end })
        continue
      }

      // The path has to be one resolved literal, not merely a string somewhere in `data`.
      //
      // A conditional argument boxes *every* branch: `token(dark ? 'colors.a' : 'colors.b')`
      // arrives as `['colors.a', 'colors.b', {}]`, and reading `data[0]` off it picks one
      // branch and deletes the condition that chose between them. Same for `a || 'colors.b'`.
      // This is the guard the class path applies below, and for the same reason — the
      // fallback argument gets a whole inertness check for a value that is *discarded*,
      // so the argument that decides the result cannot have less.
      if (!isStaticBox(item.box) || item.data.length !== 1) {
        skipped.push({ name, reason: 'dynamic', start, end })
        continue
      }

      const path = item.data[0]
      if (typeof path !== 'string') {
        skipped.push({ name, reason: 'dynamic', start, end })
        continue
      }

      // Everything after the path is dead once the token resolves, but only inert
      // arguments are provably free to delete — see `isInertArgument`.
      const extraArguments = Node.isCallExpression(call) ? call.getArguments().slice(1) : []
      if (!extraArguments.every(isInertArgument)) {
        skipped.push({ name, reason: 'dynamic', start, end })
        continue
      }

      const value = wantsVar ? runtimeTokenVar(path) : runtimeToken(path)
      // Three ways to land here, all of them the same decision: the path names no token,
      // the token's value is not a string (a numeric `fontWeights` token stays a number
      // through the dictionary, and the runtime returns that number), or the value is
      // empty. The runtime is `tokens[path]?.value || fallback`, so in the first and last
      // cases the fallback decides; in the middle one no string literal can stand in for
      // what it returns. Declining leaves all three where the user wrote them.
      //
      // Only the first and last can arise on the `.var` side, whose half of the entry is a
      // `var()` reference for every token regardless of condition.
      if (!value) {
        skipped.push({ name, reason: 'unresolved-token', start, end })
        continue
      }

      candidates.push({ item, call, node: call, start, end, value })
      continue
    }

    if (!FOLDABLE_TYPES.has(type)) {
      // Only report kinds that are calls at all; JSX entries are a different surface.
      if (call && UNFOLDABLE_TYPES.has(type)) {
        skipped.push({ name, reason: 'not-foldable', start: call.getStart(), end: call.getEnd() })
      }
      // Not when a nearer scope binds the name. The parser registers an inline recipe for
      // the whole file, so `const badge = cva(...)` at module scope makes every `badge(...)`
      // look like a recipe call — including one inside a function that declared its own. That
      // is somebody else's function, and reporting it would overstate the declined count as
      // surely as missing these understated it.
      //
      // Deduped on its own range, for the reason the fold path is: the parser can record one
      // call more than once, and this branch reports above where that check happens.
      if (call && type === RECIPE_CALL_TYPE && !isShadowed(call, name)) {
        const start = call.getStart()
        const end = call.getEnd()
        const rangeKey = `${start}:${end}`

        if (!reportedRanges.has(rangeKey)) {
          reportedRanges.add(rangeKey)

          // Offsets only mean something against the module being rewritten, and a box can
          // carry nodes from any module the extractor resolved through — the same guard the
          // fold path applies before touching `magic`.
          if (code.slice(start, end) !== call.getText()) {
            skipped.push({ name, reason: 'no-call-expression', start: 0, end: 0 })
            continue
          }

          recipeConfigs ??= collectRecipeConfigs(parserResult)
          // Declared elsewhere and imported here. Resolved lazily and only for a name the
          // local pass did not claim, so a file whose recipes are all its own pays nothing.
          if (!recipeConfigs.has(name) && item.origin) {
            const imported = resolveImportedRecipe(call, name, item.origin)
            if (imported) recipeConfigs.set(name, imported)
          }

          const tally = recipeCalls.get(name) ?? { seen: 0, lowered: 0 }
          tally.seen++
          recipeCalls.set(name, tally)
          // One resolution only: a ternary yields several candidate selections, and there is
          // no single literal that stands for all of them.
          const resolvedSelection = item.data?.length === 1 ? (item.data[0] as Dict) : undefined

          // Folding deletes the argument, so whatever evaluating it would have done goes with
          // it. `badge({ tone: trace() })` has a knowable class *and* a call in its selection —
          // the same trade `token()`'s fallback and the constant-slot fold already decline.
          const entry = recipeConfigs.get(name)
          // Inertness is decided per property rather than for the whole argument: lowering
          // keeps an expression by making it the helper's argument, so a call inside one still
          // runs. Only a property being resolved to a literal, or dropped, would delete it —
          // and `lowerRecipeCall` is what knows which of those is about to happen.
          const lowered = lowerRecipeCall(call, entry, ctx, isInertExpression, resolvedSelection)

          if (lowered.kind === 'expression') {
            // The helper has to be callable here by whatever name this file gives it, and
            // adding an import is only safe against the module bamboo generates.
            const helper = ensureRecipeHelperImport(
              RECIPE_PICK_HELPER,
              call,
              isBambooCssModule,
              isGeneratedCssModule,
              isShadowed,
              helperModules.get(name),
            )

            if (helper) {
              tally.lowered++
              candidates.push({
                item,
                call,
                node: call,
                start,
                end,
                replacement:
                  helper.name === RECIPE_PICK_HELPER
                    ? lowered.expression
                    : lowered.expression.replaceAll(`${RECIPE_PICK_HELPER}(`, `${helper.name}(`),
                className: lowered.staticClasses,
                classNames: lowered.classNames,
                insert: helper.insert,
                configBox: entry?.box,
              })
              continue
            }

            skipped.push({ name, reason: 'recipe-call', start, end })
            continue
          }

          if (lowered.kind === 'class') {
            tally.lowered++
            // `replacement`, not `value`: this is a class string, and the `value` path is
            // `token()`'s — it records an empty `className`, which is what a consumer checks
            // for a backing rule.
            candidates.push({
              item,
              call,
              node: call,
              start,
              end,
              replacement: JSON.stringify(lowered.className),
              className: lowered.className,
              classNames: lowered.className.split(' ').filter(Boolean),
              // The *definition's* node, not just the call's. A config imported from another
              // module is what the class name is hashed from, so editing it has to
              // re-transform this one or the literal here goes stale against a renamed rule.
              configBox: entry?.box,
            })
            continue
          }

          skipped.push({ name, reason: 'recipe-call', start, end })
        }
      }
      continue
    }

    if (!call) {
      skipped.push({ name, reason: 'no-call-expression', start: 0, end: 0 })
      continue
    }

    const start = call.getStart()
    const end = call.getEnd()

    // `recipe(props).slot` — a slot recipe call returns one class per slot, so the
    // expression that resolves to a string is the property access, not the call.
    //
    // Narrow on purpose. Widening the replaced range for anything else deletes the property
    // read: `css({ color: 'red' }).trim()` became `"c_red"()`, a TypeError rather than a
    // wrong class. So this fires only for a `recipe` whose accessed property names a slot
    // the recipe declares — `.raw`, `.length` and a misspelled slot all leave the range at
    // the call, where they fold exactly as they did before.
    const memberParent = call.getParent()
    const accessed =
      type === 'recipe' && Node.isPropertyAccessExpression(memberParent) && memberParent.getExpression() === call
        ? memberParent
        : undefined
    const accessedName = accessed?.getNameNode().getText()
    const declaredSlots = accessed
      ? ((ctx.recipes.getConfig(name) as { slots?: string[] } | undefined)?.slots ?? [])
      : []
    const memberAccess = accessedName && declaredSlots.includes(accessedName) ? accessed : undefined
    const slot = memberAccess ? accessedName : undefined
    const foldEnd = memberAccess ? memberAccess.getEnd() : end

    // Offsets are only meaningful against the module being rewritten, and a box can
    // carry nodes from any module the extractor resolved through. Text equality is
    // the check that this call really is this module's — cheap, and independent of
    // how the caller spells `filePath`. Without it a foreign node's offsets would
    // reach `magic.overwrite` and corrupt the output at a plausible-looking position.
    if (code.slice(start, end) !== call.getText()) {
      skipped.push({ name, reason: 'no-call-expression', start: 0, end: 0 })
      continue
    }

    // The parser can record the same call more than once; fold it once.
    const rangeKey = `${start}:${foldEnd}`
    if (seenRanges.has(rangeKey)) continue
    seenRanges.add(rangeKey)

    if (isRawCall(call)) {
      skipped.push({ name, reason: 'raw-call', start, end })
      continue
    }

    const rootName = calleeRootName(call)
    if (!rootName || !importsFor(call.getSourceFile()).has(rootName) || isShadowed(call, rootName)) {
      skipped.push({ name, reason: 'not-imported', start, end })
      continue
    }

    // A constant slot resolves the same whatever the props are, so it folds before the
    // static-argument check the rest of the class path depends on — but only when deleting
    // the arguments deletes nothing observable. `checkbox({ size: log() }).control` has a
    // constant class and a call in its props; folding past it drops the call. Same doctrine
    // as `token()`'s fallback argument above.
    if (
      slot &&
      isConstantSlot(name, slot) &&
      Node.isCallExpression(call) &&
      call.getArguments().every(isInertExpression)
    ) {
      candidates.push({ item, call, node: call, start, end: foldEnd, slot, constantSlot: true })
      continue
    }

    // A call written with no arguments has no argument box to be static about: the parser
    // stores a fallback, which `isStaticBox` rejects. The selection is still fully known —
    // it is every default — so `buttonStyle()` folds like the `buttonStyle({})` it means.
    const noArguments = Node.isCallExpression(call) && call.getArguments().length === 0 && item.data.length === 1

    if ((!noArguments && !isStaticBox(item.box)) || !hasStyles(item.data) || !argumentsAccountedFor(call, item.box)) {
      const partial = partial_ ? tryPartial(item, call, rootName) : undefined

      if (partial) {
        // Reported before the candidate, so the range is in the ledger by the time the
        // identifier walk reads it and the callee is not counted a second time.
        if (reportSurvivors && partial.runtimeCallee) {
          // Under the *imported* name, as every other `runtime-binding` is — `css as c`
          // reports `css`, matching the `dynamic` entry a neighbouring call would produce.
          skipped.push({ name, reason: 'runtime-binding', start, end })
        }

        candidates.push({ item, call, node: call, start, end, ...partial })
        continue
      }

      skipped.push({ name, reason: 'dynamic', start, end })
      continue
    }

    candidates.push({ item, call, node: call, start, end: foldEnd, slot })
  }

  /**
   * Ranges the rewrite actually replaced. Declared before the early return below, because
   * that return is now also a reporting point: a module with nothing to fold is exactly the
   * shape `reportSurvivors` exists to catch.
   */
  const applied: Array<[number, number]> = []

  if (candidates.length === 0) {
    // Nothing was rewritten, so every reference survives — and a module with no candidate at
    // all is exactly the shape this exists to catch.
    if (reportSurvivors) reportRuntimeBindings()
    return { code, map: null, folded, skipped, dependencies: [] }
  }

  // Compare by `SourceFile` identity rather than by path, since `options.filePath`
  // may be spelled differently by the caller than ts-morph spells it.
  const dependencyScan = createDependencyScan(candidates[0]!.node.getSourceFile())

  // Outermost-first, so a nested candidate can be detected and dropped rather than
  // producing an overlapping overwrite (which magic-string rejects).
  candidates.sort((a, b) => a.start - b.start || b.end - a.end)

  const magic = new MagicString(code)

  // Which bindings have already been added, for the whole module rather than per insertion
  // point. A module-level binding is in scope everywhere in the file, so one is enough
  // however many calls need it — and a file importing the css module twice has two
  // insertion points, which keyed per position would each get their own `cx` and emit
  // `Identifier 'cx' has already been declared`.
  //
  // Tracked by name rather than as a single flag, because calls in the same file need
  // different sets: one needs `cx` alone, the next also needs the leaf helper.
  const insertedNames = new Set<string>()
  const applyInsert = (insert: { pos: number; names: string[]; module?: string } | undefined) => {
    if (!insert) return

    const missing = insert.names.filter((name) => !insertedNames.has(name))
    if (!missing.length) return

    magic.appendLeft(
      insert.pos,
      insert.module
        ? `\nimport { ${missing.join(', ')} } from '${insert.module}'`
        : missing.map((name) => `, ${name}`).join(''),
    )
    for (const name of missing) insertedNames.add(name)
  }

  // Applied edit ranges, not candidate ranges. A `styled.*` element only rewrites its two
  // tags, so anything between them — a nested element, a `css()` call in the children —
  // is still free to fold. Gating on the element's whole span would reject those for an
  // overlap that never happens.
  const collides = (edits: Array<[number, number]>) =>
    edits.some(([start, end]) => applied.some(([from, to]) => start < to && from < end))

  for (const candidate of candidates) {
    const { item, start, end } = candidate
    const name = item.name ?? item.type ?? ''

    const ranges: Array<[number, number]> = [[start, end]]

    if (collides(ranges)) {
      skipped.push({ name, reason: 'overlapping', start, end })
      continue
    }

    // A `token()` call, which becomes the value itself. No class is involved, so the
    // class fields stay empty rather than carrying a `var(…)` reference that a consumer
    // would go looking for a rule behind.
    if (candidate.value !== undefined) {
      magic.overwrite(start, end, JSON.stringify(candidate.value))
      applied.push(...ranges)
      folded.push({ name, kind: 'value', className: '', classNames: [], value: candidate.value, start, end })
      collectSourceFiles(item.box, dependencyScan)
      continue
    }

    if (candidate.replacement) {
      magic.overwrite(start, end, candidate.replacement)
      applyInsert(candidate.insert)
      applied.push(...ranges)
      folded.push({
        name,
        kind: 'class',
        className: candidate.className!,
        // Filtered, because an element or call whose classes are all built at runtime
        // resolves no literal — `classNames` is what a consumer checks for CSS behind it,
        // and an empty string is not a class to check.
        classNames: (candidate.classNames ?? [candidate.className!]).filter(Boolean),
        start,
        end,
      })
      collectSourceFiles(item.box, dependencyScan)
      if (candidate.configBox) collectSourceFiles(candidate.configBox, dependencyScan)
      continue
    }

    let className: string
    try {
      if (item.type === 'pattern') {
        className = runtimeCss(...item.data.map((entry) => ctx.patterns.transform(name, entry as Dict)))
      } else if (item.type === 'recipe') {
        // A recipe call takes one variant object; anything else is not a shape the
        // generated recipe function accepts.
        const resolved = candidate.constantSlot
          ? runtimeRecipe(name, {}, candidate.slot)
          : item.data.length === 1
            ? runtimeRecipe(name, item.data[0] as Dict, candidate.slot)
            : undefined
        if (resolved == null) {
          skipped.push({ name, reason: 'unsupported-kind', start, end })
          continue
        }
        className = resolved
      } else {
        className = runtimeCss(...(item.data as Dict[]))
      }
    } catch {
      skipped.push({ name, reason: 'dynamic', start, end })
      continue
    }

    if (!className) {
      skipped.push({ name, reason: 'empty', start, end })
      continue
    }

    // JSON.stringify escapes the backslashes bamboo puts in class names for escaped
    // characters, and any quote an arbitrary value introduced.
    magic.overwrite(start, end, JSON.stringify(className))
    applied.push(...ranges)
    folded.push({ name, kind: 'class', className, classNames: [className], start, end })
    collectSourceFiles(item.box, dependencyScan)
  }

  // `input.splitVariantProps(props)` — the other way a wrapper reaches its recipe.
  //
  // Lowered because it is what keeps the binding alive once the calls have folded. The keys it
  // splits on are `Object.keys(variants)`, known here, and the function it runs is `splitProps`
  // — so the lowered form calls the same helper directly and reads nothing off the recipe. The
  // bytes are already paid: `splitVariantProps` calls `splitProps` today.
  //
  // Not driven by `parserResult`: a property access on a local binding is not a style call, so
  // nothing records it. The source file is the only place it exists.
  //
  // The module being *rewritten*, taken from a candidate rather than from a config's box.
  // Those boxes used to share this module, and no longer do: a config resolved across modules
  // carries the declaring file, so reading one here scanned somebody else's source — leaving
  // this module's `splitVariantProps` unlowered, and computing offsets against a file the
  // rewrite does not apply to.
  const recipeSourceFile = candidates[0]?.node.getSourceFile()

  if (recipeSourceFile) {
    for (const access of recipeSourceFile.getDescendantsOfKind(SyntaxKind.PropertyAccessExpression)) {
      if (access.getName() !== 'splitVariantProps') continue

      const target = access.getExpression()
      if (!Node.isIdentifier(target)) continue
      if (isShadowed(access, target.getText())) continue

      // An inline recipe the module bound, or a config recipe it imported. The keys are
      // `Object.keys(variants)` either way, and both reach `splitProps` underneath.
      const local = recipeConfigs?.get(target.getText())
      const importedConfig =
        !local && importsFor(recipeSourceFile).has(target.getText())
          ? (ctx.recipes.getConfig(target.getText()) as RecipeEntry['config'] | undefined)
          : undefined

      const entry =
        local && local !== AMBIGUOUS
          ? local
          : importedConfig
            ? ({ config: importedConfig, name: '', box: undefined } satisfies RecipeEntry)
            : undefined

      if (!entry) continue

      const call = access.getParent()
      if (!Node.isCallExpression(call) || call.getExpression() !== access) continue

      const args = call.getArguments()
      if (args.length !== 1) continue

      const start = call.getStart()
      const end = call.getEnd()
      if (code.slice(start, end) !== call.getText()) continue
      if (collides([[start, end]])) continue

      const helper = ensureRecipeHelperImport(
        SPLIT_PROPS_HELPER,
        call,
        isBambooCssModule,
        isGeneratedCssModule,
        isShadowed,
        // The same fallback the axis lowering uses. Without it this declined in exactly the
        // files that lowering now serves — leaving the access, so the binding, so the config
        // the whole exercise exists to let a bundler drop.
        helperModules.get(target.getText()),
      )
      if (!helper) continue

      const keys = Object.keys(entry.config.variants ?? {})
      magic.overwrite(start, end, `${helper.name}(${args[0]!.getText()}, ${JSON.stringify(keys)})`)
      applyInsert(helper.insert)
      applied.push([start, end])
      loweredSplitProps.add(target.getText())
    }
  }

  // A binding nothing reads any more: mark its config pure so the bundler can drop it.
  //
  // `cva(config)` hashes the config, memoizes and builds an object — no side effect, but not
  // one Rollup can prove, so without this it keeps the whole style object as a bare expression
  // statement and folding makes the module *larger* rather than smaller. The config is the
  // prize here; the runtime it feeds is a fraction of its size.
  //
  // Only when every call lowered. While one survives the binding is still read, so the
  // annotation would change nothing — and claiming the saving would be wrong.
  for (const [binding, tally] of recipeCalls) {
    if (!tally.seen || tally.lowered !== tally.seen) continue

    const definition = recipeConfigs?.get(binding)?.box?.getNode?.()
    if (!definition) continue

    const call = Node.isCallExpression(definition)
      ? definition
      : definition.getFirstAncestorByKind(SyntaxKind.CallExpression)
    if (!call) continue

    // Offsets are only meaningful against the module being rewritten.
    const start = call.getStart()
    if (code.slice(start, call.getEnd()) !== call.getText()) continue

    magic.appendLeft(start, '/*#__PURE__*/')
  }

  /**
   * Bindings from a bamboo module still referenced once every rewrite is applied.
   *
   * Deliberately not driven by `parserResult`: that is the recogniser, and the point here is
   * to catch what it did not see. A namespace import called as `s.cva(...)`, a default
   * import, a specifier that resolved to nothing — each leaves a live reference and no ledger
   * entry at all, which is how `strict` came to pass a build that still shipped the engine.
   *
   * The helpers the fold itself writes are excluded: `cx`, `cvaPick`, `splitProps` and the
   * leaf helper live in `cx` and pull no engine, so a reference to one is the fold working
   * rather than failing.
   */
  function reportRuntimeBindings() {
    // Not `parserResult`'s boxes: one can carry a node from any module the extractor resolved
    // through, and this reports offsets against *this* module's text.
    const sourceFile = ownSourceFile ?? candidates[0]?.node.getSourceFile()
    if (!sourceFile) return

    const bambooModules = [
      ...cssModules,
      ...(ctx.imports.matchers.recipe?.mods ?? []),
      ...(ctx.imports.matchers.pattern?.mods ?? []),
      ...(ctx.imports.matchers.tokens?.mods ?? []),
    ]

    /** Local name -> what to call it in the report. */
    const watched = new Map<string, string>()

    for (const declaration of sourceFile.getImportDeclarations()) {
      if (declaration.isTypeOnly()) continue
      if (!matchesModule(declaration.getModuleSpecifierValue(), bambooModules)) continue

      for (const named of declaration.getNamedImports()) {
        if (named.isTypeOnly()) continue
        const imported = named.getNameNode().getText()
        if (PERMITTED_BINDINGS.has(imported)) continue
        watched.set((named.getAliasNode() ?? named.getNameNode()).getText(), imported)
      }

      const namespace = declaration.getNamespaceImport()
      if (namespace) watched.set(namespace.getText(), `${namespace.getText()}.*`)

      const defaultImport = declaration.getDefaultImport()
      if (defaultImport) watched.set(defaultImport.getText(), defaultImport.getText())
    }

    // `export { css } from 'styled-system/css'` re-exports the binding without importing it,
    // which is exactly how a wrapper module keeps the engine alive.
    for (const declaration of sourceFile.getExportDeclarations()) {
      if (declaration.isTypeOnly()) continue
      if (!matchesModule(declaration.getModuleSpecifierValue() ?? '', bambooModules)) continue

      // `export * from` and `export * as ns from` alike: both keep the module alive, whatever
      // they bind. (The parser's barrel walk distinguishes them because it asks a different
      // question — which individual names come through.)
      if (declaration.isNamespaceExport()) {
        skipped.push({
          name: declaration.getNamespaceExport()?.getName() ?? '*',
          reason: 'runtime-binding',
          start: declaration.getStart(),
          end: declaration.getEnd(),
        })
        continue
      }

      for (const named of declaration.getNamedExports()) {
        if (named.isTypeOnly()) continue
        const imported = named.getNameNode().getText()
        if (PERMITTED_BINDINGS.has(imported)) continue

        skipped.push({ name: imported, reason: 'runtime-binding', start: named.getStart(), end: named.getEnd() })
      }
    }

    // `import { css } … export { css as style }` — the same wrapper shape in two statements,
    // and the more common one, since a barrel that also *uses* the binding has to import it.
    // The identifier walk cannot see it: an export specifier is excluded there to keep the
    // single-statement form above from being counted twice.
    for (const declaration of sourceFile.getExportDeclarations()) {
      if (declaration.isTypeOnly() || declaration.getModuleSpecifier()) continue

      for (const named of declaration.getNamedExports()) {
        if (named.isTypeOnly()) continue

        const imported = watched.get(named.getNameNode().getText())
        if (imported === undefined) continue

        skipped.push({ name: imported, reason: 'runtime-binding', start: named.getStart(), end: named.getEnd() })
      }
    }

    if (watched.size === 0) return

    // Suppressed by *range* rather than by name. The ledger records the name a binding was
    // imported under and this walk sees the name the file bound, which `css as c` makes
    // different — matching on the name reported one call site twice, under two reasons. Only
    // reasons that fail the build suppress: `not-imported` and `not-foldable` pass, so
    // treating them as covered would hide the survivor this exists to find.
    const declined = skipped
      .filter((entry) => SURVIVES_TO_RUNTIME.has(entry.reason) && entry.end > entry.start)
      .map((entry) => [entry.start, entry.end] as const)
    const reported = new Set<string>()

    for (const identifier of sourceFile.getDescendantsOfKind(SyntaxKind.Identifier)) {
      const local = identifier.getText()
      const imported = watched.get(local)
      if (imported === undefined || reported.has(local)) continue

      const start = identifier.getStart()
      // The import declaration naming it is not a use of it, and neither is anything the
      // rewrite already replaced.
      if (identifier.getFirstAncestorByKind(SyntaxKind.ImportDeclaration)) continue
      if (applied.some(([from, to]) => start >= from && start < to)) continue
      if (declined.some(([from, to]) => start >= from && start < to)) continue
      if (!isValueReference(identifier)) continue
      if (isShadowed(identifier, local)) continue

      reported.add(local)
      skipped.push({ name: imported, reason: 'runtime-binding', start, end: identifier.getEnd() })
    }
  }

  // The other reporting point. Mutually exclusive with the one above — that return exits —
  // and this one runs only once every rewrite is in `applied`, so a reference the fold
  // replaced is not counted as one it left behind.
  if (reportSurvivors) reportRuntimeBindings()

  if (folded.length === 0) {
    return { code, map: null, folded, skipped, dependencies: [] }
  }

  return {
    code: magic.toString(),
    map: magic.generateMap({ source: options.filePath, hires: true, includeContent: true }),
    folded,
    skipped,
    dependencies: [...dependencyScan.results, ...foreignDependencies],
  }
}
