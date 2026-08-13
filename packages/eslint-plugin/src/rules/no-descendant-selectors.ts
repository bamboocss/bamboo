import { type TSESTree } from '@typescript-eslint/utils'
import { createRule } from '../utils'
import { isInJSXProp as isInJSXProperty, isInBambooFunction } from '../utils/helpers'
import { isLiteral, isTemplateLiteral } from '../utils/nodes'

export const RULE_NAME = 'no-descendant-selectors'

/**
 * Split a selector on combinators that are not inside brackets, parentheses or quotes.
 *
 * `:is(p, li)` and `[data-label="a b"]` both contain characters that separate compounds
 * elsewhere, and neither is a combinator. Nesting is shallow by construction — a selector
 * cannot nest brackets inside quotes inside parentheses in a way this misreads — so a depth
 * counter is enough, and it keeps the rule free of a selector parser.
 */
const splitTopLevel = (selector: string, separators: string) => {
  const parts: string[] = []
  let depth = 0
  let quote: string | undefined
  let escaped = false
  let current = ''

  for (const character of selector) {
    // `.a\ b` is one class whose name contains a space. Reading that space as a combinator
    // would report a selector that styles the element itself.
    if (escaped) {
      escaped = false
      current += character
      continue
    }
    if (character === '\\') {
      escaped = true
      current += character
      continue
    }
    if (quote) {
      current += character
      if (character === quote) quote = undefined
      continue
    }
    if (character === '"' || character === "'") {
      quote = character
      current += character
      continue
    }
    if (character === '(' || character === '[') depth++
    // Floored, so an unbalanced closer in a malformed selector cannot leave the depth
    // negative — which would stop every separator after it from splitting anything.
    if (character === ')' || character === ']') depth = Math.max(0, depth - 1)

    if (depth === 0 && separators.includes(character)) {
      if (current.trim()) parts.push(current.trim())
      current = ''
      continue
    }
    current += character
  }

  if (current.trim()) parts.push(current.trim())
  return parts
}

/**
 * Does this selector style something other than the element the class is on?
 *
 * Decided by the **subject** — the last compound — rather than by the presence of a
 * combinator. `'.dark &'` and `'.group:hover &'` both contain one and both still style `&`
 * itself, which is how conditions are written and not what this is about. `'& p'`,
 * `'& > .card'` and `'& :is(p, li) a'` end somewhere else, and that is the case that outranks
 * whatever is applied to that element directly.
 */
const reachesAnotherElement = (selector: string) =>
  splitTopLevel(selector, ',').some((part) => {
    const compounds = splitTopLevel(part, ' \t\n>+~')
    const subject = compounds.at(-1)
    return compounds.length > 1 && subject !== undefined && !subject.includes('&')
  })

const selectorOf = (node: TSESTree.Node): string | undefined => {
  if (isLiteral(node) && typeof node.value === 'string') return node.value
  if (isTemplateLiteral(node) && node.expressions.length === 0) return node.quasis[0]?.value.raw
  return undefined
}

const rule = createRule({
  create(context) {
    return {
      // A nested selector is a string key, so `Identifier` keys — every plain property, and
      // every condition written as one — are excluded before anything else looks at them.
      'Property[key.type!=/Identifier/][value.type="ObjectExpression"]'(node: TSESTree.Property) {
        const selector = selectorOf(node.key)
        // Both tests are string work on a key this rule already has, and they run before the
        // helpers below, each of which crosses into a synckit worker to answer whether the file
        // is Bamboo's. Every `_hover: {}` and `md: {}` in a stylesheet reaches this hook.
        //
        // A nested selector must carry `&`; anything without one is a condition name, an
        // at-rule, or already reported by `no-invalid-nesting`.
        if (!selector?.includes('&')) return
        if (!reachesAnotherElement(selector)) return

        if (!isInBambooFunction(node, context) && !isInJSXProperty(node, context)) return

        context.report({ messageId: 'descendantSelector', node: node.key })
      },
    }
  },
  defaultOptions: [],
  meta: {
    docs: {
      description: 'Disallow nested selectors that style a different element than the class is applied to.',
    },
    messages: {
      descendantSelector: [
        'This styles another element, and outranks anything applied to that element directly.',
        'Cascade layers do not separate them — two `css()` calls are always in the same layer, where specificity decides, and a nested selector is more specific than a class.',
        'Style that element itself. Narrowing the selector (`& > p`) bounds what it can reach, which is worth doing, but a descendant rule still outranks a class on its target — so this rule reports it either way.',
      ].join(' '),
    },
    schema: [],
    type: 'problem',
  },
  name: RULE_NAME,
})

export default rule
