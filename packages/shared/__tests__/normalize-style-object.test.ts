import { describe, expect, test } from 'vitest'
import { normalizeStyleObject } from '../src/normalize-style-object'

const SHORTHANDS: Record<string, string> = { bg: 'background', p: 'padding' }

const context = {
  utility: {
    prefix: '',
    hasShorthand: true,
    resolveShorthand: (prop: string) => SHORTHANDS[prop] ?? prop,
    transform: (prop: string, value: any) => ({ className: `${prop}_${value}` }),
    toHash: (path: string[], h: (s: string) => string) => h(path.join(':')),
  },
  conditions: {
    shift: (v: string[]) => v,
    finalize: (v: string[]) => v,
  },
}

/**
 * Normalizing renames shorthands and drops nullish leaves. An object needing neither is
 * returned as it came in, so each of these is a case where that shortcut must not be taken.
 */
describe('normalizeStyleObject', () => {
  test('a flat longhand object comes back unchanged', () => {
    const styles = { color: 'red', margin: '4px' }

    // By reference: without this, disabling the shortcut altogether would leave the suite
    // green, since every other assertion here is about what the walk produces.
    expect(normalizeStyleObject(styles, context)).toBe(styles)
  })

  test('a top-level array is rejected, not returned as it came', () => {
    // `stop` is handed the container, so an array arriving here reaches the predicate whole
    // rather than being walked into. A guard that only inspected values would miss it, and
    // the shortcut above would hand the array straight back.
    expect(() => normalizeStyleObject(['red', 'blue'] as unknown as Record<string, any>, context)).toThrow(
      'An array is not a style value.',
    )
  })

  test('a shorthand is still renamed', () => {
    expect(normalizeStyleObject({ bg: 'red', color: 'blue' }, context)).toEqual({
      background: 'red',
      color: 'blue',
    })
  })

  test('an array under a property is rejected, and the message names the property', () => {
    // The whole reason this throws rather than passing the array through: a font stack
    // written the way CSS writes one used to become one value per breakpoint, silently.
    expect(() => normalizeStyleObject({ fontFamily: ['Inter', 'sans-serif'] }, context)).toThrow(
      'An array is not a style value: "fontFamily".',
    )
  })

  test('the property named is the one holding the array, however deep', () => {
    expect(() => normalizeStyleObject({ _hover: { color: ['red', 'blue'] } }, context)).toThrow(
      'An array is not a style value: "_hover.color".',
    )
  })

  test('a nullish leaf is still dropped', () => {
    // The one that matters most: a surviving nullish value would override the value beneath
    // it the next time two style objects are merged.
    //
    // Asserted on the key set rather than with `toEqual`, which ignores a key whose value is
    // `undefined` and so cannot tell "dropped" from "still there".
    expect(Object.keys(normalizeStyleObject({ color: 'red', margin: null }, context))).toEqual(['color'])
    expect(Object.keys(normalizeStyleObject({ color: 'red', margin: undefined }, context))).toEqual(['color'])
  })

  test('a condition block is still walked', () => {
    expect(normalizeStyleObject({ _hover: { bg: 'red', margin: null } }, context)).toEqual({
      _hover: { background: 'red' },
    })
  })

  test('shorthand renaming can be switched off', () => {
    expect(normalizeStyleObject({ bg: 'red' }, context, false)).toEqual({ bg: 'red' })
  })

  test('renaming is skipped when the utility declares no shorthands', () => {
    const noShorthand = { ...context, utility: { ...context.utility, hasShorthand: false } }

    expect(normalizeStyleObject({ bg: 'red' }, noShorthand)).toEqual({ bg: 'red' })
  })

  test('a falsy but present value survives', () => {
    expect(normalizeStyleObject({ zIndex: 0, content: '', flexGrow: false }, context)).toEqual({
      zIndex: 0,
      content: '',
      flexGrow: false,
    })
  })
})
