const FALLBACK_FN = 'fallback('

/**
 * Joins the declarations of a fallback value into the single string that carries them to
 * `stringify`.
 *
 * A style object cannot hold one property twice, and the obvious carrier — an array — is
 * already taken: `stringify` reads one under a declaration as a comma-separated list, which
 * is how a custom utility returns a font stack, and `normalizeStyleObject` rejects one
 * written as a style value outright. A string is the only shape that survives the walk, the
 * encoder, the memo, `mergeProps` and `lodash.merge` without any of them ascribing a meaning
 * to it, so the candidates travel joined and `stringify` splits them at the end.
 *
 * NUL cannot appear in a CSS value, so nothing can collide with it.
 */
export const FALLBACK_SEPARATOR = '\u0000'

/** Whether a value is written as a `fallback(...)` call, however malformed. */
export function isFallbackCall(value: unknown): value is string {
  return typeof value === 'string' && value.trimStart().startsWith(FALLBACK_FN)
}

/**
 * Split the candidates of a `fallback(...)` value, most-preferred first.
 *
 * Only a value that is *entirely* one `fallback(...)` call is a fallback. `1px solid
 * fallback(a, b)` is not, and neither is `fallback(a), fallback(b)` — a candidate list has
 * no meaning as part of a larger value, and treating one as if it did would emit a
 * declaration per candidate for a value the author meant to be single.
 *
 * Returns `undefined` for everything else. When the value did start with `fallback(`, that
 * return means the call is malformed rather than absent, which `isFallbackCall` separates
 * so the caller can say so instead of emitting the text verbatim as invalid CSS.
 *
 * @example
 * parseFallbackValue('fallback(100dvh, 100vh)') // ['100dvh', '100vh']
 * parseFallbackValue('fallback(calc(1px + 2px), 3px)') // ['calc(1px + 2px)', '3px']
 * parseFallbackValue('100dvh') // undefined
 */
export function parseFallbackValue(value: unknown): string[] | undefined {
  if (typeof value !== 'string') return undefined

  // This runs on every style entry and almost none of them are a fallback list, so the
  // reject has to come before `trim()` — that allocates, and paying for it per declaration
  // to answer "no" is pure cost. `includes` allocates nothing.
  if (!value.includes(FALLBACK_FN)) return undefined

  const trimmed = value.trim()
  if (!trimmed.startsWith(FALLBACK_FN) || !trimmed.endsWith(')')) return undefined

  const inner = trimmed.slice(FALLBACK_FN.length, -1)
  const candidates: string[] = []

  let depth = 0
  let brackets = 0
  let quote: string | undefined
  let start = 0

  for (let i = 0; i < inner.length; i++) {
    const char = inner[i]

    if (quote) {
      if (char === '\\') {
        // Skip what the backslash escapes, so an escaped quote does not close the string
        // and an escaped backslash does not make the next quote look escaped.
        i++
      } else if (char === quote) {
        quote = undefined
      }
      continue
    }

    if (char === '"' || char === "'") {
      quote = char
    } else if (char === '(') {
      depth++
    } else if (char === ')') {
      // Closing past our own call means the head `fallback(` was never the whole value —
      // `fallback(a), b` reaches here, and is not a candidate list.
      if (depth === 0) return undefined
      depth--
    } else if (char === '[') {
      // The arbitrary-value escape hatch nests like parens do, and its contents routinely
      // hold commas — `fallback([color, background-color], all)`. Splitting inside one
      // produces candidates that are not CSS at all.
      brackets++
    } else if (char === ']') {
      if (brackets === 0) return undefined
      brackets--
    } else if (char === ',' && depth === 0 && brackets === 0) {
      candidates.push(inner.slice(start, i).trim())
      start = i + 1
    }
  }

  if (depth !== 0 || brackets !== 0 || quote) return undefined
  candidates.push(inner.slice(start).trim())

  const values = candidates.filter(Boolean)
  return values.length ? values : undefined
}
