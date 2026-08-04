import type { Context } from '@bamboocss/core'
import { type BoxNode, box } from '@bamboocss/extractor'
import type { Dict, ParserResultInterface, ResultItem } from '@bamboocss/types'
import MagicString from 'magic-string'
import { Node, type SourceFile } from 'ts-morph'
import { type JsxEdit, planJsxFold } from './fold-jsx'
import { createRuntimeCss, type RuntimeCss } from './runtime-css'

/**
 * Why a call site was left alone. Surfaced through `panda`-style diagnostics so a
 * user can tell the difference between "this folded" and "this silently didn't".
 */
export type SkipReason =
  | 'dynamic' // some part of the arguments could not be resolved at build time
  | 'raw-call' // `css.raw(...)` returns a style object, not a class string
  | 'not-foldable' // the call cannot evaluate to a class string at all (cva/sva/token)
  | 'unsupported-kind' // could fold in principle, but this phase does not (config recipes)
  | 'not-imported' // the callee is not a Bamboo import — a local function of the same name
  | 'no-call-expression' // could not locate the enclosing call to replace
  | 'overlapping' // nested inside another fold
  | 'empty' // resolved to no class names at all

export interface FoldedCall {
  name: string
  className: string
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
   * Also collapse `styled.*` elements to their intrinsic tag. On by default, since the
   * JSX factory is where most style resolution happens at runtime.
   */
  jsx?: boolean
}

/**
 * `cva`/`sva` return a function and `token` returns a value, so none of them can
 * collapse to a class string. Their *invocations* could, but those are separate call
 * sites the parser does not record as such.
 */
const FOLDABLE_TYPES = new Set(['css', 'pattern'])

/**
 * Kinds that can never collapse to a class string, as opposed to config recipes,
 * which could but are not folded yet.
 *
 * A recipe call resolves to `cx(recipeCss(variants), css(compoundVariantStyles))`.
 * Both halves are reachable: `cx` is a plain string concatenation here, and
 * `getCompoundVariantCss` is a short pure function whose only dependency, `mergeCss`,
 * already lives in `@bamboocss/shared`. What is missing is the recipe-specific
 * `createCss` transform (`name--prop_value`), which the generated artifact builds
 * inline. Lifting that alongside the compound-variant matcher is the prerequisite.
 */
const UNFOLDABLE_TYPES = new Set(['cva', 'sva', 'token'])

/** Element surfaces `foldJsx` handles, as opposed to call sites. */
const JSX_TYPES = new Set(['jsx-factory'])

/**
 * Statically resolvable means: every box in the tree carries a known value.
 *
 * `unresolvable` is the extractor saying it could not evaluate a node.
 * `conditional` is a ternary — two possible values, so there is no single string to
 * fold to. `box.fallback` produces an object with no `type` at all, which is likewise
 * not something we can trust.
 */
const isStaticBox = (node: BoxNode | undefined, seen = new Set<BoxNode>()): boolean => {
  if (!node) return false
  if (seen.has(node)) return true
  seen.add(node)

  if (box.isUnresolvable(node) || box.isConditional(node)) return false

  // `box.fallback` fabricates a shape with no discriminant.
  if (!('type' in node) || node.type == null) return false

  if (box.isMap(node)) {
    for (const child of node.value.values()) {
      if (!isStaticBox(child, seen)) return false
    }
    return true
  }

  if (box.isArray(node)) {
    for (const child of node.value) {
      if (!isStaticBox(child, seen)) return false
    }
    return true
  }

  // literal / object / empty-initializer all carry a concrete value.
  return true
}

/**
 * Does the extracted box account for every property the source declares?
 *
 * `isStaticBox` is not sufficient on its own. The extractor *omits* what it cannot
 * evaluate rather than marking it unresolvable, so `css({ color: 'red.300', ...rest })`
 * yields a perfectly static-looking map holding only `color`. Folding that produces
 * `"c_red.300"` and silently drops everything `rest` contributed.
 *
 * So the source is the authority on what the call contains, and anything the box does
 * not account for disqualifies the fold:
 *
 * - a declared property missing from the map (its value did not evaluate)
 * - a computed key, which we cannot match against the map by name
 * - a spread, unless it is an inline object literal
 *
 * Spreads are the conservative case. `{ ...base }` where `base` is a static local
 * object *is* resolved by the extractor, but a resolved spread and an unresolved one
 * are indistinguishable once flattened into the map — both just contribute keys, or
 * fail to. Rather than guess, phase 1 declines them. Partial folding is where this
 * gets revisited.
 */
