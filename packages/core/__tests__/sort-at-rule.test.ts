import { describe, expect, test } from 'vitest'
import { sortAtRules } from '../src/sort-at-rules'

describe('sort-at-rules', () => {
  test(`should sort mobile first`, () => {
    const receivedOrder = [
      'screen and (max-width: 640px)',
      'screen and (min-width: 980px)',
      'screen and (max-width: 980px)',
      'tv',
      'screen and (max-width: 768px)',
      'screen and (min-width: 640px)',
      'print',
      'screen and (min-width: 1280px)',
      'screen',
      'screen and (min-width: 768px)',
      'screen and (max-width: 1280px)',
    ]

    const expectedOrder = [
      'screen and (min-width: 640px)',
      'screen and (min-width: 768px)',
      'screen and (min-width: 980px)',
      'screen and (min-width: 1280px)',
      'screen and (max-width: 1280px)',
      'screen and (max-width: 980px)',
      'screen and (max-width: 768px)',
      'screen and (max-width: 640px)',
      'screen',
      'tv',
      'print', // always last
    ]

    const expected = expectedOrder.join('\n')
    const received = receivedOrder.sort(sortAtRules).join('\n')
    expect(received).toBe(expected)
  })
})

/**
 * The comparator reads a bound out of each query and orders `min` ascending, then `max`
 * descending, then everything else. It does that by looking for the literal `min-width` and
 * `max-width`, so range syntax carries no bound as far as it is concerned and every breakpoint
 * would rank as "neither" — which sorts by length alone and interleaves a `Down` override with
 * the rules it is supposed to override. Nothing is dropped and no query is malformed, so the
 * only symptom is the wrong declaration winning at some viewports.
 */
describe('sort-at-rules with range syntax', () => {
  test('orders range syntax the way it orders the equivalent min-/max- query', () => {
    const receivedOrder = [
      '(width < 640px)',
      '(width >= 980px)',
      '(width < 980px)',
      'tv',
      '(width < 768px)',
      '(width >= 640px)',
      'print',
      '(width >= 1280px)',
      'screen',
      '(width >= 768px)',
      '(width < 1280px)',
    ]

    expect(receivedOrder.sort(sortAtRules)).toEqual([
      '(width >= 640px)',
      '(width >= 768px)',
      '(width >= 980px)',
      '(width >= 1280px)',
      '(width < 1280px)',
      '(width < 980px)',
      '(width < 768px)',
      '(width < 640px)',
      'screen',
      'tv',
      'print',
    ])
  })

  test('a double-ended range ranks by its lower bound, like a min-/max- pair', () => {
    expect(['(width >= 64rem)', '(width >= 40rem) and (width < 48rem)', '(width < 40rem)'].sort(sortAtRules)).toEqual([
      '(width >= 40rem) and (width < 48rem)',
      '(width >= 64rem)',
      '(width < 40rem)',
    ])
  })

  test('the two dialects interleave', () => {
    expect(['(width < 48rem)', 'screen and (min-width: 64rem)', '(width >= 40rem)'].sort(sortAtRules)).toEqual([
      '(width >= 40rem)',
      'screen and (min-width: 64rem)',
      '(width < 48rem)',
    ])
  })

  test('container features carry a bound too', () => {
    expect(['(inline-size < 48rem)', '(inline-size >= 40rem)'].sort(sortAtRules)).toEqual([
      '(inline-size >= 40rem)',
      '(inline-size < 48rem)',
    ])
  })

  test('the interval and reversed spellings of one range rank alike', () => {
    const ranked = (query: string) => ['(width >= 96rem)', query, '(width < 20rem)'].sort(sortAtRules).indexOf(query)

    expect(ranked('(40rem <= width < 48rem)')).toBe(0)
    expect(ranked('(40rem <= width)')).toBe(0)
    expect(ranked('(width >= 40rem)')).toBe(0)
  })

  test('a calc() bound is still read as a bound', () => {
    expect(['(width < 30rem)', '(width >= calc(40rem + 8px))'].sort(sortAtRules)).toEqual([
      '(width >= calc(40rem + 8px))',
      '(width < 30rem)',
    ])
  })

  /**
   * The value pattern admits one level of parens, which covers `calc()`, `min()`, `max()` and
   * `clamp()` as anyone writes them. A function nested inside another is not rewritten, so the
   * query classifies as carrying neither bound and ranks by length alone.
   *
   * Pinned rather than fixed because the alternative is balanced-paren matching, which a regex
   * cannot do, for a bound nobody writes. It is here so the boundary is a decision rather than
   * a surprise — the failure is silent, and this is the input that reaches it.
   */
  test('a bound nested two levels deep is not classified', () => {
    expect(['(width < 30rem)', '(width >= calc(40rem + calc(2 * 4px)))'].sort(sortAtRules)).toEqual([
      '(width < 30rem)',
      '(width >= calc(40rem + calc(2 * 4px)))',
    ])
  })
})
