/**
 * Contribution hash parsing, and JSON capture that survives a round trip with its key order.
 *
 * This is what remains of the owner-contribution codec: the encoder still parses the composite
 * hashes it interns, and still needs to snapshot an inline recipe's config as plain JSON while
 * preserving the key order the config was authored in, because that order reaches class names.
 * The versioned `StyleContribution` DTO and its validated replay went with the persistent
 * extraction cache they were built for.
 */
export type StyleContributionJson =
  | null
  | boolean
  | number
  | string
  | StyleContributionJson[]
  | StyleContributionJsonObject

export interface StyleContributionJsonObject {
  [key: string]: StyleContributionJson
}

export interface StyleContributionJsonObjectOrder {
  order: number
  path: Array<string | number>
  keys: string[]
}

export class StyleContributionError extends TypeError {
  constructor(message: string) {
    super(`Invalid StyleContribution: ${message}`)
    this.name = 'StyleContributionError'
  }
}

const HASH_SEPARATOR = ']___['
const HASH_FIELD_ORDER = ['cond', 'recipe', 'layer', 'slot'] as const
const HASH_FIELDS = new Set<string>(HASH_FIELD_ORDER)
const UNSAFE_KEYS = new Set(['__proto__', 'constructor', 'prototype'])
export interface ParsedContributionHash {
  prop: string
  value: string
  cond?: string
  recipe?: string
  layer?: string
  slot?: string
}

/**
 * Validate the flattened representation without pretending it is a reversible source codec.
 * Values are deliberately left as strings; only the segments the current decoder understands
 * are accepted.
 */
export const parseContributionHash = (hash: string, path = 'hash'): ParsedContributionHash => {
  if (!hash) fail(path, 'must not be empty')

  const parts = hash.split(HASH_SEPARATOR)
  if (parts.length < 2 || !parts[0] || !parts[1].startsWith('value:')) {
    fail(path, 'is not a StyleEncoder hash')
  }

  const parsed: ParsedContributionHash = {
    prop: parts[0],
    value: parts[1].slice('value:'.length),
  }
  let lastField = -1

  for (let index = 2; index < parts.length; index++) {
    const segment = parts[index]
    const colon = segment.indexOf(':')
    if (colon <= 0) fail(path, `contains malformed segment ${JSON.stringify(segment)}`)

    const key = segment.slice(0, colon)
    const value = segment.slice(colon + 1)
    if (!HASH_FIELDS.has(key) || !value) fail(path, `contains unsupported segment ${JSON.stringify(segment)}`)

    const fieldIndex = HASH_FIELD_ORDER.indexOf(key as (typeof HASH_FIELD_ORDER)[number])
    if (fieldIndex <= lastField || Object.hasOwn(parsed, key)) {
      fail(path, `contains duplicate or out-of-order ${JSON.stringify(key)} segment`)
    }
    lastField = fieldIndex
    ;(parsed as unknown as Record<string, string>)[key] = value
  }

  return parsed
}

/** Parse and strictly validate canonical contribution bytes (or an already-parsed value). */
export const captureStyleContributionJsonObject = (
  input: unknown,
  path = '$',
): { value: StyleContributionJsonObject; objectOrder: StyleContributionJsonObjectOrder[] } => {
  const objectOrder: StyleContributionJsonObjectOrder[] = []
  const value = canonicalJson(input, path, objectOrder, [])
  if (!value || Array.isArray(value) || typeof value !== 'object') fail(path, 'must be a JSON object')
  return { value: value as StyleContributionJsonObject, objectOrder }
}

/** Rebuild the exact enumerable property order represented by a canonical object plus order metadata. */
export const restoreStyleContributionJsonObject = (
  value: StyleContributionJsonObject,
  objectOrder: StyleContributionJsonObjectOrder[],
): StyleContributionJsonObject => {
  const byPath = new Map(objectOrder.map((entry) => [JSON.stringify(entry.path), entry.keys] as const))
  const restore = (input: StyleContributionJson, path: Array<string | number>): StyleContributionJson => {
    if (Array.isArray(input)) return input.map((item, index) => restore(item, [...path, index]))
    if (!input || typeof input !== 'object') return input

    const keys = byPath.get(JSON.stringify(path))
    if (!keys) throw new StyleContributionError(`missing object-order metadata for ${JSON.stringify(path)}`)
    const result: StyleContributionJsonObject = {}
    for (const key of keys) {
      Object.defineProperty(result, key, {
        configurable: true,
        enumerable: true,
        writable: true,
        value: restore(input[key], [...path, key]),
      })
    }
    return result
  }
  return restore(value, []) as StyleContributionJsonObject
}

