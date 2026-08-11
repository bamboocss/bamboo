import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, test } from 'vitest'
import { bamboocss } from '../src/plugin'

/**
 * `failOnUnfolded` exists because fold coverage is not a percentage you can act on.
 *
 * The fold's payoff is that a bundle where every `css()` call folded stops importing
 * `styled-system/css`, and the engine behind it drops out. One survivor keeps the whole
 * thing — so 99% folded and 0% folded cost exactly the same. A build that refuses to leave
 * one behind is the only way to know which side of that line you are on.
 */
const cwd = join(dirname(fileURLToPath(import.meta.url)), '../../../sandbox/codegen')

const hookOf = <T>(hook: T | { handler: T } | undefined): T | undefined =>
  typeof hook === 'function' ? hook : (hook as { handler: T } | undefined)?.handler

const run = async (code: string, file: string, failOnUnfolded: boolean) => {
  const plugin = bamboocss({ transform: true, cwd, reportSummary: false, failOnUnfolded }).find(
    (p) => p.name === 'bamboocss:fold',
  )!

  await hookOf(plugin.buildStart)?.call({} as never, {} as never)
  await hookOf(plugin.transform)?.call({ addWatchFile: () => {} } as never, code, join(cwd, file), {} as never)
  return () => hookOf(plugin.buildEnd)?.call({} as never, undefined as never)
}

const src = (body: string) => `import { css } from 'styled-system/css'\n${body}\n`

