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
   * The group classes the build emitted a rule for.
   *
   * Grouping names a class after a whole `css()` call, so the build has to have seen that
   * exact call to emit its rule. When it has not — a value it could not resolve, a
   * combination it declined to enumerate — the runtime returns a class with nothing behind
   * it and the element renders with *no* styles rather than losing one declaration.
   *
   * Given this set, a class the build never emitted falls back to naming each declaration
   * atomically instead. That is not a complete recovery: an atomic class only helps if some
   * rule exists for it. But it degrades to the same partial styling `cssMode: 'atomic'`
   * would give, rather than to nothing.
   *
   * Omit it and the runtime behaves exactly as before, at no cost — which is what a build
   * that cannot supply one should do.
   *
   * Membership is read through `has` so the caller can choose the representation, but it
   * must be *exact*: a probabilistic structure trades a false positive for size, and a
   * false positive here returns a class with no rule, which is the failure being fixed.
   */
  knownGroups?: { has: (className: string) => boolean }
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

/**
 * The class a whole grouped `css()` call resolves to, given its group id.
 *
 * Shared with `StyleDecoder.collectGrouped` on purpose: both sides name this class, and
 * deriving it twice is what let `hash.className` re-hash on the build side only, leaving
 * every grouped element carrying a class no rule was emitted for.
 *
 * A group id already digests every declaration in the call, so it is hashed exactly once
 * and `hash.className` is deliberately not consulted — that option shortens *utility*
 * class names, and a grouped class is not one. The build `esc()`s the result for a
 * selector; the runtime does not. That asymmetry belongs to the callers.
 */
export function groupClassName(
  groupId: string,
  toHashFn: (path: string[], hashFn: (str: string) => string) => string,
  formatClassName: (str: string) => string,
) {
  return formatClassName(toHashFn(['grouped', groupId], toHash))
}

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

  /** One declaration, kept only when there is a fallback that might need to name it. */
  const atomicName = (prop: string, value: any, conditions: string[]) => {
    const important = isImportant(value)
    const transformed = utility.transform(prop, withoutImportant(sanitize(value)))
    const className = hashFn(conditions, transformed.className)
    return important ? `${className}!` : className
  }

  if (grouped) {
    const { knownGroups } = context

    return memo(({ base, ...styles }: Record<string, any> = {}) => {
      const styleObject = Object.assign(styles, base)
      const normalizedObject = normalizeStyleObject(styleObject, context)
      const hashes: string[] = []
      // Collected only when a fallback is possible, and deliberately not *transformed*
      // here: `utility.transform` is the expensive part of naming a declaration, and the
      // overwhelmingly common case is a group the build did emit. Recording the three
      // arguments costs a push; running the transform on every call would price the miss
      // path into every hit.
      const leaves: Array<[string, any, string[]]> | undefined = knownGroups ? [] : undefined

      walkObject(normalizedObject, (value, paths) => {
        if (value == null) return

        const [prop, ...allConditions] = conds.shift(paths)
        const conditions = filterBaseConditions(allConditions)

        const parts = [`${prop}${ENTRY_SEP}value:${value}`]
        if (conditions.length) {
          parts.push(`cond:${conditions.join(COND_SEP)}`)
        }
        hashes.push(parts.join(ENTRY_SEP))
        leaves?.push([prop, value, conditions])
      })

      if (hashes.length === 0) return ''

      hashes.sort()
      const className = groupClassName(hashes.join('|'), utility.toHash, formatClassName)

      if (!leaves || knownGroups!.has(className)) return className

      // A miss keeps the group class and *adds* the atomic names, rather than replacing it.
      //
      // That is what makes an incomplete registry harmless. A registry can lag the
      // stylesheet — it is written by the build that emits the CSS, and a stale or empty one
      // is a question of when files land, not of correctness. Replacing the class would turn
      // every such lag into an element stripped of styles it actually had. Adding to it
      // means a wrong miss costs one class that matches nothing, and a right miss still
      // reaches whatever atomic rules the stylesheet carries.
      //
      // So only a false *hit* can hurt, which is why `knownGroups` has to be exact.
      const classNames = new Set<string>([className])
      for (const [prop, value, conditions] of leaves) {
        classNames.add(atomicName(prop, value, conditions))
      }
      return Array.from(classNames).join(' ')
    })
  }

  return memo(({ base, ...styles }: Record<string, any> = {}) => {
    const styleObject = Object.assign(styles, base)
    const normalizedObject = normalizeStyleObject(styleObject, context)
    const classNames = new Set<string>()

    walkObject(normalizedObject, (value, paths) => {
      if (value == null) return

      const [prop, ...allConditions] = conds.shift(paths)
      // Shared with the grouped fallback above, so a group that misses names its
      // declarations exactly as `cssMode: 'atomic'` would have. Two spellings could drift,
      // and the fallback would then reach for rules the stylesheet does not carry.
      classNames.add(atomicName(prop, value, filterBaseConditions(allConditions)))
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
  return { mergeCss: memo(mergeCss), assignCss, mergeCssUncached: mergeCss }
}
