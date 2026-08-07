import type { RecipeDefinition } from '@bamboocss/types'
import { describe, expect, test } from 'vitest'
import { createRuleProcessor } from './fixture'

function processAtomicRule(config: RecipeDefinition<any>) {
  return createRuleProcessor().cva(config).toCss()
}

describe('Atomic recipe', () => {
  test('should work', () => {
    const sheet = processAtomicRule({
      base: {
        fontSize: 'lg',
      },
      variants: {
        size: {
          sm: {
            padding: '2',
            borderRadius: 'sm',
          },
          md: {
            padding: '4',
            borderRadius: 'md',
          },
        },
        variant: {
          primary: {
            color: 'white',
            backgroundColor: 'blue.500',
          },
          danger: {
            color: 'white',
            backgroundColor: 'red.500',
            _hover: {
              color: 'green',
            },
          },
        },
      },
    })

    expect(sheet).toMatchInlineSnapshot(`
      "@layer recipes {
        .cva_jgZhlc {
          font-size: var(--font-sizes-lg);
      }

        .cva_jgZhlc--size_sm {
          padding: var(--spacing-2);
          border-radius: var(--radii-sm);
      }

        .cva_jgZhlc--size_md {
          padding: var(--spacing-4);
          border-radius: var(--radii-md);
      }

        .cva_jgZhlc--variant_primary {
          color: var(--colors-white);
          background-color: var(--colors-blue-500);
      }

        .cva_jgZhlc--variant_danger {
          color: var(--colors-white);
          background-color: var(--colors-red-500);
      }

        .cva_jgZhlc--variant_danger:is(:hover, [data-hover]) {
          color: green;
      }
      }"
    `)
  })
})
