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

      // An anchor naming a slot the recipe does not declare is dropped, and the slots it
      // was meant to reach silently fall back to per-slot variant classes: the styles still
      // apply, so nothing looks wrong, and the runtime distribution the recipe was written
      // to avoid is quietly back.
      //
      // Only membership is checkable here. Whether the anchors *cover* every slot is a fact
      // about the DOM, and a slot under none of them is the one failure this cannot catch.
      const scopeRoots = (recipe as { scopeRoots?: readonly string[] }).scopeRoots
      scopeRoots?.forEach((scopeRoot) => {
        if (recipe.slots?.includes(scopeRoot)) return
        addError(
          'slot-recipes',
          `\`scopeRoots\` in \`${recipeName}\` names \`${scopeRoot}\`, which is not a slot it declares. Expected one of: ${recipe.slots?.join(', ')}`,
        )
      })
    })
  }

  return artifacts
}
