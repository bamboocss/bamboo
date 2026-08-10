import { resolveTsPathPattern } from '@bamboocss/config/ts-path'
import { Node, type SourceFile, SyntaxKind } from 'ts-morph'
import type { BambooContext } from './create-context'
import { type SourceSnapshot, sourceSnapshots } from './source-snapshots'

/** A reference the accounting could not resolve, and where to find it. */
export interface DeclinedReference {
  filePath: string
  line: number
  reason: string
}

export interface TokenAccounting {
  /** Token paths every accepted reference asks for. Recorded by the code that accepted them. */
  paths: Set<string>
  /**
   * Prefixes a reference is bounded by without naming one token.
   *
   * A template literal with a static head — `` token(`colors.${shade}`) `` — cannot say which
   * token it wants, but it can say which it *cannot*: whatever it resolves to begins
   * `colors.`. Keeping that category is a far smaller answer than keeping every declaration,
   * which is what declining the reference would have cost, and it is still a superset of
   * anything the expression can produce.
   */
  prefixes: Set<string>
  /** Everything that could not be resolved. Non-empty means the blanket keep has to stay. */
  declined: DeclinedReference[]
}

/**
 * Account for every way javascript can reach a token, under `include`.
 *
 * This exists to answer one question: can the token layer be pruned to what is actually asked
 * for, or does a path the build cannot read mean every declaration has to survive? `token()`
 * hands back a `var()` for every token, so an unreadable path could name any of them, and a
 * declaration that goes while the app still asks for it produces a `var()` with nothing behind
 * it — the guaranteed-invalid value, which inherits rather than falling back. Silently wrong.
 *
 * Two properties make that safe to act on:
 *
 * - **Accepted implies recorded.** The code that accepts a reference records its path in the
 *   same step, so there is no second derivation to disagree with. An earlier attempt at this
 *   accepted shapes from the syntax tree while a separate text regex built the keep set; the
 *   regex needed the literal identifier `token`, so `import { token as t }` then
 *   `t('colors.red.300')` was accepted and kept nothing, and the declaration went while the
 *   app asked for it. Recording at the point of acceptance is what makes that unrepresentable.
 * - **Declining is free.** A decline keeps every declaration, which is exactly what happens
 *   today. So every branch that cannot prove a shape declines, and the accepted set below is
 *   deliberately small.
 *
 * What it cannot see is a caller *outside* `include`, which scopes style extraction rather
 * than everything that may import. That is why this only runs under `pruneUnusedTokens:
 * 'strict'`, where the user has asserted otherwise, and why `declined` is reported rather than
 * swallowed: the build says what it could not account for, instead of quietly deciding.
 */
export function accountTokenReferences(ctx: BambooContext): TokenAccounting {
  const accounting: TokenAccounting = { paths: new Set<string>(), prefixes: new Set<string>(), declined: [] }

  for (const snapshot of sourceSnapshots(ctx)) {
    accountSnapshot(ctx, snapshot, accounting)
  }

  return accounting
}

/**
 * One file's contribution, split out so the build can account and scan in a single walk.
 *
 * `pruneTokensForBuild` needs the keep set, the reachability answer and this accounting from
 * the same files; three separate passes read every file three times.
 */
