import { groupBy, truncateList } from '../src/truncate-list'
import { describe, expect, test } from 'vitest'

/**
 * A build error's job is to name the mistake. Every list in a bamboo diagnostic used to be
 * joined whole, so one bad shared import produced 400 identical blocks and 1,221 lines of
 * stderr — with the paragraph saying what to do about it scrolled off the top.
 */
describe('truncateList', () => {
  test('a list that fits is joined and nothing else', () => {
    // The common case, and the one that must not gain a trailing line: a build reporting two
    // problems has to read exactly as it did before any of this existed.
    expect(truncateList(['a', 'b'], { separator: '\n' })).toBe('a\nb')
  })

  test('a list exactly at the limit is not truncated', () => {
    const entries = Array.from({ length: 10 }, (_, i) => `e${i}`)
    const out = truncateList(entries, { separator: '\n' })

    expect(out).toBe(entries.join('\n'))
    expect(out).not.toMatch(/more/)
  })

  test('past the limit, the remainder becomes a count', () => {
    const out = truncateList(
      Array.from({ length: 13 }, (_, i) => `e${i}`),
      { separator: '\n', unit: 'file' },
    )

    expect(out).toMatch(/^e0\n/)
    expect(out).toContain('e9')
    expect(out).not.toContain('e10')
    expect(out).toMatch(/… and 3 more files\.$/)
  })

  test('one withheld entry is singular', () => {
    const out = truncateList(
      Array.from({ length: 11 }, (_, i) => `e${i}`),
      { separator: '\n', unit: 'file' },
    )

    expect(out).toMatch(/… and 1 more file\.$/)
  })

  test('the count is of what was withheld, not of the whole set', () => {
    // Callers open with the total — "400 call(s) name a binding that does not exist" — so a
    // second total here would state the same number twice and leave the reader working out
    // which one the list is a subset of.
    const out = truncateList(
      Array.from({ length: 100 }, (_, i) => `e${i}`),
      { separator: '\n', limit: 4 },
    )

    expect(out).toMatch(/… and 96 more items\.$/)
  })
})

describe('groupBy', () => {
  test('collapses items sharing a key, preserving order', () => {
    const groups = groupBy(
      [
        { name: 'stack', file: 'a' },
        { name: 'wrap', file: 'b' },
        { name: 'stack', file: 'c' },
      ],
      (item) => item.name,
    )

    expect([...groups.keys()]).toEqual(['stack', 'wrap'])
    expect(groups.get('stack')?.map((i) => i.file)).toEqual(['a', 'c'])
  })

  test('an empty list is an empty map, not a group of nothing', () => {
    expect(groupBy([], String).size).toBe(0)
  })
})

/**
 * The cap is right for reading a failure and wrong for scoping the work behind it. A user
 * migrating a codebase could only see ten findings at a time and had to rebuild — minutes a
 * round — to reveal the next batch, with no way to drive the list to zero.
 */
describe('BAMBOO_DIAGNOSTIC_LIMIT', () => {
  const withLimit = <T>(value: string | undefined, run: () => T): T => {
    const previous = process.env.BAMBOO_DIAGNOSTIC_LIMIT
    if (value === undefined) delete process.env.BAMBOO_DIAGNOSTIC_LIMIT
    else process.env.BAMBOO_DIAGNOSTIC_LIMIT = value
    try {
      return run()
    } finally {
      if (previous === undefined) delete process.env.BAMBOO_DIAGNOSTIC_LIMIT
      else process.env.BAMBOO_DIAGNOSTIC_LIMIT = previous
    }
  }

  const entries = Array.from({ length: 30 }, (_, index) => `entry-${index}`)

  test('raises the default', () => {
    const result = withLimit('20', () => truncateList(entries, { separator: '\n' }))
    expect(result).toContain('entry-19')
    expect(result).toContain('… and 10 more items.')
  })

  test('`all` withholds nothing', () => {
    const result = withLimit('all', () => truncateList(entries, { separator: '\n' }))
    expect(result).toContain('entry-29')
    expect(result).not.toContain('more')
  })

  // A caller's limit is a house style for that one diagnostic; the env var is a user saying
  // they need the whole list whichever diagnostic produced it.
  test('overrides a limit the caller passed explicitly', () => {
    const result = withLimit('all', () => truncateList(entries, { limit: 5, separator: '\n' }))
    expect(result).toContain('entry-29')
  })

  // Replacing the message the user was trying to read with one about their own env var is
  // not an improvement, so a malformed value falls back rather than throwing.
  test('a malformed value falls back to the default', () => {
    for (const value of ['0', '-4', 'lots', '2.5']) {
      const result = withLimit(value, () => truncateList(entries, { separator: '\n' }))
      expect(result, value).toContain('… and 20 more items.')
    }
  })
})
