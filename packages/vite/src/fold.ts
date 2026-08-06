import { resolveTsPathPattern } from '@bamboocss/config/ts-path'
import type { Context } from '@bamboocss/core'
import { type BoxNode, box, unbox } from '@bamboocss/extractor'
import type { Dict, ParserResultInterface, ResultItem } from '@bamboocss/types'
import MagicString from 'magic-string'
import { Node, type SourceFile, SyntaxKind } from 'ts-morph'
import { type JsxEdit, planJsxFold, planPatternFold } from './fold-jsx'
import {
  accountsForSource,
  ensureCxImport,
  findBambooBinding,
  isStaticBox,
  LEAF_HELPER,
  planPartialFold,
} from './fold-partial'
import { createRuntimeCss, createRuntimeRecipe, createRuntimeToken, type RuntimeCss } from './runtime-css'

/**
 * Why a call site was left alone. Surfaced through `panda`-style diagnostics so a
 * user can tell the difference between "this folded" and "this silently didn't".
 */
export type SkipReason =
  | 'dynamic' // some part of the arguments could not be resolved at build time
  | 'raw-call' // `css.raw(...)` returns a style object, not a class string
  | 'not-foldable' // the call cannot evaluate to a class string at all (cva/sva)
  | 'unsupported-kind' // could fold in principle, but this phase does not (config recipes)
  | 'not-imported' // the callee is not a Bamboo import — a local function of the same name
  | 'no-call-expression' // could not locate the enclosing call to replace
  | 'overlapping' // nested inside another fold
  | 'empty' // resolved to no class names at all
  | 'unresolved-token' // `token(...)` resolves to no usable string, so its fallback decides

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
   * Also collapse `styled.*` and pattern elements to the tag they render. On by default,
   * since the JSX factory is where most style resolution happens at runtime.
   */
  jsx?: boolean
  /**
   * Split a `css()` call or a `styled.*` element that is only partly static, keeping the
   * dynamic half at runtime. On by default.
   */
  partial?: boolean
}

/**
 * `cva`/`sva` return a function, so neither can collapse to a class string. Their
 * *invocations* could, but those are separate call sites the parser does not record as
 * such. `token` also resolves to no class, but it does resolve to a literal, so it folds
 * through its own path rather than being declined outright.
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

/** Element surfaces `foldJsx` handles, as opposed to call sites. */
const JSX_TYPES = new Set(['jsx-factory', 'jsx-pattern'])

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
 * The identifier a JSX tag is rooted at: `styled` for `<styled.div>`, `bamboo` for
 * `<bamboo.styled.div>`. The same question `calleeRootName` answers for a call, and it
 * feeds the same import and shadowing checks.
 */
