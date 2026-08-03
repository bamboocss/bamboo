import { createContext } from '@bamboocss/fixture'
import { cloneStyles, mergeProps } from '@bamboocss/shared'
import { describe, expect, test } from 'vitest'
import { generateCssFn } from '../src/artifacts/js/css-fn'
import { generateCvaFn } from '../src/artifacts/js/cva'

/**
 * Every `raw()` helper hands its result to user code while the merged object it
 * came from stays in a cache, so each one has to return something independent.
 * These assert the emitted runtime keeps that guard — the failure it prevents is
 * silent, so nothing else would notice it being dropped.
 */
describe('raw() helpers return independent objects', () => {
  test('css.raw copies the merged result', () => {
    const js = generateCssFn(createContext()).js
    expect(js).toContain('css.raw = (...styles) => cloneStyles(mergeCss(...styles))')
  })

  test('cva.raw copies the resolved result', () => {
    const js = generateCvaFn(createContext()).js
    expect(js).toContain('raw: (...args) => cloneStyles(resolve(...args))')
  })

  test('mergeProps does not copy, so the hot merge path stays cheap', () => {
    // The guarantee lives in cloneStyles at the raw() boundary, not in every merge.
    const nested = { color: 'red.500' }
    const merged: any = mergeProps({}, { _hover: nested })
    expect(merged._hover).toBe(nested)
  })

  test('the copy helper they rely on is deep', () => {
    // sva.raw forwards to cva.raw, so all three depend on this being a real copy
    // rather than a shared reference to a nested style object.
    const source: Record<string, any> = { _hover: { color: 'red.500' }, padding: ['1', '2'] }
    const copy: any = cloneStyles(source)

    expect(copy._hover).not.toBe(source._hover)
    expect(copy.padding).not.toBe(source.padding)

    copy._hover.color = 'MUTATED'
    copy.padding.push('3')
    expect(source._hover.color).toBe('red.500')
    expect(source.padding).toEqual(['1', '2'])
  })
})
