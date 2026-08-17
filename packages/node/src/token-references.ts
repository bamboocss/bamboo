import { logger } from '@bamboocss/logger'
import type { ParserResult } from '@bamboocss/parser'
import { BambooError, cssVarRefs } from '@bamboocss/shared'
import { isMatch } from 'matcher'
import type { BambooContext } from './create-context'
import { snapshotTexts, sourceSnapshots } from './source-snapshots'
import { accountSnapshot, type DeclinedReference, failsStrict, type TokenAccounting } from './token-accounting'

/**
 * `token('spacing.4')` and `token.value('colors.red.300')`, including the whitespace a
 * formatter may leave behind. The parser reports both, resolving constants and template
 * literals through them — `token.value()` included, since it is recorded as its own kind
 * rather than dropped for having a property access as its callee. Scanning the text still
 * earns its place twice over: it covers a path built somewhere the extractor cannot
 * follow, and it covers the callers below that supply no `results` at all.
 */
const TOKEN_CALL = /\btoken(?:\s*\.\s*value)?\s*\(\s*['"`]([^'"`]+)['"`]/g

/** An import of the generated tokens artifact, under any of the spellings that reach it. */
const TOKEN_IMPORT = /\b(?:from|import|require)\s*\(?\s*['"][^'"]*\/tokens(\/[^'"]*|\.[cm]?[jt]sx?)?['"]/

/** A call to `token()` or `token.value()`, whatever the argument is — or is not. */
const TOKEN_CALLEE = /\btoken(\s*\.\s*value)?\s*\(/

/** The same, but only where the argument is a string literal — the shape `TOKEN_CALL` resolves. */
const TOKEN_CALL_LITERAL = /\btoken(?:\s*\.\s*value)?\s*\(\s*['"`]/

/** String literals, contents and all. */
const STRING_LITERAL = /'(?:[^'\\\n]|\\.)*'|"(?:[^"\\\n]|\\.)*"|`(?:[^`\\]|\\.)*`/g

/**
 * Whether a token is reached from javascript at all — a call of any shape, or an import of the
 * artifact. It no longer decides pruning on its own: the accounting does that, and this is the
 * gate the *fallback* defers to when the accounting declines. A project reaching for no token at
 * all is one a decline cannot endanger, so it keeps nothing extra.
 *
 * The awkward part is that a token reference inside a css value is now spelled `token(…)` too,
 * and it must *not* count: `css({ border: '1px solid token(colors.red.300)' })` reaches a token
 * from a stylesheet, where the css scan already accounts for it, not from javascript. Reading it
 * as a call turned pruning off wholesale — measured at 3.2x the stylesheet on a sandbox, since
 * "keep everything" is what the gate means. It was only ever latent before, because `{…}` was
 * the spelling the docs used and it looked nothing like a call.
 *
 * So a `token(` that survives blanking every string literal is a real call, and one that does
 * not was written inside a string. The literal-argument test comes first and on the raw text,
 * which is what keeps this a superset of `TOKEN_CALL` as the coupling in `collectTokenReferences`
 * requires: a resolvable call embedded in a template literal — a fixture holding source code —
 * still counts, even though blanking would hide it.
 *
 * No `g` flag on the tests, so `test` carries no state between files.
 */
const reachableFromJs = (text: string) => {
  if (TOKEN_IMPORT.test(text) || TOKEN_CALL_LITERAL.test(text)) return true
  // Blanking is the expensive half, so it only runs where there is a call-shape to disambiguate.
  return TOKEN_CALLEE.test(text) && TOKEN_CALLEE.test(text.replace(STRING_LITERAL, "''"))
}

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
  for (const snapshot of sourceSnapshots(ctx)) yield* snapshotTexts(snapshot)
}

