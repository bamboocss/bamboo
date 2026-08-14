import { createRule } from '../utils'
import {
  getInvalidTokens,
  getUnresolvedValueMessage,
  getTaggedTemplateCaller,
  isBambooAttribute,
  isBambooProp as isBambooProperty,
  isRecipeVariant,
  isStyledTaggedTemplate,
} from '../utils/helpers'
import { isIdentifier, isJSXExpressionContainer, isJSXIdentifier, isLiteral, isTemplateLiteral } from '../utils/nodes'
import { AST_NODE_TYPES, type TSESTree } from '@typescript-eslint/utils'
import { isNodeOfTypes } from '@typescript-eslint/utils/ast-utils'

export const RULE_NAME = 'no-invalid-token-paths'

const rule = createRule({
  create(context) {
    // Cache for invalid tokens to avoid redundant computations
    const invalidTokensCache = new Map<string, string[] | undefined>()

    const sendReport = (node: TSESTree.Node, value: string | undefined) => {
      if (!value) {
        return
      }

      let tokens: string[] | undefined = invalidTokensCache.get(value)

      if (!tokens) {
        tokens = getInvalidTokens(value, context)
        invalidTokensCache.set(value, tokens)
      }

      if (!tokens || tokens.length === 0) {
        return
      }

      for (const token of tokens) {
        context.report({
          data: { token },
          messageId: 'noInvalidTokenPaths',
          node,
        })
      }
    }

    /**
     * With the property in hand, ask the resolver the whole question.
     *
     * `getInvalidTokens` can only answer "is this dotted path a token", because that is all a
     * value tells you on its own. The property is what makes `color: 'mutedd'` decidable at all,
     * and what separates `top: 'navH'` from `animationName: 'fadeIn'` — one is a typo and the
     * other is a `<custom-ident>` the grammar asks for.
     */
    const reportUnresolved = (node: TSESTree.Node, property: string, value: string | undefined) => {
      if (!value) return
      const message = getUnresolvedValueMessage(property, value, context)
      if (message) context.report({ data: { message }, messageId: 'unresolvedValue', node })
    }

    const handleValue = (node: TSESTree.Node | undefined, property?: string) => {
      if (!node) {
        return
      }

      // Both, because they answer different questions. `sendReport` reads `token(…)` references
      // out of a composite value — `token(sizes.4000) 20px` — where the value as a whole is
      // ordinary CSS. `reportUnresolved` judges the value as a whole against the property, which
      // is the only way `color: 'mutedd'` is decidable. Neither subsumes the other.
      if (isLiteral(node)) {
        const value = node.value?.toString()
        sendReport(node, value)
        if (property) reportUnresolved(node, property, value)
      } else if (isTemplateLiteral(node) && node.expressions.length === 0) {
        const value = node.quasis[0].value.raw
        sendReport(node.quasis[0], value)
        if (property) reportUnresolved(node.quasis[0], property, value)
      }
    }

    return {
      JSXAttribute(node: TSESTree.JSXAttribute) {
        if (!node.value || !isBambooProperty(node, context)) {
          return
        }

        const property = isJSXIdentifier(node.name) ? node.name.name : undefined

        if (isLiteral(node.value)) {
          handleValue(node.value, property)
        } else if (isJSXExpressionContainer(node.value)) {
          handleValue(node.value.expression, property)
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

        handleValue(node.value, node.key.name)
      },

      TaggedTemplateExpression(node: TSESTree.TaggedTemplateExpression) {
        const caller = getTaggedTemplateCaller(node)
        if (!caller) {
          return
        }

        // Check if this is a styled template literal
        if (!isStyledTaggedTemplate(node, context)) {
          return
        }

        const quasis = node.quasi.quasis
        for (const quasi of quasis) {
          const styles = quasi.value.raw
          if (!styles) {
            continue
          }

          let tokens: string[] | undefined = invalidTokensCache.get(styles)
          if (!tokens) {
            tokens = getInvalidTokens(styles, context)
            invalidTokensCache.set(styles, tokens)
          }

          if (!tokens || tokens.length === 0) {
            continue
          }

          for (const token of tokens) {
            let index = styles.indexOf(token)

            while (index !== -1) {
              const start = quasi.range[0] + index + 1 // +1 for the backtick
              const end = start + token.length

              context.report({
                data: { token },
                loc: {
                  end: context.sourceCode.getLocFromIndex(end),
                  start: context.sourceCode.getLocFromIndex(start),
                },
                messageId: 'noInvalidTokenPaths',
              })

              // Check for other occurences of the invalid token
              index = styles.indexOf(token, index + token.length)
            }
          }
        }
      },
    }
  },
  defaultOptions: [],
  meta: {
    docs: {
      description: 'Disallow the use of invalid token paths within token function syntax.',
    },
    messages: {
      noInvalidTokenPaths: '`{{token}}` is an invalid token path.',
      // The build's own sentence, passed through rather than restated, so the editor and the
      // build cannot describe one mistake differently.
      unresolvedValue: '{{message}}',
    },
    schema: [],
    type: 'problem',
  },
  name: RULE_NAME,
})

export default rule