const tagRootName = (element: Node): string | undefined => {
  if (!Node.isJsxOpeningElement(element) && !Node.isJsxSelfClosingElement(element)) return undefined

  let current: Node = element.getTagNameNode()
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
  const { ctx, code, parserResult, jsx = true, partial: partial_ = true, runtimeCss = createRuntimeCss(ctx) } = options

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
    }
  }
  const runtimeRecipe = createRuntimeRecipe(ctx)
  const runtimeToken = createRuntimeToken(ctx)

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
  const trim = (value: string) =>
    value
      .replaceAll('\\', '/')
      .replace(/^(?:\.\.?\/)+/, '')
      .replace(/\/$/, '')

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
  const jsxDeps = { isBambooCssModule, isGeneratedCssModule, isShadowed }

  const folded: FoldedCall[] = []
  const skipped: SkippedCall[] = []

  interface Candidate {
    item: ResultItem
    /** The call to replace, for a call site. Absent for a JSX element. */
    call?: Node
    /** Pre-planned edits and class, for a JSX element. */
    edits?: JsxEdit[]
    className?: string
    /** Every class literal emitted, when that is more than `className` — see FoldedCall. */
    classNames?: string[]
    /** Replacement text for a partially folded call, in place of a bare class string. */
    replacement?: string
    /** The resolved value, for a `token()` call. Its presence is what marks one. */
    value?: string
    /** Bindings to add to an existing import, by name so duplicates can be dropped. */
    insert?: { pos: number; names: string[] }
    node: Node
    start: number
    end: number
  }

  const candidates: Candidate[] = []
  const seenRanges = new Set<string>()

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

    if (jsx && JSX_TYPES.has(type)) {
      const element = item.box.getNode?.()
      if (!element) continue

      const elementStart = element.getStart()
      const elementEnd = element.getEnd()

      // Same two guards the call path applies, for the same reasons: offsets only mean
      // something against the module being rewritten, and the parser matches a factory
      // by name without requiring the import to be the one in scope. Collapsing a
      // `styled.div` that is really the user's own binding does not just change a
      // string — it deletes their component from the markup.
      if (code.slice(elementStart, elementEnd) !== element.getText()) {
        skipped.push({ name, reason: 'no-call-expression', start: 0, end: 0 })
        continue
      }

      const rootName = tagRootName(element)
      if (!rootName || !importsFor(element.getSourceFile()).has(rootName) || isShadowed(element, rootName)) {
        skipped.push({ name, reason: 'not-imported', start: elementStart, end: elementEnd })
        continue
      }

      const plan =
        type === 'jsx-pattern'
          ? planPatternFold(item, ctx, runtimeCss)
          : planJsxFold(item, ctx, runtimeCss, partial_ ? jsxDeps : undefined)

      if ('reason' in plan) {
        skipped.push({ name, reason: plan.reason, start: elementStart, end: elementEnd })
        continue
      }

      candidates.push({
        item,
        node: element,
        edits: plan.edits,
        className: plan.className,
        insert: plan.insert,
        start: plan.start,
        end: plan.end,
      })
      continue
    }

    // `token()` resolves to a CSS value rather than a class, so it takes its own path:
    // none of the class-producing machinery below has anything to say about it. Folding it
    // is worth the separate path because the alternative is shipping the whole token map —
    // every token in the project — to resolve a handful of string lookups at runtime.
    if (type === 'token') {
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

      // `token.var(path)` returns the variable reference where `token(path)` returns the
      // resolved value, and both are recorded under the name `token`. The parser does not
      // currently record `.var` at all, so this guards a case that cannot arise today —
      // and would silently inline the wrong half of the entry the day it does.
      //
      // Only a property access can name the wrong half, so only one is asked. A bare
      // callee is whatever the file bound the import to, which `token as t` makes some
      // name the matcher has never heard of.
      const callee = Node.isCallExpression(call) ? call.getExpression() : undefined
      if (
        Node.isPropertyAccessExpression(callee) &&
        !ctx.imports.matchers.tokens.match(callee.getNameNode().getText())
      ) {
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

      const value = runtimeToken(path)
      // Three ways to land here, all of them the same decision: the path names no token,
      // the token's value is not a string (a numeric `fontWeights` token stays a number
      // through the dictionary, and the runtime returns that number), or the value is
      // empty. The runtime is `tokens[path]?.value || fallback`, so in the first and last
      // cases the fallback decides; in the middle one no string literal can stand in for
      // what it returns. Declining leaves all three where the user wrote them.
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
      const partial = partial_ ? tryPartial(item, call, rootName) : undefined

      if (partial) {
        candidates.push({ item, call, node: call, start, end, ...partial })
        continue
      }

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

  // Which bindings have already been added, for the whole module rather than per insertion
  // point. A module-level binding is in scope everywhere in the file, so one is enough
  // however many calls need it — and a file importing the css module twice has two
  // insertion points, which keyed per position would each get their own `cx` and emit
  // `Identifier 'cx' has already been declared`.
  //
  // Tracked by name rather than as a single flag, because calls in the same file need
  // different sets: one needs `cx` alone, the next also needs the leaf helper.
  const insertedNames = new Set<string>()
  const applyInsert = (insert: { pos: number; names: string[] } | undefined) => {
    if (!insert) return

    const missing = insert.names.filter((name) => !insertedNames.has(name))
    if (!missing.length) return

    magic.appendLeft(insert.pos, missing.map((name) => `, ${name}`).join(''))
    for (const name of missing) insertedNames.add(name)
  }

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
      continue
    }

    if (candidate.edits) {
      for (const edit of candidate.edits) magic.overwrite(edit.start, edit.end, edit.text)
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
      continue
    }

    let className: string
    try {
      if (item.type === 'pattern') {
        className = runtimeCss(...item.data.map((entry) => ctx.patterns.transform(name, entry as Dict)))
      } else if (item.type === 'recipe') {
        // A recipe call takes one variant object; anything else is not a shape the
        // generated recipe function accepts.
        const resolved = item.data.length === 1 ? runtimeRecipe(name, item.data[0] as Dict) : undefined
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
