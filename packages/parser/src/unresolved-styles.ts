import { type BoxNode, box, unwrapExpression } from '@bamboocss/extractor'
import type { ResultItem } from '@bamboocss/types'
import { Node } from 'ts-morph'

export interface UnresolvedStyle {
  /**
   * What the loss costs, which decides how it is explained.
   *
   * - `atomic` — a `css()` call. The declarations the build saw still apply; the ones it
   *   did not have no rule behind them, so they are simply absent.
   * - `recipe` — a `cva`/`sva` config. There is no degrading. A recipe's classes are named
   *   from a hash of its config, so a declaration the build cannot see gives the two sides
   *   different names and *every* rule misses.
   */
  kind: 'atomic' | 'recipe'
  /** The property the build could not resolve, or `undefined` when only the count differs. */
  prop?: string
  filePath: string
  line: number
  column: number
  /**
   * How the build lost the call:
   *
   * - `unresolvable-value` — a value it could not evaluate.
   * - `missing-property` — a key that never arrived in the box tree at all.
   * - `unenumerable-keys` — a spread or computed key, so it cannot say what the call sets.
   *   pair of alternatives.
   * - `too-many-combinations` — more ternary branches than it will enumerate.
   */
  reason:
    | 'unresolvable-value'
    | 'missing-property'
    | 'unenumerable-keys'
    /**
     * `css(recipe.raw(props), …)` — the build reads `.raw` as returning what it was passed.
     *
     * True of `css.raw`, which is the identity it was written for. A recipe or pattern's
     * `.raw` takes *props* and returns *styles*, so the build composes the props instead: the
     * recipe's own declarations never reach the stylesheet, and its variant names are handed
     * to the encoder as if they were properties. The browser then asks for classes no rule
     * backs, and the element renders without them.
     */
    | 'unresolved-raw'
}

/**
 * Whether every box under this one carries a value the build can actually see.
 *
 * Mirrors `isStaticBox` in `@bamboocss/vite`, which asks the same question to decide
 * whether a call is safe to fold. Duplicated rather than shared for now because the fold's
 * copy also answers questions about ternaries that a diagnostic does not care about;
 * unifying them is worth doing when the fold's detection moves out of the vite package.
 */
const findUnresolvable = (node: BoxNode | undefined, path: string[], out: string[], seen = new Set<BoxNode>()) => {
  if (!node || seen.has(node)) return
  seen.add(node)

  if (box.isUnresolvable(node)) {
    out.push(path.join('.'))
    return
  }

  // A conditional is *not* a loss. `ParserResult.setCss` enumerates a ternary's branches
  // and emits a complete group for each, so the runtime finds whichever one it evaluates
  // to. Reporting it here claimed an element would render unstyled when it renders
  // perfectly, and — worse — pulled the call into the atomic-duplication path below, which
  // then emitted rules nothing could ever ask for. The one case where branches really do
  // go missing is the combination cap, and `setCss` reports that itself because only it
  // knows the count.
  if (box.isConditional(node)) return

  // A value the extractor could not evaluate is not always boxed as `unresolvable`: a
  // template literal with an interpolation comes back as a *literal* carrying `undefined`.
  // The key is present, so nothing else here would notice it went missing.
  //
  // A written `undefined` boxes identically but is not a loss — both the build and the
  // runtime drop it, and they agree. The node tells them apart: `TemplateExpression` for
  // the interpolation, `Identifier` for the keyword.
  if (box.isLiteral(node) && node.value === undefined) {
    if (Node.isTemplateExpression(node.getNode())) out.push(path.join('.'))
    return
  }

  if (box.isMap(node)) {
    for (const [key, child] of node.value) findUnresolvable(child, [...path, key], out, seen)
    return
  }

  if (box.isArray(node)) {
    node.value.forEach((child, index) => findUnresolvable(child, [...path, String(index)], out, seen))
  }
}

interface WrittenProps {
  /** The names this could read directly. */
  names: string[]
  /**
   * Whether something in the literal contributes keys this cannot enumerate — an object
   * spread, or a computed key. The names are still usable; they are just not the whole
   * story, so the caller has to account for the rest another way.
   */
  uncertain: boolean
}

/**
 * Property names written at the top level of the call's own object literal.
 *
 * A key whose value the extractor could not evaluate at all is not boxed as
 * `unresolvable` — `maybeBoxNode` returns nothing and the pair is never recorded
 * (`get-object-literal-expression-prop-pairs.ts` has no fallback), so the property
 * disappears with no trace in the box tree. Reading the source back is the only way to
 * notice, and it is why `css({ color: getColor() })` needs this and not just the walk above.
 *
 * Returns `undefined` only when the argument is not a single object literal at all, so the
 * caller reports nothing rather than something wrong.
 */
