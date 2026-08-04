import { describe, expect, test } from 'vitest'
import { createCss } from '../src/classname'
import { withoutSpace } from '../src/important'
import { leafClass } from '../src/leaf-class'

/**
 * The invariant is not "this produces a sensible class" — it is "this produces the class
 * `css()` would have produced, or declines". So every case is checked against a real
 * `createCss` rather than against a hand-written expectation.
 */
const css = createCss({
  utility: {
    prefix: '',
    hasShorthand: false,
    resolveShorthand: (prop) => prop,
    // `withoutSpace` included because the generated `transform` applies it, and leaving it
    // out here would have this fixture disagree with every real runtime.
    transform: (prop, value) => ({ className: `${prop}_${withoutSpace(value)}` }),
    toHash: (path) => path.join(':'),
  },
  conditions: { breakpoints: { keys: ['base', 'sm', 'md'] }, shift: (v) => v, finalize: (v) => v },
})

/** What the fold resolves at build time: the class for a value that survives untouched. */
const PREFIX = 'color_'
const viaLeaf = (value: unknown) => leafClass(PREFIX, value)
const viaCss = (value: unknown) => css({ color: value })

describe('leafClass', () => {
  describe('agrees with css() on values it answers', () => {
    const answered = [
      'red.300',
      'blue.500',
      '#abc',
      'rgb(1 2 3)',
      'var(--x)',
      'calc(1px+2px)',
      '4px',
      '-1',
      '',
      0,
      4,
      true,
      false,
      null,
      undefined,
    ]

    for (const value of answered) {
      test(`${JSON.stringify(value)}`, () => {
        expect(viaLeaf(value)).toBe(viaCss(value))
      })
    }
  })

  describe('agrees with css() on values that take the slow path', () => {
    const slow = [
      'red !important',
      'red!',
      'rgb(1 2 3)!important',
      '  padded  ',
      'a b',
      'a\nb',
      'a\tb',
      'a b',
      'a b',
      'calc(1px + 2px)',
      '0 0 0 1px red',
    ]

    for (const value of slow) {
      test(`${JSON.stringify(value)}`, () => {
        expect(viaLeaf(value)).toBe(viaCss(value))
      })
    }
  })

  describe('declines what does not reduce to one class', () => {
    test('an array expands to one class per breakpoint', () => {
      expect(viaLeaf(['red.300', 'blue.500'])).toBeUndefined()
      // The shape it declined to answer, for contrast.
      expect(viaCss(['red.300', 'blue.500'])).toBe('color_red.300 sm:color_blue.500')
    })

    test('an object is a condition block', () => {
      expect(viaLeaf({ base: 'red.300', md: 'blue.500' })).toBeUndefined()
    })

    test('a function has no sensible class, and css() would stringify it', () => {
      expect(viaLeaf(() => 'red')).toBeUndefined()
    })
  })

  describe('null and undefined are answered rather than declined', () => {
    test('both are the empty string, which is what the walk skipping them produces', () => {
      expect(viaLeaf(null)).toBe('')
      expect(viaLeaf(undefined)).toBe('')
      expect(viaCss(null)).toBe('')
      expect(viaCss(undefined)).toBe('')
    })
  })

  describe('the fast path is only taken where it changes nothing', () => {
    test('a value with no whitespace and no bang concatenates', () => {
      expect(viaLeaf('red.300')).toBe('color_red.300')
    })

    test('every character `\\s` matches routes to the slow path', () => {
      // Guards the character scan against the regex it stands in for: if one is added to
      // `\s` and not to the scan, this catches it.
      for (const code of [0x09, 0x0a, 0x0b, 0x0c, 0x0d, 0x20, 0xa0, 0x1680, 0x2000, 0x2028, 0x3000, 0xfeff]) {
        const value = `a${String.fromCharCode(code)}b`
        expect(viaLeaf(value), `U+${code.toString(16)}`).toBe(viaCss(value))
      }
    })
  })
})
