import { assertType, describe, test } from 'vitest'
import { css } from '../../styled-system-unknown-tokens/css'

/**
 * `strictTokens: 'unknown-tokens'` — the setting between "nothing is checked" and "only tokens".
 *
 * The default lets `color: 'mutedd'` through both TypeScript and the build, and the browser
 * drops the declaration at compute time, so it surfaces as a colour that never applied rather
 * than as a typo. `strictTokens: true` catches it and rejects every raw value with it: 468
 * errors on one otherwise-correct app, three of which were the class of mistake it was turned
 * on for. That makes it a day-one decision, which is what this setting is not.
 *
 * The rule is shape. A token path is a bare identifier, possibly dotted; anything that starts
 * with a digit, `#` or `-`, or that contains a space, a comma or a call, cannot be one and stays
 * allowed. What is left over — an identifier that names no token and no keyword the property
 * enumerates — is the typo.
 */
/** Typed `string` rather than inferred as a literal, which is the shape a prop has. */
const dynamic: string = 'blue.300'

describe('strictTokens: unknown-tokens', () => {
  test('raw CSS values need no escape hatch', () => {
    assertType(css({ fontSize: '14px' }))
    assertType(css({ minHeight: '100vh' }))
    assertType(css({ width: '50%' }))
    assertType(css({ padding: '.5rem' }))
    assertType(css({ border: '1px solid red' }))
    assertType(css({ color: 'rgb(0 0 0)' }))
    assertType(css({ color: '#ff0000' }))
    assertType(css({ marginTop: '-4px' }))
    assertType(css({ fontFamily: 'Inter, sans-serif' }))
    assertType(css({ width: 'calc(100% - 2px)' }))
    assertType(css({ opacity: 0.5 }))
  })

  test('keywords the property enumerates are values, not tokens', () => {
    assertType(css({ display: 'flex' }))
    assertType(css({ position: 'absolute' }))
    assertType(css({ color: 'transparent' }))
    assertType(css({ textDecorationLine: 'underline' }))
    assertType(css({ fontSize: 'larger' }))
    assertType(css({ color: 'inherit' }))
  })

  test('tokens, and everything that decorates one, still work', () => {
    assertType(css({ color: 'blue.300' }))
    assertType(css({ color: 'blue.300/40' }))
    assertType(css({ color: 'blue.300!' }))
    assertType(css({ fontSize: '2xl' }))
    assertType(css({ padding: '4' }))
    assertType(css({ fontSize: '[14px]' }))
    assertType(css({ height: 'fallback(100dvh, 100vh)' }))
  })

  /**
   * A utility declared as tokens *and* keywords used to lose its modifiers entirely.
   *
   * `KnownKeywords` keeps `Number` on purpose — a number cannot be a misspelled token path — and
   * the old `[T] extends [string]` test read that one non-string member as "this is not a string
   * union" and returned `never` for the whole property. So the same token, with the same mark,
   * was accepted on `padding` and rejected on `spaceX`, decided by nothing the author can see.
   */
  test('a modifier works the same on a utility that also lists keywords', () => {
    // Same token, same mark, two utilities: `rounded` is declared as tokens alone and always
    // passed, `roundedBottom` adds `KnownKeywords` and was rejected. Both emit
    // `var(--radii-lg) !important`. A digit-leading token would not show it — `'4!'` is
    // accepted by the raw-value shape rule whatever the modifier forms do.
    assertType(css({ rounded: 'lg!' }))
    assertType(css({ roundedBottom: 'lg!' }))
    assertType(css({ roundedBottom: 'lg !important' }))
  })

  /**
   * A mark works the same on a keyword as on a token, which it did not.
   *
   * Only what `WithEscapeHatch` wraps carries `!` and `/`, and that was the tokens alone — so
   * `boxShadow: 'none!'` was an error while `boxShadow: 'none'` and `color: 'blue.300!'` were
   * both fine. Nothing an author can see decided which: `none` is a csstype keyword and
   * `blue.300` is a token, and the mark is about neither.
   *
   * The keywords are held out and wrapped too now. It costs — the keyword lists are the larger
   * union, and this repo's own site measured +20.5% instantiations — and it buys back no
   * looseness: the mark is only allowed on values that were already allowed, so a marked typo
   * is still a typo.
   */
  test('an important mark works on a keyword, not only on a token', () => {
    assertType(css({ boxShadow: 'none!' }))
    assertType(css({ display: 'flex!' }))
    assertType(css({ color: 'blue.300!' }))
    assertType(css({ color: 'blue.300 !important' }))
  })

  test('an identifier that is neither a token nor a keyword is a typo', () => {
    // @ts-expect-error `blue.300` is the token
    assertType(css({ color: 'blue.3000' }))
    // @ts-expect-error the category prefix is not part of the path
    assertType(css({ color: 'colors.blue' }))
    // @ts-expect-error not a display value, and `display` has no tokens
    assertType(css({ display: 'flexx' }))
    // @ts-expect-error not a token and not a keyword
    assertType(css({ position: 'absolut' }))
    // @ts-expect-error a mark decorates a value that exists; it does not excuse one that does not
    assertType(css({ color: 'mutedd!' }))
  })

  test('a modifier does not launder an unknown token', () => {
    // @ts-expect-error
    assertType(css({ color: 'blue.3000/40' }))
    // @ts-expect-error
    assertType(css({ color: 'blue.3000!' }))
  })

  /**
   * A property whose values are identifiers the author invents is left alone.
   *
   * There is nothing to be strict against — csstype types these as open strings for the same
   * reason — and narrowing them rejects the ordinary way to write them: a `@keyframes` name
   * declared in CSS rather than in `theme.keyframes`, a grid area, a font stack, a counter.
   * A typo in one of these is what `strictTokens: true` is for.
   */
  test('properties whose values are author identifiers are not checked', () => {
    assertType(css({ animationName: 'fade-out' }))
    assertType(css({ gridArea: 'header' }))
    assertType(css({ gridColumnStart: 'main' }))
    assertType(css({ counterReset: 'section' }))
    assertType(css({ viewTransitionName: 'card' }))
    assertType(css({ containerName: 'sidebar' }))
    assertType(css({ fontFamily: 'Inter' }))
    assertType(css({ willChange: 'transform' }))
    assertType(css({ transitionProperty: 'opacity' }))
    assertType(css({ listStyleType: 'disc' }))
    assertType(css({ content: '""' }))
  })

  /**
   * The two costs of the setting, asserted so they are a decision rather than a surprise.
   *
   * A value typed `string` cannot be told from a misspelled token, so it needs an escape
   * hatch — the same as under `strictTokens: true`, and no worse than the Vite compiler,
   * which rejects an open runtime value outright. And a typo *shaped* like a value passes,
   * because the whole rule is shape.
   */
  test('the edges', () => {
    // @ts-expect-error a value typed `string`, which the compiler rejects as dynamic anyway
    assertType(css({ color: dynamic }))
    assertType(css({ color: `[${dynamic}]` }))

    // Shaped like `2rem`, so nothing distinguishes it from a length.
    assertType(css({ fontSize: '2xll' }))
  })
})
