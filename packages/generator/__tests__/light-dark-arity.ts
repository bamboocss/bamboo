/**
 * An arity check for the `light-dark()` calls a stylesheet actually contains.
 *
 * `light-dark()` takes exactly two arguments and CSS cannot group a comma-separated value
 * into one of them, so a fold whose arm is a list emits three or more and the browser drops
 * the declaration outright. That failure is invisible from inside a test suite: the sheet
 * still contains the token, the class naming it still looks correct, and nothing errors.
 *
 * What let it through was the assertion these suites reach for — `toContain('light-dark(')`
 * is satisfied by `light-dark(a, b, c)` just as well as by a valid call. So the check runs on
 * every sheet a suite generates rather than on the one a given test happens to inspect;
 * arity is decidable without a CSS parser, which makes that essentially free.
 *
 * Deliberately a second implementation rather than an import of the generator's own scanner.
 * A guard sharing code with the thing it guards agrees with it about a bug, and this one has
 * to read the emitted text the way a browser parses it.
 */

/** Top-level arguments of every `light-dark()` call in `css`, in source order. */
export const lightDarkArgs = (css: string): string[][] => {
  const CALL = 'light-dark('
  const calls: string[][] = []

  for (let start = css.indexOf(CALL); start !== -1; start = css.indexOf(CALL, start + 1)) {
    const args: string[] = []
    let current = ''
    let depth = 0
    let quote: string | undefined
    let closed = false

    // Starts on the call's own `(`, so depth 1 is the argument list.
    for (let index = start + CALL.length - 1; index < css.length; index++) {
      const char = css[index]

      if (quote) {
        current += char
        if (char === '\\') {
          current += css[index + 1] ?? ''
          index++
        } else if (char === quote) {
          quote = undefined
        }
        continue
      }

      if (char === '"' || char === "'") {
        quote = char
        current += char
        continue
      }

      if (char === '(') {
        depth++
        if (depth === 1) continue
      } else if (char === ')') {
        depth--
        if (depth === 0) {
          args.push(current)
          closed = true
          break
        }
      } else if (char === ',' && depth === 1) {
        args.push(current)
        current = ''
        continue
      }

      current += char
    }

    // An unterminated call is prose, not CSS — `light-dark()` written in a comment. Skipping
    // it keeps this usable on any string without reporting the documentation as a defect.
    if (closed) calls.push(args.map((arg) => arg.trim()))
  }

  return calls
}

/** Throw if any `light-dark()` in `css` carries other than two arguments. */
export const assertValidLightDark = (css: string) => {
  for (const args of lightDarkArgs(css)) {
    if (args.length === 2) continue
    throw new Error(
      `light-dark() takes 2 arguments, found ${args.length}. The browser drops this ` +
        `declaration and the element renders unstyled:\n\n  light-dark(${args.join(', ')})\n\n` +
        `An arm carrying a top-level comma cannot be folded — it must keep its ` +
        `\`@media (prefers-color-scheme: dark)\` block.`,
    )
  }

  return css
}
