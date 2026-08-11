import { memo } from '@bamboocss/shared'
import type { Context } from './context'
import type { RecipeNode } from './types'

interface JsxMatcher {
  string: Set<string>
  regex: RegExp[]
}

/**
 * Which JSX tags a recipe is tracked through.
 *
 * Bamboo generates no components, so a recipe component is one the project writes itself.
 * Its variant props reach the build only through this matcher: a hand-written
 * `<Button variant="danger">` whose body calls `button(props)` resolves to nothing on its
 * own, and the variant's rule would never be emitted. Matching the tag recovers it.
 *
 * Every recipe contributes at least its capitalized name, so this is on for any project
 * with recipes and off — along with the extractor's whole component surface — for one
 * without.
 */
export class JsxEngine {
  nodes: RecipeNode[] = []
  names: string[] = []

  recipeMatcher: JsxMatcher = { string: new Set(), regex: [] }
  recipePropertiesByJsxName = new Map<string, Set<string>>()

  constructor(private context: Pick<Context, 'recipes'>) {
    this.nodes = [...context.recipes.details]
    this.names = this.nodes.map((node) => node.jsxName)

    this.assignRecipeMatcher()
  }

  assignRecipeMatcher() {
    for (const recipe of this.context.recipes.details) {
      this.recipePropertiesByJsxName.set(recipe.jsxName, new Set(Object.keys(recipe.variantKeyMap ?? {})))
      recipe.jsx.forEach((jsx) => {
        if (typeof jsx === 'string') {
          this.recipeMatcher.string.add(jsx)
        } else {
          this.recipeMatcher.regex.push(jsx)
        }
      })
    }
  }

  get isEnabled() {
    return !this.context.recipes.isEmpty()
  }

  isJsxTagRecipe = memo((tagName: string) => {
    return this.recipeMatcher.string.has(tagName) || this.recipeMatcher.regex.some((regex) => regex.test(tagName))
  })

  isRecipeProp = memo((tagName: string, propName: string) => {
    if (this.isJsxTagRecipe(tagName)) {
      const recipeList = this.context.recipes.filter(tagName)
      return recipeList.some((recipe) => this.recipePropertiesByJsxName.get(recipe.jsxName)?.has(propName))
    }

    return false
  })
}
