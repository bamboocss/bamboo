import { getRecipeIdentity } from '@bamboocss/shared'
import { describe, expect, test } from 'vitest'

const base = { base: { root: { color: 'red' } }, slots: ['root', 'item'], variants: { size: { sm: { item: {} } } } }

describe('getRecipeIdentity edges', () => {
  test('slots array order matters', () => {
    const a = getRecipeIdentity({ ...base, slots: ['root', 'item'] } as never, 'sva')
    const b = getRecipeIdentity({ ...base, slots: ['item', 'root'] } as never, 'sva')
    console.log('slots order:', a, b, a === b ? 'SAME' : 'DIFFERENT')
    expect(true).toBe(true)
  })

  test('scopeRoots undefined vs absent vs []', () => {
    const absent = getRecipeIdentity({ ...base } as never, 'sva')
    const undef = getRecipeIdentity({ ...base, scopeRoots: undefined } as never, 'sva')
    const empty = getRecipeIdentity({ ...base, scopeRoots: [] } as never, 'sva')
    const rootOnly = getRecipeIdentity({ ...base, scopeRoots: ['root'] } as never, 'sva')
    console.log('absent  :', absent)
    console.log('undefined:', undef)
    console.log('empty   :', empty)
    console.log('["root"]:', rootOnly)
    console.log('absent===undefined:', absent === undef)
    console.log('absent===empty    :', absent === empty)
    console.log('absent===rootOnly :', absent === rootOnly)
    expect(true).toBe(true)
  })

  test('slots absent vs slots present-but-same-as-inferred', () => {
    const noSlots = getRecipeIdentity(
      { base: { root: { color: 'red' } }, variants: { size: { sm: { item: {} } } } } as never,
      'sva',
    )
    const withSlots = getRecipeIdentity(
      { base: { root: { color: 'red' } }, slots: ['root', 'item'], variants: { size: { sm: { item: {} } } } } as never,
      'sva',
    )
    console.log('no slots  :', noSlots)
    console.log('with slots:', withSlots)
    console.log('same:', noSlots === withSlots)
    expect(true).toBe(true)
  })

  test('a className still short-circuits everything', () => {
    expect(getRecipeIdentity({ className: 'x', slots: ['a'] } as never, 'sva')).toBe('x')
    expect(getRecipeIdentity({ className: 'x', slots: ['b'] } as never, 'sva')).toBe('x')
  })

  test('cva prefix vs sva prefix on identical config', () => {
    const c = getRecipeIdentity(base as never)
    const s = getRecipeIdentity(base as never, 'sva')
    console.log('cva:', c, 'sva:', s)
    expect(true).toBe(true)
  })
})
