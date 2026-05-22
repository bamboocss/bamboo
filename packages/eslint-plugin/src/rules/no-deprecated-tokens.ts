import { createRule } from '../utils'
import {
  getDeprecatedTokens,
  isBambooAttribute,
  isBambooProp as isBambooProperty,
  isRecipeVariant,
} from '../utils/helpers'
import { isIdentifier, isJSXExpressionContainer, isLiteral, isTemplateLiteral } from '../utils/nodes'
import { type DeprecatedToken } from '../utils/worker'
import { AST_NODE_TYPES, type TSESTree } from '@typescript-eslint/utils'
import { isNodeOfTypes } from '@typescript-eslint/utils/ast-utils'

export const RULE_NAME = 'no-deprecated-tokens'

const rule = createRule({
  create(context) {
    // Cache for deprecated tokens to avoid redundant computations
    const deprecatedTokensCache = new Map<string, DeprecatedToken[] | undefined>()

    const sendReport = (property: string, node: TSESTree.Node, value: string | undefined) => {
      if (!value) {
        return
      }

      let tokens: DeprecatedToken[] | undefined = deprecatedTokensCache.get(value)

      if (!tokens) {
        tokens = getDeprecatedTokens(property, value, context)
        deprecatedTokensCache.set(value, tokens)
      }

      if (!tokens || tokens.length === 0) {
        return
      }

      for (const token of tokens) {
        context.report({
          data: {
            category: typeof token === 'string' ? undefined : token.category,
            token: typeof token === 'string' ? token : token.value,
          },
          messageId: typeof token === 'string' ? 'noDeprecatedTokenPaths' : 'noDeprecatedTokens',
          node,
        })
      }
    }

    const handleLiteralOrTemplate = (property: string, node: TSESTree.Node | undefined) => {
      if (!node) {
        return
      }

      if (isLiteral(node)) {
        const value = node.value?.toString()
        sendReport(property, node, value)
      } else if (isTemplateLiteral(node) && node.expressions.length === 0) {
        const value = node.quasis[0].value.raw
        sendReport(property, node.quasis[0], value)
      }
    }

    return {
      JSXAttribute(node: TSESTree.JSXAttribute) {
        if (!node.value || !isBambooProperty(node, context)) {
          return
        }

        const property = node.name.name as string

        if (isLiteral(node.value)) {
          handleLiteralOrTemplate(property, node.value)
        } else if (isJSXExpressionContainer(node.value)) {
          handleLiteralOrTemplate(property, node.value.expression)
        }
      },

      Property(node: TSESTree.Property) {
        if (
          !isIdentifier(node.key) ||
          !isNodeOfTypes([AST_NODE_TYPES.Literal, AST_NODE_TYPES.TemplateLiteral])(node.value) ||
          !isBambooAttribute(node, context) ||
          isRecipeVariant(node, context)
        ) {
          return
        }

        const property = node.key.name as string

        handleLiteralOrTemplate(property, node.value)
      },
    }
  },
  defaultOptions: [],
  meta: {
    docs: {
      description: 'Disallow the use of deprecated tokens within token function syntax.',
    },
    messages: {
      noDeprecatedTokenPaths: '`{{token}}` is a deprecated token.',
      noDeprecatedTokens: '`{{token}}` is a deprecated {{category}} token.',
    },
    schema: [],
    type: 'problem',
  },
  name: RULE_NAME,
})

export default rule