const accountsForSource = (node: Node | undefined, boxNode: BoxNode | undefined): boolean => {
  if (!node) return true

  const unwrapped = Node.isAsExpression(node) || Node.isParenthesizedExpression(node) ? node.getExpression() : node

  if (Node.isArrayLiteralExpression(unwrapped)) {
    if (!box.isArray(boxNode)) return false
    const elements = unwrapped.getElements()
    if (elements.length !== boxNode.value.length) return false
    return elements.every((element, index) => accountsForSource(element, boxNode.value[index]))
  }

  if (!Node.isObjectLiteralExpression(unwrapped)) return true

  // An object literal in source must have produced a map.
  if (!box.isMap(boxNode)) return false

  for (const property of unwrapped.getProperties()) {
    if (Node.isSpreadAssignment(property)) {
      const expression = property.getExpression()
      if (!Node.isObjectLiteralExpression(expression)) return false
      continue
    }

    if (
      Node.isMethodDeclaration(property) ||
      Node.isGetAccessorDeclaration(property) ||
      Node.isSetAccessorDeclaration(property)
    ) {
      return false
    }

    if (!Node.isPropertyAssignment(property) && !Node.isShorthandPropertyAssignment(property)) {
      return false
    }

    const nameNode = property.getNameNode()
    if (Node.isComputedPropertyName(nameNode)) return false

    const key =
      Node.isStringLiteral(nameNode) || Node.isNumericLiteral(nameNode)
        ? String(nameNode.getLiteralValue())
        : nameNode.getText()

    const value = Node.isPropertyAssignment(property) ? property.getInitializer() : undefined

    // `{ display: undefined }` contributes nothing and is dropped by the encoder too,
    // so its absence from the map is expected rather than a lost value.
    if (value && Node.isIdentifier(value) && value.getText() === 'undefined') continue

    if (!boxNode.value.has(key)) return false

    if (!accountsForSource(value, boxNode.value.get(key))) return false
  }

  return true
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
 * Names a module imports, computed once per file.
 *
 * The parser matches style calls by name and does not require an import — a
 * deliberate choice, since for CSS extraction the worst case is a few unused rules.
 * A source transform cannot be that relaxed: it would rewrite a user's own
 * `const css = (styles) => JSON.stringify(styles)` into a class string and silently
 * change what their code does.
 */
const importedNames = (sourceFile: SourceFile): Set<string> => {
  const names = new Set<string>()

  for (const declaration of sourceFile.getImportDeclarations()) {
    const defaultImport = declaration.getDefaultImport()
    if (defaultImport) names.add(defaultImport.getText())

    const namespaceImport = declaration.getNamespaceImport()
    if (namespaceImport) names.add(namespaceImport.getText())

    for (const named of declaration.getNamedImports()) {
      names.add((named.getAliasNode() ?? named.getNameNode()).getText())
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
  if (args.length === 0) return false

  if (box.isArray(boxNode) && boxNode.getNode() === call) {
    if (boxNode.value.length !== args.length) return false
    return args.every((arg, index) => accountsForSource(arg, boxNode.value[index]))
  }

  // Single-argument shape: the stored box is the argument itself.
  if (args.length !== 1) return false
  return accountsForSource(args[0], boxNode)
}

export const foldSource = (options: FoldOptions): FoldResult => {
  const { ctx, code, parserResult, jsx = true, runtimeCss = createRuntimeCss(ctx) } = options

  const folded: FoldedCall[] = []
  const skipped: SkippedCall[] = []

  interface Candidate {
    item: ResultItem
    /** The call to replace, for a call site. Absent for a JSX element. */
    call?: Node
    /** Pre-planned edits and class, for a JSX element. */
    edits?: JsxEdit[]
    className?: string
    node: Node
    start: number
    end: number
  }

  const candidates: Candidate[] = []
  const seenRanges = new Set<string>()

  // One import scan per file rather than per call site.
  const importCache = new Map<SourceFile, Set<string>>()
  const importsFor = (sourceFile: SourceFile) => {
    let names = importCache.get(sourceFile)
    if (!names) {
      names = importedNames(sourceFile)
      importCache.set(sourceFile, names)
    }
    return names
  }

  for (const item of parserResult.toArray()) {
    const type = item.type ?? ''
    const name = item.name ?? type

    if (!item.box) continue

    const call = findCallExpression(item.box)

    if (jsx && JSX_TYPES.has(type)) {
      const plan = planJsxFold(item, ctx, runtimeCss)

      if ('reason' in plan) {
        const node = item.box?.getNode?.()
        if (node) skipped.push({ name, reason: plan.reason, start: node.getStart(), end: node.getEnd() })
        continue
      }

      candidates.push({
        item,
        node: item.box!.getNode!(),
        edits: plan.edits,
        className: plan.className,
        start: plan.start,
        end: plan.end,
      })
      continue
    }

    if (!FOLDABLE_TYPES.has(type)) {
      // Only report kinds that are calls at all; JSX entries are a different surface.
      if (call && UNFOLDABLE_TYPES.has(type)) {
        skipped.push({ name, reason: 'not-foldable', start: call.getStart(), end: call.getEnd() })
      } else if (call && type === 'recipe') {
        // A config recipe call does resolve to a class string, so unlike cva/sva this
        // is a "not yet", not a "never". Reported so it is visible rather than silent.
        skipped.push({ name, reason: 'unsupported-kind', start: call.getStart(), end: call.getEnd() })
      }
      continue
    }

    if (!call) {
      skipped.push({ name, reason: 'no-call-expression', start: 0, end: 0 })
      continue
    }

    const start = call.getStart()
    const end = call.getEnd()

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
    const rangeKey = `${start}:${end}`
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

    if (!isStaticBox(item.box) || !hasStyles(item.data) || !argumentsAccountedFor(call, item.box)) {
      skipped.push({ name, reason: 'dynamic', start, end })
      continue
    }

    candidates.push({ item, call, node: call, start, end })
  }

  if (candidates.length === 0) {
    return { code, map: null, folded, skipped, dependencies: [] }
  }

  // Compare by `SourceFile` identity rather than by path, since `options.filePath`
  // may be spelled differently by the caller than ts-morph spells it.
  const dependencyScan = createDependencyScan(candidates[0]!.node.getSourceFile())

  // Outermost-first, so a nested candidate can be detected and dropped rather than
  // producing an overlapping overwrite (which magic-string rejects).
  candidates.sort((a, b) => a.start - b.start || b.end - a.end)

  const magic = new MagicString(code)

  // Applied edit ranges, not candidate ranges. A `styled.*` element only rewrites its two
  // tags, so anything between them — a nested element, a `css()` call in the children —
  // is still free to fold. Gating on the element's whole span would reject those for an
  // overlap that never happens.
  const applied: Array<[number, number]> = []
  const collides = (edits: Array<[number, number]>) =>
    edits.some(([start, end]) => applied.some(([from, to]) => start < to && from < end))

  for (const candidate of candidates) {
    const { item, start, end } = candidate
    const name = item.name ?? item.type ?? ''

    const ranges: Array<[number, number]> = candidate.edits
      ? candidate.edits.map((edit) => [edit.start, edit.end])
      : [[start, end]]

    if (collides(ranges)) {
      skipped.push({ name, reason: 'overlapping', start, end })
      continue
    }

    if (candidate.edits) {
      for (const edit of candidate.edits) magic.overwrite(edit.start, edit.end, edit.text)
      applied.push(...ranges)
      folded.push({ name, className: candidate.className!, start, end })
      collectSourceFiles(item.box, dependencyScan)
      continue
    }

    let className: string
    try {
      className =
        item.type === 'pattern'
          ? runtimeCss(...item.data.map((entry) => ctx.patterns.transform(name, entry as Dict)))
          : runtimeCss(...(item.data as Dict[]))
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
    folded.push({ name, className, start, end })
    collectSourceFiles(item.box, dependencyScan)
  }

  if (folded.length === 0) {
    return { code, map: null, folded, skipped, dependencies: [] }
  }

  return {
    code: magic.toString(),
    map: magic.generateMap({ source: options.filePath, hires: true, includeContent: true }),
    folded,
    skipped,
    dependencies: Array.from(dependencyScan.results),
  }
}
