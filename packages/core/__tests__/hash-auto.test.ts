import { createGeneratorContext } from '@bamboocss/fixture'
import { describe, expect, test } from 'vitest'

/**
 * `hash: 'auto'` — readable while you are looking at them, hashed when nobody is.
 *
 * Readable names cost nothing for most of what a project writes: `fs_14px` repeats, so it gzips
 * to within a rounding error of a hash. What costs is an *arbitrary* value, which is escaped into
 * the name whole — one measured project carried a complete `linear-gradient(…)` as a 105-character
 * class, and escaped names were 20% of all class-attribute bytes. That does not compress away,
 * because the redundancy is inside one long token rather than across repeated short ones.
 *
 * The mode is resolved once, at context creation, and every name the sheet and the compiler
 * produce comes from that one answer — deciding it per call site is how the emitted CSS and the
 * compiled literal would come to disagree about a class.
 */
const hashOf = (config: object) => (createGeneratorContext(config as never) as any).hash

describe('hash: auto', () => {
  test('hashes when nothing says this is development', () => {
    expect(hashOf({ hash: 'auto' })).toEqual({ className: true, tokens: true })
  })

  test('leaves names readable in development', () => {
    expect(hashOf({ hash: 'auto', dev: true })).toEqual({ className: false, tokens: false })
  })

  test('reads per-half, so class names and css vars can differ', () => {
    expect(hashOf({ hash: { className: 'auto', cssVar: false }, dev: true })).toEqual({
      className: false,
      tokens: false,
    })
    expect(hashOf({ hash: { className: 'auto', cssVar: true } })).toEqual({ className: true, tokens: true })
  })

  /** `dev` is about the mode, not about the setting: a plain boolean is unaffected by it. */
  test('does not touch an explicit setting', () => {
    expect(hashOf({ hash: true, dev: true })).toEqual({ className: true, tokens: true })
    expect(hashOf({ hash: false })).toEqual({ className: false, tokens: false })
    expect(hashOf({})).toEqual({ className: false, tokens: false })
  })
})
