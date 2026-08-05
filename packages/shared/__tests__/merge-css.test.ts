import { describe, expect, test } from 'vitest'
import { createMergeCss } from '../src/classname'

const context = {
  utility: {
    prefix: '',
    hasShorthand: false,
    resolveShorthand: (p: string) => p,
    transform: (prop: string, value: any) => ({ className: `${prop}_${value}` }),
    toHash: (path: string[], h: (s: string) => string) => h(path.join(':')),
  },
  conditions: {
    breakpoints: { keys: ['sm', 'md'] },
    shift: (v: string[]) => v,
    finalize: (v: string[]) => v,
  },
}

const { mergeCss } = createMergeCss(context)

/**
 * `mergeCss` drops style objects that are empty once undefined values are removed. That
 * predicate decides whether a later object gets to merge over an earlier one at all, so the
 * exact set of things it counts as "present" is load-bearing — and it is answered without
 * building the compacted object it describes.
 */
describe('mergeCss discards empty style objects', () => {
  test('an object with no keys contributes nothing', () => {
    expect(mergeCss({ color: 'red' }, {})).toEqual({ color: 'red' })
  })

  test('an object whose every value is undefined contributes nothing', () => {
    expect(mergeCss({ color: 'red' }, { color: undefined })).toEqual({ color: 'red' })
  })

  test('one defined value among undefined ones is enough to merge', () => {
    expect(mergeCss({ color: 'red' }, { color: undefined, padding: '4px' })).toEqual({
      color: 'red',
      padding: '4px',
    })
  })

  test('null counts as present, unlike undefined', () => {
    // The predicate only ever dropped `undefined`. The difference is observable on a single
    // style object, which is returned without normalizing: had `{ color: null }` been read as
    // empty it would have merged to `{}` instead.
    expect(mergeCss({ color: null })).toEqual({ color: null })
    expect(mergeCss({ color: undefined })).toEqual({})
  })

  test('but a null value is still dropped once two objects are normalized', () => {
    // Long-standing and unrelated to the predicate: normalizing walks the object and skips
    // nullish leaves, and normalization only runs when there is more than one object to
    // merge. Pinned so the asymmetry above is not mistaken for this.
    expect(mergeCss({ color: 'red' }, { color: null })).toEqual({ color: 'red' })
  })

  test('a falsy value counts as present', () => {
    expect(mergeCss({ zIndex: 1 }, { zIndex: 0 })).toEqual({ zIndex: 0 })
    expect(mergeCss({ content: 'x' }, { content: '' })).toEqual({ content: '' })
  })

  /**
   * The next two need a responsive array to say anything at all.
   *
   * How many objects survive the predicate decides whether normalization runs: one survivor
   * is returned untouched, two or more are each normalized, and only normalization expands an
   * array into a breakpoint object. Asserting on a plain value instead would pass under any
   * predicate, because an object that wrongly survived would flatten to `{}` and merge to
   * nothing. Each also uses its own property name, so the memo cannot answer one from the
   * entry another left behind.
   */
  test('an inherited value does not count as present', () => {
    const inherited = Object.create({ color: 'blue' }) as Record<string, unknown>

    expect(mergeCss({ padding: ['1px', '2px'] }, inherited)).toEqual({ padding: ['1px', '2px'] })
  })

  test('a non-enumerable own value does not count as present', () => {
    const hidden = {}
    Object.defineProperty(hidden, 'color', { value: 'blue', enumerable: false })

    expect(mergeCss({ margin: ['3px', '4px'] }, hidden)).toEqual({ margin: ['3px', '4px'] })
  })

  test('a nested condition block counts as present', () => {
    expect(mergeCss({ color: 'red' }, { _hover: { color: 'blue' } })).toEqual({
      color: 'red',
      _hover: { color: 'blue' },
    })
  })
})
