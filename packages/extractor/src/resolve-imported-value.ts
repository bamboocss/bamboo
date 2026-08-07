import type { Expression, Node as TsMorphNode, SourceFile } from 'ts-morph'
import { Node, SyntaxKind } from 'ts-morph'
import { getExportedVarDeclarationWithName, getModuleSpecifierSourceFile } from './maybe-box-node'
import type { BoxContext } from './types'

/**
 * The values an expression borrows from other modules, resolved by reading the imports.
 *
 * A call to a helper in a neighbouring file has to resolve, or its declarations are silently
 * absent from the stylesheet — and for a recipe that is not a partial loss but a different
 * hash and an element with no styles at all.
 *
 * The evaluator can be handed a TypeScript type checker to follow the import itself, and was
 * for a while. That is far more than the job needs: asking for one symbol makes TypeScript
 * bind and check the whole program, every reachable `.d.ts` included. Measured on a 400-file
 * project it cost **+38% CPU and +30% peak RSS**, and because the expense is the checker
 * existing rather than how often it is consulted, it grows with the size of the codebase
 * rather than with the number of style calls — a large project reported a 5.4x extraction
 * slowdown and an OOM in CI.
 *
 * Following an import is two cheap steps this package already had: resolve the specifier to
 * a file (`ts.resolveModuleName`, path lookup, no checker), then read that file's exported
 * declaration. Crossing the import boundary is the only thing the checker was doing here.
 *
 * The evaluator resolves everything *within* a module by walking scopes, so a helper that
 * refers to another binding in its own file needs nothing from us.
 */

/** How far a chain of helpers importing helpers is followed. */
const MAX_DEPTH = 4

/** Evaluated once per declaration, however many call sites reach it. */
const evaluatedValues = new WeakMap<object, unknown>()

type Evaluator = (node: Expression, stack: TsMorphNode[], ctx: BoxContext, depth: number) => unknown

/**
 * Local name to the name and declaration it was imported from.
 *
 * Deliberately not cached per file. The nodes are invalidated whenever a file is reloaded —
 * a watch rebuild does exactly that — and a cache holding them hands back nodes ts-morph has
 * forgotten, which throws rather than merely going stale. Rebuilding is a syntactic walk of
 * the import statements, and it only happens for an expression that already failed to
 * evaluate, so it is not on the ordinary path.
 */
const importBindingsFor = (sourceFile: SourceFile) => {
  const bindings = new Map<string, { declaration: TsMorphNode; exportedName: string }>()

  for (const declaration of sourceFile.getImportDeclarations()) {
    for (const specifier of declaration.getNamedImports()) {
      // `getAliasNode()` is the local binding and `getNameNode()` the exported name, so
      // `import { focusRing as ring }` is keyed on `ring` and looked up as `focusRing`.
      const local = (specifier.getAliasNode() ?? specifier.getNameNode()).getText()
      bindings.set(local, { declaration, exportedName: specifier.getNameNode().getText() })
    }

    const defaultImport = declaration.getDefaultImport()
    if (defaultImport) bindings.set(defaultImport.getText(), { declaration, exportedName: 'default' })
  }

  return bindings
}

/** What an imported name refers to, or nothing if it cannot be reached safely. */
const valueForBinding = (
  binding: { declaration: TsMorphNode; exportedName: string },
  ctx: BoxContext,
  stack: TsMorphNode[],
  depth: number,
  evaluateExpression: Evaluator,
) => {
  const sourceFile = getModuleSpecifierSourceFile(binding.declaration as never)
  if (!sourceFile) return

  // The project boundary. A dependency's code is not ours to run at build time, however pure
  // it looks, and declining leaves exactly the behaviour that shipped before any of this.
  if (sourceFile.isInNodeModules()) return

  const declaration = getExportedVarDeclarationWithName(binding.exportedName, sourceFile, stack, ctx)
  if (!declaration) return

  if (evaluatedValues.has(declaration)) return { value: evaluatedValues.get(declaration) }

  const initializer = declaration.getInitializer()
  if (!initializer) return

  const value = evaluateExpression(initializer, stack, ctx, depth + 1)
  if (value === undefined) return

  evaluatedValues.set(declaration, value)
  return { value }
}

/**
 * Bindings for the names this expression takes from other modules, or nothing if it takes
 * none that can be reached.
 *
 * Called only after an evaluation has already failed. Everything that resolves today does so
 * without this, and an expression that reaches an unresolvable import used to be dropped
 * outright — so nothing that works pays for it, and nothing that pays for it was working.
 */
export const importedEnvironmentFor = (
  node: Expression,
  ctx: BoxContext,
  stack: TsMorphNode[],
  depth: number,
  evaluateExpression: Evaluator,
): Record<string, unknown> | undefined => {
  if (depth >= MAX_DEPTH) return

  // Only a call can borrow behaviour from another module. A plain identifier or object is
  // resolved by the machinery in `maybe-box-node`, which follows imports of its own.
  //
  // The node itself is included explicitly: `getDescendantsOfKind` does not return it, and
  // the expression handed here is very often the call — `css({ ...focusRing() })` reaches
  // the evaluator as the spread's own argument.
  const calls = node.getDescendantsOfKind(SyntaxKind.CallExpression)
  if (Node.isCallExpression(node)) calls.unshift(node)
  if (!calls.length) return

  const bindings = importBindingsFor(node.getSourceFile())
  if (!bindings.size) return

  let environment: Record<string, unknown> | undefined

  for (const call of calls) {
    const callee = call.getExpression()
    const binding = bindings.get(callee.getText())
    if (!binding || environment?.[callee.getText()] !== undefined) continue

    const resolved = valueForBinding(binding, ctx, stack, depth, evaluateExpression)
    if (!resolved) continue

    environment ??= {}
    environment[callee.getText()] = resolved.value
  }

  return environment
}
