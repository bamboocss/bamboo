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

const tokenFunctionRegex = /token\(([^)]+)\)/g
const closingParenthesisRegex = /\)$/g
const hasTokenReference = (str: string) => str.includes('token(')

const tokenReplacer = (a: string, b?: string) =>
  b ? (a.endsWith(')') ? a.replace(closingParenthesisRegex, `, ${b})`) : `var(${a}, ${b})`) : a

const notFoundMessage = (key: string, value: string) => `Reference not found: \`${key}\` in "${value}"`

const isTokenReference = (v: string) => hasReference(v) || hasTokenReference(v)

export function expandReferences(value: string, fn: (key: string) => string) {
  if (!isTokenReference(value)) return value

  const references = getReferences(value)

  const expanded = references.reduce((valueStr, key) => {
    const resolved = fn(key)
    if (!resolved) {
      logger.warn('token', notFoundMessage(key, value))
    }
    const expandedValue = resolved ?? esc(key)

    return replaceReference(valueStr, key, expandedValue)
  }, value)

  if (!expanded.includes(`token(`)) return expanded

  return expanded.replace(tokenFunctionRegex, (_, token) => {
    const [tokenValue, tokenFallback] = token.split(',').map((s: string) => s.trim())

    const result = [tokenValue, tokenFallback].filter(Boolean).map((key) => {
      const resolved = fn(key)

      if (!resolved && isTokenReference(key)) {
        logger.warn('token', notFoundMessage(key, value))
      }

      return resolved ?? esc(key)
    })

    if (result.length > 1) {
      const [a, b] = result
      return tokenReplacer(a, b)
    }

    return tokenReplacer(result[0])
  })
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
