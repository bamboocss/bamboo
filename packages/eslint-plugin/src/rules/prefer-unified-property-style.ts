import { createRule } from '../utils'
import { compositeProperties } from '../utils/composite-properties'
import {
  isBambooAttribute,
  isBambooProp as isBambooProperty,
  isRecipeVariant,
  isValidProperty,
  resolveLonghand,
} from '../utils/helpers'
import { isIdentifier, isJSXIdentifier, isJSXOpeningElement, isObjectExpression } from '../utils/nodes'
import { type TSESTree } from '@typescript-eslint/utils'

export const RULE_NAME = 'prefer-unified-property-style'

const rule = createRule({
  create(context) {
    // Cache for resolved longhand properties
    const longhandCache = new Map<string, string>()

    const getLonghand = (name: string): string => {
      if (longhandCache.has(name)) {
        return longhandCache.get(name)!
      }

      const longhand = resolveLonghand(name, context) ?? name
      longhandCache.set(name, longhand)
      return longhand
    }

    // Cache for composite property resolution
    const compositePropertyCache = new Map<string, string | undefined>()

    const resolveCompositeProperty = (name: string): string | undefined => {
      if (compositePropertyCache.has(name)) {
        return compositePropertyCache.get(name)
      }

      if (name in compositeProperties) {
        compositePropertyCache.set(name, name)
        return name
      }

      const longhand = getLonghand(name)
      if (isValidProperty(longhand, context) && longhand in compositeProperties) {
        compositePropertyCache.set(name, longhand)
        return longhand
      }

      compositePropertyCache.set(name, undefined)
      return undefined
    }

    // Caches for helper functions
    const bambooPropertyCache = new WeakMap<TSESTree.JSXAttribute, boolean | undefined>()
    const isCachedBambooProperty = (node: TSESTree.JSXAttribute): boolean => {
      if (bambooPropertyCache.has(node)) {
        return bambooPropertyCache.get(node)!
      }

      const result = isBambooProperty(node, context)
      bambooPropertyCache.set(node, result)
      return Boolean(result)
    }

    const bambooAttributeCache = new WeakMap<TSESTree.Property, boolean | undefined>()
    const isCachedBambooAttribute = (node: TSESTree.Property): boolean => {
      if (bambooAttributeCache.has(node)) {
        return bambooAttributeCache.get(node)!
      }

      const result = isBambooAttribute(node, context)
      bambooAttributeCache.set(node, result)
      return Boolean(result)
    }

    const recipeVariantCache = new WeakMap<TSESTree.Property, boolean | undefined>()
    const isCachedRecipeVariant = (node: TSESTree.Property): boolean => {
      if (recipeVariantCache.has(node)) {
        return recipeVariantCache.get(node)!
      }

      const result = isRecipeVariant(node, context)
      recipeVariantCache.set(node, result)
      return Boolean(result)
    }

    const sendReport = (node: TSESTree.Node, composite: string, siblings: string[]) => {
      const atomicPropertiesSet = new Set(
        siblings.filter((property) => compositeProperties[composite].includes(getLonghand(property))),
      )

      if (atomicPropertiesSet.size === 0) {
        return
      }

      const atomicProperties = Array.from(atomicPropertiesSet)
        .map((property) => `\`${property}\``)
        .join(', ')

      const atomics = compositeProperties[composite].map((name) => `\`${name}\``).join(', ')

      context.report({
        data: {
          atomicProperties,
          atomics,
          composite,
        },
        messageId: 'unify',
        node,
      })
    }

    return {
      JSXAttribute(node: TSESTree.JSXAttribute) {
        if (!isJSXIdentifier(node.name)) {
          return
        }

        if (!isCachedBambooProperty(node)) {
          return
        }

        const composite = resolveCompositeProperty(node.name.name)
        if (!composite) {
          return
        }

        if (!isJSXOpeningElement(node.parent)) {
          return
        }

        const siblings = node.parent.attributes.map((attribute: any) => attribute.name.name)

        sendReport(node, composite, siblings)
      },

      Property(node: TSESTree.Property) {
        if (!isIdentifier(node.key)) {
          return
        }

        if (!isCachedBambooAttribute(node)) {
          return
        }

        if (isCachedRecipeVariant(node)) {
          return
        }

        const composite = resolveCompositeProperty(node.key.name)
        if (!composite) {
          return
        }

        if (!isObjectExpression(node.parent)) {
          return
        }

        const siblings = node.parent.properties
          .filter((property): property is TSESTree.Property => property.type === 'Property')
          .map((property) => (isIdentifier(property.key) ? property.key.name : ''))

        sendReport(node.key, composite, siblings)
      },
    }
  },
  defaultOptions: [],
  meta: {
    docs: {
      description:
        'Discourage mixing atomic and composite forms of the same property in a style declaration. Atomic styles give more consistent results.',
    },
    messages: {
      unify:
        "You're mixing atomic {{atomicProperties}} with composite property `{{composite}}`. Prefer atomic styling to mixing atomic and composite properties. Remove `{{composite}}` and use one or more of {{atomics}} instead.",
    },
    schema: [],
    type: 'suggestion',
  },
  name: RULE_NAME,
})

export default rule
