import { createContext as createFixtureContext } from '@bamboocss/fixture'
import { logger } from '@bamboocss/logger'
import { describe, expect, test, vi } from 'vitest'
import type { PruneOptions } from '@bamboocss/types'
import type { BambooContext } from '../src/create-context'
import { pruneTokensForBuild } from '../src/token-references'

/**
 * `prune: { tokens: 'accounted', unresolvedPath: 'error' }` end to end, against the real prune and the emitted css.
 *
 * Every other test of this feature stubs `ctx.pruneTokens` and asserts the arguments it was
 * handed. That proves the accounting decided correctly and nothing about what ships — and no
 * sandbox sets the flag, so until this file the whole path had never run against a real
 * stylesheet. The one severe bug a reviewer found in it, a throw swallowed by the watcher, was
 * invisible for exactly that reason: nothing executed the code, only its inputs.
 *
 * So this builds a real sheet, prunes it for real, and reads the css that comes out.
 */
const FILE = 'app/src/app.tsx'

const buildCss = (source: string, prune: PruneOptions = { tokens: 'accounted', unresolvedPath: 'error' }) => {
  const ctx = createFixtureContext({
    prune,
    // Stands in for what extraction would contribute, so the sheet has a utility layer.
    staticCss: { css: [{ properties: { color: ['red.300'] } }] },
    // A custom property exported for something outside the stylesheet to read. Nothing in the
    // css references `--brand`, so the colour behind it looks unreachable — this is the shape
    // that stranded one, and the only way the dangling check below can fail at all. Without
    // it every `var()` in the sheet is a *direct* reference, which `pruneTokenVars` roots by
    // construction and which therefore cannot dangle however badly the pass is broken.
    global: { css: { ':root': { '--brand': 'token(colors.pink.500)' } } },
  }) as unknown as BambooContext

  const absolute = ctx.runtime.path.abs(ctx.config.cwd, FILE)
  ctx.project.addSourceFile(absolute, source)
  ctx.getFiles = () => [FILE]
  ctx.runtime = { ...ctx.runtime, fs: { ...ctx.runtime.fs, readFileSync: () => source } } as BambooContext['runtime']

  const sheet = ctx.createSheet()
  ctx.appendLayerParams(sheet)
  ctx.appendBaselineCss(sheet)

  pruneTokensForBuild(ctx, sheet, [])

  return ctx.getCss(sheet)
}

const declares = (css: string, name: string) => new RegExp(`\\${name}\\s*:`).test(css)
const declarationCount = (css: string) => [...css.matchAll(/(--[a-z0-9-]+)\s*:/g)].length

const imports = "import { token } from 'styled-system/tokens'\n"

