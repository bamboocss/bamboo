import { resolveTsPathPattern } from '@bamboocss/config/ts-path'
import type { Context } from '@bamboocss/core'
import { type BoxNode, box } from '@bamboocss/extractor'
import { viewTransitionClassName } from '@bamboocss/shared'
import type { Dict, ParserResultInterface, ResultItem } from '@bamboocss/types'
import MagicString from 'magic-string'
import { dirname, relative, resolve as resolvePath } from 'node:path'
import { Node, type SourceFile, SyntaxKind } from 'ts-morph'
import {
  AMBIGUOUS,
  collectRecipeConfigs,
  ensureRecipeHelperImport,
  lowerRecipeCall,
  RECIPE_MAP_HELPER,
  SPLIT_PROPS_HELPER,
  type DynamicStyleMap,
  type RecipeEntry,
} from './fold-recipe'
import { accountsForSource, isStaticBox } from './fold-analysis'
import { createRuntimeCss, createRuntimeToken, createRuntimeTokenValue, type RuntimeCss } from './runtime-css'
import type { StaticStyleSetCompiler } from './style-set'

/**
 * Why a call site could not be compiled. Surfaced through diagnostics so a user can tell
 * which part of the finite-style contract a source shape violates.
 */
export type SkipReason =
  | 'dynamic' // some part of the arguments could not be resolved at build time
  | 'raw-call' // `css.raw(...)` returns a style object, not a class string
  | 'recipe-call' // a recipe call whose selection the build could not represent finitely
  | 'unsupported-kind' // a recognized API/member whose result shape is not compilable
  | 'not-imported' // the callee is not a Bamboo import — a local function of the same name
  | 'no-call-expression' // could not locate the enclosing call to replace
  | 'overlapping' // nested inside another fold
  | 'unresolved-token' // `token(...)` resolves to no usable string, so the call has to stay
  | 'runtime-binding' // a bamboo import still referenced after the rewrite, whoever left it
  | 'compile-failed' // compilation threw on this module, so nothing about it was established

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
  kind: 'class' | 'slots' | 'value' | 'definition'
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
  /**
   * Where the surviving reference actually is, when that is not the module being folded.
   *
   * A recipe declared in one module and referenced from another is found through the
   * project-wide symbol graph, so `start`/`end` index the *referencing* file. Reporting them
   * against the folded module produced a line number derived from the wrong text — one past
   * EOF in the case that surfaced this — and named the declaration rather than the call site
   * that has to change. Both are carried so the diagnostic can point at the real one.
   */
  origin?: { filePath: string; line: number }
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
  /** Compile every style surface to the shared symbolic/atomic representation. */
  styleCompiler: StaticStyleSetCompiler
  /** Maximum finite recipe selections the static compiler may enumerate for one call. */
  maxRecipeStates?: number
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
   * the strict compiler needs an answer it can fail a build on.
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
 * `cva`/`sva` return a function, so their definitions are compile-time declarations rather
 * than class-producing calls; once their uses are lowered, the factory calls are erased.
 * `token` also resolves to no class, but it does resolve to a literal, so it compiles through
 * its own path rather than being declined outright. A static `viewTransition` bag resolves to
 * its extracted class and uses the ordinary class candidate path.
 *
 * Recipe invocations compile through `fold-recipe`. Inline calls
 * are recorded under the name the file bound; config calls arrive as `recipe`. Routing both
 * through one exact finite-state lowering keeps their selection contract identical.
 */
const FOLDABLE_TYPES = new Set(['css', 'pattern', 'viewTransition'])

/**
 * The skip reasons that leave a `css()`-family call in the output.
 *
 * `overlapping` is handled by the enclosing fold, and `not-imported` is somebody else's
 * function of the same name — neither leaves a call of ours.
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
  'unresolved-token',
  // A module the fold threw on. Nothing was established about it either way — its calls were
  // neither folded nor declined, so it counted towards neither column and the compiler saw a
  // module that did not exist. Unknown has to read as survives: the guarantee is that
  // *nothing* still calls `css()`, and a module nobody checked cannot support it.
  'compile-failed',
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
 * These are what the compiler itself writes; all live in `cx` and pull no engine, so a
 * reference to one is the fold having worked.
 */
