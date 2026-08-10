import { logger } from '@bamboocss/logger'
import { BambooError, esc, isObject } from '@bamboocss/shared'
import type { Token } from '@bamboocss/types'

/* -----------------------------------------------------------------------------
 * Token references
 * -----------------------------------------------------------------------------*/

/**
 * A reference to another token inside a string value: `token(colors.red.300)`.
 *
 * The comma exclusion keeps a fallback form — `token(spacing.4, 4)` — out of this pass
 * deliberately: only `expandTokenReferences` can resolve one, and matching it here would report a
 * reference where none is substitutable.
 */
const REFERENCE_REGEX = /token\(([^(),]+)\)/g

/**
 * How a reference to `key` is spelled, for a caller building one rather than reading one.
 *
 * The one place that knows, so retiring a spelling is an edit here rather than a search for
 * string concatenation across three packages.
 */
export const referenceOf = (key: string) => `token(${key})`

/** Replaces every reference to `key`, so a caller need not spell one itself. */
export const replaceReference = (value: string, key: string, replacement: string) =>
  value.replaceAll(referenceOf(key), replacement)

/**
 * Returns all references in a string
 *
 * @example
 *
 * `token(colors.red.300) token(sizes.sm)` => ['colors.red.300', 'sizes.sm']
 */
export function getReferences(value: string) {
  if (typeof value !== 'string') return []
  return [...value.matchAll(REFERENCE_REGEX)].map((match) => match[1]!.trim()).filter(Boolean)
}

export const hasReference = (value: string) => getReferences(value).length > 0

/**
 * The retired curly reference — `{colors.red.300}`, or `{$spacing-2}` under a custom
 * `formatTokenName`.
 *
 * Detected in order to *fail*, because leaving it alone is silent in both directions: in a style
 * value the declaration is dropped, and in a token value the literal text is emitted into the
 * stylesheet. Neither reports itself and neither is valid css.
 *
 * Safe to throw on because the spelling was never available for anything else. Until it was
 * removed, `{…}` in a value was consumed unconditionally — braces stripped, and an unresolved
 * path emitted bare — so no literal `{a.b}` could have survived to mean itself. There is no
 * legitimate use to break, which is what separates this from a strict-mode opinion.
 *
 * Excludes whitespace, quotes and `:` so a `content` string holding json-ish text is not read as
 * a stale reference.
 */
const CURLY_REFERENCE = /\{[^{}\s:;"']+\}/

/** The stale spelling in `value`, or `undefined`. Guarded, since this runs per style value. */
export const findCurlyReference = (value: string) =>
  value.includes('{') ? (CURLY_REFERENCE.exec(value)?.[0] ?? undefined) : undefined

/**
 * The retired fallback form — `token(spacing.4, 4)`.
 *
 * Removed along with the parser that existed to read it. A pattern that needed "this token, or
 * this literal" now asks `PatternHelpers.token()` and emits the answer, so the question is
 * settled where it can be answered rather than deferred into a string.
 *
 * Detected in order to fail: left alone, the comma keeps it out of `REFERENCE_REGEX`, so it is
 * emitted into the stylesheet as text — the same silence the curly form had.
 */
const FALLBACK_REFERENCE = /token\([^(),]+,[^()]*\)/

export const findFallbackReference = (value: string) =>
  value.includes('token(') ? (FALLBACK_REFERENCE.exec(value)?.[0] ?? undefined) : undefined

/** Shared wording, so the config and style-value paths say the same thing. */
export const curlyReferenceMessage = (found: string, where: string) => {
  const path = found.slice(1, -1)

  return (
    `\`${found}\` in ${where} is the retired token reference syntax. Write \`token(${path})\` instead.\n\n` +
    `Curly references were removed so a token is referenced one way. They are not ignored quietly: in a style value ` +
    `the declaration is dropped, and in a token value the text is emitted into the stylesheet as-is.`
  )
}

const notFoundMessage = (key: string, value: string) => `Reference not found: \`${key}\` in "${value}"`

export function expandReferences(value: string, fn: (key: string) => string) {
  if (!hasReference(value)) return value

  const references = getReferences(value)

  return references.reduce((valueStr, key) => {
    const resolved = fn(key)
    if (!resolved) {
      logger.warn('token', notFoundMessage(key, value))
    }
    const expandedValue = resolved ?? esc(key)

    return replaceReference(valueStr, key, expandedValue)
  }, value)
}

/** The same, for the fallback form. */
export const fallbackReferenceMessage = (found: string, where: string) => {
  const path = found.slice('token('.length, found.lastIndexOf(',')).trim()

  return (
    `\`${found}\` in ${where} uses the retired \`token(path, fallback)\` form. Write \`token(${path})\` instead.\n\n` +
    `The fallback was removed with the parser that read it. A value that may not name a token is resolved where that ` +
    `can be answered — \`PatternHelpers.token(path, fallback)\` in a pattern — rather than deferred into a string.`
  )
}

/* -----------------------------------------------------------------------------
 * Shared token utilities
 * -----------------------------------------------------------------------------*/

/**
 * Converts a JS Map to an object
 */
export function mapToJson(map: Map<string, any>) {
  const obj: Record<string, unknown> = {}
  map.forEach((value, key) => {
    if (value instanceof Map) {
      obj[key] = Object.fromEntries(value)
    } else {
      obj[key] = value
    }
  })
  return obj
}

/* -----------------------------------------------------------------------------
 * Token assertions
 * -----------------------------------------------------------------------------*/

export const isToken = (value: any): value is Token => {
  return isObject(value) && 'value' in value
}

export function assertTokenFormat(token: any): asserts token is Token {
  if (!isToken(token)) {
    throw new BambooError('INVALID_TOKEN', `Invalid token format: ${JSON.stringify(token)}`)
  }
}
