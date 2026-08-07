import { describe, expect, test } from 'vitest'
import { getUnit, toEm, toPx, toRem } from '../src/unit-conversion'

/**
 * These sit under breakpoint arithmetic, where being wrong is silent: a media query built
 * from a mis-read value is still valid CSS, it just matches the wrong viewports — or none.
 *
 * There was no test for any of it, and two defects were living here. Both are pinned below.
 */
describe('getUnit', () => {
  test.each([
    ['16px', 'px'],
    ['1rem', 'rem'],
    ['1em', 'em'],
    ['-2rem', 'rem'],
    ['.5rem', 'rem'],
    ['0.5em', 'em'],
    ['1e3px', 'px'],
    ['  40em  ', 'em'],
  ])('%s is %s', (value, unit) => {
    expect(getUnit(value)).toBe(unit)
  })

  test('units are case-insensitive, as they are in CSS', () => {
    // `40EM` is as valid as `40em`. Reporting no unit for it meant the value was passed
    // through and then read as pixels, which made a `50EM` breakpoint sixteen times smaller
    // than it should have been.
    expect(getUnit('40EM')).toBe('em')
    expect(getUnit('16PX')).toBe('px')
    expect(getUnit('2Rem')).toBe('rem')
  })

  test('a unit inside a larger expression is not the value’s unit', () => {
    // Unanchored, this found `rem` inside the expression and the conversion then ran
    // `parseFloat` over the whole string, producing `NaN`.
    expect(getUnit('calc(2rem + 3px)')).toBeUndefined()
    expect(getUnit('clamp(1rem, 2vw, 3rem)')).toBeUndefined()
    expect(getUnit('min(40em, 100%)')).toBeUndefined()
  })

  test('a unit that cannot be converted is not reported', () => {
    // Not an oversight: these functions convert between px, em and rem, and claiming a unit
    // it cannot convert is what let `50vw` be read as `50px`.
    for (const value of ['50vw', '30ch', '100%', '2vh', '10pt']) {
      expect(getUnit(value), value).toBeUndefined()
    }
  })
})

describe('conversion', () => {
  test.each([
    { em: '1em', px: '16px', rem: '1rem' },
    { em: '0.5em', px: '8px', rem: '0.5rem' },
    { em: '-2em', px: '-32px', rem: '-2rem' },
    { em: '40em', px: '640px', rem: '40rem' },
  ])('$px', ({ em, px, rem }) => {
    expect(toPx(em)).toBe(px)
    expect(toPx(rem)).toBe(px)
    expect(toRem(px)).toBe(rem)
    expect(toEm(px)).toBe(em)
  })

  test('a value already in the target unit is returned unchanged', () => {
    expect(toPx('16px')).toBe('16px')
    expect(toRem('1rem')).toBe('1rem')
    expect(toEm('1em')).toBe('1em')
  })

  test('a number is taken as pixels', () => {
    expect(toPx(24)).toBe('24px')
  })

  test('toEm scales against the font size it is given', () => {
    expect(toEm('32px', 32)).toBe('1em')
    expect(toEm('2rem', 32)).toBe('1em')
  })

  test('a value that is not a number and unit comes back untouched', () => {
    // The important half: untouched rather than `NaN`. A breakpoint of `calc(...)` used to
    // reach the stylesheet as `min-width: NaNrem`.
    for (const value of ['calc(2rem + 3px)', 'var(--x)', 'clamp(1rem,2vw,3rem)', '50vw', '100%', '']) {
      expect(toPx(value), `toPx(${value})`).toBe(value)
      expect(toRem(value), `toRem(${value})`).toBe(value)
      expect(toEm(value), `toEm(${value})`).toBe(value)
    }
  })

  test('nothing ever produces NaN', () => {
    // The guarantee is that a conversion never *introduces* `NaN`, which is what reached the
    // stylesheet as `min-width: NaNrem`. A value that already reads like one is passed
    // through, same as any other string this cannot parse.
    for (const value of ['calc(2rem + 3px)', 'var(--x)', '50vw', 'abc', '-', '.', '1e', 'px']) {
      for (const [name, out] of [
        ['toPx', toPx(value)],
        ['toRem', toRem(value)],
        ['toEm', toEm(value)],
      ] as const) {
        expect(String(out), `${name}(${value})`).not.toContain('NaN')
        expect(String(out), `${name}(${value}) should pass through`).toBe(value)
      }
    }
  })

  test('uppercase converts the same as lowercase', () => {
    expect(toPx('40EM')).toBe(toPx('40em'))
    expect(toRem('640PX')).toBe(toRem('640px'))
  })
})
