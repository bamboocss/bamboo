import type { EvaluateOptions as TEvaluateOptions } from 'ts-evaluator'
import type {
  CallExpression,
  Expression,
  GetAccessorDeclaration,
  JsxAttribute,
  JsxOpeningElement,
  JsxSelfClosingElement,
  Node,
  PropertyAssignment,
  ShorthandPropertyAssignment,
  SourceFile,
} from 'ts-morph'
import type { BoxNode, BoxNodeArray, BoxNodeMap } from './box-factory'

export type PrimitiveType = string | number | boolean | null | undefined

export interface LiteralObject {
  [key: string]: any
}

type SingleLiteralValue = PrimitiveType | LiteralObject

export type LiteralValue = SingleLiteralValue | SingleLiteralValue[]

export interface EvaluatedObjectResult {
  [key: string]: LiteralValue
}

export interface ExtractedFunctionInstance {
  name: string
  kind: 'call-expression'
  fromNode: () => CallExpression
  box: BoxNodeArray
}

export interface ExtractedFunctionResult {
  kind: 'function'
  nodesByProp: Map<string, BoxNode[]>
  queryList: ExtractedFunctionInstance[]
}

export interface ExtractedComponentInstance {
  name: string
  fromNode: () => JsxOpeningElement | JsxSelfClosingElement | CallExpression
  box: BoxNodeMap
}
export interface ExtractedComponentResult {
  kind: 'component'
  nodesByProp: Map<string, BoxNode[]>
  queryList: ExtractedComponentInstance[]
}

export type ExtractResultItem = ExtractedComponentResult | ExtractedFunctionResult
export type ExtractResultByName = Map<string, ExtractResultItem>

interface MatchTagArgs {
  tagName: string
  tagNode: JsxOpeningElement | JsxSelfClosingElement | CallExpression
  isFactory: boolean
}
export interface MatchPropArgs {
  propName: string
  propNode: JsxAttribute | PropertyAssignment | ShorthandPropertyAssignment | GetAccessorDeclaration | undefined
}
export interface MatchFnArgs {
  fnName: string
  fnNode: CallExpression
}
export interface MatchFnArguments {
  argNode: Node
  index: number
}
export interface MatchFnPropArgs {
  propName: string
  propNode: PropertyAssignment | ShorthandPropertyAssignment | GetAccessorDeclaration
}
interface FunctionMatchers {
  matchFn: (element: MatchFnArgs) => boolean
  matchArg: (arg: Pick<MatchFnArgs, 'fnName' | 'fnNode'> & MatchFnArguments) => boolean
  matchProp: (prop: Pick<MatchFnArgs, 'fnName' | 'fnNode'> & MatchFnPropArgs) => boolean
}

export interface ComponentMatchers {
  matchTag: (element: MatchTagArgs) => boolean
  matchProp: (prop: Pick<MatchTagArgs, 'tagName' | 'tagNode'> & MatchPropArgs) => boolean
}

/**
 * Place a module specifier inside the source graph owned by the caller.
 *
 * @internal Bamboo's parser supplies its Project resolver. The extractor deliberately has
 * no filesystem fallback: a cross-file read that bypasses the owner cannot be invalidated or
 * represented in the owner's dependency graph.
 */
export type ResolveModule = (specifier: string, from: SourceFile) => SourceFile | undefined

export interface BoxContext {
  resolveModule?: ResolveModule
  /** @internal Receives local source paths crossed by this exact extraction context. */
  recordDependency?: (filePath: string) => void
  getEvaluateOptions?: (node: Expression, stack: Node[]) => Omit<EvaluateOptions, 'node' | 'policy'> | void
  canEval?: (node: Expression, stack: Node[]) => boolean
  tokens?: {
    view: {
      get: (path: string, fallback?: string | number) => string | undefined
      getVar: (path: string, fallback?: string | number) => string | undefined
    }
    isTokenFn?: (fnName: string) => boolean
  }
  flags?: {
    skipEvaluate?: boolean
    skipTraverseFiles?: boolean
    skipConditions?: boolean
  }
}

export type EvaluateOptions = Omit<TEvaluateOptions, 'node' | 'policy'>

export type ExtractOptions = BoxContext & {
  ast: SourceFile
  components?: ComponentMatchers
  functions?: FunctionMatchers
}