describe('failOnUnfolded', () => {
  test('fails on a call the build could not resolve', async () => {
    const end = await run(src(`export const f = (p) => css({ ...p, color: 'red.300' })`), 'src/strict-spread.tsx', true)

    // The message has to name the file and the line, because the fix is at a call site and
    // a count alone leaves the user grepping for it.
    expect(end).toThrow(/could not be folded/)
    expect(end).toThrow(/strict-spread\.tsx/)
    expect(end).toThrow(/dynamic/)
  }, 60_000)

  test('fails on css.raw, which returns a style object rather than a class', async () => {
    const end = await run(src(`export const r = css.raw({ color: 'red.300' })`), 'src/strict-raw.tsx', true)

    expect(end).toThrow(/raw-call/)
  }, 60_000)

  /**
   * The shape that would otherwise pass while keeping the engine: this *folds*, to a
   * `cssLeaf` call, so it reports no skip. But `cssLeaf` falls back to `css()` for a value
   * that is not a scalar, so the module still imports the engine.
   */
  test('fails on a lowered leaf, which folds but still imports the engine', async () => {
    const end = await run(src(`export const f = (tone) => css({ color: tone })`), 'src/strict-leaf.tsx', true)

    expect(end).toThrow(/lowered-leaf/)
  }, 60_000)

  test('says nothing when every call folded', async () => {
    const end = await run(src(`export const cls = css({ color: 'red.300' })`), 'src/strict-static.tsx', true)

    expect(end).not.toThrow()
  }, 60_000)

  test('is off by default, so an unresolvable call only degrades', async () => {
    const end = await run(src(`export const f = (tone) => css({ color: tone })`), 'src/strict-off.tsx', false)

    expect(end).not.toThrow()
  }, 60_000)

  /**
   * A `cva` definition returns a function and can never collapse to a class string, so
   * failing on it would make `failOnUnfolded` unusable for anyone writing recipes. It keeps the
   * recipe runtime, which is a different and much smaller module than the css engine — see
   * the option's own documentation.
   */
  test('does not fail on a cva definition, which can never fold', async () => {
    const end = await run(
      `import { cva } from 'styled-system/css'\nexport const b = cva({ base: { color: 'red.300' } })\n`,
      'src/strict-cva.tsx',
      true,
    )

    expect(end).not.toThrow()
  }, 60_000)

  /**
   * The invocation, not just the definition. These are reported as `recipe-call` — which is
   * the point of reporting them — but they resolve through the recipe runtime rather than
   * `css()`, so they must not fail a build the way a surviving `css()` call does.
   */
  test('does not fail on a call of an inline recipe', async () => {
    const end = await run(
      `import { cva } from 'styled-system/css'\n` +
        `const badge = cva({ base: { color: 'red.300' }, variants: { tone: { a: { color: 'blue.300' } } } })\n` +
        `export const cls = badge({ tone: 'a' })\n` +
        `export const make = (tone) => badge({ tone })\n`,
      'src/strict-cva-call.tsx',
      true,
    )

    expect(end).not.toThrow()
  }, 60_000)

  /**
   * The ledger only holds calls something recognised, so a guarantee built on it is worth
   * what the recogniser is — and these are the shapes nothing recognises. Each folds nothing,
   * reports nothing, and keeps the module live; before this they passed `failOnUnfolded` outright.
   */
  describe('a binding the rewrite left behind', () => {
    /**
     * A module whose only bamboo usage is a bare reference. Nothing records it, so the ledger
     * is empty and so is the parser result — which meant the module was skipped before the
     * fold ever saw it, and `failOnUnfolded` passed on a file that plainly keeps the engine.
     */
    test('a binding passed on rather than called', async () => {
      const end = await run(
        `import { css } from 'styled-system/css'
export const pass = css
`,
        'src/strict-reexport.tsx',
        true,
      )

      expect(end).toThrow(/could not be folded/)
      expect(end).toThrow(/runtime-binding/)
      expect(end).toThrow(/strict-reexport\.tsx/)
    }, 60_000)

    test('a binding handed to something the build cannot follow', async () => {
      const end = await run(
        `import { css } from 'styled-system/css'
const apply = (fn, v) => fn(v)
export const f = (p) => apply(css, p)
`,
        'src/strict-indirect.tsx',
        true,
      )

      expect(end).toThrow(/runtime-binding/)
    }, 60_000)

    /**
     * The complement, and the one that matters most: the helpers the fold writes must not
     * read as survivors, or every partial fold would fail the build its own output enabled.
     */
    test('is not reported for the helpers the fold itself adds', async () => {
      const end = await run(
        `import { css } from 'styled-system/css'
export const f = (p) => css({ color: 'red.300' }, p)
`,
        'src/strict-helpers.tsx',
        true,
      )

      // The call is still `dynamic` — that is the pre-existing report. What must not appear
      // is a second complaint about the `cx` and leaf helper the split just wrote in.
      expect(end).toThrow(/dynamic/)
      expect(end).not.toThrow(/runtime-binding/)
    }, 60_000)

    test('is off when failOnUnfolded is off', async () => {
      const end = await run(
        `import { css } from 'styled-system/css'
export const pass = css
`,
        'src/strict-reexport-off.tsx',
        false,
      )

      expect(end).not.toThrow()
    }, 60_000)
  })

  /**
   * The module the fold threw on — the blind spot the ledger cannot see by construction.
   *
   * A throw in `transform` was caught, logged, and returned `null`, so the module contributed
   * to neither the folded column nor the skipped one and the survivor check saw a file that did
   * not exist. That is the same silence this option was added to close, one level up: a build
   * whose whole point is "nothing still calls `css()`" cannot make that claim about a module
   * nobody checked. A retired token spelling inside a `cva` is what reaches it — a recipe's
   * styles are resolved while the file is parsed, so the throw lands inside the fold.
   */
  describe('a module the fold threw on', () => {
    const BROKEN =
      `import { cva } from 'styled-system/css'\n` +
      `export const t = cva({ base: { boxShadow: '0 0 0 2px {colors.red.300/35}' } })\n`

    test('counts as a survivor rather than as nothing', async () => {
      const end = await run(BROKEN, 'src/strict-threw.tsx', true)

      expect(end).toThrow(/could not be folded/)
      expect(end).toThrow(/fold-failed/)
      expect(end).toThrow(/strict-threw\.tsx/)
    }, 60_000)

    /** The advice for a declined call site does not apply, so the message says where to look. */
    test('points at the error that was logged for it', async () => {
      const end = await run(BROKEN, 'src/strict-threw-why.tsx', true)

      expect(end).toThrow(/see the error logged for it above/)
    }, 60_000)

    /**
     * Still not a build failure on its own. An unfolded module keeps its runtime call, which
     * works — the fold is an optimisation, and declining to apply it is not an error.
     */
    test('does not fail a build that did not ask for the guarantee', async () => {
      const end = await run(BROKEN, 'src/strict-threw-off.tsx', false)

      expect(end).not.toThrow()
    }, 60_000)
  })
})
