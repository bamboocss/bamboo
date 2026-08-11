import { isObject } from './assert'
import { filterBaseConditions } from './condition'
import { BambooError } from './error'
import { toHash } from './hash'
import { isImportant, sanitize, withoutImportant } from './important'
import { memo } from './memo'
import { mergeProps } from './merge-props'
import { normalizeStyleObject } from './normalize-style-object'
import { walkObject } from './walk-object'

export interface CreateCssContext {
  hash?: boolean
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
    shift: (paths: string[]) => string[]
    finalize: (paths: string[]) => string[]
  }
}

const fallbackCondition: NonNullable<CreateCssContext['conditions']> = {
  shift: (v) => v,
  finalize: (v) => v,
}

/**
 * Name a style object, without caching the answer.
 *
 * For callers already sitting behind a memo keyed on the same call. `css` is the one that
 * matters:
 *
 *     css = memo((...styles) => cssFn(mergeCssUncached(...styles)))
 *
 * reaches `cssFn` only when its own cache missed, and the merged object it passes is a
 * deterministic function of those same arguments — so a second cache on it cannot hit.
 * Measured over 25k calls it served zero hits across every workload, including working sets
 * larger than `MAX_ENTRIES`, where both caches rotate in lockstep rather than one rescuing
 * the other. The same applies wherever `createCss` is called *inside* the memoized function,
 * as the generated recipe runtime does: a fresh cache built per call is used once.
 *
 * Use `createCss` instead when there is no such memo above — the vite fold reaches it
 * directly, once per folded call site, and the merge is many-to-one there, so it hits.
 */
export function createCssUncached(context: CreateCssContext) {
  const { utility, hash, conditions: conds = fallbackCondition } = context

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

  /** The class for one declaration. */
  const atomicName = (prop: string, value: any, conditions: string[]) => {
    const important = isImportant(value)
    const transformed = utility.transform(prop, withoutImportant(sanitize(value)))
    const className = hashFn(conditions, transformed.className)
    return important ? `${className}!` : className
  }

  return ({ base, ...styles }: Record<string, any> = {}) => {
    const styleObject = Object.assign(styles, base)
    const normalizedObject = normalizeStyleObject(styleObject, context)
    const classNames = new Set<string>()

    walkObject(normalizedObject, (value, paths) => {
      if (value == null) return

      const [prop, ...allConditions] = conds.shift(paths)
      classNames.add(atomicName(prop, value, filterBaseConditions(allConditions)))
    })

    return Array.from(classNames).join(' ')
  }
}

/**
 * `createCssUncached`, cached.
 *
 * For callers that reach it directly and repeatedly with no memo of their own — the vite
 * fold builds one per build and shares it across every module. There the cache earns its
 * keep twice over: call sites repeat across a codebase, and the merge feeding it is
 * many-to-one, so `css({a}, {b})` and `css({a, b})` land on the same entry. Measured 2-35%
 * hits across the projects in this repo, and dropping it cost +187% on the fold.
 */
export function createCss(context: CreateCssContext) {
  return memo(createCssUncached(context))
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

/**
 * An array is not a style argument.
 *
 * `css([a, b])` used to mean `css(a, b)`, flattened here one level. Two spellings of one
 * call is the redundancy; the array one also cost a `flat()` allocation on every merge to
 * serve a shape almost nothing wrote, and read as a responsive array everywhere that had
 * not been taught to flatten it first.
 *
 * It throws rather than being filtered out as a non-object, which is what dropping the
 * `flat()` alone would have done — silently returning no class at all.
 */
function compactStyles(...styles: StyleObject[]) {
  return styles.filter((style) => {
    if (Array.isArray(style)) {
      throw new BambooError('INVALID_STYLE_ARGUMENT', 'An array is not a style argument.', {
        hint: 'Spread it instead, e.g. css(...styles) rather than css(styles).',
      })
    }
    return isObject(style) && hasDefinedValue(style)
  })
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

  // `mergeCss` is memoized for callers that reach it directly and repeatedly with the same
  // arguments: `cva` merges once per active variant while resolving, and `css.raw` is called
  // straight from user code. Those callers treat the result as read-only.
  //
  // The result is a shared instance, so anything that hands it to user code must copy first:
  // `css.raw()` does, since a caller mutating what it received would otherwise poison this
  // cache for everyone.
  //
  // `mergeCssUncached` is the same function without that cache, for callers already sitting
  // behind a memo keyed on the same arguments. `css` is the one that matters:
  //
  //     css = memo((...styles) => cssFn(mergeCss(...styles)))
  //
  // reaches the merge only when its own cache missed, and a miss there means these exact
  // arguments have not been seen — so the inner lookup is *guaranteed* to miss as well. The
  // redundancy is structural rather than a matter of hit rate. Measured over 25k calls across
  // four distinct styles, the inner memo served zero hits while paying a hash, a bucket scan,
  // a snapshot and an insert for each miss. Driven directly the same function hit 24,996
  // times, which is why the memoized export stays.
  return { mergeCss: memo(mergeCss), mergeCssUncached: mergeCss }
}
