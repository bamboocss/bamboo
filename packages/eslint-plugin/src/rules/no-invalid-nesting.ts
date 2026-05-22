import { createRule } from '../utils'
import { isInJSXProp as isInJSXProperty, isInBambooFunction, isRecipeVariant, isStyledProperty } from '../utils/helpers'
import { isLiteral, isTemplateLiteral } from '../utils/nodes'
import { type TSESTree } from '@typescript-eslint/utils'

export const RULE_NAME = 'no-invalid-nesting'

const rule = createRule({
  create(context) {
    // Caches for helper functions
    const bambooFunctionCache = new WeakMap<TSESTree.Property, boolean | undefined>()
    const jsxPropertyCache = new WeakMap<TSESTree.Property, boolean | undefined>()
    const recipeVariantCache = new WeakMap<TSESTree.Property, boolean | undefined>()
    const styledPropertyCache = new WeakMap<TSESTree.Property, boolean | undefined>()

    // Cached helper functions
    const isCachedInBambooFunction = (node: TSESTree.Property): boolean => {
      if (bambooFunctionCache.has(node)) {
        return bambooFunctionCache.get(node)!
      }

      const result = Boolean(isInBambooFunction(node, context))
      bambooFunctionCache.set(node, result)
      return Boolean(result)
    }

    const isCachedInJSXProperty = (node: TSESTree.Property): boolean => {
      if (jsxPropertyCache.has(node)) {
        return jsxPropertyCache.get(node)!
      }

      const result = isInJSXProperty(node, context)
      jsxPropertyCache.set(node, result)
      return Boolean(result)
    }

    const isCachedRecipeVariant = (node: TSESTree.Property): boolean => {
      if (recipeVariantCache.has(node)) {
        return recipeVariantCache.get(node)!
      }

      const result = isRecipeVariant(node, context)
      recipeVariantCache.set(node, result)
      return Boolean(result)
    }

    const isCachedStyledProperty = (node: TSESTree.Property): boolean => {
      if (styledPropertyCache.has(node)) {
        return styledPropertyCache.get(node)!
      }

      const result = isStyledProperty(node, context)
      styledPropertyCache.set(node, result)
      return Boolean(result)
    }

    // Function to check if a key is an invalid nesting selector
    const isInvalidNestingSelector = (node: TSESTree.Expression): boolean => {
      if (isLiteral(node) && typeof node.value === 'string') {
        return !node.value.includes('&')
      } else if (isTemplateLiteral(node) && node.expressions.length === 0) {
        return !node.quasis[0].value.raw.includes('&')
      }

      return false
    }

    return {
      // Use AST selector to target Property nodes with non-Identifier keys whose value is an ObjectExpression
      'Property[key.type!=/Identifier/][value.type="ObjectExpression"]'(node: TSESTree.Property) {
        // Check if the node is within a Bamboo function or JSX prop
        const inBambooFunction = isCachedInBambooFunction(node)
        const inJSXProperty = isCachedInJSXProperty(node)

        if (!inBambooFunction && !inJSXProperty) {
          return
        }

        if (isCachedRecipeVariant(node)) {
          return
        }

        if (isCachedStyledProperty(node)) {
          return
        }

        const keyNode = node.key

        if (isInvalidNestingSelector(keyNode)) {
          context.report({
            messageId: 'nesting',
            node: keyNode,
          })
        }
      },
    }
  },
  defaultOptions: [],
  meta: {
    docs: {
      description: 'Warn against invalid nesting. Nested styles must contain the `&` character.',
    },
    messages: {
      nesting: 'Invalid style nesting. Nested styles must contain the `&` character.',
    },
    schema: [],
    type: 'problem',
  },
  name: RULE_NAME,
})

export default rule
