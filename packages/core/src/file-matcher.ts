import { memo } from '@bamboocss/shared'
import type { ImportMapOutput } from '@bamboocss/types'
import type { Context } from './context'

export interface ImportResult {
  /** @example 'hstack' */
  name: string
  /** @example 'bambooHStack' */
  alias: string
  /**
   * @example '../../styled-system/patterns'
   * @example '@styles/patterns'
   */
  mod: string
  importMapValue?: string
  kind?: 'named' | 'namespace'
}

interface FileMatcherOptions {
  importMap: ImportMapOutput<string>
  value: ImportResult[]
}

const cssEntrypointFns = new Set(['css', 'cva', 'sva'])

/**
 * Exported from the same entrypoint as `css`, but not one of the above: it takes a bag of
 * `::view-transition-*` slots rather than a style object, so it needs its own alias set
 * and its own branch in the parser.
 */
const viewTransitionFn = 'viewTransition'

/**
 * Everything the css barrel exports that a call site can name.
 *
 * One set rather than two so recognising an import stays a single pass over the file's
 * imports — `createMatch` filters all of them, and doing that once per entrypoint rather
 * than once per exported name is the difference between constant and linear added work
 * per file.
 */
const cssBarrelFns = new Set([...cssEntrypointFns, viewTransitionFn])

export class FileMatcher {
  imports: ImportResult[]
  namespaces: Map<string, ImportResult> = new Map()
  private importMap: ImportMapOutput<string>

  private cssAliases = new Set<string>()
  private cvaAliases = new Set<string>()
  private svaAliases = new Set<string>()
  private tokenAliases = new Set<string>()
  private viewTransitionAliases = new Set<string>()

  private recipeAliases = new Set<string>()
  private patternAliases = new Set<string>()

  private propertiesMap = new Map<string, boolean>()
  private functions = new Map<string, Map<string, boolean>>()
  private components = new Map<string, Map<string, boolean>>()

  constructor(
    private context: Pick<Context, 'jsx' | 'patterns' | 'recipes' | 'isValidProperty'>,
    opts: FileMatcherOptions,
  ) {
    const { value, importMap } = opts

    this.importMap = importMap
    this.imports = value
    this.imports.forEach((result) => {
      if (result.kind === 'namespace') {
        this.namespaces.set(result.name, result)
      }
    })

    this.assignAliases()
    this.assignProperties()
  }

  private assignAliases() {
    const isCssEntrypoint = this.createMatch(this.importMap.css, Array.from(cssBarrelFns))
    const isTokensEntrypoint = this.createMatch(this.importMap.tokens, ['token'])

    this.imports.forEach((result) => {
      if (this.isValidRecipe(result.alias)) {
        this.recipeAliases.add(result.alias)
      }

      if (this.isValidPattern(result.alias)) {
        this.patternAliases.add(result.alias)
      }

      if (isCssEntrypoint(result.alias)) {
        if (result.name === 'css') {
          this.cssAliases.add(result.alias)
        }

        if (result.name === 'cva') {
          this.cvaAliases.add(result.alias)
        }

        if (result.name === 'sva') {
          this.svaAliases.add(result.alias)
        }

        if (result.name === viewTransitionFn) {
          this.viewTransitionAliases.add(result.alias)
        }
      }

      if (isTokensEntrypoint(result.alias)) {
        if (result.name === 'token') {
          this.tokenAliases.add(result.alias)
        }
      }

      if (result.kind === 'namespace') {
        // Add all patterns when using a namespace import
        // e.g. import * as p from '../styled-system/patterns'
        if (this.importMap.pattern.some((m) => result.mod.includes(m))) {
          this.context.patterns.keys.forEach((pattern) => {
            this.patternAliases.add(pattern)
          })
        }

        // Add all recipes when using a namespace import
        // e.g. import * as r from '../styled-system/recipes'
        if (this.importMap.recipe.some((m) => result.mod.includes(m))) {
          this.context.recipes.keys.forEach((recipe) => {
            this.recipeAliases.add(recipe)
          })
        }
      }
    })
  }

  private assignProperties() {
    this.context.jsx.nodes.forEach((node) => {
      const aliases = this.getAliases(node.jsxName)
      aliases.forEach((alias) => {
        node.props?.forEach((prop) => this.propertiesMap.set(prop, true))
        this.functions.set(node.baseName, this.propertiesMap)
        this.functions.set(alias, this.propertiesMap)
        this.components.set(alias, this.propertiesMap)
      })
    })
  }

  isEmpty = () => {
    return this.imports.length === 0
  }

  toString = () => {
    return this.imports.map((item) => item.alias).join(', ')
  }

  find = (id: string) => {
    return this.imports.find((o) => o.alias === id)
  }

