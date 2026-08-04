import type { Context } from '@bamboocss/core'
import { type BoxNode } from '@bamboocss/extractor'
import type { Dict, ResultItem } from '@bamboocss/types'
import { type JsxAttribute, Node } from 'ts-morph'
import type { RuntimeCss } from './runtime-css'

/**
 * Collapse a `styled.*` element to the intrinsic tag it renders, with its style props
 * resolved into a literal `className`.
 *
 *     <styled.div color="red.300" onClick={fn}>hi</styled.div>
 *     <div onClick={fn} className={"c_red.300"}>hi</div>
 *
 * This is the hottest styling path in a JSX app: the factory runs `splitProps`,
 * `css(propStyles, cssStyles)` and `cx` on every element of every render, and wraps each
 * one in a `forwardRef` component. Folding removes all of it.
 *
 * It is also the easiest place to be subtly wrong, because the factory does more than
 * compute a class. What it does with a prop, for a factory with no recipe attached, is
 * decided by `defaultShouldForwardProp`: `!variantKeys.includes(prop) && !isCssProperty(prop)`.
 * With no recipe there are no variant keys, so the rule reduces to "css properties are
 * consumed, everything else reaches the DOM unchanged" — which is what this reproduces.
 * Anything outside that rule bails rather than guesses.
 */
export interface JsxEdit {
  start: number
  end: number
  text: string
}

export interface JsxFoldPlan {
  edits: JsxEdit[]
  className: string
  /** Range of the whole element, for overlap detection against other folds. */
  start: number
  end: number
}

/**
 * Props the factory gives meaning to beyond styling. Each one changes what is rendered
 * in a way a literal class cannot express, so an element carrying any of them is left
 * alone.
 *
 * `as` is handled separately rather than listed here: a statically known one just names
 * the tag to fold to.
 *
 * - `unstyled` takes a different branch through the factory.
 * - `css` is a style object, but merging it here would have to reproduce the argument
 *   order `cvaClass` uses; left for when partial folding lands.
 * - `ref` and `key` are React's, not props, and `children` competes with the element's
 *   own children (`children ?? combinedProps.children`).
 */
const RESERVED_PROPS = new Set(['unstyled', 'css', 'ref', 'key', 'children'])

/**
 * The tag an `as` prop names, when it names one statically.
 *
 * The factory destructures `{ as: Element = __base__ }` and hands `Element` to
 * `createElement`, so a static `as` is simply a different tag with the same class and
 * the same forwarded props — `splitProps` keys off the factory's own config, not off
 * what `as` points at, so the split is unchanged.
 *
 * Casing is load-bearing, because JSX and `createElement` disagree about it. JSX reads a
 * lowercase tag as an intrinsic element and a capitalised one as a variable, while
 * `createElement` takes a string as intrinsic and anything else as a component. So the
 * two forms only survive the rewrite when their casing already agrees:
 *
 * - `as="section"` -> `<section>`, intrinsic both ways.
 * - `as={Link}` -> `<Link>`, a component reference both ways.
 *
 * The mismatched pair render something else entirely. `as={thing}` would fold to
 * `<thing>`, a DOM element named `thing` rather than the component; `as="Section"` would
 * fold to `<Section>`, a variable reference rather than the intrinsic the factory would
 * have created. Both bail.
 *
 * A dot is the same hazard spelled differently, and it survives lowercasing. `<foo.bar>`
 * is a JSX member expression — `createElement(foo.bar)`, a property read off a variable
 * in scope — where the factory would have created an intrinsic element named literally
 * `foo.bar`. So a dotted value bails even though its casing agrees.
 */
const asTag = (attribute: JsxAttribute): string | undefined => {
  const initializer = attribute.getInitializer()
  if (!initializer) return undefined

  if (Node.isStringLiteral(initializer)) {
    const value = initializer.getLiteralValue()
    // Lowercase-initial and dot-free, so JSX reads it as the intrinsic element the
    // factory would have created rather than as a reference to something in scope.
    return /^[a-z][\w-]*$/.test(value) ? value : undefined
  }

  if (!Node.isJsxExpression(initializer)) return undefined

  const expression = initializer.getExpression()
  if (!expression || !Node.isIdentifier(expression)) return undefined

  // Capitalised only, so JSX reads it as the reference the factory would call.
  const name = expression.getText()
  return /^[A-Z]/.test(name) ? name : undefined
}

