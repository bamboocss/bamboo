import { toHash } from './hash'

/**
 * The slots a `viewTransition()` bag accepts, in the order they are emitted.
 *
 * Anything else in the options object is ignored — including by the hash, so adding a
 * comment key or spreading an unrelated object does not fork the class name.
 */
export const viewTransitionSlots = ['group', 'imagePair', 'old', 'new'] as const

export type ViewTransitionSlot = (typeof viewTransitionSlots)[number]

/**
 * The `::view-transition-*` pseudo-element each slot maps to. Only `imagePair` differs
 * from its key, since the CSS name is kebab-case.
 */
export const viewTransitionPseudo: Record<ViewTransitionSlot, string> = {
  group: 'view-transition-group',
  imagePair: 'view-transition-image-pair',
  old: 'view-transition-old',
  new: 'view-transition-new',
}

/**
 * Serialize a value with object keys sorted, so two style objects that differ only in
 * authoring order hash to the same class.
 *
 * Values JSON has no encoding for (`undefined`, functions, symbols) serialize as `null`
 * rather than being dropped. Nothing reaches here holding one — `filterSlots` removes
 * nullish slots, and the extractor drops nullish leaves — so this is only a floor: it
 * keeps a hole in an array from shifting the elements after it.
 *
 * Not exported. The name promises a general-purpose stable serializer, and this is not
 * one; `viewTransitionClassName` is the whole reason it exists.
 */
function stableStringify(value: unknown): string {
  if (value === null) return 'null'

  const type = typeof value

  if (type === 'boolean') return value ? 'true' : 'false'
  if (type === 'number') return Number.isFinite(value) ? String(value) : 'null'
  if (type === 'string') return JSON.stringify(value)

  if (Array.isArray(value)) {
    let out = '['
    for (let index = 0; index < value.length; index++) {
      if (index) out += ','
      out += stableStringify(value[index])
    }
    return out + ']'
  }

  if (type === 'object') {
    const keys = Object.keys(value as object).sort()
    let out = '{'
    for (let index = 0; index < keys.length; index++) {
      if (index) out += ','
      const key = keys[index]
      out += JSON.stringify(key) + ':' + stableStringify((value as Record<string, unknown>)[key])
    }
    return out + '}'
  }

  return 'null'
}

/**
 * Keep the four known slots, dropping any that is nullish.
 *
 * Both halves of the contract have to agree on what an empty slot is, and only one of
 * them gets a choice. The extractor evaluates the source, and a nullish property is gone
 * from what it hands over — `{ new: undefined }` and `{}` reach the build identically.
 * So absent, `undefined` and `null` collapse here too, and `new: enabled ? {…} : null`
 * hashes to the bag it actually styles.
 */
function filterSlots(options: unknown): Record<string, unknown> {
  const filtered: Record<string, unknown> = {}
  if (!options || typeof options !== 'object') return filtered

  for (const slot of viewTransitionSlots) {
    const value = (options as Record<string, unknown>)[slot]
    if (value != null) filtered[slot] = value
  }

  return filtered
}

/**
 * The class a `viewTransition()` call resolves to.
 *
 * This is the whole contract between the build and the runtime: the extractor hashes the
 * options it found in the source, the generated `viewTransition()` hashes the options it
 * is called with, and the CSS only reaches the element if the two agree. They agree by
 * construction — both call this function — but only over what the extractor can see. A
 * value it cannot resolve statically is absent from its side and present on the runtime's,
 * which is why a bag has to be a static object literal to be styled at all.
 *
 * The class is used twice, as the `view-transition-class` value and as the argument to
 * `::view-transition-*(.cls)`, so the prefix applies to both.
 */
export function viewTransitionClassName(options: unknown, prefix = ''): string {
  const base = 'vt_' + toHash(stableStringify(filterSlots(options)))
  return prefix ? prefix + '-' + base : base
}
