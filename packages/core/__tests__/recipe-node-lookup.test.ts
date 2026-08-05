import { createGeneratorContext } from '@bamboocss/fixture'
import { describe, expect, test } from 'vitest'
import { Recipes } from '../src/recipes'

/**
 * `getNode` reads the node map by key instead of building the whole node list and scanning it
 * for a matching `baseName`. Two things have to hold for that to be the same lookup, and both
 * are load-bearing enough to pin.
 *
 * Kept in its own file: the last test prunes the module-level node map, which would otherwise
 * pull the recipes out from under anything sharing the file.
 */
describe('recipe node lookup', () => {
  test('the key a node is stored under is its own baseName', () => {
    const ctx = createGeneratorContext()
    const { details } = ctx.recipes

    expect(details.length).toBeGreaterThan(0)
    for (const detail of details) {
      expect(ctx.recipes.getNode(detail.baseName)).toBe(detail)
    }
  })

  test('a slot recipe registers one node, under its root name', () => {
    const ctx = createGeneratorContext()

    // Slots reach `sharedState.styles` and `.classNames`, never `.nodes`, so there is no
    // `checkbox__label` node for either form of the lookup to find.
    expect(ctx.recipes.isSlotRecipe('checkbox')).toBe(true)
    expect(ctx.recipes.getNode('checkbox')).toBeDefined()
    expect(ctx.recipes.getNode('checkbox__label')).toBeUndefined()
  })

  test('an unknown name is undefined, not a throw', () => {
    const ctx = createGeneratorContext()
    expect(ctx.recipes.getNode('nopeNotARecipe')).toBeUndefined()
  })

  test('a lookup is not cached across a prune', () => {
    const ctx = createGeneratorContext()
    expect(ctx.recipes.getNode('cardStyle')).toBeDefined()

    // The node map is module-level, and a `Recipes` built from a different set prunes the
    // names it does not carry — so this reaches the context above. Memoizing `getNode`, as
    // the neighbouring `getRecipe` does, would keep answering with the removed node.
    // eslint-disable-next-line no-new
    new Recipes({ somethingElse: { className: 'somethingElse', base: {} } })

    expect(ctx.recipes.getNode('cardStyle')).toBeUndefined()
    expect(ctx.recipes.getNode('cardStyle')).toBe(ctx.recipes.details.find((node) => node.baseName === 'cardStyle'))
  })
})
