import type { Context } from '@bamboocss/core'
import { type BoxNode, box } from '@bamboocss/extractor'
import type { Dict } from '@bamboocss/types'
import { Node, type ObjectLiteralExpression } from 'ts-morph'

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
export const accountsForSource = (node: Node | undefined, boxNode: BoxNode | undefined): boolean => {
  if (!node) return true

  const unwrapped = Node.isAsExpression(node) || Node.isParenthesizedExpression(node) ? node.getExpression() : node

  if (Node.isArrayLiteralExpression(unwrapped)) {
    if (!box.isArray(boxNode)) return false
    const elements = unwrapped.getElements()
    if (elements.length !== boxNode.value.length) return false
    return elements.every((element, index) => accountsForSource(element, boxNode.value[index]))
  }

  if (!Node.isObjectLiteralExpression(unwrapped)) return true

  // An object literal in source must have produced a map.
  if (!box.isMap(boxNode)) return false

  for (const property of unwrapped.getProperties()) {
    if (Node.isSpreadAssignment(property)) {
      const expression = property.getExpression()
      if (!Node.isObjectLiteralExpression(expression)) return false
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

    const value = Node.isPropertyAssignment(property) ? property.getInitializer() : undefined

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
  const partition = partitionObject(argument, boxNode, styles, { ctx, runtimeCss, isAccounted, isStatic })
  if (!partition) return undefined

  const className = runtimeCss(partition.staticStyles)
  if (!className) return undefined

  return { className, dynamicText: `{ ${partition.dynamicText.join(', ')} }` }
}

interface Partition {
  /** Style object for the half that resolves now. */
  staticStyles: Dict
  /** Source text of the properties left for the runtime. */
  dynamicText: string[]
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
): Partition | undefined => {
  if (!box.isMap(boxNode)) return undefined

  const { ctx, isAccounted, isStatic } = deps
  const staticKeys: string[] = []
  const dynamicKeys: string[] = []
  const staticStyles: Dict = {}
  const dynamicText: string[] = []

  for (const property of node.getProperties()) {
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
    if (key in styles && isStatic(valueBox) && isAccounted(value, valueBox)) {
      staticKeys.push(key)
      staticStyles[key] = styles[key]
      continue
    }

    // Part static, part dynamic, and nothing hidden from the box — worth going into.
    // `isAccounted` is what rules out a spread here: it reports the block as unaccounted
    // for, and a spread's keys belong to neither half.
    const nested =
      value && Node.isObjectLiteralExpression(value) && isAccounted(value, valueBox)
        ? partitionObject(value, valueBox, (styles[key] ?? {}) as Dict, deps)
        : undefined

    if (nested && Object.keys(nested.staticStyles).length && nested.dynamicText.length) {
      staticKeys.push(key)
      staticStyles[key] = nested.staticStyles
      dynamicKeys.push(key)
      dynamicText.push(`${property.getNameNode().getText()}: { ${nested.dynamicText.join(', ')} }`)
      continue
    }

    dynamicKeys.push(key)
    dynamicText.push(property.getText())
  }

  // Nothing to gain from a split that is entirely one side.
  if (!staticKeys.length || !dynamicText.length) return undefined

  // A key appearing on both sides is a block that was split, which is the point; only
  // distinct keys can collide.
  const contested = dynamicKeys.filter((key) => !staticKeys.includes(key))
  if (collides(staticKeys, contested, ctx)) return undefined

  return { staticStyles, dynamicText }
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
): { css: string; cx: string; insert?: { pos: number; text: string } } | undefined => {
  const sourceFile = node.getSourceFile()

  for (const declaration of sourceFile.getImportDeclarations()) {
    const mod = declaration.getModuleSpecifierValue()
    if (declaration.isTypeOnly() || !isBambooCssModule(mod)) continue

    const named = declaration.getNamedImports()
    const cssImport = named.find((entry) => entry.getNameNode().getText() === 'css' && !entry.isTypeOnly())
    if (!cssImport) continue

    const cssName = (cssImport.getAliasNode() ?? cssImport.getNameNode()).getText()
    if (isShadowed(node, cssName)) return undefined

    const existingCx = named.find((entry) => entry.getNameNode().getText() === 'cx' && !entry.isTypeOnly())

    if (existingCx) {
      const cxName = (existingCx.getAliasNode() ?? existingCx.getNameNode()).getText()
      return isShadowed(node, cxName) ? undefined : { css: cssName, cx: cxName }
    }

    // Same restriction as the call-site split: only the generated module's exports are
    // known, so only it may have a binding added.
    if (!isGeneratedCssModule(mod)) return undefined
    if (isShadowed(node, 'cx')) return undefined

    const locals = sourceFile.getLocals?.()
    if (!locals || locals.some((local) => local.getName() === 'cx')) return undefined

    const last = named.at(-1)
    if (!last) return undefined

    return { css: cssName, cx: 'cx', insert: { pos: last.getEnd(), text: ', cx' } }
  }

  return undefined
}
