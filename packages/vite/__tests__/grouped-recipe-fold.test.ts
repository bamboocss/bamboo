import { createContext } from '@bamboocss/fixture'
import { describe, expect, test } from 'vitest'
import { createRuntimeRecipe } from '../src/runtime-css'

/**
 * The generated `createRecipe` names its compound-variant half through `__atomicCss`,
 * because compound variants are extracted atomically whatever `cssMode` says. The fold
 * rebuilds that function in-process, so it has to make the same choice — folding the
 * grouped name would substitute a class that neither the stylesheet nor the runtime has,
 * and the element would render unstyled.
 */
describe('folding a config recipe under cssMode: grouped', () => {
  const recipes = {
    pill: {
      className: 'pill',
      base: { display: 'inline-flex' },
      variants: { size: { sm: { padding: '2' }, lg: { padding: '4' } } },
      compoundVariants: [{ size: 'sm', css: { textDecoration: 'underline', letterSpacing: '2px' } }],
    },
  }

  const resolveWith = (cssMode: 'atomic' | 'grouped') =>
    createRuntimeRecipe(createContext({ cssMode, theme: { extend: { recipes } } }) as never)

  test('the compound-variant half keeps its atomic class names', () => {
    const grouped = resolveWith('grouped')('pill', { size: 'sm' })
    const atomic = resolveWith('atomic')('pill', { size: 'sm' })
    expect(grouped).toBe(atomic)
  })

  test('the recipe and variant classes are still there', () => {
    const folded = resolveWith('grouped')('pill', { size: 'sm' })
    expect(folded).toContain('pill')
    expect(folded).toContain('pill--size_sm')
  })
})
