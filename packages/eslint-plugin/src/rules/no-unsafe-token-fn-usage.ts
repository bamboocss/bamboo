import { createRule } from '../utils';
import {
  extractTokens,
  getTokenImport,
  isBambooAttribute,
  isBambooProp as isBambooProperty,
  isRecipeVariant,
} from '../utils/helpers';
import {
  isCallExpression,
  isIdentifier,
  isJSXExpressionContainer,
  isLiteral,
  isTemplateLiteral,
} from '../utils/nodes';
import { getArbitraryValue } from '@bamboocss/shared';
import { type TSESTree } from '@typescript-eslint/utils';

export const RULE_NAME = 'no-unsafe-token-fn-usage';

const rule = createRule({
  create(context) {
    // Cache for getTokenImport result
    let tokenImportCache: null | undefined | { alias: string };

    const getCachedTokenImport = (): null | undefined | { alias: string } => {
      if (tokenImportCache !== undefined) {
        return tokenImportCache;
      }

      tokenImportCache = getTokenImport(context);
      return tokenImportCache;
    };

    const isUnsafeCallExpression = (node: TSESTree.CallExpression): boolean => {
      const tkImport = getCachedTokenImport();
      return isIdentifier(node.callee) && node.callee.name === tkImport?.alias;
    };

    const tokenWrap = (value?: string): string =>
      value ? `token(${value})` : '';

    const isCompositeValue = (input?: string): boolean => {
      if (!input) {
        return false;
      }

      // Regular expression to match token-only values, e.g., token('space.2') or {space.2}
      const tokenRegex = /^(?:token\([^)]*\)|\{[^}]*\})$/;
      return !tokenRegex.test(input);
    };

    const sendReport = (node: TSESTree.Node, value: string) => {
      const tkImports = extractTokens(value);
      if (!tkImports.length) {
        return;
      }

      const token = tkImports[0].replace(/^[^.]*\./, '');

      context.report({
        messageId: 'noUnsafeTokenFnUsage',
        node,
        suggest: [
          {
            data: { safe: token },
            fix: (fixer) => fixer.replaceText(node, `'${token}'`),
            messageId: 'replace',
          },
        ],
      });
    };

    const handleRuntimeFunction = (node: TSESTree.Node) => {
      if (!isCallExpression(node)) {
        return;
      }

      if (!isUnsafeCallExpression(node)) {
        return;
      }

      const value = node.arguments[0];

      if (isLiteral(value)) {
        const value_ = getArbitraryValue(value.value?.toString() ?? '');
        sendReport(node, tokenWrap(value_));
      } else if (isTemplateLiteral(value) && value.expressions.length === 0) {
        const value_ = getArbitraryValue(value.quasis[0].value.raw);
        sendReport(node, tokenWrap(value_));
      }
    };

    const handleLiteral = (node: TSESTree.Node) => {
      if (!isLiteral(node)) {
        return;
      }

      const value = getArbitraryValue(node.value?.toString() ?? '');
      if (isCompositeValue(value)) {
        return;
      }

      sendReport(node, value);
    };

    const handleTemplateLiteral = (node: TSESTree.Node) => {
      if (!isTemplateLiteral(node) || node.expressions.length > 0) {
        return;
      }

      const value = getArbitraryValue(node.quasis[0].value.raw);
      if (isCompositeValue(value)) {
        return;
      }

      sendReport(node, value);
    };

    // Cached versions of helper functions
    const bambooPropertyCache = new WeakMap<
      TSESTree.JSXAttribute,
      boolean | undefined
    >();
    const isCachedBambooProperty = (node: TSESTree.JSXAttribute): boolean => {
      if (bambooPropertyCache.has(node)) {
        return bambooPropertyCache.get(node)!;
      }

      const result = isBambooProperty(node, context);
      bambooPropertyCache.set(node, result);
      return Boolean(result);
    };

    const bambooAttributeCache = new WeakMap<
      TSESTree.Property,
      boolean | undefined
    >();
    const isCachedBambooAttribute = (node: TSESTree.Property): boolean => {
      if (bambooAttributeCache.has(node)) {
        return bambooAttributeCache.get(node)!;
      }

      const result = isBambooAttribute(node, context);
      bambooAttributeCache.set(node, result);
      return Boolean(result);
    };

    const recipeVariantCache = new WeakMap<
      TSESTree.Property,
      boolean | undefined
    >();
    const isCachedRecipeVariant = (node: TSESTree.Property): boolean => {
      if (recipeVariantCache.has(node)) {
        return recipeVariantCache.get(node)!;
      }

      const result = isRecipeVariant(node, context);
      recipeVariantCache.set(node, result);
      return Boolean(result);
    };

    return {
      JSXAttribute(node: TSESTree.JSXAttribute) {
        if (!node.value) {
          return;
        }

        if (!isCachedBambooProperty(node)) {
          return;
        }

        handleLiteral(node.value);

        if (isJSXExpressionContainer(node.value)) {
          const expression = node.value.expression;
          handleLiteral(expression);
          handleTemplateLiteral(expression);
          handleRuntimeFunction(expression);
        }
      },

      Property(node: TSESTree.Property) {
        if (!isCachedBambooAttribute(node)) {
          return;
        }

        if (isCachedRecipeVariant(node)) {
          return;
        }

        const valueNode = node.value;

        if (
          isCallExpression(valueNode) ||
          isLiteral(valueNode) ||
          isTemplateLiteral(valueNode)
        ) {
          handleRuntimeFunction(valueNode);
          handleLiteral(valueNode);
          handleTemplateLiteral(valueNode);
        }
      },
    };
  },
  defaultOptions: [],
  meta: {
    docs: {
      description:
        'Prevent users from using the token function in situations where they could simply use the raw design token.',
    },
    hasSuggestions: true,
    messages: {
      noUnsafeTokenFnUsage:
        'Unnecessary token function usage. Prefer design token.',
      replace: 'Replace token function with `{{safe}}`.',
    },
    schema: [],
    type: 'suggestion',
  },
  name: RULE_NAME,
});

export default rule;
