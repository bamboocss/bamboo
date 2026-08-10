import { describe, expect, test, vi } from 'vitest'
import { createLogger } from '../src/create-logger'

/**
 * `filter` answers "which subsystem", `level` answers "how loud". Keeping them apart is what
 * lets a build stay at `warn` while one namespace is followed in full — raising `level` to
 * `debug` instead un-silences everything.
 *
 * Reachable only through the `BAMBOO_DEBUG` environment variable until it became settable,
 * which put it out of reach of a checked-in config.
 *
 * Asserted on what is *printed*, not on `onLog` — that sink deliberately receives every entry
 * whatever the level or filter, so it cannot see the thing under test.
 */
const collect = (setup: (logger: ReturnType<typeof createLogger>) => void) => {
  const printed: string[] = []
  const spy = vi.spyOn(console, 'log').mockImplementation((...args) => {
    printed.push(args.join(' '))
  })

  try {
    setup(createLogger({ level: 'warn' }))
  } finally {
    spy.mockRestore()
  }

  /** The type is rendered into the printed label, so matching on it is enough. */
  return (type: string) => printed.some((line) => line.includes(type))
}

describe('logger filter', () => {
  test('without one, level decides and info is below warn', () => {
    const shows = collect((logger) => {
      logger.info('vite:transform', 'a')
      logger.warn('config', 'b')
    })

    expect(shows('vite:transform')).toBe(false)
    expect(shows('config')).toBe(true)
  })

  test('a filter shows matching types at debug, whatever the level is', () => {
    const shows = collect((logger) => {
      logger.filter = 'vite:*'
      logger.debug('vite:transform', 'a')
      logger.info('vite:fold', 'b')
    })

    expect(shows('vite:transform')).toBe(true)
    expect(shows('vite:fold')).toBe(true)
  })

  test('and suppresses the types it does not match, including ones level would have shown', () => {
    const shows = collect((logger) => {
      logger.filter = 'vite:*'
      logger.warn('config', 'a')
      logger.error('tokens:unresolved', 'b')
    })

    expect(shows('config')).toBe(false)
    expect(shows('tokens:unresolved')).toBe(false)
  })

  test('accepts several globs', () => {
    const shows = collect((logger) => {
      logger.filter = 'prune:*, config'
      logger.debug('prune:tokens', 'a')
      logger.debug('config', 'b')
      logger.debug('vite:transform', 'c')
    })

    expect(shows('prune:tokens')).toBe(true)
    expect(shows('config')).toBe(true)
    expect(shows('vite:transform')).toBe(false)
  })

  test('clearing it hands control back to level', () => {
    const shows = collect((logger) => {
      logger.filter = 'vite:*'
      logger.filter = ''
      logger.info('vite:transform', 'a')
      logger.warn('config', 'b')
    })

    expect(shows('vite:transform')).toBe(false)
    expect(shows('config')).toBe(true)
  })

  /** `'*'` means everything, which is what no filter already means. */
  test("'*' is not treated as a glob that excludes everything else", () => {
    const shows = collect((logger) => {
      logger.filter = '*'
      logger.warn('config', 'a')
      logger.info('vite:transform', 'b')
    })

    expect(shows('config')).toBe(true)
    expect(shows('vite:transform')).toBe(false)
  })

  test('round-trips what it was given', () => {
    const logger = createLogger({})
    logger.filter = 'prune:*, config'

    expect(logger.filter).toBe('prune:*,config')
  })
})
