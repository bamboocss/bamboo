import type { Context } from '@bamboocss/core'
import { type BoxContext, type BoxNode, box, maybeBoxNode, unbox } from '@bamboocss/extractor'
import type { Dict } from '@bamboocss/types'
import { type SourceFile, VariableDeclarationKind } from 'ts-morph'
import {
  type BinaryExpression,
  type ConditionalExpression,
  type Expression,
  Node,
  type ObjectLiteralExpression,
  SyntaxKind,
} from 'ts-morph'

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
  if (box.isLiteral(node) && node.value === undefined) return false

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
 * fail to. Rather than guess, phase 1 declines them. Partial folding is where this
 * gets revisited.
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
 * Split a `css()` call into the part that can be resolved now and the part that cannot.
 *
 *     css({ color: 'red.300', padding: props.pad })
 *     cx("c_red.300", css({ padding: props.pad }))
 *
 * Whole-call folding gives up as soon as one value is dynamic, which is the common shape
 * in exactly the components that render most — anything taking props. This recovers the
 * static half of those.
 *
 * ## Why splitting is sound, and when it is not
 *
 * `css()` merges its input and emits one atomic class per resolved property. Splitting
 * emits two class strings and concatenates them, so the two agree only while no property
 * is produced by both halves. Within one object literal the keys are already distinct, so
 * the danger is not duplicate keys but *shorthands*: `mx` and `marginInline` are different
 * keys that normalise to the same property, and `css()` would keep the last while a split
 * would emit both.
 *
 * So the halves are compared after shorthand resolution and the call is left alone if they
 * overlap. `cx` does resolve conflicts, but by argument order, and the split hoists the
 * static half to the front regardless of where its key sat in the source — so for
 * `{ marginInline: dynamic, mx: '2' }` the merge keeps `mx` and the split would keep
 * `marginInline`. This check is still the only thing standing between a split and a wrong
 * class.
 *
 * Multi-argument calls are excluded for the same reason at a larger scale: `css(a, b)` is
 * later-wins across the whole object, so a static `a` cannot be hoisted out of a dynamic
 * `b` without reproducing the merge.
 */
export interface PartialFold {
  /** Class string for the statically resolvable half. */
  className: string
  /**
   * Source text of the object literal holding what is left for the runtime, or absent
   * when the split left nothing behind.
   */
  dynamicText?: string
  /** Expressions emitted in place of properties that did not resolve to a literal. */
  finite: Lowered[]
  /**
   * Whether the lowered expressions come before the runtime call. A ternary's condition, a
   * leaf's value and a dynamic property are all arbitrary expressions, so which is written
   * first is observable.
   */
  finiteFirst: boolean
}

/** One property lowered to an expression rather than left in the runtime call. */
interface Lowered {
  expression: string
  /**
   * Whether the expression's string literals are class names. A ternary's two arms are;
   * a leaf call's arguments are a class *prefix* and a property name, which are not
   * classes and must not be reported as ones — the class it builds is only known at
   * runtime, and legitimately may have no rule behind it.
   */
  emitsLiterals: boolean
}

/**
 * A property whose value is a ternary is not dynamic, it is *finite*: both branches are
 * known, so each can be resolved now and the choice left to a ternary between two
 * literals. That removes the `css()` call without needing to know which branch runs.
 *
 * Independent conditionals stay linear rather than multiplying, because each property
 * contributes its own ternary. Two conditionals give two ternaries, not four
 * combinations — which is only sound because `collides()` already rules out two
 * properties resolving to the same class, so no combination can interact with another.
 */
