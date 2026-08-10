import { esc } from '@bamboocss/shared'

/**
 * Expand `token(path)` references in a string value to whatever `resolve` returns for the path.
 *
 * This was a 180-line character-state parser, and every line of it was there for the fallback
 * form — `token(a, b)`, which could nest arbitrarily as `token(a, token(b, var(--c, blue)))`.
 * With the fallback gone the grammar has no recursion left in it, so one regex covers it.
 *
 * A path that resolves to nothing is escaped rather than dropped, so it survives into the class
 * name as written instead of silently becoming empty.
 */
const REFERENCE = /token\(([^()]+)\)/g

export const expandTokenReferences = (str: string, resolve: (path: string) => string | undefined) => {
  if (!str.includes('token(')) return str

  return str.replace(REFERENCE, (_match, path: string) => {
    const trimmed = path.trim()
    return resolve(trimmed) ?? esc(trimmed)
  })
}
