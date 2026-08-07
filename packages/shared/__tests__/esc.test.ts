import { describe, test, expect } from 'vitest'
import { esc } from '../src'

describe('esc className', () => {
  test('simple', () => {
    expect(esc('a0b')).toMatchInlineSnapshot('"a0b"')
    expect(esc('bg_red')).toMatchInlineSnapshot('"bg_red"')
  })

  test('number', () => {
    expect(esc('0a')).toMatchInlineSnapshot(`"\\30 a"`)
    expect(esc('-0a')).toMatchInlineSnapshot(`"-\\30 a"`)
    expect(esc('2xl:bg_red')).toMatchInlineSnapshot(`"\\32 xl\\:bg_red"`)
  })

  test('decimal', () => {
    expect(esc('m_0.5')).toMatchInlineSnapshot(`"m_0\\.5"`)
  })

  test('important', () => {
    expect(esc('m_0.5!')).toMatchInlineSnapshot(`"m_0\\.5\\!"`)
  })

  test('invalid characters are escaped', () => {
    expect(esc('w:_$-1/2')).toMatchInlineSnapshot(`"w\\:_\\$-1\\/2"`)
    expect(esc('--a')).toMatchInlineSnapshot(`"\\--a"`)
  })

  test('edge cases', () => {
    expect(esc('\x80\x2D\x5F\xA9')).toMatchInlineSnapshot('"-_©"')
    expect(esc('\x20\x21\x78\x79')).toMatchInlineSnapshot(`"\\ \\!xy"`)
    expect(esc('\x01\x02\x1E\x1F')).toMatchInlineSnapshot(`"\\1 \\2 \\1e \\1f "`)
  })

  test('flametest', () => {
    expect(esc('decoration-[#ccc]')).toMatchInlineSnapshot(`"decoration-\\[\\#ccc\\]"`)
    expect(esc('[@media]:bg_red')).toMatchInlineSnapshot(`"\\[\\@media\\]\\:bg_red"`)
    expect(esc('bg-red-500/50')).toMatchInlineSnapshot(`"bg-red-500\\/50"`)
    expect(esc('p-[8px_4px]')).toMatchInlineSnapshot(`"p-\\[8px_4px\\]"`)
    expect(esc('w_1/3')).toMatchInlineSnapshot(`"w_1\\/3"`)
    expect(esc(`hover:bg-[url('https://github.com/img.png')]`)).toMatchInlineSnapshot(
      `"hover\\:bg-\\[url\\(\\'https\\:\\/\\/github\\.com\\/img\\.png\\'\\)\\]"`,
    )
  })
})

/**
 * What an escape *means*, rather than what it spells.
 *
 * Every assertion above compares `esc` against a recorded string, which cannot tell a correct
 * escape from one a CSS parser reads as a different character — and for a while it recorded
 * exactly that: `esc('0a')` was pinned as `\30a`, which is U+030A, a combining ring above.
 *
 * So this decodes the way a parser does and checks the round trip. A hex escape takes up to
 * six hex digits and then one optional whitespace, which is consumed as part of the escape;
 * anything else after a backslash is that character literally.
 */
const decode = (value: string) =>
  value.replace(/\\(?:([0-9a-fA-F]{1,6}) ?|(.))/g, (_match, hex: string | undefined, char: string | undefined) =>
    hex ? String.fromCodePoint(Number.parseInt(hex, 16)) : (char ?? ''),
  )

describe('esc round trip', () => {
  test.each([
    // Reaches the bug: the character after the escape is itself a hex digit.
    { name: 'a numeric breakpoint', value: '640:p_4' },
    { name: 'a two-digit condition', value: '12:p_4' },
    { name: 'a digit followed by a-f', value: '3d:p_4' },
    { name: 'a digit-led arbitrary value', value: '2col' },
    { name: 'a digit followed by a', value: '0a' },
    { name: 'a negative digit-led name', value: '-0a' },
    { name: 'six hex digits of runway', value: '1080p' },
    // Escaped the same way, and correct before the fix only because the next character
    // happens not to be a hex digit. They must stay correct.
    { name: 'a stock breakpoint', value: '2xl:bg_red' },
    { name: 'a 4k breakpoint', value: '4k:p_4' },
    { name: 'a digit-led word', value: '9lives' },
    // Everything else, to catch a fix that changes more than the terminator.
    { name: 'a plain class', value: 'bg_red' },
    { name: 'a decimal', value: 'm_0.5' },
    { name: 'an important decimal', value: 'm_0.5!' },
    { name: 'a fraction', value: 'w_1/3' },
    { name: 'an arbitrary value', value: 'p-[8px_4px]' },
    { name: 'a url', value: `hover:bg-[url('https://github.com/img.png')]` },
    { name: 'control characters', value: '\x01\x02\x1E\x1F' },
    { name: 'a space and a bang', value: '\x20\x21\x78\x79' },
  ])('$name survives escaping', ({ value }) => {
    expect(decode(esc(value))).toBe(value)
  })

  test('the terminator ends the escape rather than formatting it', () => {
    // Only the *first* character is escaped as a code point — the pattern is anchored — so
    // the digits after it stay literal and are exactly what the escape would swallow without
    // a terminator. `\36 40` is "6" then "40"; `\3640` is a single character, U+3640.
    //
    // Pinned so a future tidy-up cannot quietly drop the space again: it reads like padding
    // and is the difference between a selector that matches and one that does not.
    expect(esc('640:p_4')).toBe('\\36 40\\:p_4')
    expect(decode(esc('640:p_4'))).toBe('640:p_4')

    // What the same input produced before the fix, kept as the counter-example.
    expect(decode('\\3640\\:p_4')).not.toBe('640:p_4')
  })
})
