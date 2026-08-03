//#region src/assert.ts
function isObject(value) {
  return typeof value === 'object' && value != null && !Array.isArray(value)
}
const isObjectOrArray = (obj) => typeof obj === 'object' && obj !== null
//#endregion
//#region src/compact.ts
function compact(value) {
  return Object.fromEntries(Object.entries(value ?? {}).filter(([_, value]) => value !== void 0))
}
//#endregion
//#region src/condition.ts
const isBaseCondition = (v) => v === 'base'
function filterBaseConditions(c) {
  return c.slice().filter((v) => !isBaseCondition(v))
}
//#endregion
//#region src/hash.ts
function toChar(code) {
  return String.fromCharCode(code + (code > 25 ? 39 : 97))
}
function toName(code) {
  let name = ''
  let x
  for (x = Math.abs(code); x > 52; x = (x / 52) | 0) name = toChar(x % 52) + name
  return toChar(x % 52) + name
}
function toPhash(h, x) {
  let i = x.length
  while (i) h = (h * 33) ^ x.charCodeAt(--i)
  return h
}
function toHash(value) {
  return toName(toPhash(5381, value) >>> 0)
}
//#endregion
//#region src/important.ts
const importantRegex = /\s*!(important)?/i
function isImportant(value) {
  return typeof value === 'string' ? importantRegex.test(value) : false
}
function withoutImportant(value) {
  return typeof value === 'string' ? value.replace(importantRegex, '').trim() : value
}
function withoutSpace(str) {
  return typeof str === 'string' ? str.replaceAll(' ', '_') : str
}
//#endregion
//#region src/memo.ts
/**
 * Bounded argument memo used by the generated runtime (`css`, patterns, `cva`, recipes).
 *
 * Two regimes, picked per call:
 *
 * - Arguments that are flat (objects of primitives) take a cheap structural hash
 *   and are confirmed with an exact comparison, so a hash collision can never
 *   serve the wrong result. This is the shape `css({ ... })` has.
 * - Anything nested falls back to `JSON.stringify`, which V8 does faster than a
 *   JS walk.
 *
 * Both regimes key on *values*, never on object identity: mutating a style object
 * between calls changes its hash, so the next call misses and recomputes rather
 * than serving a stale class.
 *
 * Both caches are bounded. An unbounded memo is a leak in any long-lived process
 * (SSR), where the set of distinct style objects grows without limit.
 */
/**
 * Distinct hashes held per memoized function before the cache rotates.
 *
 * This bounds *buckets*, not entries: a bucket keeps up to `MAX_BUCKET` colliding
 * argument lists, so the ceiling is `MAX_ENTRIES * MAX_BUCKET` live entries, and
 * twice that across both generations, since the previous one is retained until the
 * next rotation. Collisions are rare in practice, so the realistic figure is close
 * to `MAX_ENTRIES` — but the worst case is what matters when sizing a long-lived
 * process, so state it plainly.
 *
 * Rotation beats evicting the oldest key: single-key eviction is worst-case for a
 * working set that cycles, because it drops exactly the entry about to be needed.
 * Measured on a cycling set of 20k styles, one-at-a-time eviction cost ~719ns/op
 * against ~189ns unbounded, while rotation holds ~274ns. On realistic skewed
 * access rotation is at or below the unbounded cost.
 */
const MAX_ENTRIES = 1e3
/** Entries kept per hash bucket, to bound the cost of a collision scan. */
const MAX_BUCKET = 8
/**
 * DJB2 over the arguments' own keys and primitive values.
 * Returns `null` for anything nested, which routes the call to the string key.
 */
