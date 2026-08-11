import { createContext } from '@bamboocss/fixture'
import { logger } from '@bamboocss/logger'
import { afterEach, describe, expect, test, vi } from 'vitest'
import { Builder } from '../src/builder'
import type { BambooContext } from '../src/create-context'

/**
 * A file the build could not extract has to fail the build.
 *
 * Extraction used to catch, log, and carry on. The file's styles never reach the encoder, so
 * every rule it would have contributed is simply absent — and a build that dropped rules printed
 * error-level lines and still exited 0, which is the one outcome that cannot be noticed. CI
 * running a bundler build passed source that CI running `cssgen` rejected, because `cssgen` went
 * through the one entry point that let the throw out.
 *
 * A `cva` config with a retired token spelling is the shape that reaches it: unlike a plain
 * `css()` value, a recipe's styles are resolved while the file is parsed, so the throw lands
 * inside extraction rather than later when the sheet is built.
 */
const RETIRED = `
import { cva } from 'styled-system/css'
export const timeline = cva({ base: { boxShadow: '0 0 0 2px {colors.red.300/35}' } })
`

/**
 * Added at the path `parseFile` will look for it under, and reported by `getFiles`.
 *
 * `BambooContext` fills an unset `cwd` from the process, and `parseFile` resolves against it —
 * so a file added under the relative path is simply not found, and the parse that finds nothing
 * cannot throw. That reads as "the check does not fire" rather than as a test that missed.
 *
 * `getFiles` is stubbed because the fixture globs an empty `include`, and `assertExtracted`
 * drops a failure for a file no longer in scope — so every one of these would pass for the
 * wrong reason against a context that claims to hold no files at all.
 */
const withFile = (path: string, code: string) => {
  const ctx = createContext() as unknown as BambooContext
  const files: string[] = []

  const add = (at: string, source: string) => {
    ctx.project.addSourceFile(abs(ctx, at), source)
    if (!files.includes(abs(ctx, at))) files.push(abs(ctx, at))
  }

  ctx.getFiles = () => files

  add(path, code)
  return { ctx, add }
}

const abs = (ctx: BambooContext, path: string) => ctx.runtime.path.abs(ctx.config.cwd, path)

afterEach(() => {
  vi.restoreAllMocks()
})

