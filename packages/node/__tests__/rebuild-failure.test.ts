import { createContext as createFixtureContext } from '@bamboocss/fixture'
import { logger } from '@bamboocss/logger'
import { EventEmitter } from 'node:events'
import { afterEach, describe, expect, test, vi } from 'vitest'
import type { BambooContext } from '../src/create-context'

/**
 * A rebuild that throws has to say so, and the watcher has to survive it.
 *
 * The file watcher is an `EventEmitter`, so it discards whatever a listener returns, and the
 * debounce wrapper around the rebuild attaches no rejection handler — a throw became a dangling
 * promise. The process-level handler then reported it as `Unhandled rejection`, which labels a
 * config error as an internal crash, and it was suppressed entirely at `logLevel: 'silent'`.
 * The initial build was caught by the CLI and printed properly; only rebuilds of the same
 * source were silent, which is the worse half of that asymmetry.
 *
 * Driven through `watchFiles` rather than the catch it installs. The defect lived in the
 * *wiring* — an emitter discarding a return value — so a test of the extracted helper passes
 * with the wiring deleted, which is the shape of test that let this through the first time.
 *
 * `pruneUnusedTokens: 'strict'` is what made it reachable: the first thing in a rebuild that
 * throws on the user's code rather than on a bug.
 */
const watched = () => {
  const emitter = new EventEmitter()
  const ctx = createFixtureContext() as unknown as BambooContext

  ctx.runtime = {
    ...ctx.runtime,
    // The real one returns a chokidar `FSWatcher`; only the emitter half is exercised here,
    // which is precisely the half the defect lived in — a listener's return value discarded.
    fs: { ...ctx.runtime.fs, watch: (() => emitter) as unknown as BambooContext['runtime']['fs']['watch'] },
  }

  return { ctx, emitter }
}

/** The wrapper debounces, so an emitted event is not observable until the queue drains. */
const settle = () => new Promise((resolve) => setTimeout(resolve, 50))

afterEach(() => {
  vi.restoreAllMocks()
})

describe('a rebuild that throws', () => {
  test('is reported, and the watcher keeps working', async () => {
    const error = vi.spyOn(logger, 'error').mockImplementation(() => undefined)
    const { ctx, emitter } = watched()

    const seen: string[] = []
    ctx.watchFiles((_event, file) => {
      seen.push(file)
      if (file === 'broken.tsx') throw new Error('1 token reference(s) could not be resolved.')
    })

    emitter.emit('all', 'change', 'broken.tsx')
    await settle()

    expect(error).toHaveBeenCalled()
    expect(String(error.mock.calls[0]?.[1])).toContain('could not be resolved')

    // The failure must not take the watcher with it: the next edit has to rebuild.
    emitter.emit('all', 'change', 'fixed.tsx')
    await settle()

    expect(seen).toEqual(['broken.tsx', 'fixed.tsx'])
  })

  test('does not escape as an unhandled rejection', async () => {
    vi.spyOn(logger, 'error').mockImplementation(() => undefined)
    const { ctx, emitter } = watched()

    const rejections: unknown[] = []
    const onRejection = (reason: unknown) => rejections.push(reason)
    process.on('unhandledRejection', onRejection)

    ctx.watchFiles(async () => {
      throw new Error('boom')
    })

    emitter.emit('all', 'change', 'a.tsx')
    await settle()

    process.off('unhandledRejection', onRejection)
    expect(rejections).toEqual([])
  })

  test('says nothing when the rebuild succeeds', async () => {
    const error = vi.spyOn(logger, 'error').mockImplementation(() => undefined)
    const { ctx, emitter } = watched()

    ctx.watchFiles(() => undefined)
    emitter.emit('all', 'change', 'a.tsx')
    await settle()

    expect(error).not.toHaveBeenCalled()
  })
})
