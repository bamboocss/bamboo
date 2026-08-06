import { Recipes } from '../src/recipes'
import { createContext, createRuleProcessor } from '@bamboocss/fixture'
import { describe, expect, test } from 'vitest'

/**
 * A slot recipe's variants are chosen at the root, but the slots that react to them are
 * authored by the consumer somewhere below it. Rather than deliver the variant to each
 * slot at runtime — a context per recipe, a wrapper per slot — the rule is scoped by a
 * class the root already carries, so every non-root slot's class stays constant.
 */
describe('slot recipe variants are scoped by the root', () => {
  const css = (variants: Record<string, any>) => createRuleProcessor().recipe('checkbox', variants)!.toCss()

  test("a non-root slot's variant styles are emitted under the root's variant class", () => {
    const result = css({ size: 'md' })

    expect(result).toContain('@scope (.checkbox__root--size_md) to (.checkbox__root)')
    // The slot selects on its constant class — nothing carries the variant to it.
    expect(result).toContain('.checkbox__control')
    expect(result).not.toContain('.checkbox__control--size_md')
    expect(result).not.toContain('.checkbox__label--size_md')
  })

  /**
   * `to (.checkbox__root)` is what stops an outer `size="md"` from styling the control of
   * an inner checkbox. Both rules match the inner element at equal specificity, so without
   * the bound the winner would be stylesheet order rather than proximity — and which one
   * that is depends on which variant the build happened to encode first.
   */
  test('the scope is bounded at the next nested instance', () => {
    expect(css({ size: 'md' })).toContain('to (.checkbox__root)')
  })

  test('the root keeps its own styles on its own class', () => {
    // `checkbox` writes no root styles for `size`, so the scope is the only place the
    // variant appears — but the root's *base* is still a plain rule.
    expect(css({ size: 'md' })).toContain('.checkbox__root {')
  })

  /**
   * The marker class.
   *
   * `size` writes styles for `control` and `label` and none for `root`, so the root has no
   * rule of its own for it — but the class is the selector the scope opens on, so the
   * runtime has to put it on the element anyway. It fails silently if it does not: the
   * rules are in the sheet, the elements are on the page, and nothing matches.
   */
  test('the root carries a class for a variant that styles no root property', () => {
    const ctx = createContext()
    const recipe = ctx.recipes.getConfig('checkbox')

    expect(Object.keys((recipe as any).variants.size.md)).not.toContain('root')

    // The runtime derives the root's classes from the variant props alone, so a variant
    // with no root styles still names one. This is the contract the scope depends on.
    const rootClasses = ctx.recipes.getTransform('checkbox__root')('size', 'md')
    expect(rootClasses.className).toBe('checkbox__root--size_md')
  })

  /**
   * The two halves are derived independently — the prelude by the build, the class by the
   * runtime — and they only meet in the browser. If they ever disagree the rules are in
   * the sheet, the elements are on the page, and nothing matches or warns.
   */
  test('the scope opens on exactly the class the root is given', () => {
    const ctx = createContext()
    const rootClass = ctx.recipes.getTransform('checkbox__root')('size', 'md').className

    expect(css({ size: 'md' })).toContain(`@scope (.${rootClass}) to (.checkbox__root)`)
  })

  /**
   * A component library's enclosing element is not always a slot called `root` — and
   * sometimes the slot called `root` renders no element at all, which is the case that
   * makes this necessary rather than convenient.
   */
  test('scopeRoot anchors a recipe whose enclosing slot has another name', () => {
    const ctx = createContext({
      theme: {
        extend: {
          slotRecipes: {
            menu: {
              className: 'menu',
              slots: ['trigger', 'positioner', 'item'],
              scopeRoot: 'positioner',
              base: { positioner: { position: 'absolute' } },
              variants: { size: { sm: { item: { padding: '2' } } } },
            },
          },
        },
      },
    } as never)

    expect(Recipes.getRootSlot(ctx.recipes.getConfig('menu') as never)).toBe('positioner')
  })

  test('a scopeRoot naming no declared slot is not trusted', () => {
    expect(Recipes.getRootSlot({ slots: ['trigger', 'item'], scopeRoot: 'nope' } as never)).toBeUndefined()
  })

  /**
   * Sibling slots have no ancestor to scope by, so scoping one to another would emit rules
   * that match nothing. Those keep a variant class per slot.
   */
  test('a recipe whose slots are siblings keeps per-slot variant classes', () => {
    const result = createRuleProcessor().recipe('badge', { size: 'sm' })!.toCss()

    expect(result).not.toContain('@scope')
    expect(result).toContain('.badge__title--size_sm')
  })
})
