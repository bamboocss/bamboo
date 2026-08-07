import { describe, expect, test } from 'vitest'
import { getRecipeIdentity } from '../src/recipe-identity'

/**
 * The build derives this while emitting the stylesheet and the runtime derives it again in
 * the browser, from the same config but never from each other. Every property here is one
 * the two sides depend on agreeing about; a disagreement emits rules under one name and
 * asks for another, which renders as an element with no styles rather than as an error.
 */
describe('getRecipeIdentity', () => {
  test('a declared className is used verbatim', () => {
    expect(getRecipeIdentity({ base: { color: 'red' }, className: 'button' })).toBe('button')
  })

  test('an undeclared className hashes the config', () => {
    expect(getRecipeIdentity({ base: { color: 'red' } })).toMatch(/^cva_[a-zA-Z]+$/)
  })

  test('the prefix is caller supplied, so sva can differ from cva', () => {
    expect(getRecipeIdentity({ base: { color: 'red' } }, 'sva')).toMatch(/^sva_[a-zA-Z]+$/)
  })

  test('key order does not change the identity', () => {
    const a = getRecipeIdentity({ base: { color: 'red', padding: '4' } })
    const b = getRecipeIdentity({ base: { padding: '4', color: 'red' } })
    expect(a).toBe(b)
  })

  test('field order does not change the identity', () => {
    const a = getRecipeIdentity({ base: { color: 'red' }, variants: { size: { sm: { padding: '2' } } } })
    const b = getRecipeIdentity({ variants: { size: { sm: { padding: '2' } } }, base: { color: 'red' } })
    expect(a).toBe(b)
  })

  test('nested condition objects sort too', () => {
    const a = getRecipeIdentity({ base: { _hover: { color: 'blue', padding: '2' } } })
    const b = getRecipeIdentity({ base: { _hover: { padding: '2', color: 'blue' } } })
    expect(a).toBe(b)
  })

  test('different styles get different identities', () => {
    const a = getRecipeIdentity({ base: { color: 'red' } })
    const b = getRecipeIdentity({ base: { color: 'blue' } })
    expect(a).not.toBe(b)
  })

  test('compound variant order is part of the identity', () => {
    // Precedence ordered — two orderings are two different recipes, so they must not
    // collapse onto one name the way two orderings of a plain object do.
    const a = getRecipeIdentity({
      compoundVariants: [
        { color: 'red', size: 'sm' },
        { color: 'blue', size: 'lg' },
      ],
    })
    const b = getRecipeIdentity({
      compoundVariants: [
        { color: 'blue', size: 'lg' },
        { color: 'red', size: 'sm' },
      ],
    })
    expect(a).not.toBe(b)
  })

  test('metadata outside the style fields does not change the identity', () => {
    const a = getRecipeIdentity({ base: { color: 'red' } })
    const b = getRecipeIdentity({ base: { color: 'red' }, jsx: ['Button'] } as never)
    expect(a).toBe(b)
  })

  test('an absent field and an undefined one agree', () => {
    const a = getRecipeIdentity({ base: { color: 'red' } })
    const b = getRecipeIdentity({ base: { color: 'red' }, variants: undefined })
    expect(a).toBe(b)
  })

  test('an empty className falls back to the hash rather than naming everything the same', () => {
    expect(getRecipeIdentity({ base: { color: 'red' }, className: '' })).toMatch(/^cva_/)
  })

  test('a function collapses rather than keying the name on minification', () => {
    const a = getRecipeIdentity({ base: { color: () => 'red' } } as never)
    const b = getRecipeIdentity({ base: { color: () => 'blue' } } as never)
    expect(a).toBe(b)
  })
})

/**
 * `slots` and `scopeRoots` change the *shape* of what is emitted rather than a declaration,
 * but an inline recipe is registered once per identity — so two configs sharing a name make
 * whichever is extracted first decide the emission for both, and the other's runtime asks
 * for classes no rule exists under.
 */