/**
 * Collect token references that reading the generated css cannot reveal.
 *
 * This is deliberately textual and therefore over-inclusive: a match inside a comment or
 * a string that is never evaluated keeps a token alive. Keeping a token that is not used
 * costs bytes; dropping one that is breaks the page, so the bias belongs on this side.
 *
 * `results` is a second, redundant source for the same paths: the extractor resolves one
 * built from a constant — for `token.value()` as well as `token()` — which
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
 * up. It briefly was not — this allowed whitespace around the `.` of the method and the gate
 * did not, so a formatter wrapping `token\n  .value(SOME_CONST)` slipped past both. Change one
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
 * missing from a copy: a watch rebuild with `prune: { tokens: 'off' }` skipped `pruneTokens`
 * altogether, so it kept `@property` registrations that a full build of the same source
 * strips. The other two copies carried a comment pointing at that file for the reasoning,
 * which is how a missing branch reads as intentional.
 *
 * Opting out still drops the registrations. Those are not tokens — nothing hands one to
 * javascript, and none appear in the `token()` surface — so the reachability problem the flag
 * exists for does not apply to them, and opting out of token pruning should not mean shipping
 * a preset's whole filter and gradient set for nothing.
 */
/**
 * Returns the custom properties left standing, for `pruneKeyframes` to root its own walk
 * at — see `Generator.pruneKeyframes`. `'all'` when this pass had nothing to remove and so
 * never computed the closure, which is not a missing answer but the correct one: a sheet
 * nothing was removed from still declares everything it declared.
 */
