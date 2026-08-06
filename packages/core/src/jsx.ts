import { capitalize, memo } from '@bamboocss/shared'
import type { Context } from './context'
import type { RecipeNode } from './types'

interface JsxMatcher {
  string: Set<string>
  regex: RegExp[]
}

export class JsxEngine {
  nodes: RecipeNode[] = []
  names: string[] = []

  recipeMatcher: JsxMatcher = { string: new Set(), regex: [] }
  recipePropertiesByJsxName = new Map<string, Set<string>>()

  constructor(private context: Pick<Context, 'recipes' | 'config'>) {
    this.nodes = [...context.recipes.details]
    this.names = [this.factoryName, ...this.nodes.map((node) => node.jsxName)]

    this.assignRecipeMatcher()
  }

  assignRecipeMatcher() {
    if (!this.isEnabled) return

    for (const recipe of this.context.recipes.details) {
      this.recipePropertiesByJsxName.set(recipe.jsxName, new Set(recipe.props ?? []))
      recipe.jsx.forEach((jsx) => {
        if (typeof jsx === 'string') {
          this.recipeMatcher.string.add(jsx)
        } else {
          this.recipeMatcher.regex.push(jsx)
        }
      })
    }
  }

  private get jsxFactory() {
    return this.context.config.jsxFactory ?? 'styled'
  }

  get styleProps() {
    return this.context.config.jsxStyleProps ?? 'all'
  }

  get framework() {
    return this.context.config.jsxFramework
  }

  get isEnabled() {
    return this.framework != null
  }

  get factoryName() {
    return this.jsxFactory
  }

  get upperName() {
    return capitalize(this.jsxFactory)
  }

  get typeName() {
    return `HTML${capitalize(this.jsxFactory)}Props`
  }

  get variantName() {
    return `${capitalize(this.jsxFactory)}VariantProps`
  }

  get componentName() {
    return `${capitalize(this.jsxFactory)}Component`
  }

  isJsxFactory = (name: string) => {
    // `styled` -> true
    const isFactory = name === this.factoryName
    if (isFactory) return true

    // `bambooJsx.styled` -> true
    const [_namespace, identifier] = name.split('.')
    return identifier === this.factoryName
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
