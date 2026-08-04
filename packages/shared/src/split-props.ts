type Dict = Record<string, unknown>
type PredicateFn = (key: string) => boolean
type Key = PredicateFn | string[]

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

      // `own` comes from `ownKeys`, which a proxy may answer with keys it then reports no
      // descriptor for, and a predicate with a side effect can delete one in between. The
      // cast that used to stand here turned that into a crash.
      const descriptor = Object.getOwnPropertyDescriptor(props, key)
      if (!descriptor) continue

      // `'get' in descriptor` rather than a truthiness test: an accessor declared with an
      // undefined getter is still an accessor, and assigning its value would turn a
      // silent no-op into a write.
      if ('get' in descriptor || 'set' in descriptor || !descriptor.enumerable || key === '__proto__') {
        Object.defineProperty(clone, key, descriptor)
      } else {
        clone[key] = descriptor.value
      }

      taken.add(key)
    }

    return clone
  }

  return keys.map((key) => split(Array.isArray(key) ? key : allKeys.filter(key))).concat(split(allKeys))
}
