import type { ParserResult } from '@bamboocss/parser'
import { cssVarRefs } from '@bamboocss/shared'
import type { BambooContext } from './create-context'

/**
 * `token.var('colors.red.300')` and `token('spacing.4')`, including the whitespace a
 * formatter may leave behind. The parser reports both, resolving constants and template
 * literals through them — `token.var()` included, since it is recorded as its own kind
 * rather than dropped for having a property access as its callee. Scanning the text still
 * earns its place twice over: it covers a path built somewhere the extractor cannot
 * follow, and it covers the callers below that supply no `results` at all.
 */
const TOKEN_CALL = /\btoken(?:\s*\.\s*(?:var|value))?\s*\(\s*['"`]([^'"`]+)['"`]/g

/**
 * The text of every file `include` covers — as written on disk, and, when they differ, as the
 * parser understands it.
 *
 * Both, because neither alone is complete and every scan below is safe when over-fed. A file
 * the parser transformed is stored rewritten (`parseSourceFile` calls `replaceWithText`), and
 * those transforms lose things the scans want: `svelteToTsx` and `vueToTsx` each swallow a
 * throw and return an empty string, and a Vue SFC with a render function and no `<template>`
 * becomes the literal `<template>undefined</template>`. Read only the parsed copy and a file
 * like that reports no tokens and no elements at all.
 *
 * The parsed copy still has to be read as well, because `parser:before` is the documented way
 * to teach bamboo a format it does not know. A template compiled to jsx by such a hook holds
 * nothing a scan of the raw file would recognise, and that is the hook working as intended.
 *
 * So the cost is one extra read per file, and a second regex pass over the files a transform
 * actually changed. Measured at ~14ms for 806 files, against a build where css emission alone
 * is an order of magnitude more.
 */
function* sourceTexts(ctx: BambooContext): Generator<string> {
  for (const file of ctx.getFiles()) {
    const filePath = ctx.runtime.path.abs(ctx.config.cwd, file)

    let onDisk: string | undefined
    try {
      onDisk = ctx.runtime.fs.readFileSync(filePath)
    } catch {
      // Removed between the glob and this read, or never on disk at all. Not worth failing
      // a build over -- whatever the project holds still gets scanned below.
      onDisk = undefined
    }

    const parsed = ctx.project.getSourceFile(filePath)?.getFullText()

    if (onDisk != null) yield onDisk
    if (parsed != null && parsed !== onDisk) yield parsed
  }
}

/**
 * Collect token references that reading the generated css cannot reveal.
 *
 * This is deliberately textual and therefore over-inclusive: a match inside a comment or
 * a string that is never evaluated keeps a token alive. Keeping a token that is not used
 * costs bytes; dropping one that is breaks the page, so the bias belongs on this side.
 *
 * `results` is a second, redundant source for the same paths: the extractor resolves one
 * built from a constant — for `token.var()` and `token.value()` as well as `token()` — which
 * the text scan reads literally and fails to look up. Callers that cannot supply it — the
 * watch rebuild and the PostCSS plugin, where re-parsing would encode every style a second
 * time — pass none, and stay correct only because a path the scan misses can lose nothing:
 * `getAlwaysKeptTokenVars` keeps every token's declaration once anything reaches for a token
 * from javascript at all.
 *
 * That blanket keep used to be narrower, covering only the virtual, conditional and negative
 * tokens `token()` returned a `var()` for. It cannot be, now that `token()` returns the
 * reference for *every* token: a path this scan could not resolve could name any of them.
 *
 * The keeps are still not unconditional — `tokensReachableFromJs` gates them — and that gate
 * is what the argument above rests on. The gate matches `token(` regardless of what follows,
 * where `TOKEN_CALL` below needs a string literal. So the one shape this scan cannot resolve,
 * a path built from a constant, is exactly the shape that turns the gate on and restores
 * every keep. The two failures line up, which is what makes the redundancy hold.
 *
 * That alignment is a real coupling, not an observation: the gate's call pattern has to stay
 * a superset of this one, matching wherever `TOKEN_CALL` matches and also wherever it gives
 * up. It briefly was not — this allowed whitespace around the `.` of `token.var` and the gate
 * did not, so a formatter wrapping `token\n  .var(SOME_CONST)` slipped past both. Change one
 * of the two and change the other; `token-references.test.ts` pins the property directly.
 *
 * Where it stops holding is a binding renamed away from `token` — `const t = token`, then
 * `t('spacing.4')` — which matches neither. `token-references.test.ts` pins both halves.
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

  for (const content of sourceTexts(ctx)) {
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

/**
 * The token prune, as all three build paths need to run it.
 *
 * One function because it was three copies of one conditional, and the `false` branch went
 * missing from a copy: a watch rebuild with `pruneUnusedTokens: false` skipped `pruneTokens`
 * altogether, so it kept `@property` registrations that a full build of the same source
 * strips. The other two copies carried a comment pointing at that file for the reasoning,
 * which is how a missing branch reads as intentional.
 *
 * Opting out still drops the registrations. Those are not tokens — nothing hands one to
 * javascript, and none appear in the `token()` surface — so the reachability problem the flag
 * exists for does not apply to them, and opting out of token pruning should not mean shipping
 * a preset's whole filter and gradient set for nothing.
 */
export function pruneTokensForBuild(
  ctx: BambooContext,
  sheet: Parameters<BambooContext['pruneTokens']>[0],
  results: ParserResult[],
) {
  if (!ctx.config.pruneUnusedTokens) {
    ctx.pruneTokens(sheet)
    return
  }

  ctx.pruneTokens(sheet, collectTokenReferences(ctx, results), tokensReachableFromJs(ctx))
}

/**
 * Collect keyframe names that reading the generated css cannot reveal.
 *
 * A keyframe reached through `css({ animation: 'fade-in 1s' })` lands in the stylesheet
 * and `pruneKeyframes` sees it there. What it cannot see is a name assembled at runtime,
 * or one handed to an inline `style` rather than to bamboo — in both cases the animation
 * plays against a `@keyframes` that no bamboo declaration references.
 *
 * So each declared name is looked for in the source text. Like the token scan this is
 * deliberately over-inclusive: a name that happens to appear in a comment, or as a word
 * in unrelated prose, keeps its keyframe alive. Keeping an unused keyframe costs bytes;
 * dropping a used one silently stops an animation, which is the worse failure and the
 * harder one to trace.
 */
export function collectKeyframeReferences(ctx: BambooContext, names: Iterable<string>) {
  const declared = Array.from(names)
  const found = new Set<string>()
  if (!declared.length) return found

  // Word-boundary match per name, built once. A keyframe called `spin` must not be kept
  // alive by the word `spinner`.
  const patterns = declared.map((name) => [name, new RegExp(`\\b${escapeRegExp(name)}\\b`)] as const)

  for (const content of sourceTexts(ctx)) {
    for (const [name, pattern] of patterns) {
      if (!found.has(name) && pattern.test(content)) found.add(name)
    }

    // After the body, not before it: `sourceTexts` reads the next file when the loop pulls
    // it, so breaking at the top would still have paid for one file more than it needed.
    if (found.size === declared.length) break
  }

  return found
}

const escapeRegExp = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

/** The keyframes the theme declares — the allow-list `pruneKeyframes` works against. */
export const keyframeNames = (ctx: BambooContext) => Object.keys(ctx.config.theme?.keyframes ?? {})

/**
 * The HTML element names the source renders.
 *
 * A textual scan for an opening tag, over the same files the other collectors read. Matching
 * `<tag` rather than parsing: a template can spell an element in more ways than a parser of
 * any one framework's syntax would find, and over-reporting an element only keeps a reset
 * rule that would otherwise go.
 *
 * Lowercase-initial only, so a JSX component (`<Button />`) is not mistaken for an element.
 * That cuts the other way too — a component rendering `<button>` inside a dependency is
 * invisible here, which is why `prunePreflight` is opt-in.
 *
 * The commoner blind spot is nearer than a dependency: this reads `include`, and `include`
 * conventionally covers components rather than markup. An entry template — `index.html`,
 * `app.html` — is where `<table>`, `<noscript>` and a page's static markup usually live, and a
 * glob rooted at `./src` does not match it, so every element appearing only there loses its
 * reset. Nothing here can detect that; the file simply is not in the list. Listing it in
 * `include` fixes it, because this reads whatever `include` covers rather than only what the
 * parser understands — `token-references.test.ts` pins both halves.
 *
 * Reading the raw file as well as the parsed copy is what makes an SFC work here; see
 * `sourceTexts`. On a healthy `.svelte` file the two agree on everything but `<script>`, so
 * the raw read earns its place only when a transform fails -- and there it is the difference
 * between the file's elements and none of them.
 */
export function collectRenderedElements(ctx: BambooContext) {
  const found = new Set<string>()

  for (const content of sourceTexts(ctx)) {
    // `(?=…|$)` rather than consuming the delimiter, so an element written at the very end
    // of a file still counts. Lowercased to meet `elementOf`, which lowercases too.
    for (const match of content.matchAll(/<\s*([a-z][\w-]*)(?=[\s/>]|$)/g)) found.add(match[1]!.toLowerCase())
  }

  return found
}

/**
 * Whether any source file reaches for a token from javascript.
 *
 * The tokens artifact is generated into the project rather than installed, so the import is
 * written in the project's own source and a scan of `include` sees it. When this comes back
 * false, the declarations kept purely so `token()` can answer have no caller to answer.
 *
 * Deliberately loose, and loose in a specific direction: a false positive keeps a declaration
 * nothing reads, a false negative returns a `var()` nothing declares.
 *
 * So the import test is any module specifier with a `/tokens` path segment, rather than the
 * literal `styled-system/tokens` it used to be. `outdir` is configurable, so the artifact is
 * only at `styled-system/` by default, and the literal missed `outdir: 'design-system'`, a
 * tsconfig path alias, and `styled-system/tokens/index.mjs` -- which is the only spelling
 * NodeNext accepts, the artifact being a directory. It is still anchored to `from`, `import`
 * or `require`, because without that anchor a route or a url (`fetch('/api/tokens')`) reads
 * as an import and quietly switches the whole optimisation off.
 *
 * The call test allows whitespace around the dot for the same reason `TOKEN_CALL` does. It
 * did not, which broke the alignment the note on `collectTokenReferences` rests on: a
 * formatter wrapping `token\n  .var(SOME_CONST)` was invisible to that scan *and* to this
 * gate *and* to the parser, whose callee is a property access. A comment in the same position
 * -- `token/*x*\/.var(` -- is still invisible to all three.
 *
 * One shape it still does not see, pinned in `token-references.test.ts`: a binding renamed
 * away from `token`, as in `const t = token`. Also unseen is a caller outside `include`,
 * which scopes style extraction rather than everything that may import — a script, a config,
 * or a sibling workspace package. Both prune declarations the running app then asks for, and
 * neither reports itself; `pruneUnusedTokens: false` is the way out.
 */
export function tokensReachableFromJs(ctx: BambooContext) {
  const pattern =
    /\btoken(\s*\.\s*(?:var|value))?\s*\(|\b(?:from|import|require)\s*\(?\s*['"][^'"]*\/tokens(\/[^'"]*|\.[cm]?[jt]sx?)?['"]/

  for (const content of sourceTexts(ctx)) {
    if (pattern.test(content)) return true
  }

  return false
}
