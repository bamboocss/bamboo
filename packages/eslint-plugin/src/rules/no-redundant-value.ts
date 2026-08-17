import { type TSESTree } from '@typescript-eslint/utils'
import { createRule } from '../utils'
import { isBambooAttribute, isBambooProp as isBambooProperty, isRecipeVariant } from '../utils/helpers'
import { isIdentifier, isJSXExpressionContainer, isJSXIdentifier, isLiteral, isTemplateLiteral } from '../utils/nodes'

export const RULE_NAME = 'no-redundant-value'

/**
 * Properties whose value is 1-4 edges in the order top, right, bottom, left, and which therefore
 * collapse by the same rule: four equal edges are one value, a matching pair is two, a matching
 * left and right is three.
 *
 * An allowlist rather than a shape test, because "several lengths separated by spaces" is not
 * enough to know the collapse is sound. `background-position: 0 0` is left-top and `0` is
 * left-centre — same shape, different meaning. Every entry here is a box-edge property where the
 * CSS specification defines the omitted values as copies of the ones given.
 *
 * Bamboo's own shorthands are listed beside the css names they map to, since a project may write
 * either.
 */
const EDGE_PROPERTIES = new Set([
  'borderColor',
  'borderStyle',
  'borderWidth',
  'inset',
  'm',
  'margin',
  'p',
  'padding',
  'scrollMargin',
  'scrollPadding',
])

/**
 * Properties taking one or two values, where a repeated pair collapses to a single value.
 *
 * `gap: 8px 8px` is row then column, and one value sets both — the two-value case of the same
 * idea, kept separate because the four-edge collapse does not apply.
 */
const PAIR_PROPERTIES = new Set(['gap', 'gridGap', 'overflow', 'overscrollBehavior'])

/** Splits on whitespace, but never inside `var(...)`, `calc(...)` or any other function. */
const parts = (value: string): string[] | undefined => {
  const out: string[] = []
  let depth = 0
  let current = ''

  for (const char of value) {
    if (char === '(') depth++
    if (char === ')') depth--
    if (depth === 0 && /\s/.test(char)) {
      if (current) out.push(current)
      current = ''
      continue
    }
    current += char
  }
  if (current) out.push(current)

  return depth === 0 ? out : undefined
}

/**
 * Zero with a unit, written as plain zero.
 *
 * Every property this rule touches takes lengths, and a zero length is the same zero whatever
 * unit it carries — including `0%`, which resolves against the containing block to the same
 * place. Worth doing before the collapse rather than instead of it: `16px 0` and `16px 0px` are
 * one atom apart on their own, and normalizing first is what lets `0px 16px 0px 16px` reach
 * `0 16px`.
 */
const ZERO = /^0(?:px|rem|em|%|vh|vw|vmin|vmax|pt|pc|in|cm|mm|ex|ch)$/i

/** The shortest spelling of an edge list that sets the same four edges. */
const collapseEdges = (list: string[]): string[] => {
  const [top, right = top, bottom = top, left = right] = list
  if (top === bottom && right === left) return top === right ? [top] : [top, right]
  if (right === left) return [top, right, bottom]
  return [top, right, bottom, left]
}

const rule = createRule({
  create(context) {
    const whitelist: string[] = context.options[0]?.whitelist ?? []

    const shortest = (property: string, value: string): string | undefined => {
      const isEdge = EDGE_PROPERTIES.has(property)
      if (!isEdge && !PAIR_PROPERTIES.has(property)) return

      const raw = parts(value)
      // An unbalanced parenthesis means this is not a value we parsed, so it declines rather
      // than guessing at a shape it does not understand.
      if (!raw) return

      const list = raw.map((part) => (ZERO.test(part) ? '0' : part))

      if (isEdge) {
        if (list.length > 4) return
        const shorter = (list.length > 1 ? collapseEdges(list) : list).join(' ')
        return shorter === value ? undefined : shorter
      }

      const shorter = list.length === 2 && list[0] === list[1] ? list[0] : list.join(' ')
      return shorter === value ? undefined : shorter
    }

    const check = (node: TSESTree.Node, property: string, value: string) => {
      if (whitelist.includes(property)) return

      const replacement = shortest(property, value)
      if (!replacement || replacement === value) return

      const data = { property, replacement, value }

      context.report({
        data,
        messageId: 'redundant',
        node,
        suggest: [
          {
            data,
            // The quote style is taken from the source rather than assumed, so a fix does not
            // rewrite `'…'` as `"…"` and fight the formatter.
            fix: (fixer) => {
              const text = context.sourceCode.getText(node)
              const quote = text.at(0) === '`' || text.at(0) === '"' || text.at(0) === "'" ? text.at(0) : "'"
              return fixer.replaceText(node, `${quote}${replacement}${quote}`)
            },
            messageId: 'replace',
          },
        ],
      })
    }

    return {
      JSXAttribute(node: TSESTree.JSXAttribute) {
        if (!isJSXIdentifier(node.name)) return
        if (!isBambooProperty(node, context) || !node.value) return

        const property = node.name.name
        const valueNode = node.value

        if (isLiteral(valueNode)) {
          check(valueNode, property, valueNode.value?.toString() ?? '')
          return
        }

        if (!isJSXExpressionContainer(valueNode)) return
        const expression = valueNode.expression

        if (isLiteral(expression)) check(expression, property, expression.value?.toString() ?? '')
        else if (isTemplateLiteral(expression) && expression.expressions.length === 0) {
          check(expression, property, expression.quasis[0].value.raw)
        }
      },

      Property(node: TSESTree.Property) {
        if (!isIdentifier(node.key)) return
        if (!isBambooAttribute(node, context)) return
        if (isRecipeVariant(node, context)) return

        const property = node.key.name
        const valueNode = node.value

        if (isLiteral(valueNode)) check(valueNode, property, valueNode.value?.toString() ?? '')
        else if (isTemplateLiteral(valueNode) && valueNode.expressions.length === 0) {
          check(valueNode, property, valueNode.quasis[0].value.raw)
        }
      },
    }
  },
  defaultOptions: [
    {
      whitelist: [],
    },
  ],
  meta: {
    docs: {
      description:
        'Report an edge or pair value written longer than it needs to be, where a shorter spelling sets exactly the same properties.',
    },
    hasSuggestions: true,
    messages: {
      redundant: '`{{value}}` sets the same edges as `{{replacement}}`.',
      replace: 'Replace `{{value}}` with `{{replacement}}`.',
    },
    schema: [
      {
        additionalProperties: false,
        properties: {
          whitelist: {
            items: {
              minLength: 0,
              type: 'string',
            },
            type: 'array',
            uniqueItems: true,
          },
        },
        type: 'object',
      },
    ],
    type: 'suggestion',
  },
  name: RULE_NAME,
})

export default rule
