import { type TSESTree } from '@typescript-eslint/utils'
import { createRule } from '../utils'
import { isValidFile } from '../utils/helpers'
import { isCallExpression, isIdentifier, isMemberExpression } from '../utils/nodes'

export const RULE_NAME = 'no-unlayered-override'

/**
 * The call whose result is a class string in the `utilities` layer — the same layer a
 * consumer's `css()` is in, so neither can win over the other by cascade.
 *
 * `cva` and `sva` are deliberately absent. On the extraction path their output is named
 * semantically and emitted into `recipes`, whether they are declared inline or in
 * `theme.recipes`, so a consumer's `css()` beats them by layer. That is one of the fixes this
 * rule points at, and it would be incoherent to report it.
 *
 * Under the Vite compiler there is no `recipes` layer — selections are resolved to the same
 * global atoms `css()` uses, in `utilities` — so that fix does not apply there and the style
 * object one does. The rule cannot tell which build it is linting for, so the message names
 * both.
 */
const STYLING_CALLS = new Set(['css'])

const calleeName = (node: TSESTree.Node): string | undefined => {
  if (!isCallExpression(node)) return undefined
  if (isIdentifier(node.callee)) return node.callee.name
  // `css.raw(...)` returns an object, not a class — not this rule's business.
  if (isMemberExpression(node.callee) && isIdentifier(node.callee.property)) return undefined
  return undefined
}

/**
 * An argument the rule cannot see the styles behind: a prop, a parameter, anything whose
 * value arrives at runtime. `props.className` is the shape this exists for.
 */
const isOpaque = (node: TSESTree.Node): boolean => {
  if (isMemberExpression(node)) return true
  if (isIdentifier(node) && node.name !== 'undefined') return true
  return false
}

const rule = createRule({
  create(context) {
    if (!isValidFile(context)) return {}

    const isOwnStyles = (node: TSESTree.Node): boolean => {
      const name = calleeName(node)
      return name !== undefined && STYLING_CALLS.has(name)
    }

    return {
      CallExpression(node: TSESTree.CallExpression) {
        if (!isIdentifier(node.callee) || node.callee.name !== 'cx') return
        if (node.arguments.length < 2) return

        const own = node.arguments.find((argument) => isOwnStyles(argument as TSESTree.Node))
        if (!own) return

        const opaque = node.arguments.find((argument) => argument !== own && isOpaque(argument as TSESTree.Node))
        if (!opaque) return

        context.report({ messageId: 'unlayeredOverride', node: own })
      },
    }
  },
  defaultOptions: [],
  meta: {
    docs: {
      description:
        'Disallow joining a class this file styled with a class it cannot see, where neither can win by cascade layer.',
    },
    messages: {
      unlayeredOverride: [
        '`cx` joins class names, it does not resolve conflicts between them.',
        'These styles and the ones being joined are both in the `utilities` layer, so which applies is decided by stylesheet order rather than by the caller.',
        'Accept a style object and merge it with `css(base, props.css)`, which resolves per property in every build — or, on the extraction path only, declare the component styles with `cva` so they land in the `recipes` layer.',
      ].join(' '),
    },
    schema: [],
    type: 'problem',
  },
  name: RULE_NAME,
})

export default rule
