import { resolveTsPathPattern } from '@bamboocss/config/ts-path'
import { Node, type SourceFile, SyntaxKind } from 'ts-morph'
import type { BambooContext } from './create-context'
import { type SourceSnapshot, sourceSnapshots } from './source-snapshots'

/**
 * Every reason the accounting can decline, as a union so the split below is exhaustive.
 *
 * `reason: string` let a newly added reason default silently into the failing half, with no
 * compiler help. That is the wrong direction for a decision that fails builds.
 */
export type DeclineReason =
  | 'unreadable'
  | 'transformed'
  | 'unparsed'
  | 're-exported'
  | 'import-equals'
  | 'require'
  | 'dynamic-import'
  | 'unclassified-import'
  | 'unsupported-import'
  | 'unresolved-reference'

/**
 * The one decline `prune.unresolvedPath: 'error'` fails the build on.
 *
 * That setting asserts that every token path resolves, and this is the reason that says otherwise:
 * a token binding used in a way the build cannot follow — a path built at runtime, a binding
 * assigned away, a namespace enumerated. It is about the author's *token usage*, and it has a
 * fix at the call site.
 *
 * Nothing else may throw, because nothing else is necessarily about tokens at all. The other
 * reasons were written under a premise this would break: declining was free, so every branch
 * that could not prove a shape declined, and the accepted set was kept deliberately small.
 * `import(`./pages/${name}`)` declines as `dynamic-import` because the specifier is not a
 * literal and *could* be the artifact; `import lexer = require('./tokenizer')` declines because
 * the statement contains the substring `token`. Both are routine code with nothing to do with
 * design tokens, and failing a build over them would be indefensible. They keep every
 * declaration, which is what they always did, and say so.
 */
export const failsStrict = (entry: DeclinedReference) => entry.reason === 'unresolved-reference'

/** A reference the accounting could not resolve, and where to find it. */
export interface DeclinedReference {
  filePath: string
  line: number
  reason: DeclineReason
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
 * What it cannot see is a caller *outside* `include`, which scopes style extraction rather than
 * everything that may import — a script, a config, a sibling workspace package consuming the
 * output as design tokens. Nothing here declines for those, because nothing here can see them, so
 * no fallback covers them either: `prune.keepTokens` is the only answer, and `prune.unresolvedPath`
 * is what makes the declines this *can* see visible.
 *
 * That blind spot used to be covered by accident. The old default kept every declaration the
 * moment any javascript reached for a token at all, so a project with one `token()` call in it
 * protected its out-of-`include` readers without meaning to — and a project with none did not.
 * Consistency in the pruning direction is the trade this made deliberately.
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
      const mentions = mentionsToken(ctx, onDisk) || mentionsToken(ctx, parsed)
      if (!mentions) return

      declined.push({ filePath, line: 1, reason: onDisk == null || parsed == null ? 'unreadable' : 'transformed' })
      return
    }

    // Matching text is not the same as a usable tree. A file whose parse produced syntax
    // errors gives an ast that silently stops early — a construct valid in one script kind and
    // not another parses as a `JsxElement` whose children swallow the rest of the file. The
    // bytes are identical, so the comparison above sees nothing wrong, while every call below
    // the offending line has ceased to exist.
    //
    // Syntax diagnostics separate the two exactly: zero for a healthy file, non-zero for one
    // the parser could not read as written. That the check is coarse is the safe direction, and
    // the report says which file to look at.
    if (parseErrorCount(sourceFile!)) {
      if (!mentionsToken(ctx, parsed)) return
      declined.push({ filePath, line: 1, reason: 'unparsed' })
      return
    }

    // A file that cannot name the artifact has nothing to account for, and the walk below costs
    // a full identifier traversal to discover that. It is the common case by a wide margin —
    // `sandbox/vite-ts` has six files under `include` and not one of them spells `token` — and
    // paying for it everywhere is what made the accounting look like something to opt into.
    if (!mentionsToken(ctx, parsed)) return

    accountFile(ctx, sourceFile!, filePath, paths, prefixes, declined)
  }
}

/**
 * Whether a file is worth walking — because it can name the artifact, or because a shape in it
 * declines without naming one.
 *
 * The obvious half is the substring `token`, which an import of the default entrypoint, a call,
 * a member read and a `require` of it all put in the source. Three things defeat it, and each one
 * is a silent under-keep rather than a slow build, so the test errs wide:
 *
 * - **A configured entrypoint need not spell it.** `importMap: { tokens: '@acme/design' }` and a
 *   tsconfig path mapping both make `isTokensEntrypoint` true for a specifier with no `token` in
 *   it, so the configured modules are tested for as well.
 * - **An identifier may be written with unicode escapes.** An import specifier can spell the `t`
 *   of `token` as a backslash-u escape and still bind the export, which `nameOf` resolves and
 *   there is a test on. Both escape forms — the four-digit one and the braced one — begin with a
 *   backslash followed by `u`, so testing for that pair catches every spelling.
 * - **`require()` and `import()` decline on a specifier this cannot read**, which is a statement
 *   about the specifier rather than about tokens: `import(`./pages/${name}`)` names nothing and
 *   declines all the same, because it *could* be the artifact. Skipping the file would drop that
 *   decline and with it the keep it was standing in for.
 *
 * A false positive costs one identifier walk. A false negative deletes a declaration something
 * still asks for, so anything uncertain belongs on the walking side.
 */