  private createMatch = (mods: string[], keys: string[]) => {
    const matchingImports = this.imports.filter((o) => {
      const isFromMod = mods.some((m) => o.mod.includes(m) || o.importMapValue?.includes(m))
      const isOneOfKeys = o.kind === 'namespace' ? true : keys.includes(o.name)
      return isFromMod && isOneOfKeys
    })

    return memo((id: string) => {
      return !!matchingImports.find((mod) => {
        // Match patterns/recipes when using a namespace import
        if (mod.kind === 'namespace') {
          return keys.includes(id.replace(`${mod.alias}.`, ''))
        }

        return mod.alias === id || mod.name === id
      })
    })
  }

  match = (id: string) => {
    return !!this.find(id)
  }

  getName = (id: string) => {
    return this.find(id)?.name || id
  }

  getAliases = (id: string) => {
    return this.imports.filter((o) => o.name === id).map((o) => o.alias || id)
  }

  private _patternsMatcher: ReturnType<typeof this.createMatch> | undefined

  isValidPattern = (id: string) => {
    this._patternsMatcher ||= this.createMatch(this.importMap.pattern, this.context.patterns.keys)
    return this._patternsMatcher(id)
  }

  private _recipesMatcher: ReturnType<typeof this.createMatch> | undefined

  isValidRecipe = (id: string) => {
    this._recipesMatcher ||= this.createMatch(this.importMap.recipe, this.context.recipes.keys)
    return this._recipesMatcher(id)
  }

  private _viewTransitionMatcher: ReturnType<typeof this.createMatch> | undefined

  /**
   * Scoped to the css entrypoint, unlike the name-only `ImportMap` matcher: `viewTransition`
   * is an ordinary enough name that a project can have a recipe or pattern called that, and
   * dispatching on the name alone would read theirs as this and emit nothing for it.
   */
  isViewTransitionFn = (id: string) => {
    this._viewTransitionMatcher ||= this.createMatch(this.importMap.css, [viewTransitionFn])
    return this._viewTransitionMatcher(id)
  }

  isRawFn = (fnName: string) => {
    const name = fnName.split('.raw')[0] ?? ''

    // Check if it's css (literal or alias), pattern, or recipe
    const isCssOrAlias =
      name === 'css' || this.cssAliases.has(name) || this.cvaAliases.has(name) || this.svaAliases.has(name)

    return isCssOrAlias || this.isValidPattern(name) || this.isValidRecipe(name)
  }

  isNamespaced = (fnName: string) => {
    return this.namespaces.has(fnName.split('.')[0])
  }

  normalizeFnName = (fnName: string) => {
    let name = fnName

    // remove namespace and join with dot
    if (this.isNamespaced(fnName)) {
      name = name.split('.').slice(1).join('.')
    }

    if (this.isRawFn(name)) return name.replace('.raw', '')
    return name
  }

  isAliasFnName = memo((fnName: string) => {
    return (
      this.cvaAliases.has(fnName) ||
      this.cssAliases.has(fnName) ||
      this.svaAliases.has(fnName) ||
      this.tokenAliases.has(fnName) ||
      this.viewTransitionAliases.has(fnName)
    )
  })

  isTokenAlias = (fnName: string) => {
    return this.tokenAliases.has(fnName)
  }

  matchFn = memo((fnName: string) => {
    if (this.recipeAliases.has(fnName) || this.patternAliases.has(fnName)) return true
    if (this.isAliasFnName(fnName) || this.isRawFn(fnName)) return true
    if (this.functions.has(fnName)) return true

    const [namespace, identifier] = fnName.split('.')
    const ns = this.namespaces.get(namespace)
    if (ns) {
      if (this.importMap.css.some((m) => ns.mod.includes(m)) && cssBarrelFns.has(identifier)) return true
      if (this.importMap.tokens.some((m) => ns.mod.includes(m)) && identifier === 'token') return true
      if (this.importMap.recipe.some((m) => ns.mod.includes(m)) && this.recipeAliases.has(identifier)) return true
      if (this.importMap.pattern.some((m) => ns.mod.includes(m)) && this.patternAliases.has(identifier)) return true

      return this.functions.has(identifier)
    }

    return false
  })

  isBambooComponent = memo((tagName: string) => {
    // ignore fragments
    if (!tagName) return false
    return this.components.has(tagName) || this.context.jsx.isJsxTagRecipe(tagName)
  })

  /**
   * Only a recipe's own tags. Bamboo generates no components, so an arbitrary uppercase
   * tag carries nothing the build can read — matching it would walk every element in the
   * file to find no props worth extracting.
   */
  matchTag = memo((tagName: string) => {
    return this.isBambooComponent(tagName)
  })

  /**
   * A recipe's variant props, and nothing else. With no style props there is no other
   * kind of prop on a JSX tag the build has anything to say about.
   */
  matchTagProp = memo((tagName: string, propName: string) => {
    return this.context.jsx.isRecipeProp(tagName, propName)
  })
}