export function accountSnapshot(ctx: BambooContext, snapshot: SourceSnapshot, accounting: TokenAccounting) {
  const { filePath, onDisk, parsed, sourceFile } = snapshot
  const { paths, prefixes, declined } = accounting

  {
    // The syntax pass can only speak for a file it reads exactly as the bundler will compile
    // it. `parser:before` fires for every non-json file, and a single-file component is stored
    // *post-transform* — `vueToTsx` keeps only `<script setup>` when both blocks are present,
    // and both plugins return an empty string when the parse throws — so the copy the ast
    // would see is not the copy that ships. Extension is no guard either: a user hook can
    // rewrite a `.ts` file just as well.
    if (onDisk == null || parsed == null || parsed !== onDisk) {
      // A file with no token in either copy cannot reach the artifact, so there is nothing to
      // decline over. Checked here rather than up front because the text is all this branch
      // has — the tree is the wrong copy or missing.
      const mentions = (onDisk?.includes('token') ?? false) || (parsed?.includes('token') ?? false)
      if (!mentions) return

      declined.push({ filePath, line: 1, reason: onDisk == null || parsed == null ? 'unreadable' : 'transformed' })
      return
    }

    // Matching text is not the same as a usable tree. `createSourceFile` hands every file to
    // ts-morph as `ScriptKind.TSX` (`packages/parser/src/project.ts`), so a construct that is
    // valid TypeScript and invalid TSX — a generic arrow `<T>(x: T) => x`, an old-style
    // assertion `<HTMLElement>node` — parses into a `JsxElement` that swallows the rest of the
    // file. The bytes are identical, so the comparison above sees nothing wrong, while every
    // call below the offending line has simply ceased to exist: a `.ts` file with a dynamic
    // `token(k)` under a generic arrow reported no calls and no declines at all.
    //
    // Syntax diagnostics separate the two exactly: zero for healthy TS and TSX, non-zero for
    // both shapes above and for a raw single-file component. That the check is coarse — it
    // also declines a project whose `.ts` files merely use generic arrows — is the safe
    // direction, and the report says which file to look at.
    if (parseErrorCount(sourceFile!)) {
      if (!parsed.includes('token')) return
      declined.push({ filePath, line: 1, reason: 'unparsed' })
      return
    }

    accountFile(ctx, sourceFile!, filePath, paths, prefixes, declined)
  }
}

/**
 * How many syntax errors the parse produced.
 *
 * `parseDiagnostics` is TypeScript-internal and absent from the public `SourceFile` type, so
 * it is reached through a cast. The alternative, `getPreEmitDiagnostics`, runs the type checker
 * over the whole program — orders of magnitude more work for a question about syntax, and it
 * would report type errors this pass has no business declining over.
 */
const parseErrorCount = (sourceFile: SourceFile) =>
  (sourceFile.compilerNode as unknown as { parseDiagnostics?: readonly unknown[] }).parseDiagnostics?.length ?? 0

/** Whether a module specifier resolves to the generated tokens artifact. */
const isTokensEntrypoint = (ctx: BambooContext, specifier: string) => {
  const mods = ctx.imports.value.tokens

  // The `mods` half of the matcher, deliberately without `ImportMap.match`. That also tests
  // the *imported name* against `^(token)$`, so a named import from the artifact called
  // anything else comes back false — indistinguishable from "this is not the artifact", which
  // is the lenient direction. Here the specifier decides, and the names are checked below.
  if (mods.some((mod) => specifier.includes(mod))) return true

  const pathMappings = ctx.conf.tsOptions?.pathMappings
  if (!pathMappings) return false

  const resolved = resolveTsPathPattern(pathMappings, specifier)
  if (!resolved) return false

  return mods.some((mod) => resolved.includes(mod) || resolved === mod)
}

const lineOf = (node: Node) => node.getSourceFile().getLineAndColumnAtPos(node.getStart()).line

