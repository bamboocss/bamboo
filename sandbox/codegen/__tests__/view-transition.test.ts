import { describe, expect, test } from 'vitest'
import { viewTransition } from '../styled-system/css'

/**
 * The build emits `::view-transition-*` rules against a class it derives from the options
 * it found in the source. This is the other half of that: the class the *runtime* returns
 * for the same options, from the real generated `viewTransition()`.
 *
 * The expected strings are written literally, and the same literals appear in
 * `packages/parser/__tests__/view-transition.test.ts`, which asserts the CSS. Deriving
 * either from the shared helper would make both tests agree with a broken helper.
 */
describe('viewTransition', () => {
  test('returns the class the build emits CSS for', () => {
    expect(
      viewTransition({
        group: { animationDuration: '0.4s', animationTimingFunction: 'ease-in-out' },
        imagePair: { isolation: 'isolate' },
        old: { animationName: 'fade-out' },
        new: { animationName: 'fade-in' },
      }),
    ).toBe('vt_golYYs')
  })

  test('treats a nullish slot as absent, as the extractor is forced to', () => {
    const base = viewTransition({ old: { animationName: 'fade-out' } })
    expect(viewTransition({ old: { animationName: 'fade-out' }, new: undefined })).toBe(base)
    expect(viewTransition({ old: { animationName: 'fade-out' }, new: null as never })).toBe(base)
    // Pinned literally, and the same string appears in the parser test that asserts the
    // CSS this class has to match.
    expect(base).toBe('vt_ksOGxk')
  })

  test('does not depend on the order slots were written in', () => {
    const a = viewTransition({ group: { animationDuration: '0.4s' }, old: { animationName: 'x' } })
    const b = viewTransition({ old: { animationName: 'x' }, group: { animationDuration: '0.4s' } })
    expect(a).toBe(b)
  })

  test('does not depend on the order properties inside a slot were written in', () => {
    const a = viewTransition({ group: { animationDuration: '0.4s', animationName: 'x' } })
    const b = viewTransition({ group: { animationName: 'x', animationDuration: '0.4s' } })
    expect(a).toBe(b)
  })

  test('separates transitions that differ', () => {
    expect(viewTransition({ old: { animationName: 'a' } })).not.toBe(viewTransition({ old: { animationName: 'b' } }))
  })

  test('answers an empty bag with a class rather than undefined', () => {
    // Nothing is emitted for this, so the class matches no rule — but a caller spreading
    // it into `cx()` should get a string either way.
    expect(viewTransition({})).toMatch(/^vt_/)
  })
})
