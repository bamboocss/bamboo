import { createRuleProcessor } from '@bamboocss/fixture'
import { describe, expect, test } from 'vitest'

const mk = (scopeRoots?: string[]) => ({
  theme: {
    extend: {
      slotRecipes: {
        leaky: {
          className: 'leaky',
          slots: ['root', 'item'],
          ...(scopeRoots ? { scopeRoots } : {}),
          base: { root: { color: 'red' }, item: { color: 'blue' } },
          variants: {
            size: { sm: { item: { padding: '2' } }, lg: { item: { padding: '4' } } },
            tone: { a: { item: { margin: '2' } }, b: { item: { margin: '4' } } },
          },
          compoundVariants: [{ size: 'sm', tone: 'a', css: { item: { fontWeight: 'bold' } } }],
        },
      },
    },
  },
})

describe('module-global sharedState across contexts', () => {
  test('scoped first, then unscoped: does the compound leak an @scope rule?', () => {
    const scoped = createRuleProcessor(mk(['root']) as never).recipe('leaky', { size: 'sm', tone: 'a' })!
    console.log('\n### A: scopeRoots: ["root"] ###')
    console.log(scoped.toCss())

    const unscoped = createRuleProcessor(mk([]) as never).recipe('leaky', { size: 'sm', tone: 'a' })!
    console.log('\n### B: scopeRoots: [] (same process, same recipe name) ###')
    console.log(unscoped.toCss())
    console.log('CLASSES B:', JSON.stringify(unscoped.getClassNames()))
    console.log('B contains @scope:', unscoped.toCss().includes('@scope'))
    expect(true).toBe(true)
  })
})

describe('fresh process baseline: unscoped only', () => {
  test('unscoped compound alone', () => {
    const unscoped = createRuleProcessor({
      theme: {
        extend: {
          slotRecipes: {
            fresh: {
              className: 'fresh',
              slots: ['root', 'item'],
              scopeRoots: [],
              base: { root: { color: 'red' }, item: { color: 'blue' } },
              variants: {
                size: { sm: { item: { padding: '2' } } },
                tone: { a: { item: { margin: '2' } } },
              },
              compoundVariants: [{ size: 'sm', tone: 'a', css: { item: { fontWeight: 'bold' } } }],
            },
          },
        },
      },
    } as never).recipe('fresh', { size: 'sm', tone: 'a' })!
    console.log('\n### fresh unscoped ###')
    console.log(unscoped.toCss())
    console.log('CLASSES:', JSON.stringify(unscoped.getClassNames()))
    expect(true).toBe(true)
  })
})
