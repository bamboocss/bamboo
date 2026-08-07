import { type TSESTree } from '@typescript-eslint/utils'
import { createRule } from '../utils'
import { isValidFile } from '../utils/helpers'
import { isIdentifier } from '../utils/nodes'

export const RULE_NAME = 'require-recipe-class-name'

const RECIPE_CALLS = new Set(['cva', 'sva'])

/**
 * A property whose value the build reads as written, so the config it hashes is the config
 * the browser holds.
 *
 * Deliberately narrow. A spread, a computed key, a call — anything the extractor might not
 * resolve — makes the config's *content* uncertain, and the content is what the name is
 * derived from.
 */
const isStatic = (node: TSESTree.Node): boolean => {
  switch (node.type) {
    case 'Literal':
      return true
    case 'TemplateLiteral':
      return node.expressions.length === 0
    case 'TSAsExpression':
    case 'TSSatisfiesExpression':
    case 'TSNonNullExpression':
      return isStatic(node.expression)
    case 'ArrayExpression':
      return node.elements.every((element) => element !== null && isStatic(element))
    case 'ObjectExpression':
      return node.properties.every((property) => {
        if (property.type !== 'Property' || property.computed) return false
        return isStatic(property.value as TSESTree.Node)
      })
    default:
      return false
  }
}

const rule = createRule({
  create(context) {
    if (!isValidFile(context)) return {}

    const mode = (context.options[0]?.mode ?? 'always') as 'always' | 'dynamic-only'

    return {
      CallExpression(node: TSESTree.CallExpression) {
        if (!isIdentifier(node.callee) || !RECIPE_CALLS.has(node.callee.name)) return

        const config = node.arguments[0]
        if (!config) return

        const unwrapped =
          config.type === 'TSAsExpression' || config.type === 'TSSatisfiesExpression'
            ? config.expression
            : (config as TSESTree.Node)

        // Already named, so its identity does not depend on what the build could read.
        if (unwrapped.type === 'ObjectExpression') {
          const named = unwrapped.properties.some(
            (property) =>
              property.type === 'Property' &&
              !property.computed &&
              ((property.key.type === 'Identifier' && property.key.name === 'className') ||
                (property.key.type === 'Literal' && property.key.value === 'className')) &&
              property.value.type === 'Literal' &&
              typeof property.value.value === 'string' &&
              property.value.value !== '',
          )
          if (named) return

          if (mode === 'dynamic-only' && isStatic(unwrapped)) return
        }

        context.report({ messageId: 'requireRecipeClassName', node: node.callee })
      },
    }
  },
  defaultOptions: [{ mode: 'always' }],
  meta: {
    docs: {
      description: 'Require a `className` on a recipe, so its class names do not depend on what the build could read.',
    },
    messages: {
      requireRecipeClassName: [
        'This recipe has no `className`, so its classes are named by hashing its config.',
        'The build hashes the config it could read and the browser hashes the one it holds, so anything the build cannot resolve — a spread of a call, a value it cannot evaluate — gives the two different names and the element renders with no styles at all.',
        "Add `className: 'name'` to fix the name, and get readable classes with it.",
      ].join(' '),
    },
    schema: [
      {
        additionalProperties: false,
        properties: {
          mode: {
            description:
              '`always` requires a name on every recipe. `dynamic-only` requires one only where the config is not a plain static literal, which is where the failure is possible.',
            enum: ['always', 'dynamic-only'],
            type: 'string',
          },
        },
        type: 'object',
      },
    ],
    type: 'problem',
  },
  name: RULE_NAME,
})

export default rule
