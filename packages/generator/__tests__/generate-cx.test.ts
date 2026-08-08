import { createGeneratorContext } from '@bamboocss/fixture'
import type { Config } from '@bamboocss/types'
import { describe, expect, test } from 'vitest'
import { generateCx } from '../src/artifacts/js/cx'

type Cx = (...args: unknown[]) => string

/**
 * Evaluate the emitted artifact rather than a copy of it. `cx` ships to the browser as this
 * exact string, and a test that reimplemented it would be free to drift from it.
 */
const compile = (): Cx => {
  const { js } = generateCx()
  return new Function(`${js.replace(/export\s*\{\s*cx\s*\}/, 'return cx')}`)() as Cx
}

describe('generated cx', () => {
  const cx = compile()

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

  const baseline = generateCx()

  test.each(configs)('%s emits the same implementation and declaration', (_label, config) => {
    // The config is built to prove the emitted artifact does not consult it.
    createGeneratorContext(config as Config)

    const { js, dts } = generateCx()
    expect(js).toBe(baseline.js)
    expect(dts).toBe(baseline.dts)
  })

  test('the declaration says it does not merge', () => {
    expect(baseline.dts).toContain('does **not** resolve conflicts')
    expect(baseline.js).not.toContain('mergeKey')
  })
})
