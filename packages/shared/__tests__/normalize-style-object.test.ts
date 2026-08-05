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
    breakpoints: { keys: ['base', 'sm', 'md'] },
    shift: (v: string[]) => v,
    finalize: (v: string[]) => v,
  },
}

/**
 * Normalizing renames shorthands, expands responsive arrays and drops nullish leaves. An
 * object needing none of the three is returned as it came in, so each of these is a case
 * where that shortcut must not be taken.
 */
describe('normalizeStyleObject', () => {
  test('a flat longhand object comes back unchanged', () => {
    const styles = { color: 'red', margin: '4px' }

    // By reference: without this, disabling the shortcut altogether would leave the suite
    // green, since every other assertion here is about what the walk produces.
    expect(normalizeStyleObject(styles, context)).toBe(styles)
  })

  test('a top-level responsive array is expanded, not returned as it came', () => {
    // `stop` is handed the container, so an array arriving here becomes a breakpoint object
    // rather than being walked into. A guard that only inspected values would miss it.
    expect(normalizeStyleObject(['red', 'blue'] as unknown as Record<string, any>, context)).toEqual({
      base: 'red',
      sm: 'blue',
    })
  })

  test('a shorthand is still renamed', () => {
    expect(normalizeStyleObject({ bg: 'red', color: 'blue' }, context)).toEqual({
      background: 'red',
      color: 'blue',
    })
  })

  test('a responsive array is still expanded', () => {
    expect(normalizeStyleObject({ color: ['red', 'blue'] }, context)).toEqual({
      color: { base: 'red', sm: 'blue' },
    })
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