describe('slot recipe topology is part of the identity', () => {
  const styles = {
    base: { root: { color: 'red' } },
    slots: ['root', 'item'],
    variants: { size: { lg: { item: { paddingLeft: '3' } } } },
  }

  test('scopeRoots changes the identity', () => {
    expect(getRecipeIdentity({ ...styles, scopeRoots: ['root'] } as never, 'sva')).not.toBe(
      getRecipeIdentity({ ...styles, scopeRoots: [] } as never, 'sva'),
    )
  })

  test('slots changes the identity', () => {
    expect(getRecipeIdentity({ ...styles, slots: ['root', 'item'] } as never, 'sva')).not.toBe(
      getRecipeIdentity({ ...styles, slots: ['root', 'other'] } as never, 'sva'),
    )
  })
})

/**
 * The identity has to survive the one transformation the build applies before it ever sees a
 * config: `maybe-box-node` reads every string literal through `trimWhitespace`, so a value
 * written `'calc(100vh -  16px)'` reaches the encoder as `'calc(100vh - 16px)'`.
 *
 * The browser holds the config as authored. When the two hashed different objects they
 * derived different names, the element asked for a class the stylesheet did not carry, and it
 * rendered with none of the recipe's styles — silently, and invisibly to a dead-rule check,
 * because the collapsed config is byte-identical to one already emitted so no unused rule is
 * left behind.
 */
describe('whitespace in a declaration value', () => {
  const collapsed = (value: string) => value.replaceAll(/\s+/g, ' ')

  test.each([
    { name: 'a calc expression', value: 'calc(100vh -  16px)' },
    { name: 'a spaced function argument list', value: 'rgba(0,  0, 0, 0.5)' },
    { name: 'a shorthand', value: '12px  16px' },
    { name: 'a newline', value: 'calc(100vh\n- 16px)' },
    { name: 'a tab', value: 'calc(100vh\t- 16px)' },
    { name: 'leading and trailing space', value: '  12px 16px  ' },
  ])('$name hashes as the build sees it', ({ value }) => {
    // The build's side, which has already been through `trimWhitespace`.
    const build = getRecipeIdentity({ base: { padding: collapsed(value) } })
    // The browser's side, holding the value as authored.
    const runtime = getRecipeIdentity({ base: { padding: value } })

    expect(runtime).toBe(build)
  })

  test('it reaches values nested in variants and compound variants', () => {
    const authored = {
      base: { padding: '12px  16px' },
      compoundVariants: [{ css: { margin: '4px  8px' }, size: 'sm' }],
      variants: { size: { sm: { minHeight: 'calc(100vh -  16px)' } } },
    }
    const build = {
      base: { padding: '12px 16px' },
      compoundVariants: [{ css: { margin: '4px 8px' }, size: 'sm' }],
      variants: { size: { sm: { minHeight: 'calc(100vh - 16px)' } } },
    }

    expect(getRecipeIdentity(authored)).toBe(getRecipeIdentity(build))
  })

  test('a value that differs by more than whitespace still gets its own name', () => {
    // The collapse must not make genuinely different configs collide.
    expect(getRecipeIdentity({ base: { padding: '12px 16px' } })).not.toBe(
      getRecipeIdentity({ base: { padding: '12px 17px' } }),
    )
    // Case is not whitespace, and is not normalized.
    expect(getRecipeIdentity({ base: { color: '#AABBCC' } })).not.toBe(
      getRecipeIdentity({ base: { color: '#aabbcc' } }),
    )
  })

  test('a slot recipe is covered too', () => {
    expect(getRecipeIdentity({ base: { root: { padding: '12px  16px' } }, slots: ['root'] }, 'sva')).toBe(
      getRecipeIdentity({ base: { root: { padding: '12px 16px' } }, slots: ['root'] }, 'sva'),
    )
  })
})
