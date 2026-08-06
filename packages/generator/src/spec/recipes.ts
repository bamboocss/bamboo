import type { Context } from '@bamboocss/core'
import type { RecipeSpec } from '@bamboocss/types'
import { buildFunctionProps, formatFunctionValue } from '../shared'

const getFirstVariantValue = (variantKeyMap: Record<string, string[]>, key: string): string | null => {
  const values = variantKeyMap[key]
  return values && values.length > 0 ? values[0] : null
}

const buildVariantProps = (
  variantKeys: string[],
  variantKeyMap: Record<string, string[]>,
  formatFn: (key: string, value: string) => string,
  separator: string,
): string => {
  return variantKeys
    .map((key) => {
      const value = getFirstVariantValue(variantKeyMap, key)
      return value ? formatFn(key, value) : null
    })
    .filter(Boolean)
    .join(separator)
}

export const generateRecipesSpec = (ctx: Context): RecipeSpec => {
  const recipes = ctx.recipes.details.map((node) => {
    const recipeName = node.baseName
    const variantKeys = Object.keys(node.variantKeyMap)

    const functionExamples: string[] = []

    if (variantKeys.length === 0) {
      functionExamples.push(`${recipeName}()`)
    } else {
      // Generate examples for each variant key
      variantKeys.forEach((variantKey) => {
        const firstValue = getFirstVariantValue(node.variantKeyMap, variantKey)
        if (firstValue) {
          functionExamples.push(`${recipeName}({ ${variantKey}: ${formatFunctionValue(firstValue)} })`)
        }
      })

      // Generate an example with multiple variants if there are multiple variant keys
      if (variantKeys.length > 1) {
        const props = buildVariantProps(variantKeys, node.variantKeyMap, buildFunctionProps, ', ')

        if (props) {
          functionExamples.push(`${recipeName}({ ${props} })`)
        }
      }
    }

    return {
      name: recipeName,
      description: node.config.description,
      variants: node.variantKeyMap,
      defaultVariants: node.config.defaultVariants ?? {},
      functionExamples,
    }
  })

  return {
    type: 'recipes',
    data: recipes,
  }
}
