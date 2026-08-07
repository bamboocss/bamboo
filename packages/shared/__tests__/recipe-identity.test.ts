import { describe, expect, test } from 'vitest'
import { getRecipeIdentity } from '../src/recipe-identity'

/**
 * The build derives this while emitting the stylesheet and the runtime derives it again in
 * the browser, from the same config but never from each other. Every property here is one
 * the two sides depend on agreeing about; a disagreement emits rules under one name and
 * asks for another, which renders as an element with no styles rather than as an error.
 */
describe('getRecipeIdentity', () => {
  test('a declared className is used verbatim', () => {
    expect(getRecipeIdentity({ base: { color: 'red' }, className: 'button' })).toBe('button')
  })

  test('an undeclared className hashes the config', () => {
    expect(getRecipeIdentity({ base: { color: 'red' } })).toMatch(/^cva_[a-zA-Z]+$/)
  })

  test('the prefix is caller supplied, so sva can differ from cva', () => {
    expect(getRecipeIdentity({ base: { color: 'red' } }, 'sva')).toMatch(/^sva_[a-zA-Z]+$/)
  })

  test('key order does not change the identity', () => {
    const a = getRecipeIdentity({ base: { color: 'red', padding: '4' } })
    const b = getRecipeIdentity({ base: { padding: '4', color: 'red' } })
    expect(a).toBe(b)
  })

  test('field order does not change the identity', () => {
    const a = getRecipeIdentity({ base: { color: 'red' }, variants: { size: { sm: { padding: '2' } } } })
    const b = getRecipeIdentity({ variants: { size: { sm: { padding: '2' } } }, base: { color: 'red' } })
    expect(a).toBe(b)
  })

  test('nested condition objects sort too', () => {
    const a = getRecipeIdentity({ base: { _hover: { color: 'blue', padding: '2' } } })
    const b = getRecipeIdentity({ base: { _hover: { padding: '2', color: 'blue' } } })
    expect(a).toBe(b)
  })

  test('different styles get different identities', () => {
    const a = getRecipeIdentity({ base: { color: 'red' } })
    const b = getRecipeIdentity({ base: { color: 'blue' } })
    expect(a).not.toBe(b)
  })

  test('compound variant order is part of the identity', () => {
    // Precedence ordered — two orderings are two different recipes, so they must not
    // collapse onto one name the way two orderings of a plain object do.
    const a = getRecipeIdentity({
      compoundVariants: [
        { color: 'red', size: 'sm' },
        { color: 'blue', size: 'lg' },
      ],
    })
    const b = getRecipeIdentity({
      compoundVariants: [
        { color: 'blue', size: 'lg' },
        { color: 'red', size: 'sm' },
      ],
    })
    expect(a).not.toBe(b)
  })

  test('metadata outside the style fields does not change the identity', () => {
    const a = getRecipeIdentity({ base: { color: 'red' } })
    const b = getRecipeIdentity({ base: { color: 'red' }, jsx: ['Button'] } as never)
    expect(a).toBe(b)
  })

  test('an absent field and an undefined one agree', () => {
    const a = getRecipeIdentity({ base: { color: 'red' } })
    const b = getRecipeIdentity({ base: { color: 'red' }, variants: undefined })
    expect(a).toBe(b)
  })

  test('an empty className falls back to the hash rather than naming everything the same', () => {
    expect(getRecipeIdentity({ base: { color: 'red' }, className: '' })).toMatch(/^cva_/)
  })

  test('a function collapses rather than keying the name on minification', () => {
    const a = getRecipeIdentity({ base: { color: () => 'red' } } as never)
    const b = getRecipeIdentity({ base: { color: () => 'blue' } } as never)
    expect(a).toBe(b)
  })
})
