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
  test('scopeRoots anchors a recipe whose enclosing slot has another name', () => {
    const ctx = createContext({
      theme: {
        extend: {
          slotRecipes: {
            menu: {
              className: 'menu',
              slots: ['trigger', 'positioner', 'item'],
              scopeRoots: ['positioner'],
              base: { positioner: { position: 'absolute' } },
              variants: { size: { sm: { item: { padding: '2' } } } },
            },
          },
        },
      },
    } as never)

    expect(Recipes.getScopeRoots(ctx.recipes.getConfig('menu') as never)).toEqual(['positioner'])
  })

  test('an anchor naming no declared slot is dropped', () => {
    expect(Recipes.getScopeRoots({ slots: ['trigger', 'item'], scopeRoots: ['nope'] } as never)).toEqual([])
  })

  test('a slot named root is the default anchor', () => {
    expect(Recipes.getScopeRoots({ slots: ['root', 'item'] } as never)).toEqual(['root'])
  })

  test('an empty list turns scoping off, even with a slot named root', () => {
    // The explicit form of what a sibling-slot recipe gets by default: every slot keeps a
    // variant class of its own.
    expect(Recipes.getScopeRoots({ slots: ['root', 'item'], scopeRoots: [] } as never)).toEqual([])
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

/**
 * A portal is a real discontinuity in the tree, and no CSS mechanism crosses one. A
 * `<Select>` occupies two disjoint subtrees — the trigger side under `root`, the listbox
 * side under a portaled `positioner` — and a variant writes styles into both.
 *
 * With one anchor, whichever half is not under it gets variant rules that can never match.
 * The base styles still apply, so the component renders nearly right: a partial failure,
 * harder to notice than a total one.
 */
describe('slot recipes spanning a portal', () => {
  const select = () =>
    createRuleProcessor()
      .sva({
        className: 'select',
        slots: ['root', 'trigger', 'positioner', 'content', 'item'],
        scopeRoots: ['root', 'positioner'],
        base: { root: { display: 'flex' } },
        variants: {
          size: { lg: { trigger: { height: '11' }, item: { paddingInline: '3' } } },
        },
      })
      .toCss()

  test('each anchor opens its own scope', () => {
    const css = select()
    expect(css).toContain('@scope (.select__root--size_lg) to (.select__root)')
    expect(css).toContain('@scope (.select__positioner--size_lg) to (.select__positioner)')
  })

  test('every non-anchor slot is emitted under every anchor', () => {
    // Nothing declares which subtree a slot lives in. Emitting under both and letting
    // `@scope` decide is what makes that unnecessary: only the anchor that is genuinely an
    // ancestor matches at runtime.
    const css = select()
    const underRoot = css.slice(css.indexOf('@scope (.select__root--size_lg)'))
    const underPositioner = css.slice(css.indexOf('@scope (.select__positioner--size_lg)'))

    expect(underRoot).toContain('.select__item')
    expect(underPositioner).toContain('.select__trigger')
  })

  test('an anchor keeps a variant class of its own rather than being scoped', () => {
    // It is what opens the scope, so it cannot be inside one.
    const css = select()
    expect(css).not.toContain('@scope (.select__root--size_lg) to (.select__root) {\n    .select__root')
  })

  test('a single anchor emits exactly what it did before', () => {
    const one = createRuleProcessor()
      .sva({
        className: 'menu',
        slots: ['root', 'item'],
        scopeRoots: ['root'],
        variants: { size: { lg: { item: { paddingInline: '3' } } } },
      })
      .toCss()

    expect(one).toContain('@scope (.menu__root--size_lg) to (.menu__root)')
    expect(one.match(/@scope/g)).toHaveLength(1)
  })
})

/**
 * A scoped slot carries only its constant class. A compound variant selecting on that
 * slot's variant classes therefore matches nothing, ever — the variants reach the slot
 * through an anchor's scope, and the compound has to arrive the same way.
 */
describe('compound variants on a scoped slot recipe', () => {
  const scoped = (compound: Record<string, unknown>) =>
    createRuleProcessor()
      .sva({
        base: { root: { display: 'flex' } },
        className: 'cmp',
        compoundVariants: [compound],
        scopeRoots: ['root'],
        slots: ['root', 'item'],
        variants: { size: { lg: { item: { paddingInline: '3' } } }, tone: { a: { item: { color: 'red' } } } },
      } as never)
      .toCss()

  test('the compound is scoped by the anchor, not selected on the slot', () => {
    const css = scoped({ css: { item: { fontWeight: 'bold' } }, size: 'lg', tone: 'a' })

    expect(css).toContain('@scope (.cmp__root--size_lg.cmp__root--tone_a) to (.cmp__root)')
    expect(css).not.toContain('.cmp__item--size_lg')
  })

  test('every class the compound scope opens on is one the anchor carries', () => {
    const rule = createRuleProcessor().sva({
      base: { root: { display: 'flex' } },
      className: 'cmp',
      compoundVariants: [{ css: { item: { fontWeight: 'bold' } }, size: 'lg', tone: 'a' }],
      scopeRoots: ['root'],
      slots: ['root', 'item'],
      variants: { size: { lg: { item: { paddingInline: '3' } } }, tone: { a: { item: { color: 'red' } } } },
    } as never)

    const carried = new Set(rule.getClassNames())
    const prelude = rule.toCss().match(/@scope \((\.\S+\.\S+)\)/)?.[1]
    expect(prelude).toBeDefined()

    for (const className of prelude!.split('.').filter(Boolean)) {
      expect(carried).toContain(className)
    }
  })

  test('a compound on the anchor itself still selects on the anchor', () => {
    const css = scoped({ css: { root: { fontWeight: 'bold' } }, size: 'lg', tone: 'a' })
    expect(css).toContain('.cmp__root--size_lg.cmp__root--tone_a')
  })
})

describe('a scoped compound keeps its precedence and its context', () => {
  const scoped = (className: string, scopeRoots: string[]) => ({
    theme: {
      extend: {
        slotRecipes: {
          widget: {
            base: { item: { color: 'blue' }, root: { color: 'red' } },
            className,
            compoundVariants: [{ css: { item: { padding: '8' } }, size: 'sm', tone: 'a' }],
            scopeRoots,
            slots: ['root', 'item'],
            variants: {
              size: { sm: { item: { padding: '2' } } },
              tone: { a: { item: { padding: '3' } } },
              weight: { bold: { item: { padding: '5' } } },
            },
          },
        },
      },
    },
  })

  test('the compound outranks the variants it refines, by specificity', () => {
    // Every scoped rule selects one class inside a scope on the same element, so without
    // `:scope` the winner is stylesheet order — and compounds are hashed on whichever call
    // site the build reached first, so that order is not even stable.
    const css = createRuleProcessor(scoped('ord', ['root']) as never)
      .recipe('widget', { size: 'sm', tone: 'a', weight: 'bold' })!
      .toCss()

    expect(css).toContain('@scope (.ord__root--size_sm.ord__root--tone_a) to (.ord__root)')
    expect(css).toMatch(/@scope \(\.ord__root--size_sm\.ord__root--tone_a\)[^{]*\{\s*:scope \.ord__item/)
    // A single-variant scope stays at one class, so it does not need the extra weight.
    expect(css).toMatch(/@scope \(\.ord__root--weight_bold\)[^{]*\{\s*\.ord__item/)
  })

  test('a recipe that stops being scoped does not keep the old scope', () => {
    // `slotScopes` is module-global and outlives a context; a watch rebuild that removes
    // `scopeRoots` used to leave the previous build's rule behind and drop the new one.
    createRuleProcessor(scoped('old', ['root']) as never)
      .recipe('widget', { size: 'sm', tone: 'a' })!
      .toCss()
    const css = createRuleProcessor(scoped('new', []) as never)
      .recipe('widget', { size: 'sm', tone: 'a' })!
      .toCss()

    expect(css).not.toContain('old__')
    expect(css).toContain('.new__item--size_sm.new__item--tone_a')
  })
})