const flatHashOrNull = (args) => {
  let h = 5381
  for (let a = 0; a < args.length; a++) {
    const obj = args[a]
    if (obj === null || typeof obj !== 'object') {
      const t = typeof obj
      if (t === 'string') for (let i = 0; i < obj.length; i++) h = (h * 33) ^ obj.charCodeAt(i)
      else if (t === 'number') h = (h * 33) ^ (obj | 0)
      else if (t === 'boolean') h = (h * 33) ^ (obj ? 991 : 997)
      else h = (h * 33) ^ 3
      continue
    }
    if (Array.isArray(obj)) h = (h * 33) ^ 7
    else {
      const proto = Object.getPrototypeOf(obj)
      if (proto !== Object.prototype && proto !== null) return null
    }
    for (const k in obj) {
      const v = obj[k]
      const tv = typeof v
      if (v !== null && tv === 'object') return null
      for (let i = 0; i < k.length; i++) h = (h * 33) ^ k.charCodeAt(i)
      if (tv === 'string') for (let i = 0; i < v.length; i++) h = (h * 33) ^ v.charCodeAt(i)
      else if (tv === 'number') h = (h * 33) ^ (v | 0)
      else if (tv === 'boolean') h = (h * 33) ^ (v ? 991 : 997)
      else h = (h * 33) ^ 2
    }
  }
  return h >>> 0
}
/**
 * Value snapshot of the arguments, taken once at insert.
 *
 * The cache must not hold the caller's objects: a style object can capture a much
 * larger graph, and keeping it alive until the cache rotates changes GC behaviour
 * for code that never asked to be cached. Only the flat path reaches here, so a
 * shallow copy contains primitives only and retains nothing.
 *
 * Comparing against a copy also removes the last way a mutation could be missed.
 * Were the caller's own object stored, `oa === ob` would short-circuit the value
 * comparison, and a mutation that happened to preserve the hash would return the
 * stale entry. Against a copy that check can only ever be true for equal
 * primitives.
 */
const snapshotArgs = (args) => {
  const values = []
  const counts = []
  for (let i = 0; i < args.length; i++) {
    const o = args[i]
    if (o !== null && typeof o === 'object') {
      const copy = Array.isArray(o) ? [] : {}
      let n = 0
      for (const k in o) {
        copy[k] = o[k]
        n++
      }
      values.push(copy)
      counts.push(n)
    } else {
      values.push(o)
      counts.push(0)
    }
  }
  return {
    values,
    counts,
  }
}
/**
 * Exact match, so a `flatHashOrNull` collision is resolved rather than trusted.
 * `bCounts` is the cached side's key count; comparing against it avoids the
 * `Object.keys()` allocation this would otherwise make on every cache hit.
 */
