import { FALLBACK_SEPARATOR } from './fallback-value'

const importantRegex = /\s*!(important)?/i
const whitespaceRegex = /\s/

// The four below run per style leaf on every `css()` cache miss, and for the values that
// dominate real style objects — `red`, `4px`, `lg` — all four are no-ops. Each is guarded by
// the cheapest search that can prove it has nothing to do, so a plain token pays a scan
// rather than a regex rewrite.
//
// The guards are exact rather than approximate, which is the only reason they are safe:
//
// - `importantRegex` cannot match without a literal `!` — `\s*` is nullable and the group is
//   optional, so `!` is its one mandatory atom. Its absence rules out `isImportant` and the
//   `replace` half of `withoutImportant`, but not the `trim`, which still has to run.
// - `/\s/` is exactly the class `[\n\s]+` matches; `\n` is already a member. `\s` is a fixed
//   spec-defined set rather than a Unicode property, so the missing `u` flag changes nothing.
//   It includes U+FEFF and excludes U+200B, and a guard that got either wrong would be silent.
// - `trim()` strips WhiteSpace ∪ LineTerminator, the same set again.

/**
 * Collapse every run of whitespace to a single space, which is what the class name is
 * built from. Exported because `leafClass` has to reproduce this exact pipeline, and a
 * second copy of it would be free to drift from the one `createCss` runs.
 */
export function sanitize<T>(value: T): T {
  if (typeof value !== 'string') return value
  const collapsed = whitespaceRegex.test(value) ? value.replaceAll(/[\n\s]+/g, ' ') : value
  // NUL is what a `fallback(...)` joins its candidates with on the way to `stringify`. It
  // cannot appear in CSS, but it can appear in a JS string, and one arriving from pasted or
  // generated content would be split into declarations nobody wrote — and would put a raw
  // NUL in the class name, which the CSS parser rewrites to U+FFFD so the rule stops
  // matching the element. Author values never carry it past here.
  return (collapsed.includes(FALLBACK_SEPARATOR) ? collapsed.replaceAll(FALLBACK_SEPARATOR, '') : collapsed) as T
}

export function isImportant<T extends string | number | boolean>(value: T) {
  if (typeof value !== 'string') return false
  return value.includes('!') && importantRegex.test(value)
}

// `string | T` is stated rather than inferred: `T` is a literal type at most call sites, and
// letting these return `T` would promise the caller back the string it passed while handing
// it a rewritten one.
export function withoutImportant<T extends string | number | boolean>(value: T): string | T {
  if (typeof value !== 'string') return value
  if (!value.includes('!')) return value.trim()
  return value.replace(importantRegex, '').trim()
}

export function withoutSpace<T extends string | number | boolean>(str: T): string | T {
  if (typeof str !== 'string') return str
  return str.includes(' ') ? str.replaceAll(' ', '_') : str
}

type Dict = Record<string, unknown>

export function markImportant(obj: Dict) {
  if (typeof obj !== 'object' || obj === null) {
    return obj
  }

  const result = Array.isArray(obj) ? [] : {}
  const stack = [{ obj, result }] as { obj: Dict; result: Dict }[]

  while (stack.length > 0) {
    const { obj, result } = stack.pop()!
    for (const [key, value] of Object.entries(obj)) {
      if (typeof value === 'string' && value.includes(FALLBACK_SEPARATOR)) {
        // Every candidate of a fallback carries the mark, not just the last one. Marking
        // only the winning declaration would leave the others losing an important-priority
        // fight in exactly the browsers that have to fall back to them.
        result[key] = value
          .split(FALLBACK_SEPARATOR)
          .map((candidate) => `${candidate} !important`)
          .join(FALLBACK_SEPARATOR)
      } else if (typeof value === 'string' || typeof value === 'number') {
        result[key] = `${value} !important`
      } else if (typeof value === 'object' && value !== null) {
        const next = Array.isArray(value) ? [] : {}
        result[key] = next
        stack.push({ obj: value as Dict, result: next })
      } else {
        result[key] = value
      }
    }
  }

  return result
}
