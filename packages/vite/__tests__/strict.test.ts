import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, test } from 'vitest'
import { bamboocss } from '../src/plugin'

/**
 * `strict` exists because fold coverage is not a percentage you can act on.
 *
 * The fold's payoff is that a bundle where every `css()` call folded stops importing
 * `styled-system/css`, and the engine behind it drops out. One survivor keeps the whole
 * thing — so 99% folded and 0% folded cost exactly the same. A build that refuses to leave
 * one behind is the only way to know which side of that line you are on.
 */
const cwd = join(dirname(fileURLToPath(import.meta.url)), '../../../sandbox/codegen')

const hookOf = <T>(hook: T | { handler: T } | undefined): T | undefined =>
  typeof hook === 'function' ? hook : (hook as { handler: T } | undefined)?.handler

const run = async (code: string, file: string, strict: boolean) => {
  const plugin = bamboocss({ transform: true, cwd, reportSummary: false, strict }).find(
    (p) => p.name === 'bamboocss:fold',
  )!

  await hookOf(plugin.buildStart)?.call({} as never, {} as never)
  await hookOf(plugin.transform)?.call({ addWatchFile: () => {} } as never, code, join(cwd, file), {} as never)
  return () => hookOf(plugin.buildEnd)?.call({} as never, undefined as never)
}

const src = (body: string) => `import { css } from 'styled-system/css'\n${body}\n`

describe('strict', () => {
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
   * failing on it would make `strict` unusable for anyone writing recipes. It keeps the
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
})