const flatArgsEqual = (a, b, bCounts) => {
  if (a.length !== b.length) return false
  for (let i = 0; i < a.length; i++) {
    const oa = a[i]
    const ob = b[i]
    if (oa === ob) continue
    if (oa === null || ob === null || typeof oa !== 'object' || typeof ob !== 'object') return false
    if (Array.isArray(oa) !== Array.isArray(ob)) return false
    let n = 0
    for (const k in oa) {
      if (oa[k] !== ob[k]) return false
      n++
    }
    if (n !== bCounts[i]) return false
  }
  return true
}
const memo = (fn) => {
  let buckets = /* @__PURE__ */ new Map()
  let priorBuckets = /* @__PURE__ */ new Map()
  let strings = /* @__PURE__ */ new Map()
  let priorStrings = /* @__PURE__ */ new Map()
  /**
   * One scalar argument, keyed directly.
   *
   * This is the shape of the hottest callers — `isCssProperty(prop)` runs per prop
   * per render — and a plain map lookup beats hashing, bucket scanning and
   * snapshotting for it. Distinct types stay distinct keys, so `1` and `'1'` do not
   * share an entry.
   */
  let scalars = /* @__PURE__ */ new Map()
  let priorScalars = /* @__PURE__ */ new Map()
  const scan = (bucket, args) => {
    if (bucket)
      for (let i = 0; i < bucket.length; i++) {
        const entry = bucket[i]
        if (flatArgsEqual(args, entry.values, entry.counts)) return entry
      }
  }
  const get = (...args) => {
    if (args.length === 1) {
      const only = args[0]
      if (only === null || typeof only !== 'object') {
        if (scalars.has(only)) return scalars.get(only)
        if (priorScalars.has(only)) {
          const promoted = priorScalars.get(only)
          scalars.set(only, promoted)
          return promoted
        }
        const out = fn(only)
        scalars.set(only, out)
        if (scalars.size > MAX_ENTRIES) {
          priorScalars = scalars
          scalars = /* @__PURE__ */ new Map()
        }
        return out
      }
    }
    const hash = flatHashOrNull(args)
    if (hash !== null) {
      let bucket = buckets.get(hash)
      const hit = scan(bucket, args)
      if (hit) return hit.out
      const priorHit = scan(priorBuckets.get(hash), args)
      if (priorHit) {
        if (!bucket) {
          bucket = []
          buckets.set(hash, bucket)
        }
        bucket.push(priorHit)
        if (bucket.length > MAX_BUCKET) bucket.shift()
        return priorHit.out
      }
      const snap = snapshotArgs(args)
      const out = fn(...args)
      if (!bucket) {
        bucket = []
        buckets.set(hash, bucket)
      }
      bucket.push({
        values: snap.values,
        counts: snap.counts,
        out,
      })
      if (bucket.length > MAX_BUCKET) bucket.shift()
      if (buckets.size > MAX_ENTRIES) {
        priorBuckets = buckets
        buckets = /* @__PURE__ */ new Map()
      }
      return out
    }
    const key = JSON.stringify(args)
    if (strings.has(key)) return strings.get(key)
    if (priorStrings.has(key)) {
      const promoted = priorStrings.get(key)
      strings.set(key, promoted)
      return promoted
    }
    const out = fn(...args)
    strings.set(key, out)
    if (strings.size > MAX_ENTRIES) {
      priorStrings = strings
      strings = /* @__PURE__ */ new Map()
    }
    return out
  }
  return get
}
//#endregion
//#region src/merge-props.ts
const MERGE_OMIT = new Set(['__proto__', 'constructor', 'prototype'])
function mergeProps(...sources) {
  return sources.reduce((prev, obj) => {
    if (!obj) return prev
    Object.keys(obj).forEach((key) => {
      if (MERGE_OMIT.has(key)) return
      const prevValue = prev[key]
      const value = obj[key]
      if (isObject(prevValue) && isObject(value)) prev[key] = mergeProps(prevValue, value)
      else if (isObject(value)) prev[key] = mergeProps({}, value)
      else if (Array.isArray(value)) prev[key] = value.slice()
      else prev[key] = value
    })
    return prev
  }, {})
}
//#endregion
//#region src/walk-object.ts
const isNotNullish = (element) => element != null
function walkObject(target, predicate, options = {}) {
  const { stop, getKey } = options
  function inner(value, path = []) {
    if (isObjectOrArray(value)) {
      const result = {}
      for (const [prop, child] of Object.entries(value)) {
        const key = getKey?.(prop, child) ?? prop
        const childPath = [...path, key]
        if (stop?.(value, childPath)) return predicate(value, path)
        const next = inner(child, childPath)
        if (isNotNullish(next)) result[key] = next
      }
      return result
    }
    return predicate(value, path)
  }
  return inner(target)
}
function mapObject(obj, fn) {
  if (Array.isArray(obj)) return obj.map((value) => fn(value))
  if (!isObject(obj)) return fn(obj)
  return walkObject(obj, (value) => fn(value))
}
//#endregion
//#region src/normalize-style-object.ts
function toResponsiveObject(values, breakpoints) {
  return values.reduce((acc, current, index) => {
    const key = breakpoints[index]
    if (current != null) acc[key] = current
    return acc
  }, {})
}
function normalizeStyleObject(styles, context, shorthand = true) {
  const { utility, conditions } = context
  const { hasShorthand, resolveShorthand } = utility
  return walkObject(
    styles,
    (value) => {
      return Array.isArray(value) ? toResponsiveObject(value, conditions.breakpoints.keys) : value
    },
    {
      stop: (value) => Array.isArray(value),
      getKey: shorthand ? (prop) => (hasShorthand ? resolveShorthand(prop) : prop) : void 0,
    },
  )
}
//#endregion
//#region src/classname.ts
const fallbackCondition = {
  shift: (v) => v,
  finalize: (v) => v,
  breakpoints: { keys: [] },
}
const sanitize = (value) => (typeof value === 'string' ? value.replaceAll(/[\n\s]+/g, ' ') : value)
const ENTRY_SEP = ']___['
const COND_SEP = '<___>'
function createCss(context) {
  const { utility, hash, grouped, conditions: conds = fallbackCondition } = context
  const formatClassName = (str) => [utility.prefix, str].filter(Boolean).join('-')
  const hashFn = (conditions, className) => {
    let result
    if (hash) {
      const baseArray = [...conds.finalize(conditions), className]
      result = formatClassName(utility.toHash(baseArray, toHash))
    } else result = [...conds.finalize(conditions), formatClassName(className)].join(':')
    return result
  }
  if (grouped)
    return memo(({ base, ...styles } = {}) => {
      const normalizedObject = normalizeStyleObject(Object.assign(styles, base), context)
      const hashes = []
      walkObject(normalizedObject, (value, paths) => {
        if (value == null) return
        const [prop, ...allConditions] = conds.shift(paths)
        const conditions = filterBaseConditions(allConditions)
        const parts = [`${prop}${ENTRY_SEP}value:${value}`]
        if (conditions.length) parts.push(`cond:${conditions.join(COND_SEP)}`)
        hashes.push(parts.join(ENTRY_SEP))
      })
      if (hashes.length === 0) return ''
      hashes.sort()
      const groupId = hashes.join('|')
      return formatClassName(utility.toHash(['grouped', groupId], toHash))
    })
  return memo(({ base, ...styles } = {}) => {
    const normalizedObject = normalizeStyleObject(Object.assign(styles, base), context)
    const classNames = /* @__PURE__ */ new Set()
    walkObject(normalizedObject, (value, paths) => {
      if (value == null) return
      const important = isImportant(value)
      const [prop, ...allConditions] = conds.shift(paths)
      let className = hashFn(
        filterBaseConditions(allConditions),
        utility.transform(prop, withoutImportant(sanitize(value))).className,
      )
      if (important) className = `${className}!`
      classNames.add(className)
    })
    return Array.from(classNames).join(' ')
  })
}
function compactStyles(...styles) {
  return styles.flat().filter((style) => isObject(style) && Object.keys(compact(style)).length > 0)
}
function createMergeCss(context) {
  function resolve(styles) {
    const allStyles = compactStyles(...styles)
    if (allStyles.length === 1) return allStyles
    return allStyles.map((style) => normalizeStyleObject(style, context))
  }
  function mergeCss(...styles) {
    return mergeProps(...resolve(styles))
  }
  function assignCss(...styles) {
    return Object.assign({}, ...resolve(styles))
  }
  return {
    mergeCss: memo(mergeCss),
    assignCss,
  }
}
//#endregion
//#region src/hypenate-property.ts
const wordRegex = /([A-Z])/g
const msRegex = /^ms-/
const hypenateProperty = memo((property) => {
  if (property.startsWith('--')) return property
  return property.replace(wordRegex, '-$1').replace(msRegex, '-ms-').toLowerCase()
})
//#endregion
//#region src/is-css-function.ts
const fnRegExp = new RegExp(`^(${['min', 'max', 'clamp', 'calc'].join('|')})\\(.*\\)`)
const isCssFunction = (v) => typeof v === 'string' && fnRegExp.test(v)
//#endregion
//#region src/is-css-unit.ts
const lengthUnitsPattern = `(?:${'cm,mm,Q,in,pc,pt,px,em,ex,ch,rem,lh,rlh,vw,vh,vmin,vmax,vb,vi,svw,svh,lvw,lvh,dvw,dvh,cqw,cqh,cqi,cqb,cqmin,cqmax,%'.split(',').join('|')})`
const lengthRegExp = new RegExp(`^[+-]?[0-9]*.?[0-9]+(?:[eE][+-]?[0-9]+)?${lengthUnitsPattern}$`)
const isCssUnit = (v) => typeof v === 'string' && lengthRegExp.test(v)
//#endregion
//#region src/is-css-var.ts
const isCssVar = (v) => typeof v === 'string' && /^var\(--.+\)$/.test(v)
//#endregion
//#region src/pattern-fns.ts
const patternFns = {
  map: mapObject,
  isCssFunction,
  isCssVar,
  isCssUnit,
}
const getPatternStyles = (pattern, styles) => {
  if (!pattern?.defaultValues) return styles
  const defaults = typeof pattern.defaultValues === 'function' ? pattern.defaultValues(styles) : pattern.defaultValues
  return Object.assign({}, defaults, compact(styles))
}
//#endregion
//#region src/slot.ts
const getSlotRecipes = (recipe = {}) => {
  const init = (slot) => ({
    className: [recipe.className, slot].filter(Boolean).join('__'),
    base: recipe.base?.[slot] ?? {},
    variants: {},
    defaultVariants: recipe.defaultVariants ?? {},
    compoundVariants: recipe.compoundVariants ? getSlotCompoundVariant(recipe.compoundVariants, slot) : [],
  })
  const recipeParts = (recipe.slots ?? []).map((slot) => [slot, init(slot)])
  for (const [variantsKey, variantsSpec] of Object.entries(recipe.variants ?? {}))
    for (const [variantKey, variantSpec] of Object.entries(variantsSpec))
      recipeParts.forEach(([slot, slotRecipe]) => {
        slotRecipe.variants[variantsKey] ??= {}
        slotRecipe.variants[variantsKey][variantKey] = variantSpec[slot] ?? {}
      })
  return Object.fromEntries(recipeParts)
}
const getSlotCompoundVariant = (compoundVariants, slotName) =>
  compoundVariants
    .filter((compoundVariant) => compoundVariant.css[slotName])
    .map((compoundVariant) => ({
      ...compoundVariant,
      css: compoundVariant.css[slotName],
    }))
