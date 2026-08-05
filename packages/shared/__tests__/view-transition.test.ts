import { describe, expect, test } from 'vitest'
import { viewTransitionClassName } from '../src/view-transition'

/**
 * This function is the contract between the build and the runtime: the extractor hashes
 * the options it found in the source, the generated `viewTransition()` hashes the options
 * it was called with, and the CSS only reaches the element if the two agree.
 *
 * What that costs is that the hash is now an output people depend on. Every case below is
 * a way two callers can write the same transition differently and still have to land on
 * one class — or a way they can write different transitions and must not.
 *
 * Everything goes through the exported function rather than the serializer beneath it.
 * The serializer's exact encoding is not the contract; agreeing on a class is.
 */
describe('viewTransitionClassName', () => {
  const options = { group: { animationDuration: '0.4s' }, old: { animationName: 'fade-out' } }

  test('is stable, and prefixed with vt_', () => {
    expect(viewTransitionClassName(options)).toMatchInlineSnapshot(`"vt_bcNwmI"`)
  })

  test('ignores the order the slots were written in', () => {
    expect(viewTransitionClassName({ old: options.old, group: options.group })).toBe(viewTransitionClassName(options))
  })

  test('ignores the order properties inside a slot were written in', () => {
    const a = { group: { animationDuration: '0.4s', animationName: 'x' } }
    const b = { group: { animationName: 'x', animationDuration: '0.4s' } }
    expect(viewTransitionClassName(a)).toBe(viewTransitionClassName(b))
  })

  test('ignores keys that are not slots', () => {
    expect(viewTransitionClassName({ ...options, comment: 'ignored' })).toBe(viewTransitionClassName(options))
  })

  /**
   * The extractor cannot see the difference — a nullish property is gone from what it
   * hands over — so neither may this, or `new: enabled ? {…} : null` gets a class whose
   * CSS was emitted under a different one, taking the static slots down with it.
   */
  test('treats a nullish slot as absent', () => {
    expect(viewTransitionClassName({ ...options, new: undefined })).toBe(viewTransitionClassName(options))
    expect(viewTransitionClassName({ ...options, new: null })).toBe(viewTransitionClassName(options))
  })

  test('separates transitions that differ', () => {
    expect(viewTransitionClassName({ group: { animationDuration: '0.4s' } })).not.toBe(
      viewTransitionClassName({ group: { animationDuration: '0.5s' } }),
    )
  })

  test('separates a string from the number that prints the same', () => {
    expect(viewTransitionClassName({ group: { opacity: 1 } })).not.toBe(
      viewTransitionClassName({ group: { opacity: '1' } }),
    )
  })

  test('keeps array order', () => {
    // Sorting these would merge two different responsive values into one class.
    expect(viewTransitionClassName({ group: { animationDuration: ['a', 'b'] } })).not.toBe(
      viewTransitionClassName({ group: { animationDuration: ['b', 'a'] } }),
    )
  })

  test('applies the config prefix', () => {
    expect(viewTransitionClassName(options, 'bamboo')).toBe(`bamboo-${viewTransitionClassName(options)}`)
  })

  test('answers an empty or malformed bag with a class rather than throwing', () => {
    // Nothing is emitted for these; the caller gets a class that matches no CSS rather
    // than `undefined` leaking into a `className`.
    expect(viewTransitionClassName({})).toMatch(/^vt_/)
    expect(viewTransitionClassName(undefined)).toMatch(/^vt_/)
    expect(viewTransitionClassName('nope')).toMatch(/^vt_/)
  })
})
