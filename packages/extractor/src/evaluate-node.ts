import { evaluate } from 'ts-evaluator'
import type { Expression, Node } from 'ts-morph'
import { ts } from 'ts-morph'
import { importedEnvironmentFor } from './resolve-imported-value'
import type { BoxContext } from './types'

const TsEvalError = Symbol('EvalError')

const cacheMap = new WeakMap<Expression, unknown>()

/** @see https://github.com/wessberg/ts-evaluator#setting-up-policies */
const POLICY = {
  console: false,
  deterministic: true,
  io: { read: true, write: false },
  maxOpDuration: 1000,
  maxOps: Number.POSITIVE_INFINITY,
  network: false,
  process: { exit: false, spawnChild: false },
} as const

/**
 * Evaluates a node with strict policy restrictions.
 *
 * No type checker is passed. The evaluator accepts one, and it is the obvious way to let a
 * call reach a helper in another module — but asking TypeScript for a single symbol makes it
 * bind and check the entire program, `.d.ts` files included. That cost is paid by every
 * project on every build, scales with the size of the codebase rather than with the number
 * of style calls, and does not show up in a benchmark small enough to have no program to
 * check. See `resolve-imported-value.ts`, which crosses the import boundary directly for the
 * few expressions that need it.
 */
const evaluateNode = (node: Expression, stack: Node[], ctx: BoxContext, depth = 0) => {
  if (ctx.flags?.skipEvaluate) return
  if (ctx.canEval && !ctx.canEval?.(node, stack)) return

  // Only the outermost evaluation is cached by node: a nested one is reached through an
  // import and cached against its declaration instead, where every call site shares it.
  if (depth === 0 && cacheMap.has(node)) {
    return cacheMap.get(node)
  }

  const options = {
    policy: { ...POLICY },
    ...ctx.getEvaluateOptions?.(node, stack),
    node: node.compilerNode as any,
    typescript: ts as any,
  }

  let result = evaluate(options)

  /**
   * Retried only on failure, with whatever this expression imports put in scope.
   *
   * The order matters for cost. Everything that resolves today does so on the first attempt,
   * so no working call pays anything for this — and an expression that reaches an
   * unresolvable import was dropped outright before, so nothing that pays for it was
   * working. Resolving imports up front instead would put a walk of every style object on
   * the path of every build.
   */
  if (!result.success) {
    const imported = importedEnvironmentFor(node, ctx, stack, depth, safeEvaluateNode)
    if (imported) {
      result = evaluate({
        ...options,
        // `extra` is typed as a map of the evaluator's own `Literal` union, which is not
        // exported. What resolution produces is whatever the helper returned, so the cast is
        // at the boundary rather than weakening the type it is carried under.
        environment: { ...(options as { environment?: object }).environment, extra: imported as never },
      })
    }
  }

  const expr = result.success ? result.value : TsEvalError
  if (depth === 0) cacheMap.set(node, expr)

  return expr
}

export const safeEvaluateNode = <T>(node: Expression, stack: Node[], ctx: BoxContext, depth = 0) => {
  const result = evaluateNode(node, stack, ctx, depth)
  if (result === TsEvalError) return
  return result as T
}
