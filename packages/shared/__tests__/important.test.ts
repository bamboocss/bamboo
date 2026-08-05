import { FALLBACK_SEPARATOR } from '../src/fallback-value'
import { describe, expect, test } from 'vitest'
import { isImportant, markImportant, sanitize, withoutImportant, withoutSpace } from '../src/important'

/**
 * These four run per style leaf on every `css()` cache miss and each carries a fast path for
 * the values that dominate real style objects. The cases below are the ones where the guard
 * could be wrong rather than merely slow — a value that needs the work but does not look like
 * it, and a value that needs only half of it.
 */
describe('important and space handling', () => {
  describe('isImportant', () => {
    test.each([
      ['red !important', true],
      ['red!important', true],
      ['red !IMPORTANT', true],
      // The regex is `\s*!(important)?`, so a bare `!` matches with or without the word.
      ['red!', true],
      ['a!b', true],
      ['red', false],
      ['1px solid red', false],
      ['', false],
    ])('%j -> %s', (value, expected) => {
      expect(isImportant(value)).toBe(expected)
    })

    test('a non-string is never important', () => {
      expect(isImportant(4)).toBe(false)
      expect(isImportant(true)).toBe(false)
    })
  })

  describe('withoutImportant', () => {
    test('strips the marker', () => {
      expect(withoutImportant('red !important')).toBe('red')
      expect(withoutImportant('red!important')).toBe('red')
    })

    test('still trims a value that carries no marker', () => {
      // The fast path skips the regex, which is a no-op without a `!` — but not the trim,
      // which is not.
      expect(withoutImportant('  red  ')).toBe('red')
      expect(withoutImportant('\n red \t')).toBe('red')
    })

    test('trims the unicode whitespace `trim` treats as whitespace', () => {
      expect(withoutImportant('\u00a0red\u00a0')).toBe('red')
    })

    test('leaves a clean value alone', () => {
      expect(withoutImportant('red')).toBe('red')
      expect(withoutImportant(4)).toBe(4)
    })
  })

  describe('sanitize', () => {
    test('collapses every run of whitespace to one space', () => {
      expect(sanitize('1px   solid    red')).toBe('1px solid red')
      expect(sanitize('a\n\tb')).toBe('a b')
    })

    test('treats unicode whitespace as whitespace, as the regex does', () => {
      // `\s` matches these, so the guard has to as well or the collapse is skipped.
      expect(sanitize('a\u00a0b')).toBe('a b')
      expect(sanitize('a\u2003\u00a0b')).toBe('a b')
      expect(sanitize('a b')).toBe('a b')

      // The far edge of the set, and the reason the guard is a regex rather than a hand
      // rolled scan: a range check that stops at U+3000 misses the BOM and still passes
      // every case above.
      expect(sanitize('a\ufeffb')).toBe('a b')
      expect(sanitize('a\u3000b')).toBe('a b')
    })

    test('leaves alone the near-whitespace the regex excludes', () => {
      // Neither is matched by `\s`, so collapsing them would rewrite a value the original
      // passed through untouched.
      expect(sanitize('a\u200bb')).toBe('a\u200bb')
      expect(sanitize('a\u00adb')).toBe('a\u00adb')
    })

    test('leaves a value with no whitespace alone', () => {
      expect(sanitize('red')).toBe('red')
      expect(sanitize('')).toBe('')
      expect(sanitize(4)).toBe(4)
    })
  })

  describe('withoutSpace', () => {
    test('replaces every space', () => {
      expect(withoutSpace('1px solid red')).toBe('1px_solid_red')
    })

    test('only the literal space, as before', () => {
      // Deliberately not `\s`: a tab reaches this only if `sanitize` did not run, and this
      // has never rewritten one.
      expect(withoutSpace('a\tb')).toBe('a\tb')
      expect(withoutSpace('red')).toBe('red')
      expect(withoutSpace(4)).toBe(4)
    })
  })
  describe('fallback candidates', () => {
    const SEP = FALLBACK_SEPARATOR

    test('markImportant marks every candidate, not just the winning one', () => {
      // Marking only the last would leave the fallbacks losing an important-priority fight
      // in exactly the browsers that have to use them.
      expect(markImportant({ height: `100vh${SEP}100dvh` })).toEqual({
        height: `100vh !important${SEP}100dvh !important`,
      })
    })

    test('markImportant leaves an ordinary value alone', () => {
      expect(markImportant({ height: '100vh' })).toEqual({ height: '100vh !important' })
    })

    test('sanitize strips a separator arriving from author input', () => {
      expect(sanitize(`100px${SEP}200px`)).toBe('100px200px')
    })
  })
})
