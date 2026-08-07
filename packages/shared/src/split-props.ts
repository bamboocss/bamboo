type Dict = Record<string, unknown>
type PredicateFn = (key: string) => boolean
type Key = PredicateFn | string[]

/**
 * Move one key into a bucket, keeping whatever about it is observable.
 *
 * Shared by both paths below so there is one implementation of the descriptor rules rather
 * than two to keep in step. The rules themselves are documented on `splitProps`.
 */
const copyKey = (props: Dict, target: Dict, key: string): boolean => {
  // `own` said this key exists, but a proxy may answer `ownKeys` with a key it then reports
  // no descriptor for, and a predicate with a side effect can delete one in between.
  const descriptor = Object.getOwnPropertyDescriptor(props, key)
  if (!descriptor) return false

  // `'get' in descriptor` rather than a truthiness test: an accessor declared with an
  // undefined getter is still an accessor, and assigning its value would turn a silent
  // no-op into a write.
  if ('get' in descriptor || 'set' in descriptor || !descriptor.enumerable || key === '__proto__') {
    Object.defineProperty(target, key, descriptor)
  } else {
    target[key] = descriptor.value
  }
  return true
}

/**
 * One array group, which is what every call site in this project passes — a recipe's
 * `variantKeys`.
 *
 * The general path below is built for several groups that may be predicates, and pays for
 * that shape on every call: a closure per group, a `map` and a `concat` to assemble the
 * result, and a branch per group to tell an array from a predicate. None of it is reachable
 * with one array group.
 *
 * What it does *not* skip is the part that looks skippable. `own` stays, because membership
 * has to be answered from `ownKeys` rather than by asking the object: on a proxy — which is
 * what Solid's `mergeProps` hands over — every question is a trap, and a recipe naming eight
 * variants would otherwise fire eight traps to learn what one `ownKeys` already said. And
 * the two passes stay separate, because the group bucket is in *group* order while the rest
 * bucket is in *props* order, and that ordering reaches the emitted CSS.
 */
const splitOneGroup = (props: Dict, allKeys: string[], group: string[]) => {
  const own = new Set(allKeys)
  const taken = new Set<string>()

  const picked = {} as Dict
  for (let i = 0; i < group.length; i++) {
    const key = group[i] as string
    if (taken.has(key) || !own.has(key)) continue
    if (copyKey(props, picked, key)) taken.add(key)
  }

  const rest = {} as Dict
  for (let i = 0; i < allKeys.length; i++) {
    const key = allKeys[i] as string
    if (taken.has(key)) continue
    copyKey(props, rest, key)
  }

  return [picked, rest]
}

/**
 * Deal a props object into one bucket per key group, plus a final bucket for the rest.
 * A key goes to the first group that claims it.
 *
 * ## Why the descriptor is read per key rather than in bulk
 *
 * This used to call `Object.getOwnPropertyDescriptors` for the whole object and
 * `defineProperty` for every key it moved. Copying plain values instead is 2.4–2.9x faster
 * on the shapes that allow it, but it is only correct where props are data — and they are
 * not always. Solid compiles props to accessors, so reading one eagerly runs whatever it
 * wraps: splitting a component's props would construct its children before the surrounding
 * provider exists.
 *
 * So the descriptor is fetched per key, and the value path is taken only when it changes
 * nothing observable. An accessor keeps its laziness, a non-enumerable key keeps its
 * invisibility, and `__proto__` is defined rather than assigned so it stays an own
 * property instead of reaching the prototype setter.
 *
 * The one thing the value path drops is `writable`/`configurable`, so a bucket key taken
 * from frozen props is writable where it used to be frozen. Nothing here relies on that,
 * and preserving it would mean `defineProperty` on the common path — the cost this exists
 * to avoid. Keys that take the descriptor path keep theirs, so a bucket can be
 * inconsistent in that one respect.
 *
 * Key order within a bucket is preserved exactly. It is not cosmetic: `cva` merges
 * variant props in iteration order, and the parser reads the rest bucket as the style
 * props it encodes, so order reaches the emitted CSS.
 */
export function splitProps(props: Dict, ...keys: Key[]) {
  // Own keys whether enumerable or not, matching the descriptor map this replaced.
  const allKeys = Object.getOwnPropertyNames(props)

  if (keys.length === 1 && Array.isArray(keys[0])) {
    return splitOneGroup(props, allKeys, keys[0] as string[])
  }

  // Membership is answered from this rather than by asking the object, so a named group
  // listing keys the props do not have costs nothing. On a proxy — which is what Solid's
  // `mergeProps` hands over — every question is a trap, and a recipe naming eight
  // variants would otherwise fire eight traps to learn what one `ownKeys` already said.
  const own = new Set(allKeys)
  const taken = new Set<string>()

  const split = (group: string[]) => {
    const clone = {} as Dict

    for (let i = 0; i < group.length; i++) {
      const key = group[i] as string
      // Own properties only, and never twice. Reading the bulk descriptor map by key used
      // to resolve through `Object.prototype`, so a group naming `toString` or
      // `constructor` was handed one and put `undefined` in its bucket.
      if (taken.has(key) || !own.has(key)) continue

      if (copyKey(props, clone, key)) taken.add(key)
    }

    return clone
  }

  /**
   * The predicate is called with the key alone.
   *
   * Handing it to `filter` passes `(key, index, allKeys)`. A one-parameter predicate cannot
   * see the extras, but a memoized one reads its whole argument list — and the predicates
   * that arrive here are memoized, `isCssProperty` among them. So the memo hashed the entire
   * key array once per prop, and keyed its cache on it: two elements with different prop sets
   * shared no entry even for the same prop name.
   *
   * Worth ~9.7x on that path, and nothing at all on a plain predicate — which is why the
   * bench below it needs a memoized case to see this at all.
   *
   * A loop rather than `filter((k) => key(k))` because the wrapper allocates a closure per
   * group. The two measure the same to within noise; the loop just does not need one.
   */
  const matching = (predicate: PredicateFn) => {
    const group: string[] = []
    for (let i = 0; i < allKeys.length; i++) {
      const key = allKeys[i] as string
      if (predicate(key)) group.push(key)
    }
    return group
  }

  return keys.map((key) => split(Array.isArray(key) ? key : matching(key))).concat(split(allKeys))
}
