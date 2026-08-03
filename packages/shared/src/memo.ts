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
const MAX_ENTRIES = 1000

/** Entries kept per hash bucket, to bound the cost of a collision scan. */
const MAX_BUCKET = 8

/**
 * DJB2 over the arguments' own keys and primitive values.
 * Returns `null` for anything nested, which routes the call to the string key.
 */
const flatHashOrNull = (args: readonly any[]): number | null => {
  let h = 5381
  for (let a = 0; a < args.length; a++) {
    const obj = args[a]
    if (obj === null || typeof obj !== 'object') {
      // Hash scalars by value. Folding them all to one constant would put every
      // distinct string in a single bucket, where the per-bucket cap turns into a
      // hit-rate cliff.
      const t = typeof obj
      if (t === 'string') {
        for (let i = 0; i < obj.length; i++) h = (h * 33) ^ obj.charCodeAt(i)
      } else if (t === 'number') {
        h = (h * 33) ^ (obj | 0)
      } else if (t === 'boolean') {
        h = (h * 33) ^ (obj ? 991 : 997)
      } else {
        h = (h * 33) ^ 3
      }
      continue
    }
    // An array and an object with the same numeric keys enumerate identically, so
    // distinguish them or `['x']` and `{ 0: 'x' }` share an entry.
    if (Array.isArray(obj)) {
      h = (h * 33) ^ 7
    } else {
      // `for...in` walks the prototype chain while the wrapped function reads own
      // keys, so anything carrying a custom prototype goes to the string key, which
      // sees exactly what the function does. One check per object is far cheaper
      // than guarding every key, and plain objects — every style object in
      // practice — take the fast path unchanged.
      const proto = Object.getPrototypeOf(obj)
      if (proto !== Object.prototype && proto !== null) return null
    }
    for (const k in obj) {
      const v = obj[k]
      const tv = typeof v
      if (v !== null && tv === 'object') return null
      for (let i = 0; i < k.length; i++) h = (h * 33) ^ k.charCodeAt(i)
      if (tv === 'string') {
        for (let i = 0; i < v.length; i++) h = (h * 33) ^ v.charCodeAt(i)
      } else if (tv === 'number') {
        h = (h * 33) ^ (v | 0)
      } else if (tv === 'boolean') {
        h = (h * 33) ^ (v ? 991 : 997)
      } else {
        h = (h * 33) ^ 2
      }
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
const snapshotArgs = (args: readonly any[]): { values: any[]; counts: number[] } => {
  const values: any[] = []
  const counts: number[] = []
  for (let i = 0; i < args.length; i++) {
    const o = args[i]
    if (o !== null && typeof o === 'object') {
      // Copy an array as an array, so the stored side keeps the shape the equality
      // check compares against.
      const copy: any = Array.isArray(o) ? [] : {}
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
  return { values, counts }
}

/**
 * Exact match, so a `flatHashOrNull` collision is resolved rather than trusted.
 * `bCounts` is the cached side's key count; comparing against it avoids the
 * `Object.keys()` allocation this would otherwise make on every cache hit.
 */
const flatArgsEqual = (a: readonly any[], b: readonly any[], bCounts: readonly number[]): boolean => {
  if (a.length !== b.length) return false
  for (let i = 0; i < a.length; i++) {
    const oa = a[i]
    const ob = b[i]
    if (oa === ob) continue
    if (oa === null || ob === null || typeof oa !== 'object' || typeof ob !== 'object') return false
    // `['x']` and `{ 0: 'x' }` enumerate the same; the wrapped function does not
    // read them the same.
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

type Bucket = Array<{ values: any[]; counts: number[]; out: any }>

export const memo = <T extends (...args: any[]) => any>(fn: T): T => {
  let buckets = new Map<number, Bucket>()
  let priorBuckets = new Map<number, Bucket>()
  let strings = new Map<string, any>()
  let priorStrings = new Map<string, any>()

  /**
   * One scalar argument, keyed directly.
   *
   * This is the shape of the hottest callers — `isCssProperty(prop)` runs per prop
   * per render — and a plain map lookup beats hashing, bucket scanning and
   * snapshotting for it. Distinct types stay distinct keys, so `1` and `'1'` do not
   * share an entry.
   */
  let scalars = new Map<any, any>()
  let priorScalars = new Map<any, any>()

  const scan = (bucket: Bucket | undefined, args: any[]) => {
    if (bucket) {
      for (let i = 0; i < bucket.length; i++) {
        const entry = bucket[i]
        if (flatArgsEqual(args, entry.values, entry.counts)) return entry
      }
    }
    return undefined
  }

  const get = (...args: any[]) => {
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
          scalars = new Map()
        }
        return out
      }
    }

    const hash = flatHashOrNull(args)

    if (hash !== null) {
      let bucket = buckets.get(hash)
      const hit = scan(bucket, args)
      if (hit) return hit.out

      // Fall through to the previous generation, promoting on hit so a live entry
      // survives the next rotation.
      const priorBucket = priorBuckets.get(hash)
      const priorHit = scan(priorBucket, args)
      if (priorHit) {
        if (!bucket) {
          bucket = []
          buckets.set(hash, bucket)
        }
        bucket.push(priorHit)
        if (bucket.length > MAX_BUCKET) bucket.shift()
        return priorHit.out
      }

      // Snapshot before calling: the hash was taken from the arguments as they are
      // now, so capturing them afterwards would file post-call values under a
      // pre-call hash and make the entry permanently unreachable if `fn` ever
      // mutated what it was given.
      const snap = snapshotArgs(args)
      const out = fn(...args)
      if (!bucket) {
        bucket = []
        buckets.set(hash, bucket)
      }
      bucket.push({ values: snap.values, counts: snap.counts, out })
      if (bucket.length > MAX_BUCKET) bucket.shift()
      if (buckets.size > MAX_ENTRIES) {
        priorBuckets = buckets
        buckets = new Map()
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
      strings = new Map()
    }
    return out
  }

  return get as T
}
