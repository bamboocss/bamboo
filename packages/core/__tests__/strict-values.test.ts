import { createGeneratorContext } from '@bamboocss/fixture'
import { describe, expect, test } from 'vitest'

/**
 * `strictValues` — "everything goes through the theme".
 *
 * This used to be `strictTokens`, and it used to be a type: every generated prop type narrowed
 * to the tokens, so a raw value stopped type-checking. Two things were wrong with that.
 *
 * It could not tell a *keyword* from a raw value. `display: 'flex'` is not reaching outside the
 * design system — `flex` is the only way to say it — so the setting handled `display` by not
 * narrowing it at all, which let `display: 'abc'` through with it.
 *
 * And it replaced a property's own vocabulary with the utility's. `transitionProperty` declares
 * the sugar `common`, `colors`, `size`, `position`, `background`, so under the old setting
 * `transitionProperty: 'color'` — a real css property name, and a `<custom-ident>` where the
 * grammar asks for one — was rejected in favour of `'colors'`, which emits seven declarations
 * instead of one. A utility adds vocabulary to a property; it does not take the property's own
 * away.
 *
 * The grammar draws the line the types could not, so both are answered by asking it.
 */
const utility = (strictValues = true) => (createGeneratorContext({ strictValues } as never) as any).utility

describe('strictValues', () => {
  test.each([
    ['a length', 'fontSize', '14px'],
    ['a viewport unit', 'minHeight', '100vh'],
    ['a literal colour', 'color', '#fff'],
    ['a composite value', 'border', '1px solid red'],
    ['a bare number', 'opacity', '0.5'],
  ])('asks for brackets around %s', (_label, prop, value) => {
    expect(utility().isRawValue(prop, value), `${prop}: ${value}`).toBe(true)
  })

  test.each([
    ['a token', 'color', 'red.300'],
    ['a numeric token key', 'padding', '4'],
    ['the escape hatch it asks for', 'fontSize', '[14px]'],
    ['a keyword, which is not a raw value', 'display', 'flex'],
    ['a keyword on a property that also takes tokens', 'top', 'auto'],
    ['an author identifier', 'animationName', 'fadeIn'],
    ['a css property name where the grammar asks for one', 'transitionProperty', 'color'],
  ])('leaves %s alone', (_label, prop, value) => {
    expect(utility().isRawValue(prop, value), `${prop}: ${value}`).toBe(false)
  })

  test('says nothing at all when it is off', () => {
    expect(utility(false).isRawValue('fontSize', '14px')).toBe(false)
  })
})
