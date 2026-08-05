import { createRule } from '../utils'
import { isBambooAttribute, isBambooProp as isBambooProperty, isRecipeVariant } from '../utils/helpers'
import { isIdentifier, isJSXExpressionContainer, isLiteral, isTemplateLiteral } from '../utils/nodes'
import { getArbitraryValue, parseFallbackValue } from '@bamboocss/shared'
import { type TSESTree } from '@typescript-eslint/utils'

export const RULE_NAME = 'no-escape-hatch'

const rule = createRule({
  create(context) {
    // Helper function to adjust the range for fixing (removing brackets)
    const removeBrackets = (range: readonly [number, number]) => {
      const [start, end] = range
      return [start + 1, end - 1] as const
    }

    const isEscapeHatch = (value: string) => getArbitraryValue(value) !== value.trim()

    // Function to check if a value contains escape hatch syntax
    const hasEscapeHatch = (value: string | undefined): boolean => {
      if (!value) {
        return false
      }

      // Early return if the value doesn't contain brackets
      if (!value.includes('[')) {
        return false
      }

      // A `fallback(...)` wraps its candidates, so the value as a whole never looks like an
      // escape hatch even when every candidate is one. Check them individually.
      const candidates = parseFallbackValue(value)
      if (candidates) {
        return candidates.some(isEscapeHatch)
      }

      return isEscapeHatch(value)
    }

    // Unified function to handle reporting
    const handleNodeValue = (node: TSESTree.Node, value: string) => {
      if (!hasEscapeHatch(value)) {
        return
      }

      // Stripping the outer brackets is only a fix when the whole value is the escape hatch.
      // Inside a fallback the brackets are on the candidates, and removing the first and last
      // character of the node would leave `allback(...` behind.
      if (parseFallbackValue(value)) {
        context.report({ messageId: 'escapeHatch', node })
        return
      }

      context.report({
        messageId: 'escapeHatch',
        node,
        suggest: [
          {
            fix: (fixer) => {
              return fixer.replaceTextRange(removeBrackets(node.range as [number, number]), getArbitraryValue(value))
            },
            messageId: 'remove',
          },
        ],
      })
    }

    return {
      JSXAttribute(node: TSESTree.JSXAttribute) {
        if (!node.value) {
          return
        }

        // Ensure the attribute is a Bamboo prop
        if (!isBambooProperty(node, context)) {
          return
        }

        const { value } = node

        if (isLiteral(value)) {
          const value_ = value.value?.toString() ?? ''
          handleNodeValue(value, value_)
        } else if (isJSXExpressionContainer(value)) {
          const expr = value.expression
          if (isLiteral(expr)) {
            const value_ = expr.value?.toString() ?? ''
            handleNodeValue(expr, value_)
          } else if (isTemplateLiteral(expr) && expr.expressions.length === 0) {
            const value_ = expr.quasis[0].value.raw
            handleNodeValue(expr.quasis[0], value_)
          }
        }
      },

      Property(node: TSESTree.Property) {
        if (!isIdentifier(node.key)) {
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

        const value = node.value
        if (isLiteral(value)) {
          const value_ = value.value?.toString() ?? ''
          handleNodeValue(value, value_)
        } else if (isTemplateLiteral(value) && value.expressions.length === 0) {
          const value_ = value.quasis[0].value.raw
          handleNodeValue(value.quasis[0], value_)
        }
      },
    }
  },
  defaultOptions: [],
  meta: {
    docs: {
      description: 'Prohibit the use of escape hatch syntax in the code.',
    },
    hasSuggestions: true,
    messages: {
      escapeHatch:
        'Avoid using the escape hatch [value] for undefined tokens. Define a corresponding token in your design system for better consistency and maintainability.',
      remove: 'Remove the square brackets (`[]`).',
    },
    schema: [],
    type: 'problem',
  },
  name: RULE_NAME,
})

export default rule
