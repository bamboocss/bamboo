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

/**
 * The fold replaces a *longer* range for a slot access — the member expression rather than
 * the call. Widening it for anything else deletes the property read, which turns a fold from
 * "wrong class" into "TypeError": `css({ color: 'red' }).trim()` became `"c_red"()`.
 */
describe('a member access that is not a slot', () => {
  const foldWith = (source: string) => createFoldFixture().fold(source)

  test('a property access on a css() call survives', () => {
    const r = foldWith(`
import { css } from '../styled-system/css'
export const a = css({ color: 'red' }).trim()`)
    expect(r.code).toContain('"c_red".trim()')
  })

  test('a property access on a pattern call survives', () => {
    const r = foldWith(`
import { flex } from '../styled-system/patterns'
export const a = flex({ direction: 'row' }).split(' ')`)
    expect(r.code).toContain(".split(' ')")
    expect(r.code).not.toMatch(/"[^"]*"\(' '\)/)
  })

  test('a property access on a non-slot recipe still folds the call', () => {
    const r = foldWith(`
import { buttonStyle } from '../styled-system/recipes'
export const a = buttonStyle({ size: 'sm' }).length`)
    expect(r.code).toContain('.length')
    expect(r.code).toMatch(/"buttonStyle[^"]*"\.length/)
  })

  test('a property that is not a declared slot does not fold to a class', () => {
    // `.raw` is a real member of the recipe object; folding it to a slot class would be
    // silently wrong rather than a crash.
    const r = foldWith(`
import { checkbox } from '../styled-system/recipes'
export const a = checkbox({ size: 'sm' }).raw`)
    expect(r.code).toContain('.raw')
    expect(r.code).not.toContain('"checkbox__raw"')
  })
})

/**
 * A constant slot folds past its arguments without evaluating them, so deleting them has to
 * delete nothing observable. The same doctrine `token()`'s fallback argument follows.
 */
describe('a constant slot only folds past inert arguments', () => {
  const foldWith = (source: string) =>
    createFoldFixture().fold(`import { checkbox } from '../styled-system/recipes'\n${source}`)

  test('a binding read folds — that is the point of a constant slot', () => {
    const r = foldWith(`declare const dyn: 'sm' | 'md'\nexport const a = checkbox({ size: dyn }).control`)
    expect(r.code).toContain('"checkbox__control"')
  })

  test('a call in the props is not deleted', () => {
    const r = foldWith(
      `declare const log: (s: string) => any\nexport const a = checkbox({ size: log('boom') }).control`,
    )
    expect(r.code).toContain("log('boom')")
  })

  test('a spread is not deleted', () => {
    // Spreading runs the source's getters.
    const r = foldWith(`declare const getProps: () => any\nexport const a = checkbox({ ...getProps() }).control`)
    expect(r.code).toContain('getProps()')
  })

  test('a property read is not deleted', () => {
    // Solid compiles props to accessors, so reading one can run a getter.
    const r = foldWith(`declare const props: any\nexport const a = checkbox({ size: props.size }).control`)
    expect(r.code).toContain('props.size')
  })
})

/**
 * A TypeScript type wrapper is erased before anything runs, so it cannot add an effect —
 * and `dyn as Size`, `dyn!` and `dyn ?? 'sm'` are how a variant prop is normally written.
 * Rejecting them lost folds that landed before the inertness check existed.
 */
describe('inertness sees through erased wrappers', () => {
  const foldWith = (expression: string) =>
    createFoldFixture().fold(
      `import { checkbox } from '../styled-system/recipes'\ndeclare const dyn: any\ndeclare const log: () => any\nexport const a = ${expression}`,
    ).code

  test.each([
    ["checkbox({ size: dyn as 'sm' }).control"],
    ['checkbox({ size: dyn! }).control'],
    ['checkbox({ size: (dyn) }).control'],
    ["checkbox({ size: dyn ?? 'sm' }).control"],
    ['checkbox({ size: -1 as any }).control'],
  ])('%s folds', (expression) => {
    expect(foldWith(expression)).toContain('"checkbox__control"')
  })

  test.each([
    ['checkbox({ size: log() }).control'],
    ['checkbox({ size: `x${dyn}` as any }).control'],
    ['checkbox({ size: dyn + 1 }).control'],
  ])('%s does not fold', (expression) => {
    // A template substitution runs `ToString`, and `+` coerces — both can reach a getter.
    expect(foldWith(expression)).not.toContain('"checkbox__control"')
  })
})

/**
 * A slot recipe call runs a `recipeFn` per slot, and each calls `assertCompoundVariant`.
 * Which slots get one depends on scoping — with anchors only they do, without them every
 * slot does — so reading the anchors alone missed the unscoped case entirely.
 */
describe('the fold declines where the call would throw', () => {
  test('an unscoped recipe with compound variants', () => {
    const r = createFoldFixture().fold(
      `import { badge } from '../styled-system/recipes'\nexport const a = badge({ size: { base: 'sm' } as any }).body`,
    )
    expect(r.code).toContain("badge({ size: { base: 'sm' } as any }).body")
  })

  test('a static selection on the same recipe still folds', () => {
    const r = createFoldFixture().fold(
      `import { badge } from '../styled-system/recipes'\nexport const a = badge({ size: 'sm' }).body`,
    )
    expect(r.code).toContain('"badge__body badge__body--size_sm"')
  })

  test('a null selection folds, because the assert never runs for one', () => {
    const r = createFoldFixture().fold(
      `import { badge } from '../styled-system/recipes'\nexport const a = badge({ size: null as any }).body`,
    )
    expect(r.code).toContain('"badge__body"')
  })
})