/**
 * `normalizeHTMLProps` renames these on the way to the DOM (`htmlSize` -> `size`).
 * Reproducing the rename is easy; noticing that it exists is the hard part, so they bail.
 */
const HTML_PROPS = new Set(['htmlSize', 'htmlTranslate', 'htmlWidth', 'htmlHeight'])

export type JsxSkipReason = 'dynamic' | 'unsupported-kind' | 'not-imported'

/**
 * Is the name bound by an import from bamboo's generated system?
 *
 * The parser matches a pattern element by its tag name, so `<Stack>` is reported
 * whatever module `Stack` came from. That is harmless for extraction — a few unused
 * rules — and destructive for a transform: `import { Stack } from '@mui/material'`
 * would be replaced by a bamboo `<div>`, deleting the third-party component.
 *
 * `imports.match` is the same check the parser uses to decide whether a module counts,
 * so this asks the question the element surface never got around to asking.
 */
const isBambooImport = (node: Node, name: string, ctx: Context): boolean => {
  for (const declaration of node.getSourceFile().getImportDeclarations()) {
    const mod = declaration.getModuleSpecifierValue()

    for (const named of declaration.getNamedImports()) {
      const importName = named.getNameNode().getText()
      const alias = named.getAliasNode()?.getText() ?? importName
      if (alias !== name) continue
      return ctx.imports.match({ mod, name: importName, alias })
    }

    const namespace = declaration.getNamespaceImport()
    if (namespace?.getText() === name) return ctx.imports.match({ mod, name, alias: name, kind: 'namespace' })
  }

  return false
}

/**
 * The intrinsic tag a factory expression names, if it names one statically.
 *
 * Only `styled.div` and friends fold. `styled(Component)` and `styled('div')` are call
 * expressions whose result is bound elsewhere, and a capitalised tag is a component
 * rather than an intrinsic element.
 */
const intrinsicTag = (tagName: string, factoryName: string): string | undefined => {
  const prefix = `${factoryName}.`
  if (!tagName.startsWith(prefix)) return undefined

  const tag = tagName.slice(prefix.length)
  if (!/^[a-z][a-z0-9-]*$/.test(tag)) return undefined

  return tag
}

/**
 * Collapse a pattern element (`<Stack gap="4">`) to the tag it renders.
 *
 * A pattern component is a second layer on top of the factory: it splits its own props
 * out, runs them through the pattern's transform, and hands the result to
 * `styled.<jsxElement>`, which then does everything described above. Folding one removes
 * both layers.
 *
 * The class is computed through `patterns.transform`, the same call the encoder makes
 * when it decides what css to emit — so a folded pattern class is backed by a rule by
 * construction, and the render-parity test is what confirms it also matches the runtime.
 *
 * Only the default `jsxStyleProps: 'all'` folds. Under `minimal` and `none` the pattern's
 * styles reach the factory through the `css` prop instead of being spread, which reverses
 * which side wins when a prop is set in both places.
 */
export const planPatternFold = (
  item: ResultItem,
  ctx: Context,
  runtimeCss: RuntimeCss,
): JsxFoldPlan | { reason: JsxSkipReason } => {
  const node = (item.box as BoxNode | undefined)?.getNode?.()

  if (!node || (!Node.isJsxOpeningElement(node) && !Node.isJsxSelfClosingElement(node))) {
    return { reason: 'unsupported-kind' }
  }

  if (ctx.jsx.styleProps !== 'all') return { reason: 'unsupported-kind' }

  const jsxName = node.getTagNameNode().getText()
  const detail = ctx.patterns.details.find((entry) => entry.jsxName === jsxName)
  if (!detail) return { reason: 'unsupported-kind' }

  if (!isBambooImport(node, jsxName, ctx)) return { reason: 'not-imported' }

  const styles = (item.data?.[0] ?? {}) as Dict
  const passthrough: string[] = []
  let staticClassName = ''
  let tag = detail.config.jsxElement ?? 'div'

  for (const attribute of node.getAttributes()) {
    if (!Node.isJsxAttribute(attribute)) return { reason: 'dynamic' }

    const name = attribute.getNameNode().getText()

    if (name === 'className') {
      const initializer = attribute.getInitializer()
      if (!initializer || !Node.isStringLiteral(initializer)) return { reason: 'dynamic' }
      staticClassName = initializer.getLiteralValue()
      continue
    }

    if (name === 'as') {
      const resolved = asTag(attribute)
      if (!resolved) return { reason: 'dynamic' }
      tag = resolved
      continue
    }

    if (RESERVED_PROPS.has(name) || HTML_PROPS.has(name)) return { reason: 'dynamic' }

    // A pattern prop and a style prop are both consumed; what matters is only that the
    // extractor resolved it, since anything it dropped would be silently lost.
    if (detail.props.includes(name) || ctx.isValidProperty(name)) {
      if (!(name in styles)) return { reason: 'dynamic' }
      continue
    }

    passthrough.push(attribute.getText())
  }

  let resolved: string
  try {
    resolved = runtimeCss(ctx.patterns.transform(detail.baseName, styles))
  } catch {
    return { reason: 'dynamic' }
  }

  const className = [resolved, staticClassName].filter(Boolean).join(' ')
  if (!className) return { reason: 'dynamic' }

  return buildEdits(node, tag, passthrough, className)
}

