import { createGeneratorContext } from '@bamboocss/fixture'
import { logger } from '@bamboocss/logger'
import { afterEach, describe, expect, test, vi } from 'vitest'

/**
 * Every branch of `getPropertyRawValue` ends in `|| value`, so a token path that resolves to
 * nothing is handed straight through: `background: 'accent.default'` ships as
 * `background: accent.default`. It parses, so no build step objects, and the browser drops it
 * at compute time — the style is simply absent, a long way from the typo that caused it.
 *
 * The context is built *before* the spy is installed, and each case transforms one value.
 * Building it inside the spy catches the warnings that constructing the fixture's own recipes
 * produces, which made every case pass for the wrong reason: a predicate matching far too much
 * still satisfied a suite that was only ever observing unrelated noise.
 */

/**
 * Fresh per test: the warning reports each mistake once, and that state lives on `Utility`.
 *
 * The record is cleared after construction because building the fixture transforms its own
 * recipe styles, which spends the once-per-mistake budget on values the test never mentions.
 * Leaving it alone made the negative cases pass against an implementation that warns for
 * *every* path-shaped value — the case under test was silent only because construction had
 * already claimed it.
 */
const setup = () => {
  const ctx = createGeneratorContext() as any
  ctx.utility.unresolvedTokens.clear()
  const spy = vi.spyOn(logger, 'warn').mockImplementation(() => {})
  return { utility: ctx.utility, spy }
}

const messages = (spy: ReturnType<typeof vi.spyOn>) => spy.mock.calls.map((c: unknown[]) => String(c[1]))

afterEach(() => vi.restoreAllMocks())

describe('unresolved token paths', () => {
  test('warns, naming the value, the property and the category', () => {
    const { utility, spy } = setup()

    utility.transform('background', 'accent.default')

    expect(spy).toHaveBeenCalledTimes(1)
    expect(messages(spy)[0]).toContain('accent.default')
    expect(messages(spy)[0]).toContain('background')
    expect(messages(spy)[0]).toContain('colors')
  })

  test('reports rather than changes: the value is still emitted', () => {
    const { utility } = setup()

    expect(JSON.stringify(utility.transform('background', 'accent.default').styles)).toContain('accent.default')
  })

  test('says nothing for a token that resolves', () => {
    const { utility, spy } = setup()

    utility.transform('background', 'red.300')

    expect(spy).not.toHaveBeenCalled()
  })

  /**
   * `values` comes in four shapes and the resolver honours all of them. Reading the token
   * category directly covered `padding` and not `margin`, which is worse than covering
   * neither — it teaches you the warning can be trusted.
   */
  test.each([
    ['a category name', 'padding'],
    ['a function', 'margin'],
    ['a function', 'width'],
  ])('covers a property whose values are %s (%s)', (_shape, prop) => {
    const { utility, spy } = setup()

    utility.transform(prop, 'accent.default')

    expect(spy).toHaveBeenCalledTimes(1)
  })

  /**
   * For an array the resolver returns the value whether or not it is valid, so asking "did
   * the resolver hand it back unchanged" would report every valid composition as a mistake.
   */
  test('does not fire on a valid value of an array-valued property', () => {
    const { utility, spy } = setup()

    utility.transform('mixin', 'headline.h1')

    expect(spy).not.toHaveBeenCalled()
  })

  test('does fire on an invalid value of an array-valued property', () => {
    const { utility, spy } = setup()

    utility.transform('mixin', 'headline.h9')

    expect(spy).toHaveBeenCalledTimes(1)
  })

  /**
   * The whole string has parentheses so it is not path-shaped; without checking candidates
   * the broken one is hidden by the working one for good.
   */
  test('checks each fallback candidate', () => {
    const { utility, spy } = setup()

    utility.transform('background', 'fallback(accent.default, red.300)')

    expect(spy).toHaveBeenCalledTimes(1)
    expect(messages(spy)[0]).toContain('accent.default')
  })

  /** `transform` runs once per condition, so one typo would otherwise warn once per breakpoint. */
  test('reports each mistake once', () => {
    const { utility, spy } = setup()

    utility.transform('background', 'accent.default')
    utility.transform('background', 'accent.default')
    utility.transform('background', 'accent.default')

    expect(spy).toHaveBeenCalledTimes(1)
  })

  /**
   * The shape test is what keeps ordinary values out, so each case here uses a property whose
   * category is populated — otherwise an earlier gate rejects it and the case proves nothing.
   */
  test.each([
    ['a decimal', 'padding', '0.5'],
    ['a value with a unit', 'padding', '1.5rem'],
    ['a literal colour', 'background', '#fff'],
    ['a quoted string holding a dot', 'fontFamily', '"Foo.Bar"'],
    ['an arbitrary value', 'background', '[accent.default]'],
  ])('says nothing for %s', (_label, prop, value) => {
    const { utility, spy } = setup()

    utility.transform(prop, value)

    expect(spy).not.toHaveBeenCalled()
  })

  /** Nothing is enumerated, so every value is a literal and none of them can be wrong. */
  test('says nothing for a property that enumerates no values', () => {
    const { utility, spy } = setup()

    utility.transform('gridTemplateAreas', 'a.b')

    expect(spy).not.toHaveBeenCalled()
  })
})