const finiteBranches = (
  key: string,
  value: Node | undefined,
  boxNode: BoxNode | undefined,
  deps: PartialFoldContext,
): string | undefined => {
  if (!box.isConditional(boxNode)) return undefined

  const node = boxNode.getNode()
  if (!Node.isConditionalExpression(node)) return undefined

  // The box's node is wherever the extractor *found* a conditional, which need not be
  // here: identifiers are resolved through their declarations, across modules. Copying
  // that condition's text would emit a reference to a binding that does not exist at this
  // call site, and would re-evaluate it on every render rather than once at its
  // declaration. Requiring it to be this initializer also keeps the branch nodes aligned
  // with the box's, which `palette[e ? 'a' : 'b']` breaks — there the conditional is the
  // key, and the box's branches are the values it looked up.
  if (!value || unwrapExpression(value) !== node) return undefined

  const branches = [
    [node.getWhenTrue(), boxNode.whenTrue] as const,
    [node.getWhenFalse(), boxNode.whenFalse] as const,
  ].map(([source, branch]) => {
    // Both questions, for the reason the sibling static path asks both: the extractor
    // omits what it cannot evaluate, so a branch literal holding a spread or a computed
    // key produces a map that looks complete and is missing a value. A branch that is an
    // identifier is only as trustworthy as the static path's handling of one, which does
    // not look through it either.
    if (!deps.isStatic(branch)) return undefined
    if (!deps.isAccounted(source, branch)) return undefined

    const value = (unbox(branch) as { raw?: unknown }).raw

    try {
      // A branch resolving to no declaration at all — `null`, an empty object — is a
      // legitimate outcome, and `cx` drops the empty string.
      return deps.runtimeCss({ [key]: value } as Dict)
    } catch {
      return undefined
    }
  })

  const [whenTrue, whenFalse] = branches
  if (whenTrue === undefined || whenFalse === undefined) return undefined
  // Neither branch produces a declaration, so there is no class to choose between.
  // Declining leaves the property in the runtime call, which keeps the condition where
  // it was written rather than emitting `cond ? "" : ""` to preserve its side effects.
  if (!whenTrue && !whenFalse) return undefined

  return `${node.getCondition().getText()} ? ${JSON.stringify(whenTrue)} : ${JSON.stringify(whenFalse)}`
}

/** The binding the leaf fold calls, exported by the generated css module. */
export const LEAF_HELPER = 'cssLeaf'

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
 * The modules this file imports from, as specifiers.
 *
 * Only strings are cached. A ts-morph *node* cannot be: re-adding a path forgets the old
 * nodes even when the text is identical, so the memo would hand back wrappers that throw
 * on access. Strings outlive that, and answer the one question worth asking before the
 * helper resolution walks the declarations — whether this file imports from bamboo at
 * all. On a module of many elements that never fold, that walk was the entire cost of
 * trying.
 */
const specifierCache = new WeakMap<SourceFile, { text: string; value: string[] }>()

const importsAnything = (sourceFile: SourceFile, matches: (mod: string) => boolean): boolean =>
  byText(specifierCache, sourceFile, () =>
    sourceFile.getImportDeclarations().map((declaration) => declaration.getModuleSpecifierValue()),
  ).some(matches)

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

const declaredAtModuleScope = (sourceFile: SourceFile): Set<string> =>
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
 * The local name an already-imported bamboo binding goes by.
 *
 * `ensureCxImport` answers this too, but it also decides whether a *missing* binding can
 * be added, which needs `getLocals()` — the compiler's binder over the whole module. This
 * runs for every candidate whether it folds or not, so it stops at what the import
 * declarations already say and never forces that.
 */
export const findBambooBinding = (
  call: Node,
  imported: string,
  isBambooCssModule: (mod: string) => boolean,
  isShadowed: (call: Node, name: string) => boolean,
): string | undefined => {
  if (!importsAnything(call.getSourceFile(), isBambooCssModule)) return undefined

  for (const declaration of call.getSourceFile().getImportDeclarations()) {
    if (declaration.isTypeOnly() || !isBambooCssModule(declaration.getModuleSpecifierValue())) continue

    for (const named of declaration.getNamedImports()) {
      if (named.isTypeOnly() || named.getNameNode().getText() !== imported) continue

      const local = (named.getAliasNode() ?? named.getNameNode()).getText()
      return isShadowed(call, local) ? undefined : local
    }
  }

  return undefined
}