function accountFile(
  ctx: BambooContext,
  sourceFile: SourceFile,
  filePath: string,
  paths: Set<string>,
  prefixes: Set<string>,
  declined: DeclinedReference[],
) {
  const decline = (node: Node, reason: string) => declined.push({ filePath, line: lineOf(node), reason })

  /** Local names bound to the artifact: the `token` export, and any namespace of it. */
  const bindings = new Set<string>()

  for (const statement of sourceFile.getStatements()) {
    // `export { token } from './tokens'` hands the binding to a module this pass may never
    // visit, so what reaches it cannot be accounted for here. `export * from` likewise.
    if (Node.isExportDeclaration(statement)) {
      const specifier = statement.getModuleSpecifierValue()
      if (specifier && isTokensEntrypoint(ctx, specifier)) decline(statement, 're-exported')
      continue
    }

    if (!Node.isImportDeclaration(statement)) continue

    const specifier = statement.getModuleSpecifierValue()
    if (!specifier) continue

    const clause = statement.getImportClause()
    if (!clause || statement.isTypeOnly()) continue

    if (!isTokensEntrypoint(ctx, specifier)) {
      // A module this pass cannot classify. It may be a barrel re-exporting the artifact,
      // which is the same bug one module out: `import { token as t } from '@acme/ui'` then
      // `t(key)` has no artifact specifier and no `token(`-shaped call, so keying on either
      // would miss it. Keying on the *imported name* catches it.
      for (const named of clause.getNamedImports()) {
        if (!named.isTypeOnly() && nameOf(named.getNameNode()) === 'token') decline(named, 'unclassified-import')
      }

      const foreignDefault = clause.getDefaultImport()
      if (foreignDefault && nameOf(foreignDefault) === 'token') decline(foreignDefault, 'unclassified-import')

      // A namespace only matters if something reads `.token` off it.
      const foreignNamespace = clause.getNamespaceImport()
      if (foreignNamespace && usesTokenMember(sourceFile, foreignNamespace.getText())) {
        decline(foreignNamespace, 'unclassified-import')
      }

      continue
    }

    // The artifact has no default export, so this names a shape not understood.
    const defaultImport = clause.getDefaultImport()
    if (defaultImport) decline(defaultImport, 'unsupported-import')

    const namespace = clause.getNamespaceImport()
    if (namespace) bindings.add(namespace.getText())

    for (const named of clause.getNamedImports()) {
      if (named.isTypeOnly()) continue
      // Only `token` produces a `var()`. A differently-named import is usually the `Token`
      // *type* — `import { Token, token }` is the idiomatic spelling, and declining on it meant
      // the commonest typed usage never bounded anything.
      //
      // Usually, not always: the specifier test is substring-based, so a barrel could match it
      // and re-export `token` under another name, which a call of that name would then reach.
      // So the question is whether the binding is used as a *value* anywhere, not what it is
      // called.
      if (nameOf(named.getNameNode()) !== 'token') {
        const local = (named.getAliasNode() ?? named.getNameNode()).getText()
        if (usedAsValue(sourceFile, local, named)) decline(named, 'unsupported-import')
        continue
      }
      bindings.add((named.getAliasNode() ?? named.getNameNode()).getText())
    }
  }

  // `import ds = require('...')` is neither an import declaration nor a call expression, so
  // neither pass around it would see one. Walked as descendants rather than as top-level
  // statements, because it is the one import form that can nest — inside a `namespace`, where
  // a statement-only scan missed it entirely.
  for (const importEquals of sourceFile.getDescendantsOfKind(SyntaxKind.ImportEqualsDeclaration)) {
    if (importEquals.getText().includes('token')) decline(importEquals, 'import-equals')
  }

  // `require('./tokens')` and `await import('./tokens')` bind by destructuring rather than by
  // an import clause, so the bindings above do not cover them.
  for (const call of sourceFile.getDescendantsOfKind(SyntaxKind.CallExpression)) {
    const callee = call.getExpression()
    const isRequire = Node.isIdentifier(callee) && callee.getText() === 'require'
    const isDynamicImport = callee.getKind() === SyntaxKind.ImportKeyword
    if (!isRequire && !isDynamicImport) continue

    const argument = call.getArguments()[0]
    // A template or a concatenation is not a specifier this can read, and one that is could
    // still be the artifact.
    if (!argument) continue
    if (Node.isStringLiteral(argument) ? isTokensEntrypoint(ctx, argument.getLiteralValue()) : true) {
      decline(call, isRequire ? 'require' : 'dynamic-import')
    }
  }

  for (const identifier of sourceFile.getDescendantsOfKind(SyntaxKind.Identifier)) {
    const text = nameOf(identifier)
    // Bindings of the artifact, plus the bare name itself — a `token` this pass did not bind
    // came from somewhere it could not follow, and assuming it is somebody else's is the
    // lenient direction.
    if (!bindings.has(text) && text !== 'token') continue
    const parent = identifier.getParent()

    // A property *name* is not a use of a binding — `foo.token` reads a member of `foo`. But
    // it may still be *the* token: `import { theme } from '@acme/ui'` then `theme.token(k)`
    // reaches the artifact through an object this pass never bound, and skipping the name
    // outright let that through with no decline at all. The two neighbouring branches already
    // decline the sibling shapes (a named import called `token`, and an unclassified
    // namespace read as `.token`); an object carrying `.token` fell between them.
    //
    // Reading it off a binding this pass *did* collect is fine — `accountedPath` handles
    // `ns.token(...)` from the namespace identifier itself, which is visited separately.
    if (Node.isPropertyAccessExpression(parent) && parent.getNameNode() === identifier) {
      const object = parent.getExpression()
      const objectName = Node.isIdentifier(object) ? object.getText() : undefined
      if (objectName && bindings.has(objectName)) continue

      decline(identifier, 'unresolved-reference')
      continue
    }

    if (Node.isPropertyAssignment(parent) && parent.getNameNode() === identifier) continue

    const resolved = accountedPath(identifier)
    if (resolved === undefined) {
      decline(identifier, 'unresolved-reference')
      continue
    }

    if (resolved.kind === 'binding') continue

    if (resolved.kind === 'prefix') {
      prefixes.add(resolved.value)
      continue
    }

    paths.add(resolved.value)
  }
}