export const planJsxFold = (
  item: ResultItem,
  ctx: Context,
  runtimeCss: RuntimeCss,
): JsxFoldPlan | { reason: JsxSkipReason } => {
  const node = (item.box as BoxNode | undefined)?.getNode?.()

  if (!node || (!Node.isJsxOpeningElement(node) && !Node.isJsxSelfClosingElement(node))) {
    return { reason: 'unsupported-kind' }
  }

  const tagName = node.getTagNameNode().getText()
  const baseTag = intrinsicTag(tagName, ctx.jsx.factoryName)
  if (!baseTag) return { reason: 'unsupported-kind' }

  if (!isBambooImport(node, ctx.jsx.factoryName, ctx)) return { reason: 'not-imported' }

  let tag = baseTag

  const styles = (item.data?.[0] ?? {}) as Dict
  const passthrough: string[] = []
  let staticClassName = ''

  for (const attribute of node.getAttributes()) {
    if (!Node.isJsxAttribute(attribute)) return { reason: 'dynamic' }

    const name = attribute.getNameNode().getText()

    if (name === 'className') {
      // `cx(css(...), combinedProps.className)` appends it last, so a static one can be
      // concatenated. A dynamic one would need `cx` at runtime.
      const initializer = attribute.getInitializer()
      if (!initializer || !Node.isStringLiteral(initializer)) return { reason: 'dynamic' }
      staticClassName = initializer.getLiteralValue()
      continue
    }

    if (name === 'as') {
      const resolved = asTag(attribute)
      if (!resolved) return { reason: 'dynamic' }
      tag = resolved
      continue
    }

    if (RESERVED_PROPS.has(name) || HTML_PROPS.has(name)) return { reason: 'dynamic' }

    if (ctx.isValidProperty(name)) {
      // A style prop the extractor could not resolve is absent from `data`, exactly as a
      // dropped object property is. Folding without it would lose the style.
      if (!(name in styles)) return { reason: 'dynamic' }
      continue
    }

    // Not a css property, so `defaultShouldForwardProp` sends it to the DOM untouched.
    passthrough.push(attribute.getText())
  }

  const className = [runtimeCss(styles), staticClassName].filter(Boolean).join(' ')
  if (!className) return { reason: 'dynamic' }

  return buildEdits(node, tag, passthrough, className)
}

/** Rewrite the opening element, and the closing one when there is a pair. */
const buildEdits = (
  node: Node,
  tag: string,
  passthrough: string[],
  className: string,
): JsxFoldPlan | { reason: JsxSkipReason } => {
  const attributes = [...passthrough, `className={${JSON.stringify(className)}}`].join(' ')
  const selfClosing = Node.isJsxSelfClosingElement(node)

  const edits: JsxEdit[] = [
    {
      start: node.getStart(),
      end: node.getEnd(),
      text: `<${tag} ${attributes}${selfClosing ? ' />' : '>'}`,
    },
  ]

  let end = node.getEnd()

  if (!selfClosing) {
    const parent = node.getParent()
    if (!Node.isJsxElement(parent)) return { reason: 'unsupported-kind' }

    const closing = parent.getClosingElement()
    edits.push({ start: closing.getStart(), end: closing.getEnd(), text: `</${tag}>` })
    end = closing.getEnd()
  }

  return { edits, className, start: node.getStart(), end }
}