/**
 * A value that survives the class pipeline unchanged, so the class built around it is the
 * prefix and nothing else: no whitespace for `sanitize` to collapse, no `!` for the
 * important regex, no space for `withoutSpace`, and nothing a token or condition could
 * plausibly be named.
 */
const LEAF_SENTINEL = 'bamboo0leaf0sentinel0'

/**
 * A property the extractor could not resolve is *open-ended* rather than finite — but its
 * class is still `prefix + value`, and the prefix is known now.
 *
 * `utility.transform` is string construction over a table fixed at build time, and
 * nothing consults which rules were emitted. So `css({ color: tone })` already returns
 * `c_<tone>` for a value the extractor never saw, with no CSS behind it. Emitting that
 * string directly cannot be less correct than the call it replaces.
 *
 * The prefix is read off the real implementation rather than rebuilt: resolving a
 * sentinel through `runtimeCss` applies the shorthand table and the utility's class name
 * in one step. It also self-gates — a hashed or grouped class does not contain the
 * sentinel, so both modes decline here without this having to read the config.
 *
 * Shared with the element surface, which asks the same question about a JSX style prop.
 *
 * Top level only, like the finite lowering beside it. A nested leaf's class carries its
 * condition path, which the prefix would describe correctly — but the helper's fallback
 * rebuilds `{ [prop]: value }` to hand back to `css()`, and that reconstruction has to
 * carry the same path or the declined shape resolves without its condition.
 */
export const leafPrefix = (
  key: string,
  ctx: Context,
  runtimeCss: (...styles: Dict[]) => string,
): string | undefined => {
  if (ctx.isTemplateLiteralSyntax) return undefined

  // A condition key names a block, not a declaration. Its value is an object in every
  // real use, which `leafClass` declines at runtime — so lowering one only buys a wasted
  // call before the fallback, and gives it a prefix (`_hover_`) that describes a shape
  // nobody writes.
  if (ctx.conditions.isCondition(key)) return undefined

  let resolved: string
  try {
    resolved = runtimeCss({ [key]: LEAF_SENTINEL })
  } catch {
    return undefined
  }

  if (!resolved.endsWith(LEAF_SENTINEL)) return undefined

  const prefix = resolved.slice(0, -LEAF_SENTINEL.length)
  // A space means the property resolved to more than one class, so no single prefix
  // describes it. An empty prefix means it resolved to nothing recognisable.
  return !prefix || prefix.includes(' ') ? undefined : prefix
}

/**
 * Written as an object or an array, this is a condition block or a responsive list: one
 * class per entry rather than one class. `leafClass` declines both at runtime and falls
 * back, so lowering one is not wrong — it is a guaranteed round trip through the fallback,
 * which is the same reason a condition key is declined.
 */
export const isWrittenAsCollection = (value: Node): boolean => {
  const inner = unwrapExpression(value)
  return Node.isObjectLiteralExpression(inner) || Node.isArrayLiteralExpression(inner)
}

/** The call this surface emits in place of the property. */
export const leafCall = (prefix: string, key: string, valueText: string, name = LEAF_HELPER): string =>
  `${name}(${JSON.stringify(prefix)}, ${JSON.stringify(key)}, ${valueText})`

const dynamicLeaf = (key: string, value: Node | undefined, deps: PartialFoldContext): string | undefined => {
  if (!deps.allowLeaf || !value) return undefined

  if (isWrittenAsCollection(value)) return undefined

  const prefix = leafPrefix(key, deps.ctx, deps.runtimeCss)
  return prefix === undefined ? undefined : leafCall(prefix, key, value.getText(), deps.leafName ?? LEAF_HELPER)
}