const writtenProps = (node: Node | undefined): WrittenProps | undefined => {
  // The box for a `css()` call records the *call*, not its argument, so the object literal
  // has to be recovered from it. A multi-argument call is declined: the operands merge
  // last-wins at runtime, so a key absent from one of them is not necessarily absent from
  // the result.
  let literal = node
  if (literal && Node.isCallExpression(literal)) {
    const args = literal.getArguments()
    if (args.length !== 1) return undefined
    literal = args[0]
  }

  if (!literal || !Node.isObjectLiteralExpression(literal)) return undefined

  const names: string[] = []
  let uncertain = false

  for (const property of literal.getProperties()) {
    if (Node.isPropertyAssignment(property) || Node.isShorthandPropertyAssignment(property)) {
      const name = property.getName()
      // A computed or quoted-dynamic key is not comparable against a resolved key.
      if (name.startsWith('[')) {
        uncertain = true
        continue
      }
      names.push(name.replace(/^['"]|['"]$/g, ''))
      continue
    }
    // A spread contributes keys this cannot enumerate.
    uncertain = true
  }

  return { names, uncertain }
}

/** Every property of a `css()` call that will not reach the stylesheet. */
/**
 * A recipe config the build could not fully read, level by level.
 *
 * `findUnresolvedStyles` reads the *call's* literal, which for a recipe holds `base` and
 * `variants` rather than declarations — so a loss inside `base` is nested out of its reach.
 * This walks the written source against the resolved data instead, and reports three ways a
 * level can lose something:
 *
 * - a key written in the source that never arrived in the data — an unresolvable *value*,
 *   which leaves no trace in the box tree because the pair is never recorded at all;
 * - a spread or computed key that contributed no keys beyond those written beside it;
 * - the config not being an object literal at all, so nothing can be compared.
 *
 * Every level is unwrapped first. `as const` and `satisfies` are idiomatic on a recipe
 * config, and reading through them is what the extractor does — a diagnostic that stops at
 * the cast reports nothing for the exact configs most likely to be written that way.
 */
const findUnresolvedInValue = (
  node: Node | undefined,
  resolved: unknown,
  // A string rather than an array: this runs per property at every level of every recipe
  // config in the project, and the path is only ever read when something is reported.
  path: string,
  out: Array<Pick<UnresolvedStyle, 'prop' | 'reason'>>,
) => {
  const value = node ? unwrapExpression(node) : undefined
  if (!value) return

  if (Node.isArrayLiteralExpression(value)) {
    value.getElements().forEach((element, index) => {
      const at = path ? `${path}.${index}` : String(index)
      // A spread the extractor could not resolve leaves a hole rather than an absence, so
      // the element count still lines up. `slots: [...anatomy.keys(), 'body']` is the shape.
      const element_ = (resolved as unknown[] | undefined)?.[index]
      if (Node.isSpreadElement(element) && element_ == null) {
        out.push({ prop: at || undefined, reason: 'unenumerable-keys' })
        return
      }
      findUnresolvedInValue(element, element_, at, out)
    })
    return
  }

  if (!Node.isObjectLiteralExpression(value)) return

  const properties = value.getProperties()
  const written: string[] = []
  let uncertain = false

  for (const property of properties) {
    if (Node.isSpreadAssignment(property)) {
      // A spread of a literal is not uncertain — its keys are written right there, so they
      // count as written rather than as something that might have gone missing. Without
      // this, `...{}` and a spread every key of which is overridden beside it both look
      // exactly like a spread the extractor could not resolve.
      const spread = unwrapExpression(property.getExpression())
      if (Node.isObjectLiteralExpression(spread)) {
        for (const inner of spread.getProperties()) {
          if (!Node.isPropertyAssignment(inner) && !Node.isShorthandPropertyAssignment(inner)) continue
          const innerName = inner.getName()
          if (!innerName.startsWith('[')) written.push(innerName.replace(/^['"]|['"]$/g, ''))
        }
        continue
      }

      uncertain = true
      continue
    }
    if (!Node.isPropertyAssignment(property) && !Node.isShorthandPropertyAssignment(property)) continue

    const name = property.getName()
    if (name.startsWith('[')) {
      uncertain = true
      continue
    }
    written.push(name.replace(/^['"]|['"]$/g, ''))
  }

  const isObject = Boolean(resolved) && typeof resolved === 'object'
  const resolvedKeys = isObject ? Object.keys(resolved as object) : []

  // A key the source writes and the data never received. `maybeBoxNode` records nothing for
  // a value it cannot evaluate, so `{ color: getColor() }` disappears without a trace — and
  // it changes the hash exactly as a dropped spread does.
  for (const name of written) {
    if (!resolvedKeys.includes(name)) {
      out.push({ prop: path ? `${path}.${name}` : name, reason: 'missing-property' })
    }
  }

  if (uncertain && !resolvedKeys.some((key) => !written.includes(key))) {
    out.push({ prop: path || undefined, reason: 'unenumerable-keys' })
  }

  for (const property of properties) {
    if (!Node.isPropertyAssignment(property)) continue
    const name = property.getName().replace(/^['"]|['"]$/g, '')
    if (name.startsWith('[')) continue
    findUnresolvedInValue(
      property.getInitializer(),
      (resolved as Record<string, unknown> | undefined)?.[name],
      path ? `${path}.${name}` : name,
      out,
    )
  }
}

/** A recipe config the build could not fully read — see `findUnresolvedInValue`. */
export const findUnresolvedRecipeStyles = (item: ResultItem): UnresolvedStyle[] => {
  const boxNode = item.box
  const node = boxNode?.getNode()
  const sourceFile = node?.getSourceFile()
  if (!node || !sourceFile) return []

  let argument: Node | undefined = node
  if (Node.isCallExpression(argument)) {
    const args = argument.getArguments()
    if (args.length !== 1) return []
    argument = args[0]
  }

  const losses: Array<Pick<UnresolvedStyle, 'prop' | 'reason'>> = []
  const config = argument ? unwrapExpression(argument) : undefined

  // `cva(config)` — nothing to compare the data against, and the extractor resolved
  // whatever it could reach. This is the quietest total loss of the lot, so it is reported
  // rather than skipped.
  if (!config || !Node.isObjectLiteralExpression(config)) {
    losses.push({ reason: 'unresolvable-value' })
  } else {
    findUnresolvedInValue(config, item.data[0], '', losses)
  }

  if (!losses.length) return []

  const { line, column } = sourceFile.getLineAndColumnAtPos(node.getStart())
  return losses.map((loss) => ({ column, filePath: sourceFile.getFilePath(), kind: 'recipe' as const, line, ...loss }))
}

export const findUnresolvedStyles = (item: ResultItem, kind: 'atomic'): UnresolvedStyle[] => {
  const boxNode = item.box
  if (!boxNode) return []

  const node = boxNode.getNode()
  const sourceFile = node?.getSourceFile()
  if (!node || !sourceFile) return []

  const found: string[] = []
  findUnresolvable(boxNode, [], found)

  const losses: Array<Pick<UnresolvedStyle, 'prop' | 'reason'>> = found.map((prop) => ({
    prop: prop || undefined,
    reason: 'unresolvable-value' as const,
  }))

  // Then the keys that never arrived at all.
  const written = writtenProps(node)
  if (written) {
    const resolved = new Set<string>()
    for (const entry of item.data) {
      if (entry && typeof entry === 'object') for (const key of Object.keys(entry)) resolved.add(key)
    }
    if (box.isMap(boxNode)) for (const key of boxNode.value.keys()) resolved.add(key)

    for (const prop of written.names) {
      if (!resolved.has(prop)) losses.push({ prop, reason: 'missing-property' })
    }

    // A spread or a computed key contributes properties this cannot name, so the check
    // above cannot see them go missing. What it can see is whether they arrived at all: a
    // spread the extractor resolved puts its keys in `resolved`, and one it could not
    // resolve leaves nothing behind but the keys written beside it.
    //
    // Reporting on that is a guess in one direction only. `css({ ...base, color: 'red' })`
    // where `base` happens to hold nothing but `color` is read as a loss when it is not,
    // and costs this call site its atomic rules. The other way round would cost the element
    // every style it has.
    if (written.uncertain && !hasKeyOutside(resolved, written.names)) {
      losses.push({ reason: 'unenumerable-keys' })
    }
  }

  if (!losses.length) return []

  // Only once there is something to report. `getLineAndColumnAtPos` counts newlines from the
  // top of the file, and this now runs for every JSX element and pattern call a grouped
  // build sees — where the answer is almost always that nothing was lost.
  const { line, column } = sourceFile.getLineAndColumnAtPos(node.getStart())
  const at = { filePath: sourceFile.getFilePath(), line, column }

  return losses.map((loss) => ({ ...at, kind, ...loss }))
}

const hasKeyOutside = (resolved: Set<string>, names: string[]) => {
  for (const key of resolved) {
    if (!names.includes(key)) return true
  }
  return false
}
