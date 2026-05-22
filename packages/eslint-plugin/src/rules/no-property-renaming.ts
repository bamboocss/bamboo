import { createRule } from '../utils';
import {
  isBambooAttribute,
  isBambooProp as isBambooProperty,
  isRecipeVariant,
} from '../utils/helpers';
import {
  isIdentifier,
  isJSXExpressionContainer,
  isMemberExpression,
} from '../utils/nodes';
import { type TSESTree } from '@typescript-eslint/utils';

export const RULE_NAME = 'no-property-renaming';

const rule = createRule({
  create(context) {
    // Caches for helper functions
    const bambooPropertyCache = new WeakMap<
      TSESTree.JSXAttribute,
      boolean | undefined
    >();
    const bambooAttributeCache = new WeakMap<
      TSESTree.Property,
      boolean | undefined
    >();
    const recipeVariantCache = new WeakMap<
      TSESTree.Property,
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

    const isCachedBambooAttribute = (node: TSESTree.Property): boolean => {
      if (bambooAttributeCache.has(node)) {
        return bambooAttributeCache.get(node)!;
      }

      const result = isBambooAttribute(node, context);
      bambooAttributeCache.set(node, result);
      return Boolean(result);
    };

    const isCachedRecipeVariant = (node: TSESTree.Property): boolean => {
      if (recipeVariantCache.has(node)) {
        return recipeVariantCache.get(node)!;
      }

      const result = isRecipeVariant(node, context);
      recipeVariantCache.set(node, result);
      return Boolean(result);
    };

    const sendReport = (
      node: TSESTree.Node,
      expected: string,
      property: string,
    ) => {
      context.report({
        data: {
          expected,
          prop: property,
        },
        messageId: 'noRenaming',
        node,
      });
    };

    const handleReport = (
      node: TSESTree.Node,
      value: TSESTree.Node,
      attribute: string,
    ) => {
      if (isIdentifier(value) && attribute !== value.name) {
        sendReport(node, attribute, value.name);
      } else if (
        isMemberExpression(value) &&
        isIdentifier(value.property) &&
        attribute !== value.property.name
      ) {
        sendReport(node, attribute, value.property.name);
      }
    };

    return {
      JSXAttribute(node: TSESTree.JSXAttribute) {
        if (!node.value) {
          return;
        }

        if (!isJSXExpressionContainer(node.value)) {
          return;
        }

        if (!isCachedBambooProperty(node)) {
          return;
        }

        const attribute = node.name.name.toString();
        const expression = node.value.expression;

        handleReport(node.value, expression, attribute);
      },

      Property(node: TSESTree.Property) {
        if (!isIdentifier(node.key)) {
          return;
        }

        if (!isIdentifier(node.value) && !isMemberExpression(node.value)) {
          return;
        }

        if (!isCachedBambooAttribute(node)) {
          return;
        }

        if (isCachedRecipeVariant(node)) {
          return;
        }

        const attribute = node.key.name;
        const value = node.value;

        handleReport(node.value, value, attribute);
      },
    };
  },
  defaultOptions: [],
  meta: {
    docs: {
      description:
        'Ensure that properties for patterns or style props are not renamed, as it prevents proper tracking.',
    },
    messages: {
      noRenaming:
        'Incoming `{{prop}}` prop is different from the expected `{{expected}}` attribute. Bamboo will not track this prop.',
    },
    schema: [],
    type: 'problem',
  },
  name: RULE_NAME,
});

export default rule;
