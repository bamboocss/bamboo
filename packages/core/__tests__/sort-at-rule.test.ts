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

/**
 * The length parse used to match `ch|em|ex|px|rem` and fall back to `/(\d)/` — one digit — for
 * anything else, so a query's rank became its first digit. `(min-width: 100vw)` scored 1 and
 * `(min-width: 20vw)` scored 2, which for mobile-first `min-` queries is the reverse of the
 * order the cascade needs: the wider breakpoint lost to the narrower one wherever both applied.
 *
 * It reached every unit outside that alternation — every viewport and container unit among
 * them, which is to say the units a container query is most likely to be written in.
 */
describe('sort-at-rules with units beyond px/rem', () => {
  test('viewport units rank by their number, not their first digit', () => {
    expect(['(min-width: 100vw)', '(min-width: 20vw)', '(min-width: 50vw)'].sort(sortAtRules)).toEqual([
      '(min-width: 20vw)',
      '(min-width: 50vw)',
      '(min-width: 100vw)',
    ])
  })

  test('container units rank by their number too', () => {
    expect(['(min-width: 100cqw)', '(min-width: 20cqw)', '(min-width: 60cqw)'].sort(sortAtRules)).toEqual([
      '(min-width: 20cqw)',
      '(min-width: 60cqw)',
      '(min-width: 100cqw)',
    ])
  })

  test('the dynamic and root-relative spellings rank like the plain ones', () => {
    expect(['(min-width: 100dvh)', '(min-width: 20svh)', '(min-width: 50lvh)'].sort(sortAtRules)).toEqual([
      '(min-width: 20svh)',
      '(min-width: 50lvh)',
      '(min-width: 100dvh)',
    ])
  })

  test('a max- bound in viewport units still ranks descending', () => {
    expect(['(max-width: 20vw)', '(max-width: 100vw)', '(max-width: 50vw)'].sort(sortAtRules)).toEqual([
      '(max-width: 100vw)',
      '(max-width: 50vw)',
      '(max-width: 20vw)',
    ])
  })

  test('absolute units convert and interleave with px', () => {
    expect(
      ['(min-width: 768px)', '(min-width: 4in)', '(min-width: 600pt)', '(min-width: 20cm)', '(min-width: 40pc)'].sort(
        sortAtRules,
      ),
    ).toEqual([
      '(min-width: 4in)', // 384px
      '(min-width: 40pc)', // 640px
      '(min-width: 20cm)', // 755.9px
      '(min-width: 768px)',
      '(min-width: 600pt)', // 800px
    ])
  })

  /**
   * `ch` and `rch` differ only in which font they resolve against, which nothing here can read,
   * so both convert against the same 16px root the file has always assumed.
   */
  test('font-relative units convert against the assumed root', () => {
    const ranked = (query: string) =>
      ['(min-width: 1000px)', query, '(min-width: 100px)'].sort(sortAtRules).indexOf(query)

    expect(ranked('(min-width: 80ch)')).toBe(1) // 711.875px
    expect(ranked('(min-width: 80rch)')).toBe(1)
    expect(ranked('(min-width: 40lh)')).toBe(1) // 768px
  })

  /**
   * Pinned rather than argued. A `vw` or `cqw` bound has no pixel value to compare against a
   * `px` breakpoint, so each family is ordered within itself and placed after everything that
   * does resolve to a length, rather than against an invented reference viewport. Where the
   * families sit relative to each other is arbitrary under any scheme; this makes it stable.
   */
  test('units that resolve to a length rank ahead of units that cannot', () => {
    expect(['(min-width: 10cqw)', '(min-width: 90vw)', '(min-width: 9999px)'].sort(sortAtRules)).toEqual([
      '(min-width: 9999px)',
      '(min-width: 90vw)',
      '(min-width: 10cqw)',
    ])
  })

  test('a number belonging to a feature that is not a length is not read as one', () => {
    const ranked = (query: string) =>
      ['(min-width: 1000px)', query, '(min-width: 100px)'].sort(sortAtRules).indexOf(query)

    expect(ranked('(-webkit-min-device-pixel-ratio: 2) and (min-width: 40rem)')).toBe(1)
    expect(ranked('(min-resolution: 192dpi) and (min-width: 40rem)')).toBe(1)
  })

  test('a unitless zero is still a zero', () => {
    expect(['(min-width: 40rem)', '(min-width: 0)'].sort(sortAtRules)).toEqual(['(min-width: 0)', '(min-width: 40rem)'])
  })
})