/**
 * Whether any `<namespace>.token` member access appears, for an unclassified namespace.
 *
 * Element access counts too: `ui['token'](k)` reaches the same export and is invisible to a
 * property-access-only scan.
 */
function usesTokenMember(sourceFile: SourceFile, namespace: string) {
  const properties = sourceFile
    .getDescendantsOfKind(SyntaxKind.PropertyAccessExpression)
    .some((access) => access.getExpression().getText() === namespace && nameOf(access.getNameNode()) === 'token')

  if (properties) return true

  return sourceFile.getDescendantsOfKind(SyntaxKind.ElementAccessExpression).some((access) => {
    if (access.getExpression().getText() !== namespace) return false
    const argument = access.getArgumentExpression()
    return argument != null && (!Node.isStringLiteral(argument) || argument.getLiteralValue() === 'token')
  })
}

/**
 * An identifier's name as the compiler resolves it, not as it is spelled.
 *
 * `token` is the identifier `token`; reading `getText()` returns the escape and compares
 * unequal, which let an import of the artifact's export past the checks that key on the name.
 */
const nameOf = (node: Node) => (Node.isIdentifier(node) ? String(node.compilerNode.escapedText) : node.getText())

/**
 * What one occurrence asks for: an exact path, a prefix it is bounded by, or nothing at all —
 * the binding site of the import, which is not a use.
 */
type ResolvedReference = { kind: 'path' | 'prefix'; value: string } | { kind: 'binding' }

/**
 * What one occurrence asks for, or `undefined` if it is not a call this can read.
 *
 * Accepts the callee position and nothing else — `token('x')`, `token.value('x')`, and the
 * namespaced spellings of each. An identifier anywhere else is a value
 * escaping somewhere this pass cannot follow: assigned (`const t = token`), passed
 * (`useMemo(() => token)`), spread, or enumerated.
 */
