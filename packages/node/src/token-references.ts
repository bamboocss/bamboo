import type { ParserResult } from '@bamboocss/parser'
import type { BambooContext } from './create-context'

/**
 * `token.var('colors.red.300')` and `token('spacing.4')`, including the whitespace a
 * formatter may leave behind. The parser already reports `token()` calls and resolves
 * constants and template literals through them, but it does not match `token.var()`,
 * whose callee is a property access. Scanning the text covers that, and covers a path
 * built somewhere the extractor cannot follow.
 */
const TOKEN_CALL = /\btoken(?:\s*\.\s*var)?\s*\(\s*['"`]([^'"`]+)['"`]/g

/** A custom property written by hand, in an inline style or a template literal. */
const RAW_VAR = /var\(\s*(--[^\s,)]+)/g

/**
 * Collect token references that reading the generated css cannot reveal.
 *
 * This is deliberately textual and therefore over-inclusive: a match inside a comment or
 * a string that is never evaluated keeps a token alive. Keeping a token that is not used
 * costs bytes; dropping one that is breaks the page, so the bias belongs on this side.
 */
export function collectTokenReferences(ctx: BambooContext, results: ParserResult[]) {
  const paths = new Set<string>()
  const vars = new Set<string>()

  // What the extractor understood, including values it resolved through a constant.
  for (const result of results) {
    for (const item of result.token) {
      for (const value of item.data ?? []) {
        if (typeof value === 'string') paths.add(value)
      }
    }
  }

  for (const file of ctx.getFiles()) {
    let content: string

    try {
      content = ctx.runtime.fs.readFileSync(ctx.runtime.path.abs(ctx.config.cwd, file))
    } catch {
      // A file removed between the glob and this read is not worth failing a build over.
      continue
    }

    for (const match of content.matchAll(TOKEN_CALL)) paths.add(match[1])
    for (const match of content.matchAll(RAW_VAR)) vars.add(match[1])
  }

  // Token paths resolve to a css variable name through the dictionary; a path that names
  // no token simply resolves to nothing.
  for (const path of paths) {
    const ref = ctx.tokens.view.getVar(path)
    if (!ref) continue

    const name = String(ref).match(/var\(\s*(--[^\s,)]+)/)
    if (name) vars.add(name[1])
  }

  return vars
}