const recordValue = (input: unknown, path: string): Record<string, unknown> => {
  if (!input || typeof input !== 'object' || Array.isArray(input)) fail(path, 'must be an object')
  const value = input as object
  const proto = Object.getPrototypeOf(value)
  if (proto !== Object.prototype && proto !== null) fail(path, 'has an unsafe prototype')

  for (const key of Reflect.ownKeys(value)) {
    if (typeof key !== 'string') fail(path, 'contains a symbol key')
    const name = key as string
    if (UNSAFE_KEYS.has(name)) fail(path, `contains unsafe key ${JSON.stringify(name)}`)
    const descriptor = Object.getOwnPropertyDescriptor(value, name)!
    if (!descriptor.enumerable || !('value' in descriptor)) {
      fail(path, `contains unsafe property ${JSON.stringify(name)}`)
    }
  }
  return value as Record<string, unknown>
}

const arrayValue = (input: unknown, path: string): unknown[] => {
  if (!Array.isArray(input) || Object.getPrototypeOf(input) !== Array.prototype) fail(path, 'must be an array')
  const value = input as unknown[]
  const keys = Reflect.ownKeys(value)
  for (const key of keys) {
    if (key === 'length') continue
    if (typeof key !== 'string' || !/^(?:0|[1-9]\d*)$/.test(key) || Number(key) >= value.length) {
      fail(path, 'contains a non-JSON array property')
    }
  }
  for (let index = 0; index < value.length; index++) {
    if (!Object.hasOwn(value, index)) fail(`${path}[${index}]`, 'must not be an array hole')
    const descriptor = Object.getOwnPropertyDescriptor(value, String(index))!
    if (!descriptor.enumerable || !('value' in descriptor)) fail(`${path}[${index}]`, 'must be a plain value')
  }
  return value
}

const canonicalJson = (
  input: unknown,
  path: string,
  objectOrder?: StyleContributionJsonObjectOrder[],
  segments: Array<string | number> = [],
  ancestors = new Set<object>(),
): StyleContributionJson => {
  if (input === null || typeof input === 'boolean' || typeof input === 'string') return input
  if (typeof input === 'number') {
    if (!Number.isFinite(input)) fail(path, 'contains a non-finite number')
    return Object.is(input, -0) ? 0 : input
  }
  if (Array.isArray(input)) {
    const values = arrayValue(input, path)
    if (ancestors.has(values)) fail(path, 'contains a cycle')
    ancestors.add(values)
    const result = values.map((value, index) =>
      canonicalJson(value, `${path}[${index}]`, objectOrder, [...segments, index], ancestors),
    )
    ancestors.delete(values)
    return result
  }
  if (typeof input === 'object') {
    const source = recordValue(input, path)
    if (ancestors.has(source)) fail(path, 'contains a cycle')
    ancestors.add(source)
    const result: StyleContributionJsonObject = {}
    const sourceKeys = Object.keys(source)
    objectOrder?.push({ order: objectOrder.length, path: segments, keys: [...sourceKeys] })
    for (const key of [...sourceKeys].sort()) {
      Object.defineProperty(result, key, {
        configurable: true,
        enumerable: true,
        writable: true,
        value: null,
      })
    }
    // Integer-like keys have a language-defined enumeration order regardless of insertion.
    // Traverse the canonical object's actual order so metadata has one platform-stable DFS.
    for (const key of Object.keys(result)) {
      result[key] = canonicalJson(source[key], `${path}.${key}`, objectOrder, [...segments, key], ancestors)
    }
    ancestors.delete(source)
    return result
  }
  return fail(path, `contains unsupported ${typeof input} value`)
}

const fail = (path: string, message: string): never => {
  throw new StyleContributionError(`${path} ${message}`)
}
