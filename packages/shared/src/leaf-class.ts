import { isImportant, sanitize, withoutImportant, withoutSpace } from './important'

/**
 * The class a single dynamic style leaf resolves to, given the prefix its property and
 * condition path produce.
 *
 * ## Why this can exist at all
 *
 * `css()` builds a class from the value alone — `utility.transform` is string
 * construction over a static map, and nothing consults which rules were actually emitted.
 * So `css({ color: tone })` already returns `c_<tone>` for a value the extractor never
 * saw, with no CSS behind it. Reproducing that string here cannot be less correct than
 * the call it replaces; it just skips the object literal, the merge and the memo.
 *
 * ## Why it is not a template literal
 *
 * Three shapes do not reduce to `prefix + value`, and all three return `undefined` so the
 * caller runs `css()` instead:
 *
 * - An array is expanded to a responsive object by `normalizeStyleObject`, so it produces
 *   one class per breakpoint rather than one class.
 * - An object is a condition block, walked into for the same reason.
 * - `null` and `undefined` are skipped by the walk entirely, which is an empty string
 *   rather than a class — that one is answered here, since it needs no `css()` call.
 *
 * ## Why the character scan
 *
 * The remaining work — collapsing whitespace, stripping `!important`, turning spaces into
 * underscores — is three regexes, and paying them per call makes this *slower* than a
 * memo hit. Almost no token value contains whitespace or `!`, so one scan for the
 * characters that make any of it necessary sends the common value straight to a
 * concatenation. A false positive only costs the slow path, so the scan errs wide.
 */
export function leafClass(prefix: string, value: unknown): string | undefined {
  if (value == null) return ''

  const type = typeof value
  if (type === 'number' || type === 'boolean') return `${prefix}${value as number | boolean}`
  if (type !== 'string') return undefined

  const str = value as string

  for (let index = 0; index < str.length; index++) {
    const code = str.charCodeAt(index)

    // Everything `\s` matches, plus `!`. Below 0x21 covers space, tab, the line breaks and
    // the control range; the three literals and the 0x2000 floor cover the rest of what
    // Unicode counts as space — NBSP, Ogham, the general punctuation spaces, and BOM.
    if (code <= 0x21 || code === 0xa0 || code === 0x1680 || code >= 0x2000) {
      return slowLeaf(prefix, str)
    }
  }

  return `${prefix}${str}`
}

/** The full pipeline `createCss` runs, for a value that needs it. */
function slowLeaf(prefix: string, value: string): string {
  // Tested against the raw value, exactly where `createCss` tests it — before `sanitize`
  // has collapsed the whitespace that `\s*!` is allowed to match.
  const important = isImportant(value)
  const className = `${prefix}${withoutSpace(withoutImportant(sanitize(value)))}`

  return important ? `${className}!` : className
}