/**
 * The half that used to be the type system's, and the half it could never do well.
 *
 * `isUnresolvedTokenValue` required a dot, so the build saw `color: 'blue.3000'` and was blind to
 * `color: 'mutedd'` — the single typo the whole feature is sold on. Only the type layer caught
 * that, at the cost of narrowing every generated prop type, and it could not tell `top: 'navH'`
 * from `animationName: 'fadeIn'` without a hand-written list of 29 properties.
 *
 * The grammar decides instead. A bare identifier is a mistake when the property enumerates
 * keywords, does not accept an identifier the author invents, and neither the tokens nor the
 * keywords contain it.
 */
describe('a bare identifier', () => {
  const warns = (prop: string, value: string) => {
    const { utility, spy } = setup()
    utility.transform(prop, value)
    return spy.mock.calls.length > 0 ? String(spy.mock.calls[0]![1]) : null
  }

  test.each([
    ['names no token and no keyword', 'color', 'mutedd'],
    ['is a keyword with a typo', 'display', 'flexx'],
    ['names a token category that does not exist', 'zIndex', 'overlay'],
    ['is sugar the property does not have', 'transform', 'auto'],
  ])('is reported when it %s', (_label, prop, value) => {
    expect(warns(prop, value), `${prop}: ${value}`).not.toBeNull()
  })

  test.each([
    ['a keyword the property enumerates', 'display', 'flex'],
    ['a keyword reached through a shared data type', 'color', 'rebeccapurple'],
    ['a css-wide keyword', 'color', 'inherit'],
    ['a keyword on a property that also takes tokens', 'top', 'auto'],
    ['a token', 'color', 'red.300'],
    // The grammar takes `<custom-ident>` here, so there is no list to be wrong against. This is
    // the case the type layer got wrong: it rejected `'color'` and suggested `'colors'`, which
    // is a utility value that emits seven declarations instead of one.
    ['a css property name where the grammar asks for one', 'transitionProperty', 'color'],
    ['an author identifier', 'animationName', 'fadeIn'],
    ['a grid line name', 'gridArea', 'sidebar'],
    ['a font family', 'fontFamily', 'Inter'],
  ])('is left alone when it is %s', (_label, prop, value) => {
    expect(warns(prop, value), `${prop}: ${value}`).toBeNull()
  })

  /**
   * The diagnostic a type error cannot reach. The name exists — it is on another shelf — and
   * saying which shelf is the fix. TypeScript can only report that a string is not assignable to
   * a union of two hundred members, and guess a near-miss by spelling.
   */
  test('says where the name actually lives', () => {
    const message = warns('top', 'sm')

    expect(message).toContain('`sm` is declared under')
    expect(message).toContain('`radii`')
    expect(message).toContain('`top` reads `spacing`')
    expect(message).toContain('[sm]')
  })
})