describe('prune.unresolved, against the emitted css', () => {
  /**
   * The whole point of the flag. Reaching for a token from javascript keeps every declaration
   * under the default; asserting that the paths resolve keeps only what is asked for.
   */
  /**
   * Through an *aliased* import. The plain spelling proves less than it appears to: the
   * non-strict text scan matches `token('…')` literally and adds the path itself, so the
   * assertion survives deleting the strict accounting's entire contribution to the keep set.
   * `t('…')` is invisible to that regex, so only the accounting can keep it — which is the
   * "accepted implies recorded" invariant this whole feature rests on.
   */
  test('a resolved path keeps its token and drops the rest', () => {
    const css = buildCss(`import { token as t } from 'styled-system/tokens'\nexport const brand = t('colors.blue.500')`)

    expect(declares(css, '--colors-blue-500')).toBe(true)
    // Not pink: `globalCss` exports `--brand: var(--colors-pink-500)`, so that one is kept on
    // its own merits and asserting its absence would be asserting a bug.
    expect(declares(css, '--colors-teal-500')).toBe(false)
  })

  test('the default keeps everything for the same source', () => {
    const strict = buildCss(`${imports}export const brand = token('colors.blue.500')`)
    const relaxed = buildCss(`${imports}export const brand = token('colors.blue.500')`, { tokens: 'reachable' })

    expect(declares(relaxed, '--colors-teal-500')).toBe(true)
    expect(declarationCount(strict)).toBeLessThan(declarationCount(relaxed))
  })

  /**
   * A template with a static head cannot name one token, but it bounds what it can reach — so
   * the category survives and everything else goes. Asserted on the stylesheet rather than on
   * the keep set, because a prefix that matched the keep set and not the emitted declarations
   * would be exactly the silent failure this feature exists to avoid.
   */
  test('a bounded path keeps its category and nothing else', () => {
    const css = buildCss(`${imports}export const brand = (s) => token(\`colors.\${s}\`)`)

    expect(declares(css, '--colors-blue-500')).toBe(true)
    expect(declares(css, '--colors-pink-500')).toBe(true)
    // A different category the expression cannot reach. Not `--spacing-4`: the negative margin
    // in `staticCss` references it through `calc(var(--spacing-4) * -1)`, so the css scan keeps
    // it on its own merits and asserting its absence would be asserting a bug.
    expect(declares(css, '--spacing-16')).toBe(false)
    expect(declares(css, '--font-sizes-3xl')).toBe(false)
  })

  test('a path the build cannot follow fails the build', () => {
    expect(() => buildCss(`${imports}export const brand = (p) => token(p)`)).toThrow(/could not be resolved/)
  })

  /**
   * `warn` is `error` without the throw: the same accounting runs and the same references are
   * reported, so a project can read what turning `error` on would reject before a build depends
   * on the answer.
   *
   * Asserted on the emitted css rather than on the log, because the point is that the pruning is
   * identical — only whether the build stops differs. A `warn` that quietly fell back to the
   * default's blanket keep would look fine in the log and ship a different stylesheet.
   */
  test('warn reports the same reference without failing, and prunes the same way', () => {
    const source = `${imports}export const brand = token('colors.blue.500')`

    const warned = buildCss(source, { tokens: 'accounted', unresolvedPath: 'warn' })
    const errored = buildCss(source, { tokens: 'accounted', unresolvedPath: 'error' })

    expect(warned).toBe(errored)
  })

  /**
   * `off` is documented as falling back and saying nothing, and said plenty: the throw branch
   * was gated on `error` and the warn beside it on nothing at all, so the quietest setting
   * printed the loudest diagnostic — advising the reader to set `warn`, which they were already
   * quieter than.
   */
  test('off says nothing at all', () => {
    const warn = vi.spyOn(logger, 'warn').mockImplementation(() => undefined)

    buildCss(`${imports}export const brand = (p) => token(p)`, { tokens: 'accounted', unresolvedPath: 'off' })

    expect(warn).not.toHaveBeenCalledWith('tokens:unresolved', expect.anything())

    warn.mockRestore()
  })

  test('warn does not throw on the path error rejects', () => {
    const source = `${imports}export const brand = (p) => token(p)`

    expect(() => buildCss(source, { tokens: 'accounted', unresolvedPath: 'warn' })).not.toThrow()
    expect(() => buildCss(source, { tokens: 'accounted', unresolvedPath: 'error' })).toThrow(/could not be resolved/)
  })

  /**
   * Every `var()` the surviving stylesheet references must still have a declaration behind it.
   * This is the property that matters — everything above is a proxy for it — and it is cheap
   * to check directly once the css is in hand.
   */
  test.each([
    ['a resolved path', `${imports}export const brand = token('colors.blue.500')`],
    ['a bounded path', `${imports}export const brand = (s) => token(\`colors.\${s}\`)`],
    ['a bounded negative', `${imports}export const gutter = (s) => token(\`spacing.\${s}\`)`],
  ])('leaves no dangling token variable — %s', (_label, source) => {
    const css = buildCss(source)

    // `\\.` is part of the name: the fixture declares `--spacing-0\\.5` and friends, and a
    // pattern stopping at the backslash would read a dangling `var(--spacing-4\\.5)` as a live
    // reference to the declared `--spacing-4`.
    const declared = new Set([...css.matchAll(/(--[a-z0-9\\.-]+)\s*:/g)].map((match) => match[1]))
    const referenced = [...css.matchAll(/var\(\s*(--[a-z0-9\\.-]+)/g)].map((match) => match[1])

    const dangling = referenced.filter((name) => !declared.has(name!))

    expect([...new Set(dangling)]).toEqual([])
  })
})

/**
 * `prune.keepTokens`, the declared bound.
 *
 * The fallback this replaces is total: **one** reference the accounting cannot follow keeps
 * every declaration in the project, so a codebase with a single `token(key)` in it ships the
 * same stylesheet as one that never prunes. That put the whole feature out of reach of the
 * codebases that reach for `token()` most — the middle ground was missing rather than narrow.
 *
 * The claim being made is about the author's own code, which is why nothing infers it: naming
 * `colors.*` says *the reads you cannot follow land in colours*. So these assert both halves —
 * that the named category survives, and that the rest actually goes.
 */
describe('prune.keepTokens', () => {
  /** No static head, so nothing bounds it and every declaration used to survive. */
  const UNFOLLOWABLE = `${imports}export const brand = (p) => token(p)`

  const accounted = { tokens: 'accounted', unresolvedPath: 'warn' } as const

  test('bounds a reference the build cannot follow, instead of keeping everything', () => {
    const bounded = buildCss(UNFOLLOWABLE, { ...accounted, keepTokens: ['colors.*'] })
    const blanket = buildCss(UNFOLLOWABLE, accounted)

    expect(declares(bounded, '--colors-blue-500')).toBe(true)
    expect(declares(bounded, '--font-sizes-3xl')).toBe(false)
    expect(declarationCount(bounded)).toBeLessThan(declarationCount(blanket))
  })

  /** Without it, the same source is the cliff this exists to remove. */
  test('the same source keeps everything without it', () => {
    const blanket = buildCss(UNFOLLOWABLE, accounted)
    const relaxed = buildCss(UNFOLLOWABLE, { tokens: 'reachable' })

    expect(declarationCount(blanket)).toBe(declarationCount(relaxed))
  })

  test('narrows to a sub-path, not just a category', () => {
    const css = buildCss(UNFOLLOWABLE, { ...accounted, keepTokens: ['colors.blue.*'] })

    expect(declares(css, '--colors-blue-500')).toBe(true)
    expect(declares(css, '--colors-teal-500')).toBe(false)
  })

  test('takes an exact path', () => {
    const css = buildCss(UNFOLLOWABLE, { ...accounted, keepTokens: ['colors.blue.500'] })

    expect(declares(css, '--colors-blue-500')).toBe(true)
    expect(declares(css, '--colors-blue-600')).toBe(false)
  })

  /** `logFilter`'s language, so `!` excludes from a wider pattern beside it. */
  test('excludes with a leading `!`', () => {
    const css = buildCss(UNFOLLOWABLE, { ...accounted, keepTokens: ['colors.*', '!colors.teal.*'] })

    expect(declares(css, '--colors-blue-500')).toBe(true)
    expect(declares(css, '--colors-teal-500')).toBe(false)
  })

  /**
   * An inferred bound and a declared one compose. This is the shape that regressed while the
   * feature was being written: prefix bounding was skipped whenever anything declined, on the
   * reasoning that the blanket keep made it redundant — true until `keepTokens` removed the
   * blanket keep, at which point skipping it dropped a category the build *had* proved was
   * needed.
   */
  test('keeps an inferred bound alongside the declared one', () => {
    const source =
      `${imports}export const gutter = (s) => token(\`spacing.\${s}\`)\n` + `export const brand = (p) => token(p)\n`

    const css = buildCss(source, { ...accounted, keepTokens: ['colors.*'] })

    expect(declares(css, '--spacing-16')).toBe(true)
    expect(declares(css, '--colors-blue-500')).toBe(true)
    expect(declares(css, '--font-sizes-3xl')).toBe(false)
  })

  /**
   * Contradictory requests, so the build stops rather than silently preferring the weaker
   * claim. `error` asserts every path resolves; `keepTokens` declares where the ones that do
   * not will land. Letting a keep suppress the throw would make `error` stop meaning anything
   * the moment one was added.
   */
  test('does not silence `unresolvedPath: error`', () => {
    expect(() =>
      buildCss(UNFOLLOWABLE, { tokens: 'accounted', unresolvedPath: 'error', keepTokens: ['colors.*'] }),
    ).toThrow(/contradictory/)
  })

  /**
   * And not only for the declines `failsStrict` picks out.
   *
   * Every other decline reports without throwing, for reasons that all assume the blanket keep
   * is what it costs — `import(`./pages/${n}`)` is routine code with nothing to do with tokens,
   * and failing a build over it would be indefensible. `keepTokens` is exactly what takes that
   * blanket keep away, so guarding only the subset let a dynamic import put the keeps in charge
   * of the whole theme under the one setting whose job is to refuse that. Verified before the
   * fix: no throw, and the categories outside the keeps were dropped.
   */
  test('does not silence it for a decline that is not about a token path either', () => {
    const source =
      `${imports}export const page = (n) => import(\`./pages/\${n}\`)\n` +
      `export const brand = token('colors.blue.500')\n`

    expect(() =>
      buildCss(source, { tokens: 'accounted', unresolvedPath: 'error', keepTokens: ['colors.blue.*'] }),
    ).toThrow(/contradictory/)
  })

  /**
   * `!` subtracts from a selection, so a list of only exclusions selects everything they do not
   * name — the opposite of what a list of keeps reads as, and `tokens: 'off'` with extra steps.
   * Reported rather than reinterpreted.
   */
  test('reports a list that holds only exclusions', () => {
    const warn = vi.spyOn(logger, 'warn').mockImplementation(() => undefined)

    buildCss(UNFOLLOWABLE, { ...accounted, keepTokens: ['!colors.teal.*'] })

    expect(warn).toHaveBeenCalledWith('prune:tokens', expect.stringContaining('only exclusions'))

    warn.mockRestore()
  })

  /**
   * Additive under `reachable`, where there is no fallback to replace.
   *
   * The source must not reach for a token at all: `reachable` keeps every declaration the
   * moment it sees one, so a source that calls `token()` passes this whatever `keepTokens`
   * does — including when the pattern matches nothing. It did, on both counts.
   */
  test('keeps a token the stylesheet never references, under reachable', () => {
    const source = 'export const unrelated = 1\n'

    const withKeep = buildCss(source, { tokens: 'reachable', keepTokens: ['fontSizes.*'] })
    const without = buildCss(source, { tokens: 'reachable' })

    expect(declares(withKeep, '--font-sizes-3xl')).toBe(true)
    expect(declares(without, '--font-sizes-3xl')).toBe(false)
  })

  /**
   * Token paths are camelCase and their variables are dash-cased, so `font-sizes.*` is the
   * natural thing to write after reading `styles.css` and it matches nothing at all. The
   * report has to name the spelling that would have worked, or it is the same silence one
   * level out.
   */
  test('reports the css-variable spelling of a category, with the path to use', () => {
    const warn = vi.spyOn(logger, 'warn').mockImplementation(() => undefined)

    buildCss(UNFOLLOWABLE, { ...accounted, keepTokens: ['font-sizes.*'] })

    expect(warn).toHaveBeenCalledWith('prune:tokens', expect.stringContaining('fontSizes.*'))

    warn.mockRestore()
  })

  test('is inert when nothing declines and the paths all resolve', () => {
    const source = `${imports}export const brand = token('colors.blue.500')`

    const withKeep = buildCss(source, { ...accounted, keepTokens: ['colors.blue.500'] })
    const without = buildCss(source, accounted)

    expect(withKeep).toBe(without)
  })

  /**
   * The property everything above is a proxy for: a declaration dropped while something still
   * references it leaves a `var()` that inherits rather than falling back, which is silent.
   */
  test('leaves no dangling token variable', () => {
    const css = buildCss(UNFOLLOWABLE, { ...accounted, keepTokens: ['colors.blue.*'] })

    const declared = new Set([...css.matchAll(/(--[a-z0-9\\.-]+)\s*:/g)].map((match) => match[1]))
    const referenced = [...css.matchAll(/var\(\s*(--[a-z0-9\\.-]+)/g)].map((match) => match[1])

    expect([...new Set(referenced.filter((name) => !declared.has(name!)))]).toEqual([])
  })

  /**
   * A pattern matching nothing is nearly always a typo for one that would have — `colors` for
   * `colors.*`, which is the mistake the anchoring invites. It keeps nothing, and everything
   * else about that is silent.
   */
  test('reports a pattern that matches no token', () => {
    const warn = vi.spyOn(logger, 'warn').mockImplementation(() => undefined)

    buildCss(UNFOLLOWABLE, { ...accounted, keepTokens: ['colors.*', 'colours.*'] })

    expect(warn).toHaveBeenCalledWith('prune:tokens', expect.stringContaining('colours.*'))
    expect(warn).not.toHaveBeenCalledWith('prune:tokens', expect.stringContaining('colors.*\n'))

    warn.mockRestore()
  })

  /** An exclusion selects nothing by construction, so it is not evidence of a typo. */
  test('does not report an exclusion as unmatched', () => {
    const warn = vi.spyOn(logger, 'warn').mockImplementation(() => undefined)

    buildCss(UNFOLLOWABLE, { ...accounted, keepTokens: ['colors.*', '!colors.teal.*'] })

    expect(warn).not.toHaveBeenCalledWith('prune:tokens', expect.stringContaining('match no token'))

    warn.mockRestore()
  })
})