export interface PartialFoldContext {
  ctx: Context
  runtimeCss: (...styles: Dict[]) => string
  /** Whether a property's value is fully accounted for by the extractor. */
  isAccounted: (value: Node | undefined, boxNode: BoxNode | undefined) => boolean
  /** Whether every leaf under a box carries a known value. */
  isStatic: (boxNode: BoxNode | undefined) => boolean
  /**
   * Whether an open-ended leaf may be lowered. False when the helper it calls cannot be
   * imported into this file, which leaves those properties in the runtime call rather
   * than abandoning the split that hoists the static half.
   */
  allowLeaf?: boolean
  /**
   * The name to call the leaf helper by. Not always `cssLeaf`: a file that already
   * imports it under an alias has to be called through that alias, since the emitted
   * call has to resolve against the binding this module actually has.
   */
  leafName?: string
}

/**
 * Properties are partitioned whole rather than recursed into. A top-level property is
 * either entirely static or entirely dynamic, which keeps the reconstructed object a
 * verbatim slice of the source and avoids rebuilding nested conditions by hand.
 */
export const planPartialFold = (
  argument: ObjectLiteralExpression,
  boxNode: BoxNode | undefined,
  styles: Dict,
  deps: PartialFoldContext,
): PartialFold | undefined => {
  const partition = partitionObject(argument, boxNode, styles, deps)
  if (!partition) return undefined

  const className = deps.runtimeCss(partition.staticStyles)

  // A call may be entirely static plus finite, with nothing left for the runtime, so an
  // empty class is only a failure when there are no branches to carry either.
  if (!className && !partition.finite.length) return undefined

  return {
    className,
    dynamicText: partition.dynamicText.length ? `{ ${partition.dynamicText.join(', ')} }` : undefined,
    finite: partition.finite,
    finiteFirst: partition.finiteFirst,
  }
}

/** One property that did not resolve outright, before it is assigned to a half. */
interface Slot {
  key: string
  kind: 'dynamic' | 'finite'
  /** Source text of the property, used when it goes to the runtime call. */
  text: string
  /** The expression to emit, while this stays finite. */
  lowered?: Lowered
  /** A block the recursion split, which therefore appears on both sides legitimately. */
  split?: boolean
}

interface Partition {
  /** Style object for the half that resolves now. */
  staticStyles: Dict
  /** Source text of the properties left for the runtime. */
  dynamicText: string[]
  /** Expressions for properties lowered rather than left in the runtime call. */
  finite: Lowered[]
  /** Whether every ternary is written before every dynamic property. */
  finiteFirst: boolean
}

/**
 * Split one object level, recursing into a block that is part static and part dynamic.
 *
 * Without the recursion a single dynamic leaf sends its whole block to the runtime:
 * `{ _hover: { color: 'red.300', bg: p } }` loses the resolved `color` even though
 * nothing about it depends on `p`. That is a precision loss rather than a wrong answer,
 * but it costs exactly the calls a component re-renders most.
 *
 * A class is identified by its condition path *and* its property, so `_hover.color` in
 * one half and `_hover.bg` in the other cannot collide, and neither can `color` against
 * `_hover.color`. Collision is therefore checked per level, among siblings.
 *
 * The static subtree is read from the extracted data rather than rebuilt: the extractor
 * has already dropped the unresolvable leaves, so `styles[key]` for a mixed block is
 * exactly the resolvable part. The dynamic side is taken from source text, so nothing
 * depends on that pruning being complete.
 */
