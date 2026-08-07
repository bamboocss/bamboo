import { evaluate } from 'ts-evaluator'
import type { Expression, Node as TsMorphNode } from 'ts-morph'
import { Node, ts } from 'ts-morph'
import type { BoxContext } from './types'

const TsEvalError = Symbol('EvalError')

const cacheMap = new WeakMap<Expression, unknown>()

/**
 * Whether a call reaches a function declared outside this project.
 *
 * Passing a type checker lets the evaluator resolve an identifier to its declaration in
 * another module, which is what makes a call to an imported helper resolvable at all — a
 * style helper in a neighbouring file used to come back unresolvable, and for a recipe that
 * is not a partial loss but a different config, a different hash, and an element with no
 * styles.
 *
 * It also means evaluating whatever it resolves to, so the project boundary is where that
 * stops. A dependency's code is not ours to run at build time, however pure it looks, and
 * declining leaves exactly the behaviour that shipped before the checker was passed.
 */
const resolvesWithinProject = (node: Expression): boolean => {
  // Only a call can benefit: everything else the evaluator already handles without one, and
  // handing it a checker anyway made it do more work on every literal in the project — a
  // third again on a file of plain `css()` calls, which is most files.
  if (!Node.isCallExpression(node)) return false

  const symbol = node.getExpression().getSymbol()
  if (!symbol) return false

  const aliased = symbol.getAliasedSymbol() ?? symbol
  const declarations = aliased.getDeclarations()
  if (!declarations.length) return false

  return !declarations.some((declaration) => declaration.getSourceFile().isInNodeModules())
}

/** One per project. `getTypeChecker()` is cheap, but this runs per evaluated call. */
const typeCheckers = new WeakMap<object, unknown>()

const typeCheckerFor = (node: Expression) => {
  const project = node.getProject()
  let checker = typeCheckers.get(project)
  if (!checker) {
    checker = project.getTypeChecker().compilerObject
    typeCheckers.set(project, checker)
  }
  return checker
}

/**
 * Evaluates a node with strict policies restrictions
 * @see https://github.com/wessberg/ts-evaluator#setting-up-policies
 */
const evaluateNode = (node: Expression, stack: TsMorphNode[], ctx: BoxContext) => {
  if (ctx.flags?.skipEvaluate) return
  if (ctx.canEval && !ctx.canEval?.(node, stack)) return

  if (cacheMap.has(node)) {
    return cacheMap.get(node)
  }

  const result = evaluate({
    // Only for a call this project owns — see `resolvesWithinProject`.
    ...(resolvesWithinProject(node) ? { typeChecker: typeCheckerFor(node) as any } : {}),
    policy: {
      deterministic: true,
      network: false,
      console: false,
      maxOps: Number.POSITIVE_INFINITY,
      maxOpDuration: 1000,
      io: { read: true, write: false },
      process: { exit: false, spawnChild: false },
    },
    ...ctx.getEvaluateOptions?.(node, stack),
    node: node.compilerNode as any,
    typescript: ts as any,
  })

  const expr = result.success ? result.value : TsEvalError
  cacheMap.set(node, expr)

  return expr
}

export const safeEvaluateNode = <T>(node: Expression, stack: Node[], ctx: BoxContext) => {
  const result = evaluateNode(node, stack, ctx)
  if (result === TsEvalError) return
  return result as T
}
