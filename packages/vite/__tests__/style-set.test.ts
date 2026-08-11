import { describe, expect, test } from 'vitest'
import { createContext } from '@bamboocss/fixture'
import { createRuntimeCss } from '../src/runtime-css'
import { createStaticStyleSetCompiler } from '../src/style-set'

const compiler = () => {
  const ctx = createContext()
  return createStaticStyleSetCompiler(ctx, createRuntimeCss(ctx))
}

describe('static style sets', () => {
  test('recipe declarations and css declarations allocate the same atoms', () => {
    const styles = compiler()
    const recipe = styles.resolveRecipe({ base: { display: 'flex' } })

    expect(recipe).toEqual({ display: 'flex' })
    expect(styles.className(recipe!)).toBe(styles.className({ display: 'flex' }))
  })

  test('composes base, selected variants and matching compounds before allocating classes', () => {
    const styles = compiler()
    const recipe = styles.resolveRecipe(
      {
        base: { display: 'flex', color: 'red.300' },
        variants: {
          tone: {
            quiet: { color: 'gray.500' },
            loud: { color: 'red.500' },
          },
          size: {
            sm: { padding: '1' },
            lg: { padding: '4' },
          },
        },
        defaultVariants: { size: 'sm' },
        compoundVariants: [{ tone: 'quiet', size: ['sm', 'lg'], css: { opacity: 0.8 } }],
      },
      { tone: 'quiet' },
    )

    expect(recipe).toEqual({ display: 'flex', color: 'gray.500', padding: '1', opacity: 0.8 })
    expect(styles.className(recipe!)).toBe(
      styles.className({
        display: 'flex',
        color: 'gray.500',
        padding: '1',
        opacity: 0.8,
      }),
    )
  })

  test('resolves one slot without carrying recipe identity into its declarations', () => {
    const styles = compiler()
    const config = {
      slots: ['root', 'label'],
      base: {
        root: { display: 'flex' },
        label: { color: 'gray.500' },
      },
      variants: {
        size: {
          sm: {
            root: { gap: '1' },
            label: { fontSize: 'sm' },
          },
        },
      },
      defaultVariants: { size: 'sm' },
    }

    expect(styles.resolveRecipe(config, {}, 'root')).toEqual({ display: 'flex', gap: '1' })
    expect(styles.resolveRecipe(config, {}, 'label')).toEqual({ color: 'gray.500', fontSize: 'sm' })
    expect(styles.resolveRecipe(config)).toBeUndefined()
  })

  test('declines conditional selections until their conditions can be preserved', () => {
    const styles = compiler()
    expect(
      styles.resolveRecipe(
        { variants: { size: { sm: { padding: '1' }, lg: { padding: '4' } } } },
        { size: { base: 'sm', md: 'lg' } },
      ),
    ).toBeUndefined()
  })
})
