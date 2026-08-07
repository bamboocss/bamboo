import { createRuleProcessor } from '@bamboocss/fixture'
import { describe, expect, test } from 'vitest'

const cfgs: Array<[string, any]> = [
  ['default', {}],
  ['prefix', { prefix: 'bam' }],
  ['hash', { hash: true }],
  ['hash+prefix', { hash: true, prefix: 'bam' }],
  ['separator', { separator: '=' }],
]

describe('scoped slot: sva', () => {
  test.each(cfgs)('%s', (name, config) => {
    const rule = createRuleProcessor(config).sva({
      className: 'cmp',
      slots: ['root', 'item'],
      base: { root: { color: 'red' }, item: { color: 'blue' } },
      variants: { size: { lg: { item: { padding: '4' } }, sm: { item: { padding: '2' } } } },
    } as never)

    console.log(`\n===== sva ${name} =====`)
    console.log(rule.toCss())
    console.log('CLASSES:', JSON.stringify(rule.getClassNames()))
    expect(true).toBe(true)
  })
})

describe('scoped slot: config recipe multiple anchors', () => {
  test.each(cfgs)('%s', (name, config) => {
    const rule = createRuleProcessor({
      ...config,
      theme: {
        extend: {
          slotRecipes: {
            menu: {
              className: 'menu',
              slots: ['root', 'positioner', 'item'],
              scopeRoots: ['root', 'positioner'],
              base: { root: { color: 'red' }, item: { color: 'blue' } },
              variants: { size: { sm: { item: { padding: '2' } }, lg: { item: { padding: '4' } } } },
            },
          },
        },
      },
    } as never).recipe('menu', { size: 'sm' })!

    console.log(`\n===== 2-anchor ${name} =====`)
    console.log(rule.toCss())
    console.log('CLASSES:', JSON.stringify(rule.getClassNames()))
    expect(true).toBe(true)
  })
})

describe('compound on scoped slot recipe', () => {
  test.each(cfgs)('%s', (name, config) => {
    const rule = createRuleProcessor({
      ...config,
      theme: {
        extend: {
          slotRecipes: {
            cmp: {
              className: 'cmp',
              slots: ['root', 'item'],
              scopeRoots: ['root'],
              base: { root: { color: 'red' }, item: { color: 'blue' } },
              variants: {
                size: { sm: { item: { padding: '2' } }, lg: { item: { padding: '4' } } },
                tone: { a: { item: { margin: '2' } }, b: { item: { margin: '4' } } },
              },
              compoundVariants: [
                { size: 'sm', tone: 'a', css: { item: { fontWeight: 'bold' } } },
                { size: ['sm', 'lg'], tone: 'b', css: { item: { opacity: '0.5' } } },
                // compound whose css targets the ANCHOR slot
                { size: 'lg', tone: 'a', css: { root: { textDecoration: 'underline' } } },
              ],
            },
          },
        },
      },
    } as never).recipe('cmp', { size: 'sm', tone: 'a' })!

    console.log(`\n===== compound-scoped ${name} =====`)
    console.log(rule.toCss())
    console.log('CLASSES:', JSON.stringify(rule.getClassNames()))
    expect(true).toBe(true)
  })
})
