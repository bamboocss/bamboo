import {
  BindingElement,
  EnumDeclaration,
  FunctionDeclaration,
  Identifier,
  Node,
  ParameterDeclaration,
  VariableDeclaration,
  ts,
} from 'ts-morph'
import { getExportedVarDeclarationWithName, getModuleSpecifierSourceFile } from './maybe-box-node'
import type { BoxContext } from './types'

function isScope(node: Node): boolean {
  return (
    Node.isFunctionDeclaration(node) ||
    Node.isFunctionExpression(node) ||
    Node.isArrowFunction(node) ||
    Node.isSourceFile(node)
  )
}

// adapted from https://github.com/dsherret/ts-morph/issues/1351

export function getDeclarationFor(
  node: Identifier,
  stack: Node[],
  ctx: BoxContext,
): VariableDeclaration | ParameterDeclaration | FunctionDeclaration | EnumDeclaration | BindingElement | undefined {
  const parent = node.getParent()
  if (!parent) return

  const declarationStack = [] as Node[]

  let declaration

  if (
    (Node.isVariableDeclaration(parent) ||
      Node.isParameterDeclaration(parent) ||
      Node.isFunctionDeclaration(parent) ||
      Node.isEnumDeclaration(parent) ||
      Node.isBindingElement(parent)) &&
    parent.getNameNode() == node
  ) {
    declarationStack.push(parent)
    declaration = parent
    // `getNameNode()` is the exported name and `getAliasNode()` the local binding,
    // so `import { button as btn }` reaches here as the alias node.
  } else if (Node.isImportSpecifier(parent) && (parent.getNameNode() == node || parent.getAliasNode() == node)) {
    if (ctx.flags?.skipTraverseFiles) return

    const sourceFile = getModuleSpecifierSourceFile(parent.getImportDeclaration(), ctx)

    if (sourceFile) {
      const exportStack = [parent, sourceFile] as Node[]
      // Always look up the *exported* name, which differs from the local one when aliased.
      const exportedName = parent.getNameNode().getText()
      const maybeVar = getExportedVarDeclarationWithName(exportedName, sourceFile, exportStack, ctx)

      if (maybeVar) {
        declarationStack.push(...exportStack.concat(maybeVar))
        declaration = maybeVar
      }
    }
  }

  if (declaration) {
    stack.push(...declarationStack)
  }

  return declaration
}

const getInnermostScope = (from: Node) => {
  let scope = from.getParent()
  while (scope && !isScope(scope)) {
    scope = scope.getParent()
  }

  return scope
}

/**
 * The identifiers in a scope that could name a declaration, grouped by the name they bind.
 *
 * Only the structural half of `getDeclarationFor` is decided here — is this identifier the name
 * node of a declaration, or an import specifier's name or alias — because that is the whole of
 * what it tests before it does anything observable. Everything expensive and context-dependent
 * (crossing a module boundary, `ctx.recordDependency`) stays in `getDeclarationFor`, called
 * below on the candidates in document order, exactly as the walk used to call it.
 */
type DeclarationIndex = Map<string, Identifier[]>

/**
 * Keyed on the compiler node, never the ts-morph wrapper.
 *
 * `Project.replaceWithText` — which is how a re-parse installs a source transform — keeps the
 * wrapper identity and swaps the compiler node underneath it. A wrapper-keyed cache would
 * therefore answer a rebuild from the previous revision of the file, which is a wrong
 * stylesheet rather than a slow one. Keying on the compiler node makes the cache
 * self-invalidating: ts-morph reuses a compiler node exactly when its subtree did not change.
 */
const declarationIndexes = new WeakMap<ts.Node, DeclarationIndex>()

const isDeclarationName = (node: Identifier, parent: Node): boolean => {
  if (
    Node.isVariableDeclaration(parent) ||
    Node.isParameterDeclaration(parent) ||
    Node.isFunctionDeclaration(parent) ||
    Node.isEnumDeclaration(parent) ||
    Node.isBindingElement(parent)
  ) {
    return parent.getNameNode() == node
  }
  return Node.isImportSpecifier(parent) && (parent.getNameNode() == node || parent.getAliasNode() == node)
}

/**
 * Walk a scope once, so that every later lookup inside it is a map read.
 *
 * This used to be a `forEachDescendant` per identifier, widening to each enclosing scope and
 * re-walking from scratch, calling `getText()` on every identifier it passed. A module whose
 * declarations are referenced n times paid n full traversals of itself, and traversal is where
 * ts-morph charges for wrapping each node — it measured ~10% of extraction on its own.
 */
const declarationIndexFor = (scope: Node): DeclarationIndex => {
  const cached = declarationIndexes.get(scope.compilerNode)
  if (cached) return cached

  const index: DeclarationIndex = new Map()
  scope.forEachDescendant((node) => {
    if (!Node.isIdentifier(node)) return
    const parent = node.getParent()
    if (!parent || !isDeclarationName(node, parent)) return
    const name = node.getText()
    const declared = index.get(name)
    if (declared) declared.push(node)
    else index.set(name, [node])
  })

  declarationIndexes.set(scope.compilerNode, index)
  return index
}

export function findIdentifierValueDeclaration(
  identifier: Identifier,
  stack: Node[],
  ctx: BoxContext,
  visitedsWithStack: WeakMap<Node, Node[]> = new Map(),
): ReturnType<typeof getDeclarationFor> | undefined {
  let scope = identifier as Node | undefined
  let count = 0
  const innerStack = [] as Node[]
  const refName = identifier.getText()

  do {
    scope = getInnermostScope(scope!)
    count++
    if (!scope) return

    // Document order within the scope, which is the order the traversal reached them in, so
    // the first candidate that resolves is the same one it used to stop on.
    for (const candidate of declarationIndexFor(scope).get(refName) ?? []) {
      if (candidate == identifier) continue
      // Widening to an enclosing scope re-reaches every candidate the inner scope already
      // rejected. Skipping them is what the visited map did for whole subtrees.
      if (visitedsWithStack.has(candidate)) continue
      visitedsWithStack.set(candidate, innerStack)

      const declarationStack = [candidate] as Node[]
      const maybeDeclaration = getDeclarationFor(candidate, declarationStack, ctx)
      if (!maybeDeclaration) continue

      if (Node.isParameterDeclaration(maybeDeclaration)) {
        const initializer = maybeDeclaration.getInitializer()
        const typeNode = maybeDeclaration.getTypeNode()
        if (initializer) {
          innerStack.push(...declarationStack.concat(initializer))
        } else if (typeNode && Node.isTypeLiteral(typeNode)) {
          innerStack.push(...declarationStack.concat(typeNode))
        } else {
          // A parameter with neither an initializer nor a type literal is unresolvable, and
          // deliberately ends the search rather than widening past it.
          return
        }
        stack.push(...innerStack)
        return maybeDeclaration
      }

      innerStack.push(...declarationStack)
      stack.push(...innerStack)
      return maybeDeclaration
    }
  } while (scope && !Node.isSourceFile(scope) && count < 100)
}
