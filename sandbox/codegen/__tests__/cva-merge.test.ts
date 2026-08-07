import { describe, expect, test } from 'vitest'
import { cva } from '../styled-system/css/cva'

/** `merge` is not on the public `RecipeRuntimeFn`, so the shape is spelled out here. */
interface Merged {
  (props?: Record<string, unknown>): string
  getVariantProps: () => Record<string, unknown>
  merge: (other: unknown) => Merged
}

/**
 * `merge` composes two recipes into one set of classes.
 *
 * It cannot merge their *configs* and name classes off the result: a recipe's classes come
 * from the config the build saw, and the build only sees the literal `cva(...)` call sites.
 * A config synthesised at runtime has no rules behind it, so that returned classes that
 * styled nothing.
 */
describe('cva().merge()', () => {
  const a = cva({
    base: { color: 'red' },
    className: 'A',
    defaultVariants: { size: 'sm' },
    variants: { size: { lg: { padding: '9' }, sm: { padding: '1' } } },
  } as never)
  const b = cva({
    base: { background: 'blue' },
    className: 'B',
    defaultVariants: { tone: 'x' },
    variants: { tone: { x: { margin: '1' } } },
  } as never)
  const c = cva({
    base: { borderWidth: '1px' },
    className: 'C',
    defaultVariants: { shape: 'r' },
    variants: { shape: { r: { outlineWidth: '1px' } } },
  } as never)

  test('asks for classes both parents have rules for', () => {
    expect((a as never as { merge: (o: unknown) => Merged }).merge(b)().split(' ')).toEqual([
      'A',
      'A--size_sm',
      'B',
      'B--tone_x',
    ])
  })

  test('composes three, keeping the middle one', () => {
    // `merge` on the result must compose the *result*, not recompose the left parent.
    const three = (a as never as { merge: (o: unknown) => Merged }).merge(b).merge(c)
    expect(three()).toBe('A A--size_sm B B--tone_x C C--shape_r')
  })

  test('is associative', () => {
    const merge = (recipe: unknown) => recipe as never as Merged
    const left = merge(a).merge(b).merge(c)()
    const right = merge(a).merge(merge(b).merge(c))()
    expect(left).toBe(right)
  })

  test('applies the merged defaults, not each parent’s own', () => {
    const d = cva({
      className: 'D',
      defaultVariants: { size: 'lg' },
      variants: { size: { lg: { padding: '9' }, sm: { padding: '1' } } },
    } as never)
    const merged = (a as never as { merge: (o: unknown) => Merged }).merge(d)

    // Calling with no props must equal calling with the selection the recipe publishes.
    expect(merged()).toBe(merged(merged.getVariantProps()))
    expect(merged()).toContain('A--size_lg')
  })
})