function accountedPath(identifier: Node): ResolvedReference | undefined {
  const parent = identifier.getParent()
  if (!parent) return undefined

  // The binding site itself, and a type position naming it. Not a use.
  if (Node.isImportSpecifier(parent) || Node.isNamespaceImport(parent) || Node.isImportClause(parent)) {
    return { kind: 'binding' }
  }

  if (Node.isCallExpression(parent) && parent.getExpression() === identifier) return literalPath(parent)

  if (!Node.isPropertyAccessExpression(parent) || parent.getExpression() !== identifier) return undefined

  const property = parent.getNameNode().getText()
  const grandParent = parent.getParent()

  if (property === 'value') {
    return Node.isCallExpression(grandParent) && grandParent.getExpression() === parent
      ? literalPath(grandParent)
      : undefined
  }

  if (property !== 'token') return undefined

  // `ns.token('x')`
  if (Node.isCallExpression(grandParent) && grandParent.getExpression() === parent) return literalPath(grandParent)

  // `ns.token.value('x')`
  if (Node.isPropertyAccessExpression(grandParent) && grandParent.getExpression() === parent) {
    const method = grandParent.getNameNode().getText()
    if (method !== 'value') return undefined

    const call = grandParent.getParent()
    return Node.isCallExpression(call) && call.getExpression() === grandParent ? literalPath(call) : undefined
  }

  return undefined
}

/**
 * The path a call asks for, or the prefix it is bounded by.
 *
 * Read through `getLiteralValue()`, never off the source text. The text carries escapes —
 * `token('colors.red.300')` — and a path recorded raw looks up nothing, which
 * would accept a reference and keep no declaration for it. That is the exact failure this
 * module exists to make unrepresentable.
 *
 * A template literal with substitutions is not a path, but it is not unbounded either: its
 * head is a prefix everything it can produce begins with. Declining one cost every token
 * declaration in the project; bounding it costs the category. The head is the *whole* answer —
 * `` `colors.${a}.${b}` `` bounds no more tightly than `` `colors.${x}` `` does — and an empty
 * head bounds nothing at all, so that still declines.
 */
function literalPath(call: Node): ResolvedReference | undefined {
  if (!Node.isCallExpression(call)) return undefined
  const argument = unwrapAssertions(call.getArguments()[0])
  if (!argument) return undefined

  if (Node.isStringLiteral(argument)) return { kind: 'path', value: argument.getLiteralValue() }
  // A template with no substitutions is a literal in every way that matters here.
  if (Node.isNoSubstitutionTemplateLiteral(argument)) return { kind: 'path', value: argument.getLiteralValue() }

  if (Node.isTemplateExpression(argument)) {
    const head = argument.getHead().getLiteralText()
    return head ? { kind: 'prefix', value: head } : undefined
  }

  return undefined
}

/**
 * Whether a binding is read anywhere outside a type position.
 *
 * `import { Token, token }` brings in a type beside the value, and a type cannot produce a
 * `var()` — but a binding that is *called* can, whatever it is named, because a barrel
 * matching the specifier test could re-export `token` under it.
 */
function usedAsValue(sourceFile: SourceFile, name: string, declaration: Node) {
  return sourceFile.getDescendantsOfKind(SyntaxKind.Identifier).some((identifier) => {
    if (nameOf(identifier) !== name) return false
    // The import specifier itself is the binding site, not a read.
    if (identifier.getFirstAncestor((ancestor) => ancestor === declaration)) return false

    return !identifier.getFirstAncestor((ancestor) => Node.isTypeNode(ancestor))
  })
}

/**
 * Strip the wrappers that carry no runtime meaning.
 *
 * `` token(`animations.${name}` as Token) `` is the shape a *typed* caller writes, and has to
 * be: the generated `Token` type is a union of template literals, so a `string`-typed
 * substitution does not typecheck without the assertion. Reading only the outermost node
 * declined exactly the call this bounding exists for — the one in this repository's own
 * documentation site.
 *
 * Each of these evaluates to its inner expression, so unwrapping changes nothing about what
 * the call receives.
 */
function unwrapAssertions(node: Node | undefined): Node | undefined {
  let current = node

  while (
    current &&
    (Node.isAsExpression(current) ||
      Node.isSatisfiesExpression(current) ||
      Node.isNonNullExpression(current) ||
      Node.isParenthesizedExpression(current) ||
      Node.isTypeAssertion(current))
  ) {
    current = current.getExpression()
  }

  return current
}
