import { type TSESTree } from '@typescript-eslint/utils'
import { createRule } from '../utils'
import { isValidFile } from '../utils/helpers'
import { isCallExpression, isIdentifier, isMemberExpression } from '../utils/nodes'

export const RULE_NAME = 'no-unlayered-override'

/** The call whose result is a class string built from styles this file owns. */
const STYLING_CALLS = new Set(['css', 'cva', 'sva'])

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

    /**
     * Names bound to an inline `cva`/`sva` in this file.
     *
     * These matter and an imported recipe does not: an inline recipe's output is atomic,
     * so it lands in `utilities` beside the consumer, while a config recipe imported from
     * `styled-system/recipes` is in `recipes` and loses to the consumer by layer. The two
     * are indistinguishable at the call site — `button()` either way — so the binding is
     * what tells them apart.
     */
    const localRecipes = new Set<string>()

    const isOwnStyles = (node: TSESTree.Node): boolean => {
      const name = calleeName(node)
      if (name === undefined) return false
      return STYLING_CALLS.has(name) || localRecipes.has(name)
    }

    return {
      VariableDeclarator(node: TSESTree.VariableDeclarator) {
        if (!isIdentifier(node.id) || !node.init) return
        const name = calleeName(node.init)
        if (name === 'cva' || name === 'sva') localRecipes.add(node.id.name)
      },

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
        'Declare the component styles as a config recipe so they land in `recipes`, or accept a style object and merge it with `css(base, props.css)`.',
      ].join(' '),
    },
    schema: [],
    type: 'problem',
  },
  name: RULE_NAME,
})

export default rule
