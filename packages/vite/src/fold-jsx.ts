import type { Context } from '@bamboocss/core'
import { type BoxNode, box } from '@bamboocss/extractor'
import type { Dict, ResultItem } from '@bamboocss/types'
import { type JsxAttribute, Node, SyntaxKind } from 'ts-morph'
import {
  accountsForSource,
  collides,
  isStaticBox,
  isWrittenAsCollection,
  leafCall,
  leafPrefix,
  resolveCssHelpers,
} from './fold-partial'
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
  /** Import edit for a split that needed a `cx` binding added. */
  insert?: { pos: number; names: string[] }
}

/** Callbacks a split needs, threaded in so this file stays free of context plumbing. */
export interface JsxFoldDeps {
  isBambooCssModule: (mod: string) => boolean
  isGeneratedCssModule: (mod: string) => boolean
  isShadowed: (node: Node, name: string) => boolean
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
/**
 * How much of the program an expression can touch.
 *
 * `constant` neither reads nor writes, so it commutes with anything. `reads` runs no code
 * but observes bindings, so it commutes only with something that also cannot write.
 * `unknown` may do either.
 *
 * The distinction matters because the question is not "can this run code" but "is
 * swapping these two observable" — and `A;B` becoming `B;A` is observable as soon as `A`
 * writes something `B` reads. An identifier read is code-free and still not safe to move
 * behind a call that assigns to it.
 */
type Purity = 'constant' | 'reads' | 'unknown'

const RANK: Record<Purity, number> = { constant: 0, reads: 1, unknown: 2 }
const worst = (a: Purity, b: Purity): Purity => (RANK[a] >= RANK[b] ? a : b)

const purityOf = (node: Node): Purity => {
  if (Node.isIdentifier(node)) return 'reads'

  if (
    Node.isStringLiteral(node) ||
    Node.isNumericLiteral(node) ||
    Node.isNoSubstitutionTemplateLiteral(node) ||
    Node.isTrueLiteral(node) ||
    Node.isFalseLiteral(node) ||
    node.getKind() === SyntaxKind.NullKeyword
  ) {
    return 'constant'
  }

  if (Node.isPrefixUnaryExpression(node) && Node.isNumericLiteral(node.getOperand())) return 'constant'

  if (Node.isObjectLiteralExpression(node)) {
    return node.getProperties().reduce<Purity>((acc, property) => {
      if (!Node.isPropertyAssignment(property)) return 'unknown'
      if (Node.isComputedPropertyName(property.getNameNode())) return 'unknown'
      const value = property.getInitializer()
      return worst(acc, value ? purityOf(value) : 'unknown')
    }, 'constant')
  }

  if (Node.isArrayLiteralExpression(node)) {
    return node.getElements().reduce<Purity>((acc, element) => worst(acc, purityOf(element)), 'constant')
  }

  return 'unknown'
}

/**
 * The same question for a whole attribute.
 *
 * A `JsxElement` or `JsxFragment` initializer — `title=<Tag x={f()} />` — is legal, holds
 * arbitrary expressions, and is not a `JsxExpression`, so this asks what an initializer
 * *is* rather than listing the kinds that carry code.
 */
const attributePurity = (attribute: JsxAttribute): Purity => {
  const initializer = attribute.getInitializer()
  if (!initializer) return 'constant'
  if (Node.isStringLiteral(initializer)) return 'constant'
  if (!Node.isJsxExpression(initializer)) return 'unknown'

  const expression = initializer.getExpression()
  return expression ? purityOf(expression) : 'constant'
}

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

/**
 * `not-imported` is not among these: whether the tag's binding really is bamboo's is
 * settled in `fold.ts` before either planner runs, against a per-file scan shared with
 * the call sites. Asking it here meant one `getImportDeclarations()` walk per element.
 */
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
  deps?: JsxFoldDeps,
): JsxFoldPlan | { reason: JsxSkipReason } => {
  const node = (item.box as BoxNode | undefined)?.getNode?.()

  if (!node || (!Node.isJsxOpeningElement(node) && !Node.isJsxSelfClosingElement(node))) {
    return { reason: 'unsupported-kind' }
  }

  const tagName = node.getTagNameNode().getText()
  const baseTag = intrinsicTag(tagName, ctx.jsx.factoryName)
  if (!baseTag) return { reason: 'unsupported-kind' }

  let tag = baseTag

  const styles = (item.data?.[0] ?? {}) as Dict
  const propBoxes = box.isMap(item.box as BoxNode | undefined)
    ? (item.box as never as { value: Map<string, BoxNode> }).value
    : undefined
  const passthrough: string[] = []
  const staticProps: string[] = []
  const dynamicProps: Array<{ name: string; text: string; expression: Node }> = []
  let staticClassName = ''
  let dynamicClassName = ''
  let sawClassName = false
  /**
   * Where a dynamic `className` was written, and where the attributes that outlive the
   * fold were.
   *
   * The factory appends `className` after the styles, so a folded one is emitted last and
   * anything written after it runs before it instead. That covers more than the style
   * props — a passthrough keeps its own place among the attributes — but only where the
   * expression survives at all. A static style prop is not among them: it is *deleted*,
   * its value having been resolved at build time. That is a larger change than reordering
   * and a separate pre-existing gap — `<styled.div color={counted()} />` folds and never
   * calls it, with or without this — rather than a reason the reordering is moot.
   */
  let classNameIndex = -1
  let classNamePurity: Purity = 'constant'
  const survivors: Array<{ index: number; purity: Purity }> = []
  let index = -1

  for (const attribute of node.getAttributes()) {
    if (!Node.isJsxAttribute(attribute)) return { reason: 'dynamic' }

    index += 1
    const name = attribute.getNameNode().getText()

    if (name === 'className') {
      // `cx(css(...), combinedProps.className)` appends it last, so a static one can be
      // concatenated into the literal and a dynamic one becomes a final `cx` argument —
      // in that position, so a class it carries still wins the way it did before.
      const initializer = attribute.getInitializer()
      if (!initializer) return { reason: 'dynamic' }

      // Written twice, JSX keeps the last and evaluates both. Two static ones simply
      // overwrite, which is what the runtime does too; any other pairing would either
      // apply a class the runtime dropped or lose one of their side effects.
      if (sawClassName && (dynamicClassName || !Node.isStringLiteral(initializer))) return { reason: 'dynamic' }
      sawClassName = true

      if (Node.isStringLiteral(initializer)) {
        staticClassName = initializer.getLiteralValue()
        continue
      }

      const expression = Node.isJsxExpression(initializer) ? initializer.getExpression() : undefined
      if (!expression) return { reason: 'dynamic' }
      dynamicClassName = expression.getText()
      classNameIndex = index
      classNamePurity = purityOf(expression)
      continue
    }

    if (name === 'as') {
      const resolved = asTag(attribute)
      if (!resolved) return { reason: 'dynamic' }
      // The tag becomes the first argument to `jsx()`, so it moves ahead of everything —
      // further than a passthrough does, and by the same rule.
      survivors.push({ index, purity: attributePurity(attribute) })
      tag = resolved
      continue
    }

    if (RESERVED_PROPS.has(name) || HTML_PROPS.has(name)) return { reason: 'dynamic' }

    if (ctx.isValidProperty(name)) {
      // A style prop the extractor could not resolve is absent from `data`, exactly as a
      // dropped object property is. Folding it away would lose the style, so it is either
      // kept for the runtime half or, with no split available, declines the element.
      // `name in styles` is not enough, and this is the same defect the call-site split
      // was fixed for. The extractor keeps an `unresolvable` leaf inside the box while
      // `unbox` drops it from the data, so `_hover={{ color: t }}` leaves `_hover` present
      // as an empty object — static by that test, and folding it discards the whole
      // condition block. Only the box knows.
      const attributeValue = attribute.getInitializer()
      const valueExpression =
        attributeValue && Node.isJsxExpression(attributeValue) ? attributeValue.getExpression() : undefined
      const propBox = propBoxes?.get(name)

      // Two questions, and both have to be asked. `isStaticBox` answers "is every leaf
      // that is here resolvable" — it cannot see a spread, which contributes no box entry
      // at all, so `_hover={{ ...rest }}` walks an empty map and reports static.
      // `accountsForSource` is the one that compares against what the source declared.
      // The call-site split has always run both; this surface had only the first.
      if (name in styles && isStaticBox(propBox) && accountsForSource(valueExpression, propBox)) {
        staticProps.push(name)
        continue
      }

      if (!valueExpression) return { reason: 'dynamic' }
      const expression = valueExpression

      survivors.push({ index, purity: attributePurity(attribute) })
      dynamicProps.push({ name, text: expression.getText(), expression })
      continue
    }

    // Not a css property, so `defaultShouldForwardProp` sends it to the DOM untouched —
    // in its original position, which is what makes it able to cross the className.
    survivors.push({ index, purity: attributePurity(attribute) })
    passthrough.push(attribute.getText())
  }

  /**
   * Would emitting the className last move it past something that can observe it?
   *
   * A constant survivor commutes with anything. One that only reads commutes only while
   * the className expression cannot write — `className={cn} onClick={h}` is safe, and
   * `className={assigns()} bg={tone}` is not, because moving the read after the write
   * hands it the other value.
   *
   * This answers for the className and nothing else. `buildEdits` emits
   * `[...passthrough, className={cx(…)}]`, so a passthrough is also hoisted ahead of every
   * dynamic style prop's expression — `<styled.div bg={writes()} data-x={reads} />`
   * reorders those two with no className present at all. That is pre-existing and
   * reproduces on an unchanged tree; folding a dynamic className only makes it reachable
   * for more elements. Closing it means comparing every survivor against everything it
   * crosses rather than against one attribute, which is a different change.
   */
  const reordered = () =>
    classNameIndex >= 0 &&
    survivors.some(
      (entry) =>
        entry.index > classNameIndex &&
        entry.purity !== 'constant' &&
        !(entry.purity === 'reads' && classNamePurity !== 'unknown'),
    )

  if (dynamicProps.length) {
    if (!deps || item.data.length !== 1) return { reason: 'dynamic' }

    // Same rule as the call-site split: two halves must never produce a class for the
    // same property, and shorthand resolution is where distinct names converge.
    if (
      collides(
        staticProps,
        dynamicProps.map((prop) => prop.name),
        ctx,
      )
    )
      return { reason: 'dynamic' }

    // A prop whose class is a prefix plus its value can be lowered the way a call-site
    // property is, rather than travelling in the `css()` call. Two rules narrow it:
    //
    // A property has to be claimed by exactly one prop. Two that resolve to the same one
    // — `mx` and `marginInline` — are last-wins inside a single `css()` object, and
    // lowering either would emit both classes instead.
    const resolveProp = (name: string) => (ctx.utility.hasShorthand ? ctx.utility.resolveShorthand(name) : name)
    const claimed = new Map<string, number>()
    for (const prop of dynamicProps) claimed.set(resolveProp(prop.name), (claimed.get(resolveProp(prop.name)) ?? 0) + 1)

    const prefixes = new Map<string, string>()
    for (const prop of dynamicProps) {
      if (claimed.get(resolveProp(prop.name)) !== 1) continue
      if (isWrittenAsCollection(prop.expression)) continue
      const prefix = leafPrefix(prop.name, ctx, runtimeCss)
      if (prefix !== undefined) prefixes.set(prop.name, prefix)
    }

    // And they must not interleave with what stays behind. Each prop's expression runs
    // where it is written, so the lowered ones can sit before the call or after it, but
    // splitting the residue into two `css()` calls around them would turn one last-wins
    // merge into two independent ones.
    const kinds = dynamicProps.map((prop) => (prefixes.has(prop.name) ? 'l' : 'r')).join('')
    if (!/^l*r*$/.test(kinds) && !/^r*l*$/.test(kinds)) prefixes.clear()

    if (reordered()) return { reason: 'dynamic' }

    const helpers = resolveCssHelpers(
      node,
      deps.isBambooCssModule,
      deps.isGeneratedCssModule,
      deps.isShadowed,
      prefixes.size > 0,
    )
    if (!helpers) return { reason: 'dynamic' }
    if (!helpers.leaf) prefixes.clear()

    const staticStyles: Dict = {}
    for (const name of staticProps) staticStyles[name] = styles[name]

    const resolved = [runtimeCss(staticStyles), staticClassName].filter(Boolean).join(' ')

    const lowered = dynamicProps
      .filter((prop) => prefixes.has(prop.name))
      .map((prop) => leafCall(prefixes.get(prop.name)!, prop.name, prop.text, helpers.leaf))
    const residue = dynamicProps.filter((prop) => !prefixes.has(prop.name))
    const runtime = residue.length
      ? [`${helpers.css}({ ${residue.map((prop) => `${prop.name}: ${prop.text}`).join(', ')} })`]
      : []

    // Nothing to hoist and nothing lowered means the split would emit the same `css()`
    // call inside a `cx()`, so the element keeps its factory. One lowered prop is enough
    // to be worth it even with no static half: the factory layer goes with it.
    if (!resolved && !lowered.length) return { reason: 'dynamic' }

    const ordered = kinds.startsWith('r') ? [...runtime, ...lowered] : [...lowered, ...runtime]
    const parts = dynamicClassName ? [...ordered, dynamicClassName] : ordered
    const plan = buildEdits(
      node,
      tag,
      passthrough,
      resolved,
      `${helpers.cx}(${[...(resolved ? [JSON.stringify(resolved)] : []), ...parts].join(', ')})`,
    )

    return 'reason' in plan ? plan : { ...plan, insert: helpers.insert }
  }

  // `item.data` is `[...conditions, raw, ...spreadConditions]`, so more than one entry
  // means a ternary is present and `data[0]` is a branch projection rather than the props
  // as written. Folding the whole element from that collapses it to one branch.
  if (item.data.length !== 1) return { reason: 'dynamic' }

  const className = [runtimeCss(styles), staticClassName].filter(Boolean).join(' ')

  if (dynamicClassName) {
    // Same rule as the split path: it is emitted last, so nothing written after it may
    // still be an expression — including a passthrough prop, which keeps its own place
    // among the attributes and would then run first.
    if (reordered()) return { reason: 'dynamic' }

    const helpers = deps && resolveCssHelpers(node, deps.isBambooCssModule, deps.isGeneratedCssModule, deps.isShadowed)
    if (!helpers) return { reason: 'dynamic' }

    const args = [...(className ? [JSON.stringify(className)] : []), dynamicClassName]
    const plan = buildEdits(node, tag, passthrough, className, `${helpers.cx}(${args.join(', ')})`)
    return 'reason' in plan ? plan : { ...plan, insert: helpers.insert }
  }

  if (!className) return { reason: 'dynamic' }

  return buildEdits(node, tag, passthrough, className)
}

/** Rewrite the opening element, and the closing one when there is a pair. */
const buildEdits = (
  node: Node,
  tag: string,
  passthrough: string[],
  className: string,
  /** Expression for the `className` attribute, when it is not a plain literal. */
  classExpression?: string,
): JsxFoldPlan | { reason: JsxSkipReason } => {
  const attributes = [...passthrough, `className={${classExpression ?? JSON.stringify(className)}}`].join(' ')
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