const partitionObject = (
  node: ObjectLiteralExpression,
  boxNode: BoxNode | undefined,
  styles: Dict,
  deps: PartialFoldContext,
  topLevel = true,
): Partition | undefined => {
  if (!box.isMap(boxNode)) return undefined

  const { ctx, isAccounted, isStatic } = deps
  const staticKeys: string[] = []
  const staticStyles: Dict = {}
  const seenKeys = new Set<string>()
  /**
   * Everything not resolved outright, in source order. Kept as one list because a ternary
   * that cannot be lowered has to become a runtime property *in its original position*,
   * and because whether the two kinds interleave is a property of that order.
   */
  const slots: Slot[] = []

  for (const property of node.getProperties()) {
    // A spread contributes keys that cannot be attributed to either half.
    if (!Node.isPropertyAssignment(property) && !Node.isShorthandPropertyAssignment(property)) return undefined

    const nameNode = property.getNameNode()
    if (Node.isComputedPropertyName(nameNode)) return undefined

    const key =
      Node.isStringLiteral(nameNode) || Node.isNumericLiteral(nameNode)
        ? String(nameNode.getLiteralValue())
        : nameNode.getText()

    // Object literals are last-wins, so a repeated key means the earlier one is
    // discarded. A split emits both halves and cannot express that, and the box holds
    // only the surviving value — so there is no reading of a duplicate that is safe.
    if (seenKeys.has(key)) return undefined
    seenKeys.add(key)

    const value = valueOf(property)
    const valueBox = boxNode.value.get(key)

    // Three separate questions, and only asking the first two is how a ternary gets
    // folded to its `whenTrue` branch: `styles` is a projection that already picked a
    // branch, and `accountsForSource` answers "are the declared keys present", not "is
    // every leaf resolvable". `isStaticBox` is the one that rejects a `conditional` or
    // `unresolvable` box, including one nested in a responsive array.
    if (key in styles && isStatic(valueBox) && isAccounted(value, valueBox)) {
      staticKeys.push(key)
      staticStyles[key] = styles[key]
      continue
    }

    // A ternary is finite rather than dynamic: both branches resolve, so the choice can
    // be a ternary between two literals instead of a runtime call. Only at this level —
    // a nested one would need its condition path carried into the class.
    if (topLevel) {
      const branches = finiteBranches(key, value, valueBox, deps)
      if (branches) {
        slots.push({
          key,
          kind: 'finite',
          lowered: { expression: branches, emitsLiterals: true },
          text: property.getText(),
        })
        continue
      }

      // Not finite, but still lowerable: an open-ended value whose class is the prefix
      // resolved here plus whatever it holds at runtime. Lowered as `finite` because it
      // is the same thing to everything downstream — one property, replaced by one
      // expression that emits one class, evaluated where it was written.
      const leaf = dynamicLeaf(key, value, deps)
      if (leaf) {
        slots.push({
          key,
          kind: 'finite',
          lowered: { expression: leaf, emitsLiterals: false },
          text: property.getText(),
        })
        continue
      }
    }

    // Part static, part dynamic, and nothing hidden from the box — worth going into.
    // `isAccounted` is what rules out a spread here: it reports the block as unaccounted
    // for, and a spread's keys belong to neither half.
    const nested =
      value && Node.isObjectLiteralExpression(value) && isAccounted(value, valueBox)
        ? partitionObject(value, valueBox, (styles[key] ?? {}) as Dict, deps, false)
        : undefined

    if (nested && Object.keys(nested.staticStyles).length && nested.dynamicText.length) {
      staticKeys.push(key)
      staticStyles[key] = nested.staticStyles
      slots.push({
        key,
        kind: 'dynamic',
        split: true,
        text: `${property.getNameNode().getText()}: { ${nested.dynamicText.join(', ')} }`,
      })
      continue
    }

    slots.push({ key, kind: 'dynamic', text: property.getText() })
  }

  // A lowering that cannot be kept sends its property back to the runtime call, rather
  // than abandoning the split: the static half is still worth hoisting, and every other
  // declined lowering already falls through to exactly that.
  const demote = (slot: Slot) => {
    slot.kind = 'dynamic'
    slot.lowered = undefined
  }

  // Only the keys the recursion actually split are exempt from the collision check.
  // Inferring that from "appears on both sides" was wrong: a duplicated key lands on both
  // sides too, and exempting it let a discarded property emit classes.
  const contested = () => slots.filter((slot) => slot.kind === 'dynamic' && !slot.split).map((slot) => slot.key)

  // A finite branch emits a class for its property in both arms, so it collides with the
  // other halves exactly as a static or dynamic key would — and with the ternaries kept
  // before it, since two on `mx` and `marginInline` would each emit a class for
  // margin-inline where the object keeps only the last.
  // To a fixed point, because demoting one makes it a dynamic key the ones already kept
  // have not been checked against: `{ mx: a ? … , marginInline: b ? … }` demotes the
  // second and then the first, ending with neither lowered rather than with a pair that
  // still emits two classes for margin-inline.
  for (;;) {
    const lowered = slots.filter((slot) => slot.kind === 'finite')
    const dynamic = contested()
    const offender = lowered.find((slot, index) =>
      collides([slot.key], [...staticKeys, ...dynamic, ...lowered.slice(0, index).map((kept) => kept.key)], ctx),
    )

    if (!offender) break
    demote(offender)
  }

  // A ternary's condition leaves the object, so it is evaluated relative to the dynamic
  // values rather than among them. That is expressible while the two do not interleave —
  // ternaries before the call, or after it. Demoting from the end is what restores it,
  // and keeps the ternaries that were already on one side.
  const written = () => slots.map((slot) => (slot.kind === 'finite' ? 'f' : 'd')).join('')
  while (!/^f*d*$/.test(written()) && !/^d*f*$/.test(written())) {
    demote(slots.findLast((slot) => slot.kind === 'finite')!)
  }

  const dynamicText = slots.filter((slot) => slot.kind === 'dynamic').map((slot) => slot.text)
  const finite = slots.filter((slot) => slot.kind === 'finite').map((slot) => slot.lowered!)

  // Nothing to gain unless something resolves and something is left over. A finite branch
  // counts as both: it resolves, and it replaces what would have been a call.
  if (!staticKeys.length && !finite.length) return undefined
  if (!dynamicText.length && !finite.length) return undefined

  // Last, because a demoted ternary is a dynamic key it did not used to be.
  if (collides(staticKeys, contested(), ctx)) return undefined

  return { staticStyles, dynamicText, finite, finiteFirst: !written().startsWith('d') }
}

