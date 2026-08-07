import { createRuleProcessor } from '@bamboocss/fixture'
import { describe, expect, test } from 'vitest'

/** `className` containing the slot separator. */
describe('splitRecipeKey', () => {
  test('className containing __', () => {
    const rule = createRuleProcessor({
      theme: {
        extend: {
          slotRecipes: {
            card: {
              className: 'card__body',
              slots: ['root', 'item'],
              base: { root: { color: 'red' }, item: { color: 'blue' } },
              variants: { size: { sm: { item: { padding: '2' } } } },
            },
          },
        },
      },
    } as never).recipe('card', { size: 'sm' })!
    console.log('\n== className with __ ==')
    console.log(rule.toCss())
    console.log('CLASSES', JSON.stringify(rule.getClassNames()))
    expect(true).toBe(true)
  })

  test('slot name containing __', () => {
    const rule = createRuleProcessor({
      theme: {
        extend: {
          slotRecipes: {
            card: {
              className: 'card',
              slots: ['root', 'a__b'],
              base: { root: { color: 'red' }, a__b: { color: 'blue' } },
              variants: { size: { sm: { a__b: { padding: '2' } } } },
            },
          },
        },
      },
    } as never).recipe('card', { size: 'sm' })!
    console.log('\n== slot with __ ==')
    console.log(rule.toCss())
    console.log('CLASSES', JSON.stringify(rule.getClassNames()))
    expect(true).toBe(true)
  })

  test('recipe name that is a prefix of another registered name', () => {
    const rule = createRuleProcessor({
      theme: {
        extend: {
          slotRecipes: {
            card: {
              className: 'card',
              slots: ['root', 'body__inner'],
              base: { root: { color: 'red' }, body__inner: { color: 'blue' } },
            },
            card__body: {
              className: 'card__body',
              slots: ['root', 'inner'],
              base: { root: { color: 'green' }, inner: { color: 'purple' } },
            },
          },
        },
      },
    } as never)

    const a = rule.recipe('card', {})!
    const b = rule.recipe('card__body', {})!
    console.log('\n== card ==')
    console.log(a.toCss())
    console.log('CLASSES', JSON.stringify(a.getClassNames()))
    console.log('\n== card__body ==')
    console.log(b.toCss())
    console.log('CLASSES', JSON.stringify(b.getClassNames()))
    expect(true).toBe(true)
  })

  test('inline sva under a hashed identity, slot containing __', () => {
    const rule = createRuleProcessor().sva({
      slots: ['root', 'a__b'],
      base: { root: { color: 'red' }, a__b: { color: 'blue' } },
      variants: { size: { sm: { a__b: { padding: '2' } } } },
    } as never)
    console.log('\n== inline sva slot with __ ==')
    console.log(rule.toCss())
    console.log('CLASSES', JSON.stringify(rule.getClassNames()))
    expect(true).toBe(true)
  })
})
