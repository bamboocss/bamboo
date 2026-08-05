import { isObject } from './assert'
import { filterBaseConditions } from './condition'
import { toHash } from './hash'
import { isImportant, sanitize, withoutImportant } from './important'
import { memo } from './memo'
import { mergeProps } from './merge-props'
import { normalizeStyleObject } from './normalize-style-object'
import { walkObject } from './walk-object'

export interface CreateCssContext {
  hash?: boolean
  grouped?: boolean
  /**
   * Partial properties from the Utility class
   */
  utility: {
    prefix: string
    hasShorthand: boolean
    resolveShorthand: (prop: string) => string
    transform: (prop: string, value: any) => { className: string }
    toHash: (path: string[], toHash: (str: string) => string) => string
  }
  /**
   * Partial properties from the Condition class
   */
  conditions?: {
    breakpoints: { keys: string[] }
    shift: (paths: string[]) => string[]
    finalize: (paths: string[]) => string[]
  }
}

const fallbackCondition: NonNullable<CreateCssContext['conditions']> = {
  shift: (v) => v,
  finalize: (v) => v,
  breakpoints: { keys: [] },
}

const ENTRY_SEP = ']___['
const COND_SEP = '<___>'

export function createCss(context: CreateCssContext) {
  const { utility, hash, grouped, conditions: conds = fallbackCondition } = context

  // Both of these run once per style leaf per cache miss, so the prefix is resolved here
  // rather than rebuilt into an array, filtered and joined on every one of them. Most
  // configs set no prefix at all, which made that array pure overhead.
  //
  // The `|| ''` keeps the unprefixed branch returning a string for a falsy class, which the
  // array-and-join it replaced did for any class at all. `transform` is declared to return a
  // string and every implementation builds one, so that is the invariant this now leans on.
  const { prefix } = utility
  const formatClassName = prefix ? (str: string) => (str ? `${prefix}-${str}` : prefix) : (str: string) => str || ''

  const hashFn = (conditions: string[], className: string) => {
    if (hash) {
      const baseArray = [...conds.finalize(conditions), className]
      return formatClassName(utility.toHash(baseArray, toHash))
    }

    const finalized = conds.finalize(conditions)
    // An unconditional style is the common case and needs neither the copy nor the join —
    // `[x].join(':')` is `x`.
    if (finalized.length === 0) return formatClassName(className)
    return [...finalized, formatClassName(className)].join(':')
  }

  if (grouped) {
    return memo(({ base, ...styles }: Record<string, any> = {}) => {
      const styleObject = Object.assign(styles, base)
      const normalizedObject = normalizeStyleObject(styleObject, context)
      const hashes: string[] = []

      walkObject(normalizedObject, (value, paths) => {
        if (value == null) return

        const [prop, ...allConditions] = conds.shift(paths)
        const conditions = filterBaseConditions(allConditions)

        const parts = [`${prop}${ENTRY_SEP}value:${value}`]
        if (conditions.length) {
          parts.push(`cond:${conditions.join(COND_SEP)}`)
        }
        hashes.push(parts.join(ENTRY_SEP))
      })

      if (hashes.length === 0) return ''

      hashes.sort()
      const groupId = hashes.join('|')
      const shortHash = utility.toHash(['grouped', groupId], toHash)
      return formatClassName(shortHash)
    })
  }

  return memo(({ base, ...styles }: Record<string, any> = {}) => {
    const styleObject = Object.assign(styles, base)
    const normalizedObject = normalizeStyleObject(styleObject, context)
    const classNames = new Set<string>()

    walkObject(normalizedObject, (value, paths) => {
      if (value == null) return

      const important = isImportant(value)

      const [prop, ...allConditions] = conds.shift(paths)
      const conditions = filterBaseConditions(allConditions)

      const transformed = utility.transform(prop, withoutImportant(sanitize(value)))

      let className = hashFn(conditions, transformed.className)
      if (important) className = `${className}!`

      classNames.add(className)
    })

    return Array.from(classNames).join(' ')
  })
}

interface StyleObject {
  [key: string]: any
}

/**
 * Whether a style object carries anything `compact` would have kept.
 *
 * The question `compactStyles` asks is only ever "is this empty once undefined values are
 * dropped", but it used to answer it by building the compacted object and then a key array
 * for it, then throwing both away. `Object.keys` enumerates exactly what `compact`'s
 * `Object.entries` did — own, enumerable, string-keyed — so this is the same predicate
 * without the two allocations, and it stops at the first value that settles it.
 */
function hasDefinedValue(style: StyleObject) {
  const keys = Object.keys(style)
  for (let i = 0; i < keys.length; i++) {
    if (style[keys[i] as string] !== undefined) return true
  }
  return false
}

function compactStyles(...styles: StyleObject[]) {
  return styles.flat().filter((style) => isObject(style) && hasDefinedValue(style))
}

export function createMergeCss(context: CreateCssContext) {
  function resolve(styles: StyleObject[]) {
    const allStyles = compactStyles(...styles)
    if (allStyles.length === 1) return allStyles
    return allStyles.map((style) => normalizeStyleObject(style, context))
  }

  function mergeCss(...styles: StyleObject[]) {
    return mergeProps(...resolve(styles))
  }

  function assignCss(...styles: StyleObject[]) {
    return Object.assign({}, ...resolve(styles))
  }

  // Memoized for the internal callers that dominate this path — the JSX factories
  // merge style props with the `css` prop on every render, and `cva` merges while
  // resolving variants. Those callers treat the result as read-only.
  //
  // The result is a shared instance, so anything that hands it to user code must
  // copy first: `css.raw()` does, since a caller mutating what it received would
  // otherwise poison this cache for everyone.
  return { mergeCss: memo(mergeCss), assignCss }
}
