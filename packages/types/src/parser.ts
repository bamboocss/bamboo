import type { BoxNodeArray, BoxNodeLiteral, BoxNodeMap, Unboxed } from '@bamboocss/extractor'

export interface ResultItem {
  name?: string
  data: Array<Unboxed['raw']>
  /**
   * `tokenVar` is `token.var(path)`, kept distinct from `token` because the two resolve to
   * different halves of the same entry — the variable reference against the resolved value.
   * Both live in `ParserResult.token`, since every consumer that reads a token *path* out of
   * a result wants both.
   */
  type?: 'css' | 'cva' | 'sva' | 'token' | 'tokenVar' | 'pattern' | 'recipe' | 'jsx-recipe' | 'cva-call'
  box?: BoxNodeMap | BoxNodeLiteral | BoxNodeArray
  /**
   * For a `cva-call`, the module the recipe was declared in when that is not this one.
   *
   * Absent for a recipe the file declares itself, which is the case the name alone already
   * identifies.
   */
  origin?: { filePath: string; name: string }
}

export interface ParserResultInterface {
  all: Array<ResultItem>
  css: Set<ResultItem>
  cva: Set<ResultItem>
  /** Calls of a locally-bound inline recipe: `const b = cva(...)`, then `b({ ... })`. */
  cvaCall: Set<ResultItem>
  sva: Set<ResultItem>
  token: Set<ResultItem>
  viewTransition: Set<ResultItem>
  recipe: Map<string, Set<ResultItem>>
  pattern: Map<string, Set<ResultItem>>
  filePath: string | undefined
  isEmpty: () => boolean
  toArray: () => Array<ResultItem>
  set: (name: 'cva' | 'css' | 'sva' | 'token', result: ResultItem) => void
  setCss: (result: ResultItem) => void
  setCva: (result: ResultItem) => void
  setSva: (result: ResultItem) => void
  setToken: (result: ResultItem, kind?: 'token' | 'tokenVar') => void
  setViewTransition: (result: ResultItem) => void
  setPattern: (name: string, result: ResultItem) => void
  setRecipe: (name: string, result: ResultItem) => void
}

export interface EncoderJson {
  schemaVersion: string
  styles: {
    atomic?: string[]
    recipes?: {
      [name: string]: string[]
    }
    /** Bag class -> the `::view-transition-*` slot styles behind it. */
    viewTransitions?: {
      [className: string]: Record<string, any>
    }
  }
}
