import type { ParserResult } from '@bamboocss/parser'
import { cssVarRefs } from '@bamboocss/shared'
import type { BambooContext } from './create-context'

/**
 * `token.var('colors.red.300')` and `token('spacing.4')`, including the whitespace a
 * formatter may leave behind. The parser already reports `token()` calls and resolves
 * constants and template literals through them, but it does not match `token.var()`,
 * whose callee is a property access. Scanning the text covers that, and covers a path
 * built somewhere the extractor cannot follow.
 */
const TOKEN_CALL = /\btoken(?:\s*\.\s*var)?\s*\(\s*['"`]([^'"`]+)['"`]/g

/**
 * Collect token references that reading the generated css cannot reveal.
 *
 * This is deliberately textual and therefore over-inclusive: a match inside a comment or
 * a string that is never evaluated keeps a token alive. Keeping a token that is not used
 * costs bytes; dropping one that is breaks the page, so the bias belongs on this side.
 *
 * `results` is a second, redundant source for the same paths: the extractor resolves one
 * built from a constant, which the text scan reads literally and fails to look up. Callers
 * that cannot supply it — the watch rebuild and the PostCSS plugin, where re-parsing would
 * encode every style a second time — pass none, and stay correct only because a path the
 * scan misses can lose nothing: `token()` hands javascript a literal for exactly the
 * tokens this cannot see, and hands it a `var()` only for virtual, conditional and
 * negative tokens, which `getAlwaysKeptTokenVars` keeps whatever the source says. Narrow
 * those blanket keeps and this argument stops being redundant, so those two callers would
 * have to find another way to supply it.
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
    const filePath = ctx.runtime.path.abs(ctx.config.cwd, file)

    // The project already holds the text of every file it parsed, and every caller syncs
    // it before getting here, so reading from disk again would repeat the io on each
    // watch rebuild. Files the project does not track — css under `include`, say — still
    // have to be read.
    let content = ctx.project.getSourceFile(filePath)?.getFullText()

    if (content == null) {
      try {
        content = ctx.runtime.fs.readFileSync(filePath)
      } catch {
        // A file removed between the glob and this read is not worth failing a build over.
        continue
      }
    }

    for (const match of content.matchAll(TOKEN_CALL)) paths.add(match[1])
    for (const name of cssVarRefs(content)) vars.add(name)
  }

  // Token paths resolve to a css variable name through the dictionary; a path that names
  // no token simply resolves to nothing. A negative token resolves to `calc(var(--x) *
  // -1)`, so read every reference out rather than only the first.
  for (const path of paths) {
    const ref = ctx.tokens.view.getVar(path)
    if (!ref) continue

    for (const name of cssVarRefs(ref)) vars.add(name)
  }

  return vars
}
