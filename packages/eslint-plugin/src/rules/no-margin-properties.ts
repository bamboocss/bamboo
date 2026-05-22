import { createRule } from '../utils';
import {
  isBambooAttribute,
  isBambooProp as isBambooProperty,
  isRecipeVariant,
  resolveLonghand,
} from '../utils/helpers';
import { isIdentifier, isJSXIdentifier } from '../utils/nodes';
import { type TSESTree } from '@typescript-eslint/utils';

export const RULE_NAME = 'no-margin-properties';

const rule = createRule({
  create(context) {
    const whitelist: string[] = context.options[0]?.whitelist ?? [];

    // Cache for resolved longhand properties
    const longhandCache = new Map<string, string>();

    const getLonghand = (name: string): string => {
      if (longhandCache.has(name)) {
        return longhandCache.get(name)!;
      }

      const longhand = resolveLonghand(name, context) ?? name;
      longhandCache.set(name, longhand);
      return longhand;
    };

    const marginRegex = /margin/i;

    const isMarginProperty = (name: string): boolean => {
      const longhand = getLonghand(name).toLowerCase();
      return marginRegex.test(longhand);
    };

    const sendReport = (node: TSESTree.Identifier | TSESTree.JSXIdentifier) => {
      if (whitelist.includes(node.name)) {
        return;
      }

      if (!isMarginProperty(node.name)) {
        return;
      }

      context.report({
        messageId: 'noMargin',
        node,
      });
    };

    // Cache for helper functions
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
        if (!isJSXIdentifier(node.name)) {
          return;
        }

        if (!isCachedBambooProperty(node)) {
          return;
        }

        sendReport(node.name);
      },

      Property(node: TSESTree.Property) {
        if (!isIdentifier(node.key)) {
          return;
        }

        if (!isCachedBambooAttribute(node)) {
          return;
        }

        if (isCachedRecipeVariant(node)) {
          return;
        }

        sendReport(node.key);
      },
    };
  },
  defaultOptions: [
    {
      whitelist: [],
    },
  ],
  meta: {
    docs: {
      description:
        'Discourage using margin properties for spacing; prefer defining spacing in parent elements with `flex` or `grid` using the `gap` property for a more resilient layout. Margins make components less reusable in other contexts.',
    },
    messages: {
      noMargin:
        'Use flex or grid with the `gap` property to define spacing in parent elements for a more resilient layout.',
    },
    schema: [
      {
        additionalProperties: false,
        properties: {
          whitelist: {
            items: {
              minLength: 0,
              type: 'string',
            },
            type: 'array',
            uniqueItems: true,
          },
        },
        type: 'object',
      },
    ],
    type: 'suggestion',
  },
  name: RULE_NAME,
});

export default rule;
