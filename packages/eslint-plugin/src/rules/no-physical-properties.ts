import { createRule } from '../utils';
import {
  isBambooAttribute,
  isBambooProp as isBambooProperty,
  isRecipeVariant,
  resolveLonghand,
} from '../utils/helpers';
import {
  isIdentifier,
  isJSXExpressionContainer,
  isJSXIdentifier,
  isLiteral,
} from '../utils/nodes';
import {
  physicalProperties,
  physicalPropertyValues,
} from '../utils/physical-properties';
import { type TSESLint, type TSESTree } from '@typescript-eslint/utils';

type CacheMap<K extends object, V> = WeakMap<K, undefined | V>;
type IdentifierNode = TSESTree.Identifier | TSESTree.JSXIdentifier;
type RuleContextType = TSESLint.RuleContext<
  keyof typeof MESSAGES,
  [{ whitelist: string[] }]
>;
type ValueNode = TSESTree.JSXAttribute['value'] | TSESTree.Property['value'];

export const RULE_NAME = 'no-physical-properties';

const MESSAGES = {
  physical:
    'Use logical property instead of {{physical}}. Prefer `{{logical}}`.',
  physicalValue:
    'Use logical value instead of {{physical}}. Prefer `{{logical}}`.',
  replace: 'Replace `{{physical}}` with `{{logical}}`.',
} as const;

class PropertyCache {
  private longhandCache = new Map<string, string>();

  private bambooAttributeCache: CacheMap<TSESTree.Property, boolean> =
    new WeakMap();

  private bambooPropCache: CacheMap<TSESTree.JSXAttribute, boolean> =
    new WeakMap();

  private recipeVariantCache: CacheMap<TSESTree.Property, boolean> =
    new WeakMap();

  getLonghand(name: string, context: RuleContextType): string {
    if (this.longhandCache.has(name)) {
      return this.longhandCache.get(name)!;
    }

    const longhand = resolveLonghand(name, context) ?? name;
    this.longhandCache.set(name, longhand);
    return longhand;
  }

  isBambooAttribute(node: TSESTree.Property, context: RuleContextType): boolean {
    if (this.bambooAttributeCache.has(node)) {
      return this.bambooAttributeCache.get(node)!;
    }

    const result = isBambooAttribute(node, context);
    this.bambooAttributeCache.set(node, result);
    return Boolean(result);
  }

  isBambooProp(node: TSESTree.JSXAttribute, context: RuleContextType): boolean {
    if (this.bambooPropCache.has(node)) {
      return this.bambooPropCache.get(node)!;
    }

    const result = isBambooProperty(node, context);
    this.bambooPropCache.set(node, result);
    return Boolean(result);
  }

  isRecipeVariant(node: TSESTree.Property, context: RuleContextType): boolean {
    if (this.recipeVariantCache.has(node)) {
      return this.recipeVariantCache.get(node)!;
    }

    const result = isRecipeVariant(node, context);
    this.recipeVariantCache.set(node, result);
    return Boolean(result);
  }
}

const extractStringLiteralValue = (valueNode: ValueNode): null | string => {
  if (isLiteral(valueNode) && typeof valueNode.value === 'string') {
    return valueNode.value;
  }

  if (
    isJSXExpressionContainer(valueNode) &&
    isLiteral(valueNode.expression) &&
    typeof valueNode.expression.value === 'string'
  ) {
    return valueNode.expression.value;
  }

  return null;
};

const createPropertyReport = (
  node: IdentifierNode,
  longhandName: string,
  logical: string,
  context: RuleContextType,
) => {
  const physicalName = `\`${node.name}\`${longhandName !== node.name ? ` (resolved to \`${longhandName}\`)` : ''}`;

  context.report({
    data: { logical, physical: physicalName },
    messageId: 'physical',
    node,
    suggest: [
      {
        data: { logical, physical: node.name },
        fix: (fixer: TSESLint.RuleFixer) => fixer.replaceText(node, logical),
        messageId: 'replace',
      },
    ],
  });
};

const createValueReport = (
  valueNode: NonNullable<ValueNode>,
  valueText: string,
  logical: string,
  context: RuleContextType,
) => {
  context.report({
    data: { logical: `"${logical}"`, physical: `"${valueText}"` },
    messageId: 'physicalValue',
    node: valueNode,
    suggest: [
      {
        data: { logical: `"${logical}"`, physical: `"${valueText}"` },
        fix: (fixer: TSESLint.RuleFixer) => {
          if (isLiteral(valueNode)) {
            return fixer.replaceText(valueNode, `"${logical}"`);
          }

          if (
            isJSXExpressionContainer(valueNode) &&
            isLiteral(valueNode.expression)
          ) {
            return fixer.replaceText(valueNode.expression, `"${logical}"`);
          }

          return null;
        },
        messageId: 'replace',
      },
    ],
  });
};

const rule = createRule({
  create(context) {
    const whitelist: string[] = context.options[0]?.whitelist ?? [];
    const cache = new PropertyCache();

    const checkPropertyName = (node: IdentifierNode) => {
      if (whitelist.includes(node.name)) {
        return;
      }

      const longhandName = cache.getLonghand(node.name, context);
      if (!(longhandName in physicalProperties)) {
        return;
      }

      const logical = physicalProperties[longhandName];
      createPropertyReport(node, longhandName, logical, context);
    };

    const checkPropertyValue = (
      keyNode: IdentifierNode,
      valueNode: NonNullable<ValueNode>,
    ): boolean => {
      const propertyName = keyNode.name;
      if (!(propertyName in physicalPropertyValues)) {
        return false;
      }

      const valueText = extractStringLiteralValue(valueNode);
      if (valueText === null) {
        return false;
      }

      const valueMap = physicalPropertyValues[propertyName];
      if (!valueMap[valueText]) {
        return false;
      }

      createValueReport(valueNode, valueText, valueMap[valueText], context);
      return true;
    };

    return {
      JSXAttribute(node: TSESTree.JSXAttribute) {
        if (!isJSXIdentifier(node.name)) {
          return;
        }

        if (!cache.isBambooProp(node, context)) {
          return;
        }

        checkPropertyName(node.name);
        if (node.value) {
          checkPropertyValue(node.name, node.value);
        }
      },

      Property(node: TSESTree.Property) {
        if (!isIdentifier(node.key)) {
          return;
        }

        if (!cache.isBambooAttribute(node, context)) {
          return;
        }

        if (cache.isRecipeVariant(node, context)) {
          return;
        }

        checkPropertyName(node.key);
        if (node.value) {
          checkPropertyValue(node.key, node.value);
        }
      },
    };
  },
  defaultOptions: [{ whitelist: [] }],
  meta: {
    docs: {
      description:
        'Encourage the use of logical properties over physical properties to foster a responsive and adaptable user interface.',
    },
    hasSuggestions: true,
    messages: MESSAGES,
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
