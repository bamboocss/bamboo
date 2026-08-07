import type { ConditionDetails } from './conditions'

export interface StyleResultObject {
  [key: string]: any
}
export interface StyleProps extends StyleResultObject {
  css?: StyleResultObject
}

export interface StyleEntry {
  prop: string
  value: string | number | boolean
  cond: string
  recipe?: string
  slot?: string
  layer?: string
  variants?: boolean
}

export interface AtomicStyleResult {
  result: StyleResultObject
  entry: StyleEntry
  hash: string
  className: string
  conditions?: ConditionDetails[]
  layer?: string
  /**
   * The rule selects through a `@scope` prelude rather than on `className`.
   *
   * A non-root slot's variant styles are reached from the class the *root* carries, so this
   * result's own class names nothing. It still identifies the rule for bookkeeping, but
   * reporting it would put a class on the element that no rule ever matches.
   */
  scoped?: boolean
}

export interface GroupedResult extends Pick<AtomicStyleResult, 'result' | 'className'> {
  hashSet: Set<string>
  details: GroupedStyleResultDetails[]
}

export interface RecipeBaseResult extends GroupedResult {
  recipe: string
  slot?: string
}

export interface GroupedStyleResultDetails extends Pick<AtomicStyleResult, 'hash' | 'entry' | 'conditions'> {
  result: StyleResultObject
}

export interface ViewTransitionResult {
  className: string
  /**
   * Selector -> authored style object, the shape `globalCss` takes.
   *
   * Unlike every other result here this is *not* transformed yet: the bodies target
   * `::view-transition-*` pseudo-elements, so they are serialized whole at emit rather
   * than atomized into classes.
   */
  styles: StyleResultObject
}