export function pruneTokensForBuild(
  ctx: BambooContext,
  sheet: Parameters<BambooContext['pruneTokens']>[0],
  results: ParserResult[],
): Set<string> | 'all' {
  if (ctx.config.prune?.tokens === false) {
    return ctx.pruneTokens(sheet)?.reachable ?? 'all'
  }

  // The accounting always runs. It used to be opt-in behind `tokens: 'accounted'`, beside a
  // default that asked one cheap boolean — "does any javascript reach for a token" — and threw
  // away everything else it had read, so a single `token()` call anywhere kept every
  // declaration in the project. Those were never two strategies so much as two answers to
  // *what do we do when we cannot tell*, and only one of them is worth defaulting to.
  //
  // What makes it safe to default is the fallback: a reference this cannot read leaves the
  // build exactly where the blanket keep would have left it, never short of a declaration
  // something still asks for. What it cannot see is a caller outside `include` — see
  // `accountTokenReferences` — which is why `keepTokens` exists and why `unresolvedPath` can
  // make the declines visible.
  //
  // `unresolvedPath` decides how loudly, and nothing else: the keeps are identical across all
  // three of its values. It defaults to `off` because this is now an inference the build makes
  // unasked, and a default that reports would be noise in every project that cannot help it.
  const unresolved = ctx.config.prune?.unresolvedPath ?? 'off'

  // One walk. These three answers all come from the same files, and reading them apart meant
  // a strict build opened every file three times: once for the reference set, once to account,
  // and once more for the gate whenever the accounting declined.
  const paths = new Set<string>()
  const vars = new Set<string>()
  const accounting: TokenAccounting = { paths: new Set<string>(), prefixes: new Set<string>(), declined: [] }
  let reachable = false

  // What the extractor understood, including values it resolved through a constant.
  for (const result of results) {
    for (const item of result.token) {
      for (const value of item.data ?? []) {
        if (typeof value === 'string') paths.add(value)
      }
    }
  }

  for (const snapshot of sourceSnapshots(ctx)) {
    for (const text of snapshotTexts(snapshot)) {
      for (const match of text.matchAll(TOKEN_CALL)) paths.add(match[1])
      for (const name of cssVarRefs(text)) vars.add(name)
      if (!reachable && reachableFromJs(text)) reachable = true
    }

    accountSnapshot(ctx, snapshot, accounting)
  }

  for (const name of tokenVarsFor(ctx, paths)) vars.add(name)

  // Declared keeps do two things: they keep what they match — a token nothing in the stylesheet
  // references and no javascript here reads, which is the sibling-package case — and they stand
  // in for the blanket keep when something could not be followed. See `keepTokens`.
  const declared = declaredKeeps(ctx)
  for (const name of tokenVarsFor(ctx, declared)) vars.add(name)

  for (const name of tokenVarsFor(ctx, accounting.paths)) vars.add(name)

  // Whether the author has named the bound the accounting could not derive. That is what turns
  // a decline from "keep every declaration" into "keep what was declared" — see `keepTokens`.
  const bounded = (ctx.config.prune?.keepTokens?.length ?? 0) > 0

  // A reference bounded by a prefix rather than resolved to a path — `` token(`colors.${x}`) ``
  // — keeps the tokens that prefix can reach and nothing else. Declining it instead kept every
  // declaration in the project, which is what the whole category costs against.
  //
  // Skipped when something else already declined *and* nothing was declared, since the blanket
  // keep below then makes every name here redundant. With `keepTokens` there is no blanket
  // keep, so an inferred bound is load-bearing again alongside the declared ones.
  //
  // `reachable` has to be part of that, because the blanket below requires it too. The text scan
  // it comes from cannot see an artifact reached under a configured specifier — `importMap:
  // { tokens: '@acme/design' }` — so a file bounding `colors.` through such an import, beside one
  // unrelated decline, skipped the prefix *and* got no blanket, deleting the category it bounded.
  if (accounting.prefixes.size && (bounded || !accounting.declined.length || !reachable)) {
    const prefixes = Array.from(accounting.prefixes)
    const matched: string[] = []

    for (const token of ctx.tokens.allTokens) {
      if (prefixes.some((prefix) => token.name.startsWith(prefix))) matched.push(token.name)
    }

    for (const name of tokenVarsFor(ctx, matched)) vars.add(name)
  }

  // On a decline, fall back to the same gate the cheap text scan answers rather than to an
  // unconditional keep. Those differ: a project whose only unreadable reference is an import of a
  // module this pass cannot classify declines here while the scan finds no token call at all, so
  // keeping everything would ship *more* than the scan alone would — the one case where accounting
  // could cost bytes. Deferring to that gate is what makes it safe to do unasked.
  //
  // `unresolvedPath: 'error'` is an assertion, so a token reference that breaks it fails the build
  // rather than warning and carrying on. Warning was the wrong shape for that one: the user asked
  // to be told the exact set shipped, did not get it, and nothing stopped to say so.
  //
  // Only that one. Every other decline reports and keeps everything, exactly as before — see
  // `failsStrict` for why, and why widening it would fail builds over `import()` calls with
  // nothing to do with tokens.
  const failing = accounting.declined.filter(failsStrict)
  const reported = accounting.declined.filter((entry) => !failsStrict(entry))

  // `keepTokens` and `error` are contradictory requests — one asserts every path resolves, the
  // other declares where the ones that do not will land — so the build stops rather than
  // silently preferring the weaker claim.
  //
  // Checked against *every* decline rather than against `failing`, which is only the subset
  // `failsStrict` picks out. The rest never throw on their own, for good reasons that all
  // assume the blanket keep is what they cost — and `keepTokens` is precisely what takes that
  // away. So guarding the subset let a `require()` or a transformed component put the keeps in
  // charge of the whole theme under the setting whose entire job is to refuse that.
  if (bounded && unresolved === 'error' && accounting.declined.length) {
    throw new BambooError(
      'TOKEN_REFERENCE_UNRESOLVED',
      `${accounting.declined.length} token reference(s) could not be accounted for.\n\n` +
        `${formatDeclined(ctx, accounting.declined)}\n\n` +
        `\`prune.unresolvedPath: 'error'\` asserts that every token path resolves at build time, and ` +
        `\`prune.keepTokens\` declares where the ones that do not will land. Those are contradictory, so one ` +
        `has to go: drop \`keepTokens\` and respell the paths, or set \`prune: { unresolvedPath: 'warn' }\` ` +
        `and let the keeps cover them.`,
    )
  }

  // Thrown before the report, so a build that is about to fail does not first announce what it
  // kept. Under `warn` the same references are printed and the build carries on, which is the
  // only difference between the two modes — and under `off` neither happens, which is what
  // `off` means.
  if (failing.length && unresolved !== 'off') {
    const where = `${failing.length} token reference(s) could not be resolved.\n\n${formatDeclined(ctx, failing)}\n\n`

    // `bounded` cannot reach the throw: the contradiction above has already stopped the build.
    if (unresolved === 'error') {
      throw new BambooError(
        'TOKEN_REFERENCE_UNRESOLVED',
        where +
          `\`prune.unresolvedPath: 'error'\` asserts that every token path resolves at build time. Spell the ` +
          `path as a string literal at the call, give a template a static prefix so it can be bounded, name the ` +
          `category they land in with \`prune: { keepTokens: ['colors.*'] }\` and drop to ` +
          `\`prune: { unresolvedPath: 'warn' }\`, or set \`prune: { unresolvedPath: 'off' }\` to stop asserting.`,
      )
    }

    logger.warn(
      'tokens:unresolved',
      bounded
        ? where +
            `\`prune.keepTokens\` covers them: they keep what it names rather than every declaration in the ` +
            `theme. Nothing checks that they stay inside it, which is why it is yours to declare — a read ` +
            `landing outside the patterns loses its declaration and resolves to a \`var()\` with nothing ` +
            `behind it. Respell what you can, and widen the patterns for what you cannot.`
        : where +
            `An unfollowable path keeps every token declaration. Spell the path as a string literal at the ` +
            `call, give a template a static prefix so it can be bounded, name the category they land in with ` +
            `\`prune: { keepTokens: ['colors.*'] }\`, or set \`prune: { unresolvedPath: 'off' }\` to stop ` +
            `reporting it.`,
    )
  }

  if (reported.length && unresolved !== 'off') {
    logger.warn(
      'tokens:unresolved',
      `${reported.length} reference(s) could not be accounted for, so ` +
        (bounded ? `\`prune.keepTokens\` decides what they keep` : `every token declaration is kept`) +
        `.\n\n${formatDeclined(ctx, reported)}\n\n` +
        `These are shapes the build cannot follow rather than paths you can respell — a component stored ` +
        `post-transform, a file it could not parse, a barrel it cannot classify, a dynamic \`import()\`. ` +
        (bounded
          ? `Nothing checks that they stay inside \`keepTokens\`, which is why it is yours to declare: ` +
            `a read landing outside it loses its declaration. Narrow \`include\`, or widen the patterns.`
          : `Narrow \`include\`, name the categories they reach with \`prune: { keepTokens: [...] }\`, or ` +
            `accept the keeps.`),
    )
  }

  // A decline falls back to what `reachable` would have answered — unless the author declared
  // the bound, which is the whole point of `keepTokens`: it replaces that fallback rather than
  // adding to it, so a single unfollowable reference stops costing every declaration.
  return ctx.pruneTokens(sheet, vars, !bounded && accounting.declined.length > 0 && reachable)?.reachable ?? 'all'
}

