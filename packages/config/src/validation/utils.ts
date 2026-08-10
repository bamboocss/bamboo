import { isObject, isString } from '@bamboocss/shared'

/**
 * A reference to another token: `token(colors.red.300)`.
 *
 * Deliberately a copy of the regex in `@bamboocss/token-dictionary`, which this package does not
 * depend on. The two must agree: validation is what reports a missing or circular reference, so a
 * spelling only the dictionary understands is one this never checks — which is silence, not an
 * error, and exactly what a spelling change here is most likely to cause.
 */
const REFERENCE_REGEX = /token\(([^(),]+)\)/g

export const isValidToken = (token: unknown) => isObject(token) && Object.hasOwnProperty.call(token, 'value')
export const isTokenReference = (value: unknown) => typeof value === 'string' && getReferences(value).length > 0

/**
 * The retired curly reference — `{colors.red.300}`, or `{$spacing-2}` under a custom
 * `formatTokenName`. A copy of the regex in `@bamboocss/token-dictionary`, which this package
 * does not depend on.
 *
 * Reported here as well as there because a *token* value carrying one is the worse case: the
 * text is emitted into the stylesheet rather than dropped, and validation is the only thing that
 * can name which token it came from.
 */
const CURLY_REFERENCE = /\{[^{}\s:;"']+\}/

export const findCurlyReference = (value: string) =>
  value.includes('{') ? (CURLY_REFERENCE.exec(value)?.[0] ?? undefined) : undefined

/** The retired `token(path, fallback)` form. See `findCurlyReference` for why these fail. */
const FALLBACK_REFERENCE = /token\([^(),]+,[^()]*\)/

export const findFallbackReference = (value: string) =>
  value.includes('token(') ? (FALLBACK_REFERENCE.exec(value)?.[0] ?? undefined) : undefined

export const formatPath = (path: string) => path
export const SEP = '.'

export function getReferences(value: string) {
  if (typeof value !== 'string') return []

  return [...value.matchAll(REFERENCE_REGEX)].map((match) => match[1]!.trim().split('/')[0]!).filter(Boolean)
}

export const serializeTokenValue = (value: any): string => {
  if (isString(value)) {
    return value
  }

  if (isObject(value)) {
    return Object.values(value)
      .map((v) => serializeTokenValue(v))
      .join(' ')
  }

  if (Array.isArray(value)) {
    return value.map((v) => serializeTokenValue(v)).join(' ')
  }

  return value.toString()
}