/**
 * Do the two halves resolve to a shared property?
 *
 * Compared after shorthand resolution, since that is where distinct keys become the same
 * property. An unrecognised key resolves to itself, so two distinct unknown keys are read
 * as distinct — which is right for atomic output, where one class is emitted per key.
 */
export const collides = (staticKeys: string[], dynamicKeys: string[], ctx: Context): boolean => {
  // `createCss` does `const { base, ...styles } = obj; Object.assign(styles, base)`, so a
  // top-level `base` block overrides its siblings whatever they are named. Comparing key
  // names cannot see that, so its mere presence disqualifies the split.
  if (staticKeys.includes('base') || dynamicKeys.includes('base')) return true

  const resolve = (key: string) => (ctx.utility.hasShorthand ? ctx.utility.resolveShorthand(key) : key)
  const resolvedStatic = new Set(staticKeys.map(resolve))

  return dynamicKeys.some((key) => resolvedStatic.has(resolve(key)))
}

/**
 * The `cx` binding to call, adding it to the import that already brings in the style
 * helper when it is not there yet.
 *
 * Reusing that declaration rather than writing a new one avoids having to guess the
 * module specifier, which varies with `importMap`, path aliases and how the project
 * spells its outdir.
 */
export const ensureCxImport = (
  call: Node,
  calleeRoot: string,
  isBambooCssModule: (mod: string) => boolean,
  isGeneratedCssModule: (mod: string) => boolean,
  isShadowed: (call: Node, name: string) => boolean,
  extra: string[] = [],
): { name: string; names: Record<string, string>; insert?: { pos: number; names: string[] } } | undefined => {
  const sourceFile = call.getSourceFile()
  const wanted = ['cx', ...extra]
  const resolved: Record<string, string> = {}

  let host: ReturnType<typeof sourceFile.getImportDeclarations>[number] | undefined

  for (const declaration of sourceFile.getImportDeclarations()) {
    const mod = declaration.getModuleSpecifierValue()

    for (const named of declaration.getNamedImports()) {
      const local = (named.getAliasNode() ?? named.getNameNode()).getText()
      const imported = named.getNameNode().getText()

      // First occurrence wins, matching the single-binding lookup this replaced.
      if (wanted.includes(imported) && !(imported in resolved)) {
        // A binding that is not bamboo's, or is erased at runtime, or is shadowed where
        // the call sits, would be called instead of the one this relies on.
        if (declaration.isTypeOnly() || named.isTypeOnly()) return undefined
        if (!isBambooCssModule(mod)) return undefined
        if (isShadowed(call, local)) return undefined
        resolved[imported] = local
      }

      if (local === calleeRoot) host = declaration
    }
  }

  const missing = wanted.filter((name) => !(name in resolved))
  if (!missing.length) return { name: resolved.cx!, names: resolved }

  if (!host) return undefined

  // Adding an import is only safe against the module whose exports are known — the one
  // bamboo generates. A configured `importMap.css` names the user's own wrapper, and a
  // wrapper re-exporting `css` need not re-export `cx`.
  if (!isGeneratedCssModule(host.getModuleSpecifierValue())) return undefined

  // A module-scope binding of the same name would collide with the one being added, and
  // one in scope at the call site would be reached instead of it.
  const declared = declaredAtModuleScope(sourceFile)

  for (const name of missing) {
    if (declared.has(name) || isShadowed(call, name)) return undefined
    resolved[name] = name
  }

  const last = host.getNamedImports().at(-1)
  if (!last) return undefined

  return { name: resolved.cx!, names: resolved, insert: { pos: last.getEnd(), names: missing } }
}

