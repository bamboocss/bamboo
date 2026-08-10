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
