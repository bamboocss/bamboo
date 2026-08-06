import { type BoxNode, box } from '@bamboocss/extractor'
import type { ResultItem } from '@bamboocss/types'
import { Node } from 'ts-morph'

export interface UnresolvedStyle {
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
   * - `ambiguous-merge` — two arguments setting one property, which it cannot tell from a
   *   pair of alternatives.
   * - `too-many-combinations` — more ternary branches than it will enumerate.
   */
  reason: 'unresolvable-value' | 'missing-property' | 'unenumerable-keys' | 'ambiguous-merge' | 'too-many-combinations'
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

/**
 * Every property of a `css()` call that will not reach the stylesheet.
 *
 * Only meaningful under `cssMode: 'grouped'`, where one class names the whole call: a
 * property the build cannot resolve does not merely go missing, it changes the class, and
 * the element renders with no styles at all. Under `atomic` the same call loses one
 * declaration and keeps the rest, which is why this is not reported there.
 */
export const findUnresolvedStyles = (item: ResultItem): UnresolvedStyle[] => {
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

  return losses.map((loss) => ({ ...at, ...loss }))
}

const hasKeyOutside = (resolved: Set<string>, names: string[]) => {
  for (const key of resolved) {
    if (!names.includes(key)) return true
  }
  return false
}