const PERMITTED_BINDINGS = new Set(['cx', RECIPE_MAP_HELPER, SPLIT_PROPS_HELPER])

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
 * `token()` takes one argument, but javascript evaluates every argument a call site passes
 * before the call — so a fold that drops an extra one also drops whatever evaluating it would
 * have done. `token('x', compute())` is pathological and no longer type-checks, and the fold's
 * contract is behaviour preservation regardless: a literal is the cheap way to prove it, since
 * it means no call, no property read, no getter.
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
    runtimeCss = createRuntimeCss(ctx),
    styleCompiler,
    maxRecipeStates,
    parseModule,
    recipeConfigCache,
    reportSurvivors,
    sourceFile: ownSourceFile,
  } = options

  const runtimeToken = createRuntimeToken(ctx)
  const runtimeTokenValue = createRuntimeTokenValue(ctx)

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
   * the check and silently loses helper lowering, which is indistinguishable in the
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
   * Where the compiler's helpers can be imported from, for a file that imports the generated
   * css module by *subpath* rather than through its barrel.
   *
   * `styled-system/css/cva.js` is a real spelling, and it cannot host the helper: that module
   * exports `cva`, not `cvaMap`. Matching only the barrel meant no host was found and every
   * runtime recipe selection in the file declined — a failure whose reported reason said
   * nothing about import spelling, and whose suggested remedies all pointed elsewhere.
   *
   * The sibling `cx` module is what actually exports them. The prefix is verified against the
   * configured output before anything is derived, so an unrelated `foo/css/bar.js` is left
   * alone, and the caller's extension is preserved rather than guessed at.
   */
  const helperModuleFromSubpath = (mod: string): string | undefined => {
    const normalized = mod.replaceAll('\\', '/')
    const marker = '/css/'
    const at = normalized.lastIndexOf(marker)
    if (at < 0) return undefined

    const prefix = normalized.slice(0, at + marker.length - 1)
    if (!isGeneratedCssModule(prefix)) return undefined

    const rest = normalized.slice(at + marker.length)
    if (!rest || rest.includes('/')) return undefined

    const dot = rest.lastIndexOf('.')
    const extension = dot > 0 ? rest.slice(dot) : ''
    // Already the helper module, so there is a host to extend and nothing to derive.
    if (rest === `cx${extension}`) return undefined

    return `${prefix}/cx${extension}`
  }

  /**
   * The generated css entry as spelled beside an imported config recipe.
   *
   * A decision table needs only `cvaMap`, but a module importing a config recipe often has
   * no css import to extend. Preserve a relative/aliased styled-system spelling by replacing
   * its `/recipes` suffix; falling back to the configured generated entry covers bare imports.
   */
  const configRecipeCssSpecifier = (call: Node, binding: string): string => {
    for (const declaration of call.getSourceFile().getImportDeclarations()) {
      if (declaration.isTypeOnly()) continue
      const namesBinding = declaration.getNamedImports().some((named) => {
        if (named.isTypeOnly()) return false
        return (named.getAliasNode() ?? named.getNameNode()).getText() === binding
      })
      if (!namesBinding) continue

      const mod = declaration.getModuleSpecifierValue().replaceAll('\\', '/')
      const marker = '/recipes'
      const at = mod.lastIndexOf(marker)
      if (at >= 0) return `${mod.slice(0, at)}/css`
    }

    return generatedCssModule
  }

  /**
   * How *this* module would have to spell the css module, learnt from one that already does.
   *
   * A file calling an imported recipe need not import the css module at all, so when the
   * lowering needs a decision-table helper there is no spelling in the file to copy. The declaring module
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
   * The selected declarations do not depend on which module the call is in. A recipe lowered
   * here therefore reaches the same globally shared atoms as a call in its declaring module.
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
          configs.set(key, entry === AMBIGUOUS ? entry : { config: entry.config, box: undefined })
        }

        foreign = { configs, cssSpecifier: declaring ? cssModuleSpecifierFrom(declaring) : undefined }
        configsByModule.set(origin.filePath, foreign)
      }

      // Under the name the *declaring* module gave it, which an alias at any hop makes
      // different from the name written here.
      const entry = foreign.configs.get(origin.name)
      if (!entry || entry === AMBIGUOUS) return undefined

      // Editing the declaration can change the selected StyleSet and therefore the atoms this
      // literal needs, so every compiled consumer must be invalidated with it.
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
    /** Symbolic declarations this candidate contributes, before class allocation. */
    styleSet?: Dict
    /** Name reported for a compiler-created enclosing candidate such as semantic `cx`. */
    displayName?: string
    /** Source boxes subsumed by an enclosing candidate, retained for watch dependencies. */
    sourceBoxes?: Array<ResultItem['box']>
    /** The call to replace. */
    call?: Node
    className?: string
    /** Every class literal emitted, when that is more than `className` — see FoldedCall. */
    classNames?: string[]
    /** A finite runtime recipe lookup, intentionally unallocated until semantic `cx()`. */
    styleMap?: DynamicStyleMap
    /** Local name of the generated map helper, when the import was aliased. */
    mapHelperName?: string
    /** Set once an enclosing semantic composition owns this candidate. */
    subsumed?: boolean
    /** The replacement evaluates to a slot-name → class-string object. */
    outputKind?: 'slots'
    /** Replacement text for a compiled call, in place of a bare class string. */
    replacement?: string
    /**
     * The node of the *definition* a recipe call was compiled against.
     *
     * Registered as a watch dependency alongside the call's own module: a config living in
     * another file selects this call's declarations, so changing it has to recompile this one.
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
  }

  const candidates: Candidate[] = []
  const seenRanges = new Set<string>()
  const recipeConfigs = collectRecipeConfigs(parserResult)
  const recipeDefinitions: Array<{ name: string; call: Node }> = []

  // Recipe factories are a compile-time declaration form. Once the config has been
  // extracted, the executable factory and its style object have no runtime meaning.
  for (const [name, entry] of recipeConfigs) {
    if (entry === AMBIGUOUS) continue
    const definition = entry.box?.getNode?.()
    if (!definition) continue
    const call = Node.isCallExpression(definition)
      ? definition
      : definition.getFirstAncestorByKind(SyntaxKind.CallExpression)
    if (!call || code.slice(call.getStart(), call.getEnd()) !== call.getText()) continue
    recipeDefinitions.push({ name, call })
  }

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
    // `token.value()` shares the path because every guard below is the same question. It
    // only resolves differently at the end, reading the literal where `token()` reads the
    // variable reference.
    if (type === 'token' || type === 'tokenValue') {
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
      // `token(path)` resolves to the variable reference and `token.value(path)` to the
      // literal, so inlining one as the other swaps a themeable reference for a fixed
      // colour — the one difference a fold can make that no class-name check would catch.
      //
      // Only a property access can name a half at all, so only one is asked. A bare callee
      // is whatever the file bound the import to, which `token as t` makes some name the
      // matcher has never heard of.
      const callee = Node.isCallExpression(call) ? call.getExpression() : undefined
      const propertyName = Node.isPropertyAccessExpression(callee) ? callee.getNameNode().getText() : undefined
      const wantsValue = type === 'tokenValue'

      if (wantsValue !== (propertyName === 'value')) {
        skipped.push({ name, reason: 'unsupported-kind', start, end })
        continue
      }

      // The reference side accepts two spellings: a bare callee, and `ns.token(path)`, which
      // puts `token` in that position. Anything else named there is a method of somebody's
      // object, not ours.
      if (!wantsValue && propertyName !== undefined && !ctx.imports.matchers.tokens.match(propertyName)) {
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

      const value = wantsValue ? runtimeTokenValue(path) : runtimeToken(path)
      // Three ways to land here, all of them the same decision: the path names no token,
      // the token's value is not a string (a numeric `fontWeights` token stays a number
      // through the dictionary, and the runtime returns that number), or the value is
      // empty. The runtime returns `undefined` in the first and last; in the middle one no
      // string literal can stand in for what it returns. Declining leaves all three where
      // the user wrote them.
      //
      // Only the first and last can arise on the reference side, whose half of the entry is
      // a `var()` for every token regardless of condition.
      if (!value) {
        skipped.push({ name, reason: 'unresolved-token', start, end })
        continue
      }

      candidates.push({ item, call, node: call, start, end, value })
      continue
    }

    if (!FOLDABLE_TYPES.has(type)) {
      // Not when a nearer scope binds the name. The parser registers an inline recipe for
      // the whole file, so `const badge = cva(...)` at module scope makes every `badge(...)`
      // look like a recipe call — including one inside a function that declared its own. That
      // is somebody else's function, and reporting it would overstate the declined count as
      // surely as missing these understated it.
      //
      // Deduped on its own range, for the reason the fold path is: the parser can record one
      // call more than once, and this branch reports above where that check happens.
      if (call && (type === RECIPE_CALL_TYPE || type === 'recipe') && !isShadowed(call, name)) {
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

          // `recipe.raw()` returns style data, not the selected class value. It is a live
          // runtime API and cannot be mistaken for an invocation of the recipe itself.
          if (isRawCall(call)) {
            skipped.push({ name, reason: 'raw-call', start, end })
            continue
          }

          if (!recipeConfigs.has(name)) {
            if (type === 'recipe') {
              // Config recipes expose the same finite variant map as inline declarations.
              // Their configured class name is metadata only; selected authored styles are
              // resolved through the shared StyleSet compiler below.
              const config = ctx.recipes.getConfig(name) as RecipeEntry['config'] | undefined
              if (config) {
                recipeConfigs.set(name, { config, box: undefined })
                helperModules.set(name, configRecipeCssSpecifier(call, name))
              }
            } else if (item.origin) {
              // Inline declaration in another module. Resolved lazily and only for a name
              // the local pass did not claim, so local-only files pay nothing.
              const imported = resolveImportedRecipe(call, name, item.origin)
              if (imported) recipeConfigs.set(name, imported)
            }
          }

          // One resolution only: a ternary yields several candidate selections, and there is
          // no single literal that stands for all of them.
          const resolvedSelection = item.data?.length === 1 ? (item.data[0] as Dict) : undefined

          // Folding deletes the argument, so whatever evaluating it would have done goes with
          // it. `badge({ tone: trace() })` has a knowable class *and* a call in its selection —
          // the same trade `token()`'s fallback and the constant-slot fold already decline.
          const entry = recipeConfigs.get(name)
          let inlineSlot: string | undefined
          let inlineEnd = end
          if (Array.isArray(entry?.config.slots)) {
            const parent = call.getParent()
            if (Node.isPropertyAccessExpression(parent) && parent.getExpression() === call) {
              const accessed = parent.getName()
              if (entry.config.slots.includes(accessed)) {
                inlineSlot = accessed
                inlineEnd = parent.getEnd()
              }
            } else if (Node.isElementAccessExpression(parent) && parent.getExpression() === call) {
              const argument = parent.getArgumentExpression()
              const accessed =
                argument && (Node.isStringLiteral(argument) || Node.isNoSubstitutionTemplateLiteral(argument))
                  ? argument.getLiteralValue()
                  : undefined
              if (typeof accessed === 'string' && entry.config.slots.includes(accessed)) {
                inlineSlot = accessed
                inlineEnd = parent.getEnd()
              }
            }
          }
          // Inertness is decided per property rather than for the whole argument: lowering
          // keeps an expression by making it the helper's argument, so a call inside one still
          // runs. Only a property being resolved to a literal, or dropped, would delete it —
          // and `lowerRecipeCall` is what knows which of those is about to happen.
          const lowered = lowerRecipeCall(
            call,
            entry,
            styleCompiler,
            isInertExpression,
            resolvedSelection,
            inlineSlot,
            maxRecipeStates,
          )

          if (lowered.kind === 'dynamic-style') {
            const helper = ensureRecipeHelperImport(
              RECIPE_MAP_HELPER,
              call,
              isBambooCssModule,
              isGeneratedCssModule,
              isShadowed,
              helperModules.get(name),
              helperModuleFromSubpath,
            )

            if (helper) {
              candidates.push({
                item,
                call,
                node: call,
                start,
                end: inlineEnd,
                className: '',
                classNames: [],
                styleMap: lowered.map,
                mapHelperName: helper.name,
                insert: helper.insert,
                configBox: entry?.box,
                outputKind: lowered.map.outputKind === 'slots' ? 'slots' : undefined,
              })
              continue
            }

            skipped.push({ name, reason: 'recipe-call', start, end })
            continue
          }

          if (lowered.kind === 'slots') {
            const helper = lowered.helper
              ? ensureRecipeHelperImport(
                  lowered.helper,
                  call,
                  isBambooCssModule,
                  isGeneratedCssModule,
                  isShadowed,
                  helperModules.get(name),
                  helperModuleFromSubpath,
                )
              : undefined

            if (!lowered.helper || helper) {
              const replacement =
                lowered.helper && helper && helper.name !== lowered.helper
                  ? lowered.expression.replaceAll(`${lowered.helper}(`, `${helper.name}(`)
                  : lowered.expression
              candidates.push({
                item,
                call,
                node: call,
                start,
                end: inlineEnd,
                replacement,
                className: '',
                classNames: lowered.classNames,
                insert: helper?.insert,
                configBox: entry?.box,
                outputKind: 'slots',
              })
              continue
            }

            skipped.push({ name, reason: 'recipe-call', start, end })
            continue
          }

          if (lowered.kind === 'class') {
            // `replacement`, not `value`: this is a class string, and the `value` path is
            // `token()`'s — it records an empty `className`, which is what a consumer checks
            // for a backing rule.
            candidates.push({
              item,
              call,
              node: call,
              start,
              end: inlineEnd,
              replacement: JSON.stringify(lowered.className),
              className: lowered.className,
              classNames: lowered.className.split(' ').filter(Boolean),
              styleSet: lowered.styles,
              // The *definition's* node, not just the call's. Editing an imported config can
              // change this complete StyleSet, so the consumer must be recompiled with it.
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

    // A call written with no arguments has no argument box to be static about: the parser
    // stores a fallback, which `isStaticBox` rejects. The selection is still fully known —
    // it is every default — so `buttonStyle()` folds like the `buttonStyle({})` it means.
    const noArguments = Node.isCallExpression(call) && call.getArguments().length === 0 && item.data.length === 1

    if ((!noArguments && !isStaticBox(item.box)) || !hasStyles(item.data) || !argumentsAccountedFor(call, item.box)) {
      skipped.push({ name, reason: 'dynamic', start, end })
      continue
    }

    candidates.push({ item, call, node: call, start, end: foldEnd, slot })
  }

  /**
   * Resolve every fully static candidate to symbolic declarations before allocating a class.
   *
   * The normal fold can wait until the rewrite loop to compute a class string. Semantic
   * composition cannot: an enclosing `cx()` needs the declarations of its arguments so it can
   * discard overridden values before any string exists.
   */
  {
    for (const candidate of candidates) {
      if (candidate.styleSet || candidate.value !== undefined || candidate.replacement) continue

      const { item } = candidate
      if (item.type === 'css') {
        candidate.styleSet = styleCompiler.compose(...(item.data as Dict[]))
        continue
      }

      if (item.type === 'pattern') {
        candidate.styleSet = styleCompiler.compose(
          ...item.data.map((entry) => ctx.patterns.transform(item.name ?? '', entry as Dict)),
        )
        continue
      }

      if (item.type === 'viewTransition') {
        const semantic = viewTransitionClassName(item.data[0], ctx.utility.prefix)
        candidate.className = styleCompiler.allocateClassString(semantic)
        candidate.classNames = [candidate.className]
        candidate.replacement = JSON.stringify(candidate.className)
        continue
      }

      // Recipes already carry either a complete StyleSet or a finite decision map from the
      // exact lowering above. Keeping them out of this generic static-box path prevents the
      // parser's lossy dynamic data from being mistaken for an empty selection.
    }

    const sourceFile = ownSourceFile ?? candidates[0]?.node.getSourceFile()
    if (sourceFile) {
      const cxBindings = new Set<string>()
      for (const declaration of sourceFile.getImportDeclarations()) {
        if (declaration.isTypeOnly() || !isBambooCssModule(declaration.getModuleSpecifierValue())) continue
        for (const named of declaration.getNamedImports()) {
          if (named.isTypeOnly() || named.getNameNode().getText() !== 'cx') continue
          cxBindings.add((named.getAliasNode() ?? named.getNameNode()).getText())
        }
      }

      const byRange = new Map(candidates.map((candidate) => [`${candidate.start}:${candidate.end}`, candidate]))

      for (const call of sourceFile.getDescendantsOfKind(SyntaxKind.CallExpression)) {
        const callee = call.getExpression()
        if (!Node.isIdentifier(callee) || !cxBindings.has(callee.getText()) || isShadowed(call, callee.getText())) {
          continue
        }

        const matched: Candidate[] = []
        const parts: Array<
          | { kind: 'style'; candidate: Candidate }
          | { kind: 'dynamic'; candidate: Candidate }
          | { kind: 'class'; value: string; candidate?: Candidate }
        > = []
        const dynamic: Candidate[] = []
        const constantCandidates: Candidate[] = []
        let supported = true

        const take = (arg: Node): boolean => {
          const candidate = byRange.get(`${arg.getStart()}:${arg.getEnd()}`)
          if (candidate?.styleMap?.outputKind === 'class') {
            dynamic.push(candidate)
            parts.push({ kind: 'dynamic', candidate })
            return true
          }
          if (candidate?.styleSet) {
            matched.push(candidate)
            parts.push({ kind: 'style', candidate })
            return true
          }
          if (candidate?.item.type === 'viewTransition' && candidate.replacement && candidate.className) {
            constantCandidates.push(candidate)
            parts.push({ kind: 'class', value: candidate.className, candidate })
            return true
          }

          if (Node.isStringLiteral(arg) || Node.isNoSubstitutionTemplateLiteral(arg)) {
            parts.push({ kind: 'class', value: arg.getLiteralValue() })
            return true
          }

          if (Node.isArrayLiteralExpression(arg)) {
            for (const element of arg.getElements()) {
              if (Node.isSpreadElement(element) || !take(element)) return false
            }
            return true
          }

          // Values the runtime `cx` ignores and whose evaluation is inert.
          if (
            arg.getKind() === SyntaxKind.FalseKeyword ||
            arg.getKind() === SyntaxKind.TrueKeyword ||
            Node.isNumericLiteral(arg) ||
            arg.getKind() === SyntaxKind.NullKeyword ||
            (Node.isIdentifier(arg) && arg.getText() === 'undefined')
          ) {
            return true
          }

          return false
        }

        for (const arg of call.getArguments()) {
          if (take(arg)) continue
          supported = false
          break
        }

        if (dynamic.length > 1) {
          skipped.push({ name: 'cx', reason: 'dynamic', start: call.getStart(), end: call.getEnd() })
          continue
        }

        if (!supported) {
          skipped.push({ name: 'cx', reason: 'dynamic', start: call.getStart(), end: call.getEnd() })
          continue
        }

        if (dynamic.length === 1 && matched.length > 0) {
          const dynamicCandidate = dynamic[0]!
          const styleParts = parts.filter(
            (part): part is { kind: 'style' | 'dynamic'; candidate: Candidate } => part.kind !== 'class',
          )
          const dynamicIndex = styleParts.findIndex((part) => part.kind === 'dynamic')
          const before = styleParts
            .slice(0, dynamicIndex)
            .filter((part) => part.kind === 'style')
            .map((part) => part.candidate.styleSet!)
          const after = styleParts
            .slice(dynamicIndex + 1)
            .filter((part) => part.kind === 'style')
            .map((part) => part.candidate.styleSet!)
          const compiled = dynamicCandidate.styleMap!.compile(before, after)
          const expression =
            compiled.usesHelper &&
            dynamicCandidate.mapHelperName &&
            dynamicCandidate.mapHelperName !== RECIPE_MAP_HELPER
              ? compiled.expression.replaceAll(`${RECIPE_MAP_HELPER}(`, `${dynamicCandidate.mapHelperName}(`)
              : compiled.expression

          const arguments_: string[] = []
          let wroteCompiled = false
          for (const part of parts) {
            if (part.kind === 'class') {
              if (part.value) arguments_.push(JSON.stringify(part.value))
              continue
            }
            if (!wroteCompiled) {
              arguments_.push(expression)
              wroteCompiled = true
            }
          }

          dynamicCandidate.subsumed = true
          const first = styleParts[0]!.candidate
          candidates.push({
            ...first,
            call,
            node: call,
            start: call.getStart(),
            end: call.getEnd(),
            displayName: 'cx',
            replacement: arguments_.length === 1 ? arguments_[0] : `${callee.getText()}(${arguments_.join(', ')})`,
            className: '',
            classNames: [
              ...compiled.classNames,
              ...parts.filter((part) => part.kind === 'class').flatMap((part) => part.value.split(' ')),
            ].filter(Boolean),
            styleSet: undefined,
            styleMap: undefined,
            outputKind: undefined,
            insert: compiled.usesHelper ? dynamicCandidate.insert : undefined,
            sourceBoxes: styleParts
              .flatMap((part) => [part.candidate.item.box, part.candidate.configBox])
              .concat(constantCandidates.map((candidate) => candidate.item.box))
              .filter(Boolean),
          })
          continue
        }

        if (matched.length === 0) {
          if (constantCandidates.length === 0) continue

          const className = parts
            .filter((part): part is { kind: 'class'; value: string; candidate?: Candidate } => part.kind === 'class')
            .map((part) => part.value)
            .filter(Boolean)
            .join(' ')
          const first = constantCandidates[0]!
          candidates.push({
            ...first,
            call,
            node: call,
            start: call.getStart(),
            end: call.getEnd(),
            displayName: 'cx',
            replacement: JSON.stringify(className),
            className,
            classNames: className.split(' ').filter(Boolean),
            sourceBoxes: constantCandidates.map((candidate) => candidate.item.box).filter(Boolean),
          })
          continue
        }

        const merged = styleCompiler.compose(...matched.map((candidate) => candidate.styleSet!))
        const compiled = styleCompiler.className(merged)
        const classParts: string[] = []
        let wroteCompiled = false
        for (const part of parts) {
          if (part.kind === 'class') {
            if (part.value) classParts.push(part.value)
            continue
          }
          if (!wroteCompiled && compiled) {
            classParts.push(compiled)
            wroteCompiled = true
          }
        }

        const first = matched[0]!
        candidates.push({
          ...first,
          call,
          node: call,
          start: call.getStart(),
          end: call.getEnd(),
          displayName: 'cx',
          replacement: JSON.stringify(classParts.join(' ')),
          className: classParts.join(' '),
          classNames: classParts.flatMap((part) => part.split(' ')).filter(Boolean),
          styleSet: merged,
          sourceBoxes: [
            ...matched.flatMap((candidate) => [candidate.item.box, candidate.configBox]),
            ...constantCandidates.map((candidate) => candidate.item.box),
          ].filter(Boolean),
        })
      }
    }

    // Runtime maps are allocated only after semantic `cx()` has had a chance to merge every
    // leaf. This prevents the uncomposed intermediate atoms from entering the stylesheet.
    for (const candidate of candidates) {
      if (!candidate.styleMap || candidate.subsumed || candidate.replacement) continue
      const compiled = candidate.styleMap.compile()
      candidate.replacement =
        compiled.usesHelper && candidate.mapHelperName && candidate.mapHelperName !== RECIPE_MAP_HELPER
          ? compiled.expression.replaceAll(`${RECIPE_MAP_HELPER}(`, `${candidate.mapHelperName}(`)
          : compiled.expression
      if (!compiled.usesHelper) candidate.insert = undefined
      candidate.className = compiled.staticClasses
      candidate.classNames = compiled.classNames
      candidate.outputKind = compiled.outputKind === 'slots' ? 'slots' : undefined
    }
  }

  /**
   * Ranges the rewrite actually replaced. Declared before the early return below, because
   * that return is now also a reporting point: a module with nothing to fold is exactly the
   * shape `reportSurvivors` exists to catch.
   */
  const applied: Array<[number, number]> = []

  if (candidates.length === 0 && recipeDefinitions.length === 0) {
    // Nothing was rewritten, so every reference survives — and a module with no candidate at
    // all is exactly the shape this exists to catch.
    if (reportSurvivors) reportRuntimeBindings()
    return { code, map: null, folded, skipped, dependencies: [] }
  }

  // Compare by `SourceFile` identity rather than by path, since `options.filePath`
  // may be spelled differently by the caller than ts-morph spells it.
  const rewriteSourceFile =
    ownSourceFile ?? candidates[0]?.node.getSourceFile() ?? recipeDefinitions[0]?.call.getSourceFile()
  if (!rewriteSourceFile) return { code, map: null, folded, skipped, dependencies: [] }
  const dependencyScan = createDependencyScan(rewriteSourceFile)

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
    const name = candidate.displayName ?? item.name ?? item.type ?? ''

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
        kind: candidate.outputKind ?? 'class',
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
      for (const box of candidate.sourceBoxes ?? []) collectSourceFiles(box, dependencyScan)
      continue
    }

    let className: string
    try {
      if (item.type === 'pattern') {
        className = runtimeCss(...item.data.map((entry) => ctx.patterns.transform(name, entry as Dict)))
      } else {
        className = runtimeCss(...(item.data as Dict[]))
      }
    } catch {
      skipped.push({ name, reason: 'dynamic', start, end })
      continue
    }

    // JSON.stringify escapes the backslashes bamboo puts in class names for escaped
    // characters, and any quote an arbitrary value introduced.
    magic.overwrite(start, end, JSON.stringify(className))
    applied.push(...ranges)
    folded.push({ name, kind: 'class', className, classNames: className ? [className] : [], start, end })
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
            ? ({ config: importedConfig, box: undefined } satisfies RecipeEntry)
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
        helperModuleFromSubpath,
      )
      if (!helper) continue

      const keys = Object.keys(entry.config.variants ?? {})
      magic.overwrite(start, end, `${helper.name}(${args[0]!.getText()}, ${JSON.stringify(keys)})`)
      applyInsert(helper.insert)
      applied.push([start, end])
    }
  }

  // Erase every successfully extracted recipe declaration. Calls and supported metadata
  // operations above no longer read the binding; any other read is reported below and makes
  // the compilation fail. Replacing the whole factory call also deletes the style config,
  // allowing the now-unused `cva`/`sva` import to disappear under tree-shaking.
  for (const { name, call } of recipeDefinitions) {
    const start = call.getStart()
    const end = call.getEnd()
    if (collides([[start, end]])) continue
    magic.overwrite(start, end, 'undefined')
    applied.push([start, end])
    folded.push({ name, kind: 'definition', className: '', classNames: [], start, end })
  }

  /**
   * Bindings from a bamboo module still referenced once every rewrite is applied.
   *
   * Deliberately not driven by `parserResult`: that is the recogniser, and the point here is
   * to catch what it did not see. A namespace import called as `s.cva(...)`, a default
   * import, a specifier that resolved to nothing — each leaves a live reference and no ledger
   * entry at all, which used to let a build silently ship the engine.
   *
   * The helpers the compiler writes are excluded because they pull no style engine. `cx` is
   * also allowed to remain when it joins an arbitrary external class; only fully analyzable
   * arguments receive Bamboo's semantic composition guarantee.
   */
  function reportRuntimeBindings() {
    // Not `parserResult`'s boxes: one can carry a node from any module the extractor resolved
    // through, and this reports offsets against *this* module's text.
    const sourceFile =
      ownSourceFile ?? candidates[0]?.node.getSourceFile() ?? recipeDefinitions[0]?.call.getSourceFile()
    if (!sourceFile) return

    // Inline recipe bindings are local variables, so the import scan below cannot see reads
    // such as `badge.raw`, `badge.config`, `badge.merge(...)`, or a bare re-export. Follow the
    // declaration's symbol references and require every value read to sit inside a range the
    // compiler actually replaced. Otherwise a static build could remove the recipe layer
    // while silently retaining an API whose result still depends on it.
    for (const [binding, entry] of recipeConfigs) {
      if (entry === AMBIGUOUS) continue
      const definition = entry.box?.getNode?.()
      if (!definition || definition.getSourceFile() !== sourceFile) continue
      const declaration = definition.getFirstAncestorByKind(SyntaxKind.VariableDeclaration)
      const nameNode = declaration?.getNameNode()
      if (!nameNode || !Node.isIdentifier(nameNode)) continue

      const declined = skipped
        .filter((item) => SURVIVES_TO_RUNTIME.has(item.reason) && item.end > item.start)
        .some((item) =>
          nameNode.findReferencesAsNodes().some((ref) => ref.getStart() >= item.start && ref.getStart() < item.end),
        )

      if (declined) continue
      const survivor = nameNode
        .findReferencesAsNodes()
        .find((ref) => !applied.some(([from, to]) => ref.getStart() >= from && ref.getStart() < to))
      if (!survivor) continue

      // `findReferencesAsNodes` searches the whole project, so the reference that survives
      // is often in another module. Its offsets index *that* file, and reporting them against
      // this one yields a position in text they do not describe. Carry the reference's own
      // file and line, and let the offsets stay local so nothing else has to special-case them.
      const survivorFile = survivor.getSourceFile()
      const foreign = survivorFile !== sourceFile
      skipped.push({
        name: binding,
        reason: 'runtime-binding',
        start: foreign ? nameNode.getStart() : survivor.getStart(),
        end: foreign ? nameNode.getEnd() : survivor.getEnd(),
        ...(foreign ? { origin: { filePath: survivorFile.getFilePath(), line: survivor.getStartLineNumber() } } : {}),
      })
    }

    const bambooModules = [
      ...cssModules,
      ...(ctx.imports.matchers.recipe?.mods ?? []),
      ...(ctx.imports.matchers.pattern?.mods ?? []),
      ...(ctx.imports.matchers.tokens?.mods ?? []),
    ]

    // Imports that do not create a static ES binding bypass the binding walk below while
    // still retaining the generated runtime module. There is no useful fallback contract for
    // them: the compiler cannot rewrite an API selected from an opaque namespace at runtime.
    for (const call of sourceFile.getDescendantsOfKind(SyntaxKind.CallExpression)) {
      const callee = call.getExpression()
      const argument = call.getArguments()[0]
      if (!argument || (!Node.isStringLiteral(argument) && !Node.isNoSubstitutionTemplateLiteral(argument))) {
        continue
      }
      if (!matchesModule(argument.getLiteralValue(), bambooModules)) continue

      const isDynamicImport = callee.getKind() === SyntaxKind.ImportKeyword
      const isRequire = Node.isIdentifier(callee) && callee.getText() === 'require' && !isShadowed(call, 'require')
      if (!isDynamicImport && !isRequire) continue

      skipped.push({
        name: isDynamicImport ? 'import' : 'require',
        reason: 'runtime-binding',
        start: call.getStart(),
        end: call.getEnd(),
      })
    }

    for (const declaration of sourceFile.getDescendantsOfKind(SyntaxKind.ImportEqualsDeclaration)) {
      if (declaration.isTypeOnly()) continue
      const reference = declaration.getModuleReference()
      if (!Node.isExternalModuleReference(reference)) continue
      const expression = reference.getExpression()
      if (
        !expression ||
        !Node.isStringLiteral(expression) ||
        !matchesModule(expression.getLiteralValue(), bambooModules)
      ) {
        continue
      }
      skipped.push({
        name: declaration.getName(),
        reason: 'runtime-binding',
        start: declaration.getStart(),
        end: declaration.getEnd(),
      })
    }

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
    // reasons that fail the build suppress; `not-imported` passes, so
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
