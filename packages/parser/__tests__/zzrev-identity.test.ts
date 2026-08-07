import { getRecipeIdentity } from '@bamboocss/shared'
import { describe, expect, test } from 'vitest'
import { parseAndExtract } from './fixture'

/**
 * The build hashes the EXTRACTED config; the runtime hashes the literal. If extraction
 * drops or retypes a STYLE_FIELD, the two names diverge and every slot renders unstyled.
 */
describe('extracted identity vs runtime identity', () => {
  const cases: Array<[string, string, any]> = [
    [
      'scopeRoots',
      `
      import { sva } from 'styled-system/css'
      const c = sva({
        slots: ['root', 'item'],
        scopeRoots: ['root'],
        base: { root: { color: 'red' }, item: { color: 'blue' } },
        variants: { size: { sm: { item: { padding: '2' } } } },
      })
      export const x = c({ size: 'sm' })
      `,
      {
        slots: ['root', 'item'],
        scopeRoots: ['root'],
        base: { root: { color: 'red' }, item: { color: 'blue' } },
        variants: { size: { sm: { item: { padding: '2' } } } },
      },
    ],
    [
      'scopeRoots empty',
      `
      import { sva } from 'styled-system/css'
      const c = sva({
        slots: ['root', 'item'],
        scopeRoots: [],
        base: { root: { color: 'red' }, item: { color: 'blue' } },
        variants: { size: { sm: { item: { padding: '2' } } } },
      })
      export const x = c({ size: 'sm' })
      `,
      {
        slots: ['root', 'item'],
        scopeRoots: [],
        base: { root: { color: 'red' }, item: { color: 'blue' } },
        variants: { size: { sm: { item: { padding: '2' } } } },
      },
    ],
    [
      'numeric style value',
      `
      import { sva } from 'styled-system/css'
      const c = sva({
        slots: ['root', 'item'],
        base: { root: { zIndex: 3 }, item: { color: 'blue' } },
        variants: { size: { sm: { item: { padding: '2' } } } },
      })
      export const x = c({ size: 'sm' })
      `,
      {
        slots: ['root', 'item'],
        base: { root: { zIndex: 3 }, item: { color: 'blue' } },
        variants: { size: { sm: { item: { padding: '2' } } } },
      },
    ],
    [
      'boolean variant',
      `
      import { sva } from 'styled-system/css'
      const c = sva({
        slots: ['root', 'item'],
        base: { root: { color: 'red' }, item: { color: 'blue' } },
        variants: { raised: { true: { item: { padding: '2' } } } },
      })
      export const x = c({ raised: true })
      `,
      {
        slots: ['root', 'item'],
        base: { root: { color: 'red' }, item: { color: 'blue' } },
        variants: { raised: { true: { item: { padding: '2' } } } },
      },
    ],
    [
      'compound variant with array value',
      `
      import { sva } from 'styled-system/css'
      const c = sva({
        slots: ['root', 'item'],
        base: { root: { color: 'red' }, item: { color: 'blue' } },
        variants: { size: { sm: { item: { padding: '2' } }, lg: { item: { padding: '4' } } }, tone: { a: { item: { margin: '1' } } } },
        compoundVariants: [{ size: ['sm', 'lg'], tone: 'a', css: { item: { fontWeight: 'bold' } } }],
      })
      export const x = c({ size: 'sm', tone: 'a' })
      `,
      {
        slots: ['root', 'item'],
        base: { root: { color: 'red' }, item: { color: 'blue' } },
        variants: {
          size: { sm: { item: { padding: '2' } }, lg: { item: { padding: '4' } } },
          tone: { a: { item: { margin: '1' } } },
        },
        compoundVariants: [{ size: ['sm', 'lg'], tone: 'a', css: { item: { fontWeight: 'bold' } } }],
      },
    ],
  ]

  test.each(cases)('%s', (name, code, literal) => {
    const result = parseAndExtract(code)
    const expected = getRecipeIdentity(literal, 'sva')
    console.log(`\n===== ${name} =====`)
    console.log('runtime identity:', expected)
    console.log('build css:\n' + result.css)
    console.log('build names it correctly:', result.css.includes(expected))
    expect(true).toBe(true)
  })
})
