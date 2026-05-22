import { createRule } from '../utils'
import { isBambooAttribute, isBambooProp as isBambooProperty, isRecipeVariant } from '../utils/helpers'
import { isJSXExpressionContainer, isObjectExpression } from '../utils/nodes'
import { type TSESTree } from '@typescript-eslint/utils'

export const RULE_NAME = 'no-debug'

const rule = createRule({
  create(context) {
    // Track processed nodes to avoid duplicate reports
    const processedNodes = new WeakSet<TSESTree.Node>()

    const checkObjectForDebug = (object: TSESTree.ObjectExpression) => {
      for (const property of object.properties) {
        if (property.type !== 'Property') {
          continue
        }

        if (!property.key || property.key.type !== 'Identifier') {
          continue
        }

        // Check for debug property
        if (property.key.name === 'debug') {
          if (processedNodes.has(property)) {
            continue
          }

          processedNodes.add(property)

          context.report({
            messageId: 'debug',
            node: property.key,
            suggest: [
              {
                fix: (fixer) => fixer.removeRange([property.range[0], property.range[1] + 1]),
                messageId: 'property',
              },
            ],
          })
        }

        // Check nested objects (for pseudo selectors like &:hover)
        if (property.value && property.value.type === 'ObjectExpression') {
          checkObjectForDebug(property.value)
        }
      }
    }

    return {
      // Handle JSX attributes with object values (_hover, css, etc.)
      JSXAttribute(node: TSESTree.JSXAttribute) {
        if (!isBambooProperty(node, context)) {
          return
        }

        // Skip non-object values
        if (!node.value || !isJSXExpressionContainer(node.value)) {
          return
        }

        const expr = node.value.expression
        if (!isObjectExpression(expr)) {
          return
        }

        // Check for debug in the object
        checkObjectForDebug(expr)
      },

      // Handle JSX debug attribute directly on Bamboo components
      'JSXAttribute[name.name="debug"]'(node: TSESTree.JSXAttribute) {
        if (!isBambooProperty(node, context)) {
          return
        }

        context.report({
          messageId: 'debug',
          node,
          suggest: [
            {
              fix: (fixer) => fixer.remove(node),
              messageId: 'prop',
            },
          ],
        })
      },

      // Handle debug property in objects (css, styled, etc.)
      'Property[key.name="debug"]'(node: TSESTree.Property) {
        // Skip if already processed
        if (processedNodes.has(node)) {
          return
        }

        // Ensure the property is a Bamboo attribute
        if (!isBambooAttribute(node, context)) {
          return
        }

        // Exclude recipe variants
        if (isRecipeVariant(node, context)) {
          return
        }

        processedNodes.add(node)

        context.report({
          messageId: 'debug',
          node: node.key,
          suggest: [
            {
              fix: (fixer) => fixer.removeRange([node.range[0], node.range[1] + 1]),
              messageId: 'property',
            },
          ],
        })
      },
    }
  },
  defaultOptions: [],
  meta: {
    docs: {
      description: 'Disallow the inclusion of the debug attribute when shipping code to the production environment.',
    },
    hasSuggestions: true,
    messages: {
      debug: 'Unnecessary debug utility.',
      prop: 'Remove the debug prop.',
      property: 'Remove the debug property.',
    },
    schema: [],
    type: 'problem',
  },
  name: RULE_NAME,
})

export default rule