/**
 * The `css` and `cx` bindings a partially folded JSX element needs.
 *
 * Splitting an element sends its dynamic style props to a `css()` call, so unlike the
 * call-site split this needs *two* bindings rather than one. Both are taken from an
 * existing bamboo `css` import: writing a new import declaration would mean guessing a
 * module specifier, and the spelling varies with `importMap`, path aliases and how the
 * project reaches its outdir. An element in a file that does not already import `css` is
 * left alone instead.
 */
export const resolveCssHelpers = (
  node: Node,
  isBambooCssModule: (mod: string) => boolean,
  isGeneratedCssModule: (mod: string) => boolean,
  isShadowed: (node: Node, name: string) => boolean,
  wantLeaf = false,
): { css: string; cx: string; leaf?: string; insert?: { pos: number; names: string[] } } | undefined => {
  const sourceFile = node.getSourceFile()
  if (!importsAnything(sourceFile, isBambooCssModule)) return undefined

  for (const declaration of sourceFile.getImportDeclarations()) {
    const mod = declaration.getModuleSpecifierValue()
    if (declaration.isTypeOnly() || !isBambooCssModule(mod)) continue

    const named = declaration.getNamedImports()
    const cssImport = named.find((entry) => entry.getNameNode().getText() === 'css' && !entry.isTypeOnly())
    if (!cssImport) continue

    const cssName = (cssImport.getAliasNode() ?? cssImport.getNameNode()).getText()
    if (isShadowed(node, cssName)) return undefined

    const wanted = wantLeaf ? ['cx', LEAF_HELPER] : ['cx']
    const resolved: Record<string, string> = {}
    const missing: string[] = []

    for (const want of wanted) {
      const existing = named.find((entry) => entry.getNameNode().getText() === want && !entry.isTypeOnly())

      if (existing) {
        const local = (existing.getAliasNode() ?? existing.getNameNode()).getText()
        if (isShadowed(node, local)) return undefined
        resolved[want] = local
        continue
      }

      missing.push(want)
    }

    if (!missing.length) return { css: cssName, cx: resolved.cx!, leaf: resolved[LEAF_HELPER] }

    // Same restriction as the call-site split: only the generated module's exports are
    // known, so only it may have a binding added.
    if (!isGeneratedCssModule(mod)) return undefined

    const declared = declaredAtModuleScope(sourceFile)
    for (const name of missing) {
      if (isShadowed(node, name) || declared.has(name)) return undefined
      resolved[name] = name
    }

    const last = named.at(-1)
    if (!last) return undefined

    return {
      css: cssName,
      cx: resolved.cx!,
      leaf: resolved[LEAF_HELPER],
      insert: { pos: last.getEnd(), names: missing },
    }
  }

  return undefined
}