/**
 * The dash-cased spelling of a token path, as it appears in the emitted css variable.
 *
 * Not a transform this applies — only one it recognises, to tell a user their pattern is
 * written against the wrong side of the system. The paths are camelCase (`fontSizes.3xl`) and
 * the variables are dash-cased (`--font-sizes-3xl`), so `font-sizes.*` is the natural thing to
 * write after reading `styles.css` and it matches nothing at all.
 */
const dashed = (path: string) => path.replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`)

/**
 * The token names `prune.keepTokens` names, matched against the whole theme.
 *
 * Patterns are anchored globs over the dotted token *path* — `colors.*`, `colors.brand.*`,
 * `!colors.legacy.*`, or a bare path for one token. Matched case-sensitively, because a path is
 * a key in the config rather than free text.
 *
 * A pattern that matches nothing is reported rather than ignored. It is nearly always a typo
 * for one that would have matched, and the failure it causes is the one this whole module is
 * careful about everywhere else: a declaration dropped while something still asks for it, with
 * no error and no warning, resolving to a `var()` that inherits instead of falling back.
 */
function declaredKeeps(ctx: BambooContext) {
  const patterns = ctx.config.prune?.keepTokens
  if (!patterns?.length) return []

  // `!` subtracts from a selection, so a list holding only exclusions selects everything they
  // do not name — which is the opposite of what a list of keeps reads as, and is `tokens: 'off'`
  // with extra steps. Reported rather than reinterpreted: guessing at the intent of a config
  // that decides what ships is worse than saying what was understood.
  const includes = patterns.filter((pattern) => !pattern.startsWith('!'))

  if (!includes.length) {
    logger.warn(
      'prune:tokens',
      `\`prune.keepTokens\` holds only exclusions, so it keeps every token they do not name:\n\n` +
        `${patterns.map((pattern) => `  ${pattern}`).join('\n')}\n\n` +
        `A leading \`!\` subtracts from a selection and there is none here. Add the categories to keep — ` +
        `\`['colors.*', '!colors.legacy.*']\` — or use \`prune: { tokens: false }\` if keeping everything ` +
        `is the intent.`,
    )
  }

  const matched: string[] = []
  const used = new Set<string>()

  for (const token of ctx.tokens.allTokens) {
    // The whole list, in one call: `!` is a property of the *set*, so matching pattern by
    // pattern and taking any hit reads `['colors.*', '!colors.teal.*']` as "colours, or
    // anything that is not teal" — which is everything.
    if (isMatch(token.name, patterns, { caseSensitive: true })) matched.push(token.name)

    // Which inclusions pull their weight, for the report below. Asked separately because the
    // combined answer cannot attribute a match, and asked of the inclusions alone so a pattern
    // whose every match is later excluded still counts as spelled correctly.
    if (used.size === includes.length) continue
    for (const pattern of includes) {
      if (isMatch(token.name, pattern, { caseSensitive: true })) used.add(pattern)
    }
  }

  const unused = includes.filter((pattern) => !used.has(pattern))

  if (unused.length) {
    // The camelCase/dash-case mix-up specifically, since it is the one a correct reading of the
    // stylesheet leads you into. Named per pattern rather than described in general, because
    // the whole point is that the two spellings look equally plausible.
    const paths = ctx.tokens.allTokens.map((token) => token.name)
    const respell = unused
      .map((pattern) => {
        const hit = paths.find((path) => isMatch(dashed(path), pattern, { caseSensitive: true }))
        if (!hit) return `  ${pattern}`
        return `  ${pattern} — matches \`${dashed(hit)}\`, which is the css variable's spelling. Write the token path: \`${hit.split('.')[0]}.*\``
      })
      .join('\n')

    logger.warn(
      'prune:tokens',
      `${unused.length} \`prune.keepTokens\` pattern(s) match no token in this theme:\n\n${respell}\n\n` +
        `A pattern is an anchored glob over the dotted token *path* — \`colors.*\`, not \`colors\`, and ` +
        `\`fontSizes.*\` rather than the \`--font-sizes-\` spelling the css variable uses. One that matches ` +
        `nothing keeps nothing, which is silent everywhere except here.`,
    )
  }

  return matched
}

