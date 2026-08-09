import { createGeneratorContext } from '@bamboocss/fixture'
import type { Config } from '@bamboocss/types'
import { describe, expect, test } from 'vitest'
import { generateCx } from '../src/artifacts/js/cx'

type Cx = (...args: unknown[]) => string
type CvaPick = (value: unknown, classNameByValue: Record<string, string>, fallback?: string) => string

/**
 * Evaluate the emitted artifact rather than a copy of it. These ship to the browser as this
 * exact string, and a test that reimplemented them would be free to drift from them.
 */
const compile = (): { cx: Cx; cvaPick: CvaPick } => {
  const { js } = generateCx(createGeneratorContext())
  // `splitProps` is re-exported from helpers, so the import is dropped rather than resolved —
  // nothing here exercises it, and the two functions defined in this module are the point.
  const body = js.replace(/^import[^\n]*\n/m, '').replace(/export\s*\{[^}]*\}/, 'return { cx, cvaPick }')
  return new Function(body)() as { cx: Cx; cvaPick: CvaPick }
}

const { cx, cvaPick } = compile()

/**
 * The helper the fold emits for a variant chosen at runtime.
 *
 * It stands in for what `cvaFn` would have decided, so it has to make the same three
 * distinctions: `undefined` means the property was never passed and the recipe's default
 * applies; a declared value selects its class; anything else selects nothing — including
 * `null`, which `compact` deliberately keeps rather than treating as absent.
 */
describe('generated cvaPick', () => {
  const table = { a: ' badge--tone_a', b: ' badge--tone_b' }

  test('selects the class a declared value names', () => {
    expect(cvaPick('a', table)).toBe(' badge--tone_a')
    expect(cvaPick('b', table)).toBe(' badge--tone_b')
  })

  test('falls back only for undefined, which is what compact drops', () => {
    expect(cvaPick(undefined, table, ' badge--tone_b')).toBe(' badge--tone_b')
    expect(cvaPick(null, table, ' badge--tone_b')).toBe('')
  })

  test('selects nothing for a value the config does not declare', () => {
    for (const value of ['zzz', '', 0, false, Number.NaN]) {
      expect(cvaPick(value, table, ' badge--tone_b')).toBe('')
    }
  })

  test('with no fallback, an absent value selects nothing', () => {
    expect(cvaPick(undefined, table)).toBe('')
  })

  /**
   * The table is an object literal, so a plain lookup would find `Object.prototype` and
   * concatenate a *function* into the class attribute.
   */
  test.each(['toString', 'constructor', 'hasOwnProperty', 'valueOf', '__proto__'])(
    'a value of %s selects nothing rather than a prototype member',
    (value) => {
      expect(cvaPick(value, table)).toBe('')
    },
  )

  test('a variant genuinely named like a prototype member still works', () => {
    expect(cvaPick('toString', { toString: ' badge--tone_toString' })).toBe(' badge--tone_toString')
  })
})

describe('generated cx', () => {
  test('joins its arguments', () => {
    expect(cx('px_4', 'c_red.300')).toBe('px_4 c_red.300')
  })

  test('skips falsy parts and flattens arrays', () => {
    expect(cx('a', false, undefined, null, ['b', ['c']], 0)).toBe('a b c')
  })

  test('returns a lone class string untouched', () => {
    expect(cx('px_4')).toBe('px_4')
    expect(cx()).toBe('')
  })

  /**
   * The contract that replaced merging.
   *
   * `cx` used to drop the earlier of two classes setting the same property, which read as
   * an override resolving. It only ever worked where the class names carried a property to
   * compare, and silently stopped in any build that hashed them — so the same source
   * behaved differently in development and production.
   *
   * Now it keeps both, everywhere, and precedence is the cascade's job. Two `css()` outputs
   * are in the same layer and resolve by source order; a `cva`/`sva` class is in `recipes`
   * and always loses to a consumer's `css()` in `utilities`.
   */
  test('does not resolve conflicts — both classes survive', () => {
    expect(cx('px_4', 'px_2')).toBe('px_4 px_2')
    expect(cx('c_red.300', 'c_blue.500')).toBe('c_red.300 c_blue.500')
  })

  test('a duplicate is not deduplicated either', () => {
    expect(cx('px_4', 'px_4')).toBe('px_4 px_4')
  })

  test('leaves classes bamboo did not generate alone', () => {
    expect(cx('my-button', 'px_4', 'my-button')).toBe('my-button px_4 my-button')
  })
})

/**
 * The reason merging was removed.
 *
 * `hash` is commonly wired to a minification flag — off while developing, on when
 * shipping. A `cx` that resolved conflicts under one and concatenated under another turned
 * an override bug into something that only appeared in production, with nothing raised at
 * build time to say so.
 *
 * One implementation, byte for byte, whatever the config says.
 */
describe('generated cx is identical in every build', () => {
  const configs: Array<[string, Config | undefined]> = [
    ['default', undefined],
    ['hash.className', { hash: true } as Config],
    ['prefix', { prefix: 'bam' } as Config],
    ['separator', { separator: '-' } as Config],
  ]

  const baseline = generateCx(createGeneratorContext())

  test.each(configs)('%s emits the same implementation and declaration', (_label, config) => {
    // Built from each config to prove the emitted artifact does not consult it. The context is
    // needed only to spell the `helpers` import, which no styling option changes.
    const { js, dts } = generateCx(createGeneratorContext(config as Config))
    expect(js).toBe(baseline.js)
    expect(dts).toBe(baseline.dts)
  })

  test('the declaration says it does not merge', () => {
    expect(baseline.dts).toContain('does **not** resolve conflicts')
    expect(baseline.js).not.toContain('mergeKey')
  })
})