describe('a file that could not be extracted', () => {
  test('is recorded rather than only logged', () => {
    const error = vi.spyOn(logger, 'caughtError').mockImplementation(() => undefined)
    const { ctx } = withFile('app/src/timeline.tsx', RETIRED)

    // Unchanged: the caller still gets nothing back, and the failure is still logged where it
    // happened. What is new is that it outlives the call.
    expect(ctx.parseFile('app/src/timeline.tsx')).toBeUndefined()
    expect(error).toHaveBeenCalled()

    expect(Array.from(ctx.parseFailures.keys())).toEqual([abs(ctx, 'app/src/timeline.tsx')])
  })

  test('fails the build, naming the file and what it threw', () => {
    vi.spyOn(logger, 'caughtError').mockImplementation(() => undefined)
    const { ctx } = withFile('app/src/timeline.tsx', RETIRED)
    ctx.parseFile('app/src/timeline.tsx')

    expect(() => ctx.assertExtracted()).toThrow(/app\/src\/timeline\.tsx/)
    expect(() => ctx.assertExtracted()).toThrow(/retired token reference syntax/)
  })

  /**
   * One aggregate code rather than the code of whichever file happened to throw first: six
   * broken files can throw six different errors, so there is no single one to re-raise. The
   * originals are reachable through `cause`, below.
   */
  test('throws one aggregate error, whatever the files threw', () => {
    vi.spyOn(logger, 'caughtError').mockImplementation(() => undefined)
    const { ctx } = withFile('app/src/timeline.tsx', RETIRED)
    ctx.parseFile('app/src/timeline.tsx')

    expect(() => ctx.assertExtracted()).toThrow(expect.objectContaining({ code: 'ERR_BAMBOO_EXTRACT_FAILED' }) as Error)
  })

  /**
   * The originals, reachable from the aggregate.
   *
   * The message names every file, but a caller acting on the failure needs the codes
   * underneath — `ERR_BAMBOO_INVALID_TOKEN` distinguishes a retired token spelling from a
   * syntax error, and the aggregate's own code cannot. Always an `AggregateError`, one file or
   * six, so reading `cause.errors` never has to test how many there were first.
   */
  test('carries the original errors as its cause', () => {
    vi.spyOn(logger, 'caughtError').mockImplementation(() => undefined)
    const { ctx, add } = withFile('app/src/one.tsx', RETIRED)
    add('app/src/two.tsx', RETIRED.replace('red.300/35', 'red.300/40'))

    ctx.parseFile('app/src/one.tsx')
    ctx.parseFile('app/src/two.tsx')

    let cause: AggregateError | undefined
    try {
      ctx.assertExtracted()
    } catch (error) {
      cause = (error as Error).cause as AggregateError
    }

    expect(cause).toBeInstanceOf(AggregateError)
    expect(cause?.errors).toHaveLength(2)
    expect(cause?.errors.map((entry: { code?: string }) => entry.code)).toEqual([
      'ERR_BAMBOO_INVALID_TOKEN',
      'ERR_BAMBOO_INVALID_TOKEN',
    ])
  })

  /** Relative to `cwd`, like the token diagnostics beside it: an absolute path per entry
   * buries the segment that differs between them. */
  test('names the file as the user typed it', () => {
    vi.spyOn(logger, 'caughtError').mockImplementation(() => undefined)
    const { ctx } = withFile('app/src/timeline.tsx', RETIRED)
    ctx.parseFile('app/src/timeline.tsx')

    let message = ''
    try {
      ctx.assertExtracted()
    } catch (error) {
      message = (error as Error).message
    }

    expect(message).toContain('app/src/timeline.tsx')
    expect(message).not.toContain(abs(ctx, 'app/src/timeline.tsx'))
  })

  /**
   * Fixed once rather than one build at a time.
   *
   * Distinct values, because the encoder hashes what it has already seen: two files with the
   * identical retired declaration throw once between them, which would pass this while proving
   * nothing about the second file.
   */
  test('names every broken file, not the first', () => {
    vi.spyOn(logger, 'caughtError').mockImplementation(() => undefined)
    const { ctx, add } = withFile('app/src/one.tsx', RETIRED)
    add('app/src/two.tsx', RETIRED.replace('red.300/35', 'red.300/40'))

    ctx.parseFile('app/src/one.tsx')
    ctx.parseFile('app/src/two.tsx')

    expect(() => ctx.assertExtracted()).toThrow(/one\.tsx/)
    expect(() => ctx.assertExtracted()).toThrow(/two\.tsx/)
    expect(() => ctx.assertExtracted()).toThrow(/^2 file\(s\)/)
  })

  test('stops failing once the file parses', () => {
    vi.spyOn(logger, 'caughtError').mockImplementation(() => undefined)
    const { ctx, add } = withFile('app/src/timeline.tsx', RETIRED)
    ctx.parseFile('app/src/timeline.tsx')

    add(
      'app/src/timeline.tsx',
      `import { cva } from 'styled-system/css'\nexport const t = cva({ base: { color: 'red.300' } })\n`,
    )
    ctx.parseFile('app/src/timeline.tsx')

    expect(() => ctx.assertExtracted()).not.toThrow()
  })

  test('says nothing about a build where every file parsed', () => {
    const { ctx } = withFile('app/src/ok.tsx', `import { css } from 'styled-system/css'\nexport const c = css({})\n`)
    ctx.parseFile('app/src/ok.tsx')

    expect(() => ctx.assertExtracted()).not.toThrow()
  })

  /**
   * The incremental pass is the one that could launder it.
   *
   * `extract` skips a file whose mtime has not moved, so nothing re-parses the broken one and
   * nothing re-records the failure. If the check only covered the pass that discovered it, the
   * next rebuild — of identical, still-broken source — would come back green.
   *
   * `affecteds` has to be set for the skip branch to be reachable at all: an unset one reads as
   * "the config changed", which takes the ordinary path. Without it this passed against a build
   * with the branch deleted, which is the shape of test that proves nothing.
   */
  test('still fails a rebuild that re-parses nothing', () => {
    vi.spyOn(logger, 'caughtError').mockImplementation(() => undefined)
    const { ctx } = withFile('app/src/timeline.tsx', RETIRED)
    ctx.parseFile('app/src/timeline.tsx')

    const builder = new Builder()
    builder.context = ctx
    // `affecteds` is private, and there is no public way to say "the config did not change" —
    // it is set by `setup`, which would need a real config on disk to reload.
    ;(builder as unknown as { affecteds: { hasConfigChanged: boolean } }).affecteds = { hasConfigChanged: false }

    expect(() => builder.extract()).toThrow(/timeline\.tsx/)
  })

  /**
   * Deleting the file is a fix, not a state to stay wedged in.
   *
   * A failure is kept across the passes that skip an unchanged file, which is what stops a
   * no-op rebuild reading as green. But nothing re-parses a file that is *gone*, so the entry
   * outlives it — and a context outlives rebuilds, being replaced only when the config changes.
   * The vite dev server and the postcss plugin each hold one for the life of the process, so
   * this failed every later build against a path that no longer existed until a restart.
   */
  test('stops failing once the file is deleted', () => {
    vi.spyOn(logger, 'caughtError').mockImplementation(() => undefined)
    const { ctx } = withFile('app/src/timeline.tsx', RETIRED)

    const builder = new Builder()
    builder.context = ctx
    expect(() => builder.extract()).toThrow(/timeline\.tsx/)

    ctx.project.removeSourceFile(abs(ctx, 'app/src/timeline.tsx'))
    ctx.getFiles = () => []

    expect(() => builder.extract()).not.toThrow()
    expect(ctx.parseFailures.size).toBe(0)
  })

  /** The same, for a file taken out of `include` rather than off disk. */
  test('stops failing once the file leaves `include`', () => {
    vi.spyOn(logger, 'caughtError').mockImplementation(() => undefined)
    const { ctx } = withFile('app/src/timeline.tsx', RETIRED)
    ctx.parseFile('app/src/timeline.tsx')

    expect(() => ctx.assertExtracted(['app/src/other.tsx'])).not.toThrow()
  })
})
