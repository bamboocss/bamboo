import type { Context } from '@bamboocss/core'
import { type BoxNode } from '@bamboocss/extractor'
import type { Dict, ResultItem } from '@bamboocss/types'
import { Node } from 'ts-morph'
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
 * - `as` swaps the element type at runtime.
 * - `unstyled` takes a different branch through the factory.
 * - `css` is a style object, but merging it here would have to reproduce the argument
 *   order `cvaClass` uses; left for when partial folding lands.
 * - `ref` and `key` are React's, not props, and `children` competes with the element's
 *   own children (`children ?? combinedProps.children`).
 */
const RESERVED_PROPS = new Set(['as', 'unstyled', 'css', 'ref', 'key', 'children'])

/**
 * `normalizeHTMLProps` renames these on the way to the DOM (`htmlSize` -> `size`).
 * Reproducing the rename is easy; noticing that it exists is the hard part, so they bail.
 */
const HTML_PROPS = new Set(['htmlSize', 'htmlTranslate', 'htmlWidth', 'htmlHeight'])

export type JsxSkipReason = 'dynamic' | 'unsupported-kind'

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

export const planJsxFold = (
  item: ResultItem,
  ctx: Context,
  runtimeCss: RuntimeCss,
): JsxFoldPlan | { reason: JsxSkipReason } => {
  const node = (item.box as BoxNode | undefined)?.getNode?.()

  if (!node || (!Node.isJsxOpeningElement(node) && !Node.isJsxSelfClosingElement(node))) {
    return { reason: 'unsupported-kind' }
  }

  const tag = intrinsicTag(node.getTagNameNode().getText(), ctx.jsx.factoryName)
  if (!tag) return { reason: 'unsupported-kind' }

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
