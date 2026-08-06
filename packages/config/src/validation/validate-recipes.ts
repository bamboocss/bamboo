import type { Config } from '@bamboocss/types'
import type { AddError, ArtifactNames, TokensData } from '../types'

interface Options {
  config: Config
  tokens: TokensData
  artifacts: ArtifactNames
  addError: AddError
}

export const validateRecipes = (options: Options) => {
  const {
    config: { theme },
    artifacts,
    addError,
  } = options

  if (!theme) return

  if (theme.recipes) {
    Object.keys(theme.recipes).forEach((recipeName) => {
      artifacts.recipes.add(recipeName)
    })
  }

  if (theme.slotRecipes) {
    Object.entries(theme.slotRecipes).forEach(([recipeName, recipe]) => {
      artifacts.slotRecipes.add(recipeName)

      // A `scopeRoot` naming a slot the recipe does not declare would silently fall back
      // to per-slot variant classes: the styles still apply, so nothing looks wrong, and
      // the runtime distribution the recipe was written to avoid is quietly back.
      const scopeRoot = (recipe as { scopeRoot?: string }).scopeRoot
      if (scopeRoot && !recipe.slots?.includes(scopeRoot)) {
        addError(
          'slot-recipes',
          `\`scopeRoot: '${scopeRoot}'\` in \`${recipeName}\` names no slot it declares. Expected one of: ${recipe.slots?.join(', ')}`,
        )
      }
    })
  }

  return artifacts
}
