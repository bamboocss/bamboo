import type { Context } from '@bamboocss/core'
import { type BoxNode, box } from '@bamboocss/extractor'
import type { Dict } from '@bamboocss/types'
import { Node, type ObjectLiteralExpression } from 'ts-morph'

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
 * overlap. `cx` here is a plain concatenation with no conflict resolution of its own, so
 * this check is the only thing standing between a split and a wrong class.
 *
 * Multi-argument calls are excluded for the same reason at a larger scale: `css(a, b)` is
 * later-wins across the whole object, so a static `a` cannot be hoisted out of a dynamic
 * `b` without reproducing the merge.
 */
export interface PartialFold {
  /** Class string for the statically resolvable half. */
  className: string
  /** Source text of the object literal holding what is left for the runtime. */
  dynamicText: string
}

export interface PartialFoldContext {
  ctx: Context
  runtimeCss: (...styles: Dict[]) => string
  /** Whether a property's value is fully accounted for by the extractor. */
  isAccounted: (value: Node | undefined, boxNode: BoxNode | undefined) => boolean
  /** Whether every leaf under a box carries a known value. */
  isStatic: (boxNode: BoxNode | undefined) => boolean
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
  { ctx, runtimeCss, isAccounted, isStatic }: PartialFoldContext,
): PartialFold | undefined => {
  if (!box.isMap(boxNode)) return undefined

  const staticKeys: string[] = []
  const dynamicKeys: string[] = []
  const dynamicText: string[] = []

  for (const property of argument.getProperties()) {
    // A spread contributes keys that cannot be attributed to either half.
    if (!Node.isPropertyAssignment(property) && !Node.isShorthandPropertyAssignment(property)) return undefined

    const nameNode = property.getNameNode()
    if (Node.isComputedPropertyName(nameNode)) return undefined

    const key =
      Node.isStringLiteral(nameNode) || Node.isNumericLiteral(nameNode)
        ? String(nameNode.getLiteralValue())
        : nameNode.getText()

    const value = Node.isPropertyAssignment(property) ? property.getInitializer() : undefined
    const valueBox = boxNode.value.get(key)

    // Three separate questions, and only asking the first two is how a ternary gets
    // folded to its `whenTrue` branch: `styles` is a projection that already picked a
    // branch, and `accountsForSource` answers "are the declared keys present", not "is
    // every leaf resolvable". `isStaticBox` is the one that rejects a `conditional` or
    // `unresolvable` box, including one nested in a responsive array.
    const resolved = key in styles && isStatic(valueBox) && isAccounted(value, valueBox)

    if (resolved) {
      staticKeys.push(key)
      continue
    }

    dynamicKeys.push(key)
    dynamicText.push(property.getText())
  }

  // Nothing to gain from a split that is entirely one side.
  if (!staticKeys.length || !dynamicKeys.length) return undefined

  if (collides(staticKeys, dynamicKeys, ctx)) return undefined

  const staticStyles: Dict = {}
  for (const key of staticKeys) staticStyles[key] = styles[key]

  const className = runtimeCss(staticStyles)
  if (!className) return undefined

  return { className, dynamicText: `{ ${dynamicText.join(', ')} }` }
}

/**
 * Do the two halves resolve to a shared property?
 *
 * Compared after shorthand resolution, since that is where distinct keys become the same
 * property. An unrecognised key resolves to itself, so two distinct unknown keys are read
 * as distinct — which is right for atomic output, where one class is emitted per key.
 */
const collides = (staticKeys: string[], dynamicKeys: string[], ctx: Context): boolean => {
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
): { name: string; insert?: { pos: number; text: string } } | undefined => {
  const sourceFile = call.getSourceFile()

  let host: ReturnType<typeof sourceFile.getImportDeclarations>[number] | undefined

  for (const declaration of sourceFile.getImportDeclarations()) {
    const mod = declaration.getModuleSpecifierValue()

    for (const named of declaration.getNamedImports()) {
      const local = (named.getAliasNode() ?? named.getNameNode()).getText()

      if (named.getNameNode().getText() === 'cx') {
        // A `cx` that is not bamboo's, or is erased at runtime, or is shadowed where the
        // call sits, would be called instead of the concatenation this relies on.
        if (declaration.isTypeOnly() || named.isTypeOnly()) return undefined
        if (!isBambooCssModule(mod)) return undefined
        if (isShadowed(call, local)) return undefined
        return { name: local }
      }

      if (local === calleeRoot) host = declaration
    }
  }

  if (!host) return undefined

  // Adding an import is only safe against the module whose exports are known — the one
  // bamboo generates. A configured `importMap.css` names the user's own wrapper, and a
  // wrapper re-exporting `css` need not re-export `cx`.
  if (!isGeneratedCssModule(host.getModuleSpecifierValue())) return undefined

  // A local `cx` anywhere in scope would collide with the binding being added, or be
  // reached instead of it. `getLocals` is compiler internals that ts-morph documents as
  // unstable, so its absence declines the insert rather than waving it through — the
  // alternative is a silent duplicate declaration if it ever goes away.
  if (isShadowed(call, 'cx')) return undefined
  const locals = sourceFile.getLocals?.()
  if (!locals || locals.some((local) => local.getName() === 'cx')) return undefined

  const last = host.getNamedImports().at(-1)
  if (!last) return undefined

  return { name: 'cx', insert: { pos: last.getEnd(), text: ', cx' } }
}