/** The custom properties a set of token paths resolves to. */
function tokenVarsFor(ctx: BambooContext, paths: Iterable<string>) {
  const vars = new Set<string>()

  for (const path of paths) {
    if (!path) continue
    const ref = ctx.tokens.view.getVar(path)
    if (!ref) continue

    for (const name of cssVarRefs(ref)) vars.add(name)
  }

  return vars
}

/** Where to look, grouped by file. The surrounding text differs by whether this throws. */
function formatDeclined(ctx: BambooContext, declined: DeclinedReference[]) {
  const byFile = new Map<string, DeclinedReference[]>()
  for (const entry of declined) {
    const list = byFile.get(entry.filePath) ?? []
    list.push(entry)
    byFile.set(entry.filePath, list)
  }

  const detail = Array.from(byFile.entries())
    .map(([filePath, entries]) => {
      const relative = filePath.startsWith(ctx.config.cwd) ? filePath.slice(ctx.config.cwd.length + 1) : filePath
      return [`  ${relative}`, ...entries.map((entry) => `    ${entry.line}: ${entry.reason}`)].join('\n')
    })
    .join('\n')

  return detail
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
 * invisible here, which is why `preflight.prune` is opt-in.
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
 * tsconfig path alias, and `styled-system/tokens/index.mjs`. It is still anchored to `from`,
 * `import` or `require`, because without that anchor a route or a url (`fetch('/api/tokens')`)
 * reads as an import and quietly switches the whole optimisation off.
 *
 * That last spelling used to be the only one NodeNext accepted, the artifact being a directory
 * and the generated `package.json` declaring no `exports`. It declares one now, so
 * `styled-system/tokens` resolves there too — but both spellings still have to be seen here,
 * because the map keeps the explicit one working and projects have it written down.
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
 * neither reports itself. `prune: { keepTokens: [...] }` names what they reach; `prune: { tokens:
 * 'off' }` keeps the lot.
 */
export function tokensReachableFromJs(ctx: BambooContext) {
  for (const content of sourceTexts(ctx)) {
    if (reachableFromJs(content)) return true
  }

  return false
}