//#endregion
//#region src/split-props.ts
function splitProps(props, ...keys) {
  const descriptors = Object.getOwnPropertyDescriptors(props)
  const dKeys = Object.keys(descriptors)
  const split = (k) => {
    const clone = {}
    for (let i = 0; i < k.length; i++) {
      const key = k[i]
      if (descriptors[key]) {
        Object.defineProperty(clone, key, descriptors[key])
        delete descriptors[key]
      }
    }
    return clone
  }
  const fn = (key) => split(Array.isArray(key) ? key : dKeys.filter(key))
  return keys.map(fn).concat(split(dKeys))
}
//#endregion
//#region src/uniq.ts
const uniq = (...items) => {
  const set = items.reduce((acc, currItems) => {
    if (currItems) currItems.forEach((item) => acc.add(item))
    return acc
  }, /* @__PURE__ */ new Set([]))
  return Array.from(set)
}
//#endregion
export {
  compact,
  createCss,
  createMergeCss,
  filterBaseConditions,
  getPatternStyles,
  getSlotCompoundVariant,
  getSlotRecipes,
  hypenateProperty,
  isBaseCondition,
  isObject,
  mapObject,
  memo,
  mergeProps,
  patternFns,
  splitProps,
  toHash,
  uniq,
  walkObject,
  withoutSpace,
}

//#region src/normalize-html.ts
const htmlProps = ['htmlSize', 'htmlTranslate', 'htmlWidth', 'htmlHeight']
function convert(key) {
  return htmlProps.includes(key) ? key.replace('html', '').toLowerCase() : key
}
function normalizeHTMLProps(props) {
  return Object.fromEntries(Object.entries(props).map(([key, value]) => [convert(key), value]))
}
normalizeHTMLProps.keys = htmlProps
//#endregion
export { normalizeHTMLProps }

export function __spreadValues(a, b) {
  return { ...a, ...b }
}

export function __objRest(source, exclude) {
  return Object.fromEntries(Object.entries(source).filter(([key]) => !exclude.includes(key)))
}
