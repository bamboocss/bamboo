import { type BoxContext, type BoxNode, box, maybeBoxNode } from '@bamboocss/extractor'
import { type SourceFile, VariableDeclarationKind } from 'ts-morph'
import { type BinaryExpression, type ConditionalExpression, type Expression, Node, SyntaxKind } from 'ts-morph'

/**
 * Statically resolvable means: every box in the tree carries a known value.
 *
 * `unresolvable` is the extractor saying it could not evaluate a node.
 * `conditional` is a ternary — two possible values, so there is no single string to
 * fold to. `box.fallback` produces an object with no `type` at all, which is likewise
 * not something we can trust.
 */
export const isStaticBox = (node: BoxNode | undefined, seen = new Set<BoxNode>()): boolean => {
  if (!node) return false
  if (seen.has(node)) return true
  seen.add(node)

  if (box.isUnresolvable(node) || box.isConditional(node)) return false

  // `box.fallback` fabricates a shape with no discriminant.
  if (!('type' in node) || node.type == null) return false

  // A value the extractor could not evaluate is not always boxed as `unresolvable`: a
  // template literal with an interpolation comes back as a *literal* carrying
  // `undefined`. The key is present in the map, so the accounting check is satisfied
  // too, and the property would be dropped from a fold that looked static by both tests.
  if (box.isLiteral(node) && node.value === undefined) {
    const source = node.getNode?.()
    // An explicit `undefined` contributes no declaration and is fully known. Dynamic
    // template literals also arrive as a literal carrying `undefined`, but their source
    // node is not this identifier and must remain rejected.
    return Boolean(source && Node.isIdentifier(source) && source.getText() === 'undefined')
  }

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
 * Strip the wrappers the extractor strips before it builds a box, so the source node
 * compared against a box is the same node the box was built from.
 *
 * A local copy of the extractor's `unwrapExpression`, which is not part of its public
 * surface. Recognising fewer wrappers than it does is not a cosmetic difference: an
 * unrecognised one leaves an object literal wrapped, and the object checks below skip it.
 */
const unwrapExpression = (node: Node): Node =>
  Node.isAsExpression(node) ||
  Node.isParenthesizedExpression(node) ||
  Node.isNonNullExpression(node) ||
  Node.isTypeAssertion(node) ||
  Node.isSatisfiesExpression(node)
    ? unwrapExpression(node.getExpression())
    : node

/**
 * Mirrors the parser's evaluator environment, so re-boxing an operand here gets the same
 * answer the extraction did. Left to its default, ts-evaluator presets to `NODE` and
 * would resolve expressions the parser cannot see — making this check *more* permissive
 * than the extraction it is auditing, which is the one thing it must never be.
 */
const REBOXED: BoxContext = { getEvaluateOptions: () => ({ environment: { preset: 'ECMA' } }) }

// Unwrapped first, because the extractor unwraps before boxing and `maybeBoxNode` has no
// case for a wrapper node — handing it one reports `('red.300')` or `'red.300' as const`
// as unresolvable, which is neither true nor what extraction concluded.
const rebox = (node: Node) => maybeBoxNode(unwrapExpression(node) as Expression, [], REBOXED)

/**
 * Did this operand resolve to a value the program will actually produce?
 *
 * Producing a box is not enough when the operand is itself a choice: `a || b || c` parses
 * as `(a || b) || c`, so the outer operator is handed whatever the inner one answered —
 * including an arm the extractor invented. Asking only "is there a box" reads that
 * invention as an ordinary literal.
 */
const resolvesExactly = (node: Node): boolean => {
  const inner = unwrapExpression(node)
  const boxed = rebox(inner)
  if (!boxed) return false

  // The ternary half of this is defensive: with operands required to be written here, an
  // operand that is a ternary is refused before it can be asked, and in the arm positions
  // an unjudged nested ternary is caught by the sibling arm failing instead. I could not
  // construct a shape that needs it — it is kept so the two positions stay symmetric if
  // `isWrittenHere` is ever loosened.
  return Node.isConditionalExpression(inner) || isCollapsedBinary(inner) ? decidedAtBuildTime(inner) : true
}

/**
 * Is this operand's value written here, rather than named?
 *
 * A box records what the extractor resolved a name *through* — a `let`'s initializer, a
 * parameter's default — none of which is what the operand holds when the call runs.
 * `let m = '1'; m = undefined` still boxes as `'1'`, and `({ c = 'red.300' })` still boxes
 * as `'red.300'` for a caller that passed something else. Only a value written at the call
 * site is what it appears to be, so only that can be judged truthy or nullish here.
 */
const isWrittenHere = (node: Node): boolean => {
  const inner = unwrapExpression(node)

  return (
    Node.isStringLiteral(inner) ||
    Node.isNumericLiteral(inner) ||
    Node.isNoSubstitutionTemplateLiteral(inner) ||
    Node.isObjectLiteralExpression(inner) ||
    Node.isArrayLiteralExpression(inner) ||
    Node.isTrueLiteral(inner) ||
    Node.isFalseLiteral(inner) ||
    inner.getKind() === SyntaxKind.NullKeyword ||
    // `-1`, which the parser gives as an operator over a numeric literal.
    (Node.isPrefixUnaryExpression(inner) && Node.isNumericLiteral(inner.getOperand()))
  )
}

/** An inline value's truthiness, which its box carries directly. */
const isTruthy = (boxNode: BoxNode): boolean =>
  box.isLiteral(boxNode) ? Boolean(boxNode.value) : box.isMap(boxNode) || box.isArray(boxNode) || box.isObject(boxNode)

/**
 * Did the extractor *decide* this choice, or guess at it?
 *
 * `a ? b : c`, `a || b` and `a && b` are asked "what styles could this produce", and when
 * one arm does not evaluate the extractor answers with the other rather than refusing
 * (`maybe-box-node.ts`, `whenTrueValue && !whenFalseValue`). That is right for generating
 * CSS — emit rules for whatever might be used — and wrong for rewriting source, where the
 * arm it kept becomes the only one that runs.
 *
 * For a ternary the tell is the arms: it guessed exactly when one produced a box and the
 * other did not. For a short-circuit the answer is always the left operand, so what has to
 * be established is that the left is the side that wins.
 */
const decidedAtBuildTime = (node: ConditionalExpression | BinaryExpression): boolean => {
  if (Node.isConditionalExpression(node)) {
    return resolvesExactly(node.getWhenTrue()) && resolvesExactly(node.getWhenFalse())
  }

  const operator = node.getOperatorToken().getKind()

  // A comparison's value is a boolean, and the extractor never computes one: it routes
  // `===` and the rest through the same collapse as a choice and answers with an operand.
  // So its answer is that operand, never the comparison — `false === false` comes back as
  // `false`. There is no shape of answer that would be right, so none is accepted.
  if (!SHORT_CIRCUIT.includes(operator)) return false

  // The left has to be written here. A box reached through a name records the declaration
  // rather than the value, and truthiness is exactly what that distinction changes.
  if (!isWrittenHere(node.getLeft())) return false

  const left = rebox(node.getLeft())
  if (!left) return false

  // `||` and `??` answer with the left, so once the left wins the right is dead code and
  // whether it resolves does not matter. A falsy left under `||` gets the wrong side back.
  if (operator === SyntaxKind.BarBarToken) return isTruthy(left)
  if (operator === SyntaxKind.QuestionQuestionToken) return !box.isLiteral(left) || left.value != null

  // `&&` with a falsy left also yields the left, which is what the extractor returned.
  // With a truthy left the result is the right, so that is what has to resolve.
  return isTruthy(left) ? resolvesExactly(node.getRight()) : true
}

const SHORT_CIRCUIT = [SyntaxKind.AmpersandAmpersandToken, SyntaxKind.BarBarToken, SyntaxKind.QuestionQuestionToken]

/**
 * Every binary form the extractor collapses to one operand — the short-circuits plus the
 * comparisons, which `isLogicalSyntax` sends down the same path even though their value is
 * a boolean rather than either side.
 *
 * Hoisted rather than built per call: `accountsForSource` asks this for every property of
 * every candidate, and rebuilding a thirteen-element list each time is not free.
 */
const COLLAPSED_BINARY = new Set([
  ...SHORT_CIRCUIT,
  SyntaxKind.EqualsEqualsToken,
  SyntaxKind.EqualsEqualsEqualsToken,
  SyntaxKind.ExclamationEqualsToken,
  SyntaxKind.ExclamationEqualsEqualsToken,
  SyntaxKind.GreaterThanToken,
  SyntaxKind.GreaterThanEqualsToken,
  SyntaxKind.LessThanToken,
  SyntaxKind.LessThanEqualsToken,
  SyntaxKind.InKeyword,
  SyntaxKind.InstanceOfKeyword,
])

const isCollapsedBinary = (node: Node): node is BinaryExpression =>
  Node.isBinaryExpression(node) && COLLAPSED_BINARY.has(node.getOperatorToken().getKind())

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
 * fail to. Rather than guess and erase evaluation the compiler cannot reproduce, the call
 * is rejected.
 */
/**
 * What a property's value is written as. A shorthand names it, so the name *is* the
 * expression — reading an initializer that is not there reports the property as having no
 * source, and everything hidden behind the name goes unchecked.
 */
const valueOf = (property: Node): Node | undefined =>
  Node.isPropertyAssignment(property)
    ? property.getInitializer()
    : Node.isShorthandPropertyAssignment(property)
      ? property.getNameNode()
      : undefined

export const accountsForSource = (node: Node | undefined, boxNode: BoxNode | undefined): boolean => {
  if (!node) return true

  const unwrapped = unwrapExpression(node)

  // A choice the extractor collapsed to one arm without being able to decide it. The box
  // looks like a plain value, so nothing downstream can tell it apart from one.
  if (
    (Node.isConditionalExpression(unwrapped) || isCollapsedBinary(unwrapped)) &&
    !box.isConditional(boxNode) &&
    !decidedAtBuildTime(unwrapped)
  ) {
    return false
  }

  if (Node.isArrayLiteralExpression(unwrapped)) {
    if (!box.isArray(boxNode)) return false
    const elements = unwrapped.getElements()
    if (elements.length !== boxNode.value.length) return false
    return elements.every((element, index) => accountsForSource(element, boxNode.value[index]))
  }

  if (!Node.isObjectLiteralExpression(unwrapped)) {
    // The source may only *name* the object — `_hover: shared`. The box records the
    // literal it was actually built from, and that is what has to be checked: a spread or
    // a computed key inside the declaration is invisible from the name alone.
    const origin = box.isMap(boxNode) ? boxNode.getNode() : undefined

    return !origin || origin === unwrapped || !Node.isObjectLiteralExpression(origin)
      ? true
      : accountsForSource(origin, boxNode)
  }

  // An object literal in source must have produced a map.
  if (!box.isMap(boxNode)) return false

  for (const property of unwrapped.getProperties()) {
    if (Node.isSpreadAssignment(property)) {
      const expression = unwrapExpression(property.getExpression())

      // An inline object literal is self-evidently accounted for: its keys are right there.
      if (Node.isObjectLiteralExpression(expression)) continue

      // Otherwise ask the extractor, which records the spreads it walked. Absence is a
      // decline, not an acceptance: an unrecorded spread may have contributed keys nobody
      // can see, and that is the case this rule has always existed to refuse.
      const walked = boxNode.resolvedSpreads?.find((entry) => entry.node === expression)
      if (!walked) return false

      // Being walked is not being accounted for. The extractor omits what it cannot
      // evaluate at any depth, so the spread object gets the same audit the literal itself
      // is getting — otherwise `{ ...{ padding: '4', ...rest } }` folds while quietly
      // dropping `rest`, and a getter or a computed key inside it goes the same way.
      const origin = walked.box.getNode()
      if (!accountsForSource(origin, walked.box)) return false

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

    const value = valueOf(property)

    // `{ display: undefined }` contributes nothing and is dropped by the encoder too,
    // so its absence from the map is expected rather than a lost value.
    if (value && Node.isIdentifier(value) && value.getText() === 'undefined') continue

    if (!boxNode.value.has(key)) return false

    if (!accountsForSource(value, boxNode.value.get(key))) return false
  }

  return true
}

/**
 * Memo keyed on a file, thrown away when its text is replaced.
 *
 * A plain `WeakMap<SourceFile, …>` is wrong here: ts-morph reuses the wrapper when a path
 * is re-added with new text — which is what a watch rebuild does — so it would answer for
 * the previous revision. Comparing against the text it was computed from costs a
 * reference check while the file is unchanged, since `getFullText()` hands back the same
 * string instance.
 */
const byText = <T>(
  cache: WeakMap<SourceFile, { text: string; value: T }>,
  sourceFile: SourceFile,
  compute: () => T,
): T => {
  const text = sourceFile.getFullText()
  const hit = cache.get(sourceFile)
  if (hit && hit.text === text) return hit.value

  const value = compute()
  cache.set(sourceFile, { text, value })
  return value
}

/**
 * Every name declared at module scope, which is what an added import could collide with.
 *
 * This replaced `sourceFile.getLocals()`. That was precise, but it goes through the
 * compiler's symbol table, and reaching for it binds the program — including every
 * `.d.ts` the module's imports pull in. It cost ~8ms on a ten-line file and grew with the
 * project, which was invisible while only a partial split reached it and became the
 * dominant cost once open-ended values started lowering too.
 *
 * A syntactic walk answers the same question: a binding in a nested *function* cannot
 * collide with a module-scope import, and one that shadows it *at the call site* is what
 * `isShadowed` is for. Memoized against the file's text rather than the file, since
 * ts-morph reuses the wrapper across a re-add and a plain `WeakMap` would answer for the
 * previous revision. Uncached it is re-walked per candidate, which is quadratic in a
 * module of many elements.
 */
const moduleScopeCache = new WeakMap<SourceFile, { text: string; value: Set<string> }>()

export const declaredAtModuleScope = (sourceFile: SourceFile): Set<string> =>
  byText(moduleScopeCache, sourceFile, () => collectModuleScopeNames(sourceFile))

const collectModuleScopeNames = (sourceFile: SourceFile): Set<string> => {
  const names = new Set<string>()

  const addBinding = (node: Node | undefined) => {
    if (!node) return

    // `const { a, b: c } = …` and `const [a, b] = …` bind their elements, not themselves.
    if (Node.isObjectBindingPattern(node) || Node.isArrayBindingPattern(node)) {
      for (const element of node.getElements()) {
        if (Node.isBindingElement(element)) addBinding(element.getNameNode())
      }
      return
    }

    if (Node.isIdentifier(node)) names.add(node.getText())
  }

  const addDeclarations = (list: Node) => {
    if (Node.isVariableStatement(list)) {
      for (const declaration of list.getDeclarations()) addBinding(declaration.getNameNode())
      return
    }
    if (Node.isVariableDeclarationList(list)) {
      for (const declaration of list.getDeclarations()) addBinding(declaration.getNameNode())
    }
  }

  const isVar = (node: Node): boolean =>
    (Node.isVariableStatement(node) || Node.isVariableDeclarationList(node)) &&
    node.getDeclarationKind() === VariableDeclarationKind.Var

  /**
   * `var` is scoped to the enclosing *function*, not the enclosing block, so one written
   * inside any statement at the top level still binds at module scope. Walking only the
   * top-level statements missed every one of them, and each emitted a duplicate binding.
   *
   * Only statement containers are followed. A function or class body opens a new variable
   * scope, so a `var` inside one cannot collide with a module-level import.
   */
  const addHoistedVars = (node: Node) => {
    if (isVar(node)) {
      addDeclarations(node)
      return
    }

    if (Node.isBlock(node)) {
      for (const statement of node.getStatements()) addHoistedVars(statement)
      return
    }
    if (Node.isIfStatement(node)) {
      addHoistedVars(node.getThenStatement())
      const otherwise = node.getElseStatement()
      if (otherwise) addHoistedVars(otherwise)
      return
    }
    if (Node.isForStatement(node)) {
      const initializer = node.getInitializer()
      if (initializer) addHoistedVars(initializer)
      addHoistedVars(node.getStatement())
      return
    }
    if (Node.isForInStatement(node) || Node.isForOfStatement(node)) {
      addHoistedVars(node.getInitializer())
      addHoistedVars(node.getStatement())
      return
    }
    if (Node.isWhileStatement(node) || Node.isDoStatement(node) || Node.isWithStatement(node)) {
      addHoistedVars(node.getStatement())
      return
    }
    if (Node.isLabeledStatement(node)) {
      addHoistedVars(node.getStatement())
      return
    }
    if (Node.isTryStatement(node)) {
      addHoistedVars(node.getTryBlock())
      const caught = node.getCatchClause()
      if (caught) addHoistedVars(caught.getBlock())
      const finally_ = node.getFinallyBlock()
      if (finally_) addHoistedVars(finally_)
      return
    }
    if (Node.isSwitchStatement(node)) {
      for (const clause of node.getCaseBlock().getClauses()) {
        for (const statement of clause.getStatements()) addHoistedVars(statement)
      }
    }
  }

  for (const statement of sourceFile.getStatements()) {
    if (Node.isVariableStatement(statement)) {
      addDeclarations(statement)
      continue
    }

    if (Node.isImportDeclaration(statement)) {
      addBinding(statement.getDefaultImport())
      addBinding(statement.getNamespaceImport())
      for (const named of statement.getNamedImports()) addBinding(named.getAliasNode() ?? named.getNameNode())
      continue
    }

    // `import x = require('…')`, which is its own statement kind rather than an import
    // declaration, so the branch above never sees it.
    if (Node.isImportEqualsDeclaration(statement)) {
      addBinding(statement.getNameNode())
      continue
    }

    if (
      Node.isFunctionDeclaration(statement) ||
      Node.isClassDeclaration(statement) ||
      Node.isEnumDeclaration(statement) ||
      Node.isModuleDeclaration(statement) ||
      Node.isTypeAliasDeclaration(statement) ||
      Node.isInterfaceDeclaration(statement)
    ) {
      addBinding(statement.getNameNode())
      continue
    }

    addHoistedVars(statement)
  }

  return names
}

/**
 * Every identifier in this module that reads the binding `name` declared at `declaration`.
 *
 * Replaces `nameNode.findReferencesAsNodes()`, which is a TypeScript *language-service*
 * query. The first such query forces `synchronizeHostData` -> `createProgram`, binding the
 * whole transitive `.d.ts` closure of the project — the exact cost `createTsProject`'s
 * `skipAddingFilesFromTsConfig`, `skipFileDependencyResolution` and `skipLoadingLibFiles`
 * exist to avoid, and which none of them govern. On a 2,278-file app it loaded 24,081 source
 * files and 4.4 GB of AST and symbols, 80% of the heap, and OOMed the build. The retained
 * strings were `googleapis` and `typescript`; none of it can reference a recipe binding.
 *
 * A recipe binding is module-scoped or imported, so every read of it is in this file. A
 * syntactic walk answers the same question over one AST the parser has already built.
 *
 * ## Where this deliberately over-reports
 *
 * Shadowing is not resolved. If any nested scope declares the same name, every matching
 * identifier is returned rather than only the ones that bind to `declaration`. That direction
 * is chosen on purpose: over-reporting fails the build with a diagnostic naming a real line,
 * while under-reporting ships an element whose class has no rule behind it and says nothing.
 * Shadowing a recipe binding is rare; silently shipping unstyled markup is not recoverable.
 */
/**
 * Every identifier in the module, grouped by the name it spells.
 *
 * Built once per pass and handed to each lookup, because walking the whole tree per binding
 * made that O(bindings x identifiers): a module declaring ten recipes walked its identifiers
 * ten times.
 *
 * Deliberately *not* memoized across passes, unlike the module-scope names beside it. That
 * cache holds strings, which outlive anything; this one holds nodes, and a node does not
 * survive its source file being replaced — `addSourceFile` overwrites, which forgets every
 * node previously taken from it. Keying on the source text does not help, because identical
 * text re-parsed is a fresh tree: the cache hits and returns nodes that throw
 * `Attempted to get information from a node that was removed or forgotten` on the next read.
 */
export const identifierIndex = (sourceFile: SourceFile): Map<string, Node[]> => {
  const index = new Map<string, Node[]>()
  for (const identifier of sourceFile.getDescendantsOfKind(SyntaxKind.Identifier)) {
    const text = identifier.getText()
    const known = index.get(text)
    if (known) known.push(identifier)
    else index.set(text, [identifier])
  }
  return index
}

export const localReferencesTo = (index: Map<string, Node[]>, name: string, declaration: Node): Node[] => {
  const references: Node[] = []

  for (const identifier of index.get(name) ?? []) {
    // The declaration itself is not a read of it. For a local recipe that is the variable's
    // name node; for an imported one it is the import specifier, which stays in the module
    // and would otherwise read as a surviving reference in every consumer.
    if (identifier === declaration) continue

    const parent = identifier.getParent()
    if (!parent) continue

    // `x.name` names a property, not this binding. Shorthand `{ name }` is a read and is
    // deliberately not excluded here.
    if (Node.isPropertyAccessExpression(parent) && parent.getNameNode() === identifier) continue
    if (Node.isPropertyAssignment(parent) && parent.getNameNode() === identifier) continue
    if (Node.isBindingElement(parent) && parent.getPropertyNameNode() === identifier) continue

    // A JSX tag is an intrinsic element or a component, never this binding — and a recipe
    // named after an element it styles (`button`, `input`) is the common case, not an edge
    // one. `<button className={button(...)} />` must not read as a reference to itself.
    if (
      (Node.isJsxOpeningElement(parent) || Node.isJsxSelfClosingElement(parent) || Node.isJsxClosingElement(parent)) &&
      parent.getTagNameNode() === identifier
    ) {
      continue
    }
    if (Node.isJsxAttribute(parent) && parent.getNameNode() === identifier) continue

    // A member's *name* is not a read of a module binding, however it is spelled.
    if (
      (Node.isMethodDeclaration(parent) ||
        Node.isPropertyDeclaration(parent) ||
        Node.isGetAccessorDeclaration(parent) ||
        Node.isSetAccessorDeclaration(parent) ||
        Node.isMethodSignature(parent) ||
        Node.isPropertySignature(parent) ||
        Node.isEnumMember(parent)) &&
      parent.getNameNode() === identifier
    ) {
      continue
    }

    // Another declaration of the same name shadows this binding rather than reading it.
    if (
      (Node.isVariableDeclaration(parent) ||
        Node.isParameterDeclaration(parent) ||
        Node.isFunctionDeclaration(parent) ||
        Node.isClassDeclaration(parent) ||
        Node.isBindingElement(parent)) &&
      parent.getNameNode() === identifier
    ) {
      continue
    }
    // A declaration of the same name elsewhere — including the import specifier's own
    // `propertyName` in `import { name as other }` — is not a read either.
    if (Node.isImportSpecifier(parent) || Node.isExportSpecifier(parent)) {
      if (parent.getNameNode() !== identifier) continue
      // `export { name }` re-exports the binding, which is a read that escapes the module.
      if (Node.isExportSpecifier(parent)) {
        references.push(identifier)
        continue
      }
      continue
    }

    references.push(identifier)
  }

  return references
}