const IMPORTING_CALL = /\b(?:require|import)\s*\(/

const mentionsToken = (ctx: BambooContext, text: string | undefined | null) => {
  if (text == null) return false
  if (text.includes('token') || text.includes('\\u')) return true
  if (ctx.imports.value.tokens.some((mod) => text.includes(mod))) return true

  return IMPORTING_CALL.test(text)
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
  const decline = (node: Node, reason: DeclineReason) => declined.push({ filePath, line: lineOf(node), reason })

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

  // Built once per file: the walk below asks about a handful of names, and rebuilding the answer
  // per occurrence would re-scan the tree for every one of them.
  const shadows = shadowedScopes(sourceFile)

  for (const identifier of sourceFile.getDescendantsOfKind(SyntaxKind.Identifier)) {
    const text = nameOf(identifier)
    // Bindings of the artifact, plus the bare name itself — a `token` this pass did not bind
    // came from somewhere it could not follow, and assuming it is somebody else's is the
    // lenient direction.
    if (!bindings.has(text) && text !== 'token') continue
    const parent = identifier.getParent()

    // `export { token }` hands the binding to a module this pass may never visit, exactly as
    // `export { token } from './tokens'` does. The statement walk only sees the spelling that
    // carries a specifier, and `accountedPath` reads an export specifier as a binding *site* and
    // skips it — so the two-statement form recorded nothing, declined nothing, and pruned as
    // though the export were not there. A sibling package importing that barrel then asked for a
    // declaration the build had deleted.
    if (Node.isExportSpecifier(parent)) {
      const declaration = parent.getFirstAncestorByKind(SyntaxKind.ExportDeclaration)
      if (declaration && !declaration.getModuleSpecifier()) decline(identifier, 're-exported')
      continue
    }

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

    if (isDeclarationName(identifier, parent)) continue

    // A local binding of the same name, which is not this artifact whatever it is called. Tested
    // here rather than at the top of the loop so a property *name* still declines: `theme.token(k)`
    // reaches the artifact through an object this pass never bound, and a `token` parameter
    // elsewhere in the file says nothing about that.
    if (isShadowed(identifier, shadows.get(text))) continue

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

/** Every name a binding name binds, following object and array destructuring. */
function boundNames(name: Node | undefined, bound: (name: string) => void) {
  if (!name) return

  if (Node.isIdentifier(name)) {
    bound(nameOf(name))
    return
  }

  if (!Node.isObjectBindingPattern(name) && !Node.isArrayBindingPattern(name)) return

  for (const element of name.getElements()) {
    if (Node.isBindingElement(element)) boundNames(element.getNameNode(), bound)
  }
}

/**
 * Scopes that bind a name to something which cannot be the artifact, keyed by that name.
 *
 * A parameter named `token` is not the `token` export. `items.map((token) => token.value)`
 * iterates token *objects* — from `@bamboocss/token-dictionary`, or from any list — and `token`
 * is the obvious name to reach for. The identifier walk keyed on the spelling alone, so every
 * read off such a parameter declined as an `unresolved-reference`, and one decline anywhere
 * keeps every declaration in the project.
 *
 * That is not hypothetical: on this repository's own documentation site it was 40 declines
 * across seven components, none of them a token call, holding a token layer of 500 declarations
 * where 146 are referenced. Token accounting there emitted a byte-identical
 * stylesheet and a wall of warnings — the feature reporting loudly that it had done nothing.
 *
 * Only the forms that *cannot* hold the artifact are collected. A parameter, a catch variable,
 * and a function or class declaration each bind something this file defines. A `const token = …`
 * in general does not — its initializer can be anything, including the artifact reached through a
 * barrel — so it goes on declining. Declining is free; accepting a reference whose path is never
 * recorded is the failure this module exists to prevent.
 *
 * The one variable form that is collected is a read off a binding already known to be local:
 * `const { token } = props` is whatever `props` holds, and `props` is a parameter. Rooting the
 * test at a local binding is what keeps `const { token } = ui` — a namespace import, which a
 * barrel could make the artifact — declining as before.
 */
function shadowedScopes(sourceFile: SourceFile) {
  const scopes = new Map<string, Node[]>()

  const add = (name: string, scope: Node | undefined) => {
    if (!scope) return
    const existing = scopes.get(name)
    if (existing) existing.push(scope)
    else scopes.set(name, [scope])
  }

  // One traversal. `getDescendantsOfKind` walks the whole tree per call, and this needs six
  // kinds — plus the variables, which cannot be resolved until the rest of the map is built.
  const variables: Node[] = []

  sourceFile.forEachDescendant((node) => {
    // A parameter is scoped to the function it belongs to, destructuring included.
    if (Node.isParameterDeclaration(node)) {
      const scope = node.getParent()
      boundNames(node.getNameNode(), (name) => add(name, scope))
      return
    }

    if (Node.isCatchClause(node)) {
      boundNames(node.getVariableDeclaration()?.getNameNode(), (name) => add(name, node))
      return
    }

    // A declaration's name is bound in the scope that *contains* it.
    if (Node.isFunctionDeclaration(node) || Node.isClassDeclaration(node)) {
      const name = node.getNameNode()
      if (name) add(nameOf(name), node.getParent())
      return
    }

    // A named function or class *expression* binds its own name inside itself and nowhere else.
    if (Node.isFunctionExpression(node) || Node.isClassExpression(node)) {
      const name = node.getNameNode()
      if (name) add(nameOf(name), node)
      return
    }

    if (Node.isVariableDeclaration(node)) variables.push(node)
  })

  // Destructuring off something already known to be local, so it runs once the map is complete.
  // One level only — a chain declines, which costs bytes and never correctness.
  for (const declaration of variables) {
    if (!Node.isVariableDeclaration(declaration)) continue

    const root = rootIdentifier(declaration.getInitializer())
    if (!root || !isShadowed(root, scopes.get(nameOf(root)))) continue

    const scope = declaration.getFirstAncestor(
      (ancestor) =>
        Node.isBlock(ancestor) ||
        Node.isSourceFile(ancestor) ||
        Node.isModuleBlock(ancestor) ||
        Node.isCaseClause(ancestor) ||
        Node.isDefaultClause(ancestor) ||
        Node.isForStatement(ancestor) ||
        Node.isForOfStatement(ancestor) ||
        Node.isForInStatement(ancestor),
    )

    boundNames(declaration.getNameNode(), (name) => add(name, scope))
  }

  return scopes
}

/**
 * The identifier an expression is rooted at, for the member reads that keep it local.
 *
 * `props`, `props.theme` and `props['theme']` all root at `props`. Anything else — a call, an
 * `await`, a literal — returns nothing, so the variable it initializes is not treated as local.
 */
function rootIdentifier(expression: Node | undefined): Node | undefined {
  let current = expression

  while (current && (Node.isPropertyAccessExpression(current) || Node.isElementAccessExpression(current))) {
    current = current.getExpression()
  }

  return current && Node.isIdentifier(current) ? current : undefined
}

/**
 * Whether an identifier is the *name* of a declaration rather than a read of one.
 *
 * `interface Props { token: Token }` names a member and reads nothing, but reached
 * `accountedPath`, which cannot read it and so declined — and an `unresolved-reference` is the
 * one decline that fails a strict build. `PropertyAssignment` was already excluded for this
 * reason; the type and class members are the same statement about a different node.
 *
 * `ShorthandPropertyAssignment` is deliberately absent: `{ token }` names a property *and* reads
 * the binding, so it is a reference like any other.
 */
function isDeclarationName(identifier: Node, parent: Node) {
  if (
    Node.isPropertyAssignment(parent) ||
    Node.isPropertySignature(parent) ||
    Node.isMethodSignature(parent) ||
    Node.isPropertyDeclaration(parent) ||
    Node.isMethodDeclaration(parent) ||
    Node.isEnumMember(parent)
  ) {
    return parent.getNameNode() === identifier
  }

  return false
}

/**
 * Whether an occurrence falls inside one of the scopes that shadow its name.
 *
 * Both nodes come from the same file, so containment in the tree is containment in the source
 * range — which answers it without walking ancestors once per candidate scope.
 */
function isShadowed(identifier: Node, scopes: Node[] | undefined) {
  if (!scopes) return false

  const start = identifier.getStart()
  const end = identifier.getEnd()

  return scopes.some((scope) => scope.getStart() <= start && end <= scope.getEnd())
}

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

  // A binding site rather than a use. `ExportSpecifier` belongs here too: `export { token }
  // from '…'` is declined as `re-exported` by the statement walk, with the reason that
  // actually describes it — leaving it to fall through here reported it a second time as an
  // unresolved *reference*, which is the one reason that fails the build.
  if (
    Node.isImportSpecifier(parent) ||
    Node.isNamespaceImport(parent) ||
    Node.isImportClause(parent) ||
    Node.isExportSpecifier(parent)
  ) {
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
