import { createRule } from '../utils';
import { compositeProperties } from '../utils/composite-properties';
import {
  isBambooAttribute,
  isBambooProp as isBambooProperty,
  isRecipeVariant,
  isValidProperty,
  resolveLonghand,
} from '../utils/helpers';
import { isIdentifier, isJSXIdentifier } from '../utils/nodes';
import { type TSESTree } from '@typescript-eslint/utils';

export const RULE_NAME = 'prefer-composite-properties';

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

    // Cache for composite property resolution
    const compositePropertyCache = new Map<string, string | undefined>();

    const resolveCompositeProperty = (name: string): string | undefined => {
      if (compositePropertyCache.has(name)) {
        return compositePropertyCache.get(name);
      }

      const longhand = getLonghand(name);

      if (!isValidProperty(longhand, context)) {
        compositePropertyCache.set(name, undefined);
        return undefined;
      }

      const composite = Object.keys(compositeProperties).find((cpd) =>
        compositeProperties[cpd].includes(longhand),
      );

      compositePropertyCache.set(name, composite);
      return composite;
    };

    // Caches for helper functions
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

    const sendReport = (
      node: TSESTree.Identifier | TSESTree.JSXIdentifier,
      composite: string,
    ) => {
      if (whitelist.includes(node.name)) {
        return;
      }

      context.report({
        data: {
          atomic: node.name,
          composite,
        },
        messageId: 'composite',
        node,
      });
    };

    return {
      JSXAttribute(node: TSESTree.JSXAttribute) {
        if (!isJSXIdentifier(node.name)) {
          return;
        }

        if (!isCachedBambooProperty(node)) {
          return;
        }

        const composite = resolveCompositeProperty(node.name.name);
        if (!composite) {
          return;
        }

        sendReport(node.name, composite);
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

        const composite = resolveCompositeProperty(node.key.name);
        if (!composite) {
          return;
        }

        sendReport(node.key, composite);
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
        'Encourage the use of composite properties instead of atomic properties in the codebase.',
    },
    messages: {
      composite:
        'Use composite property instead of `{{atomic}}`. Prefer: `{{composite}}`.',
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
