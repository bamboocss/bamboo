import { describe, expect, test } from 'vitest'
import { createFoldFixture } from './fixture'

/**
 * A slot recipe call returns one class per slot, so the expression that resolves to a
 * string is `recipe(props).slot` rather than the call.
 *
 * The case worth the machinery is a *scoped* recipe's non-anchor slot. Its variant styles
 * arrive through an `@scope` rule anchored on an enclosing slot, so its own class is a
 * constant — the same string whatever the props are — and it folds even when the variant is
 * fully dynamic. Before scoping every slot carried a variant class and none of this was
 * possible.
 */
describe('folding slot recipes', () => {
  const foldSlot = (source: string) => {
    const { fold } = createFoldFixture()
    return fold(`import { checkbox, badge } from '../styled-system/recipes'\ndeclare const dyn: 'sm' | 'md'\n${source}`)
  }

  test('an anchor slot folds with static variants', () => {
    const r = foldSlot(`export const a = checkbox({ size: 'sm' }).root`)
    expect(r.code).toContain('"checkbox__root checkbox__root--size_sm"')
  })

  test('a constant slot folds even when the variant is dynamic', () => {
    const r = foldSlot(`export const a = checkbox({ size: dyn }).control`)
    expect(r.code).toContain('"checkbox__control"')
  })

  test('an anchor slot with a dynamic variant is left alone', () => {
    // Its class *is* the variant, so there is nothing constant to fold to.
    const r = foldSlot(`export const a = checkbox({ size: dyn }).root`)
    expect(r.code).toContain('checkbox({ size: dyn }).root')
    expect(r.skipped.map((s) => s.reason)).toContain('dynamic')
  })

  test('an unscoped recipe folds no slot on a dynamic variant', () => {
    // `badge` has sibling slots and no anchor, so every slot takes variants and none of
    // them is constant.
    const r = foldSlot(`export const a = badge({ size: dyn }).title`)
    expect(r.code).toContain('badge({ size: dyn }).title')
  })

  test('the whole call is still declined', () => {
    // It resolves to an object, and the fold substitutes a string.
    const r = foldSlot(`export const a = checkbox({ size: 'sm' })`)
    expect(r.code).toContain("checkbox({ size: 'sm' })")
    expect(r.skipped.map((s) => s.reason)).toContain('unsupported-kind')
  })

  test('a folded slot class has a rule behind it', () => {
    const { fold, getCss } = createFoldFixture()
    fold(`import { checkbox } from '../styled-system/recipes'\nexport const a = checkbox({ size: 'sm' }).control`)
    // The constant class is what the base rule is emitted under.
    expect(getCss()).toContain('.checkbox__control')
  })
})
