import { describe, expect, test } from 'vitest'
import { astish } from '../src/astish'

describe('astish', () => {
  test('should work', () => {
    const result = astish(`
      display: flex;
      align-items: center;
      -webkit-align-items: center;
      @media (min-width: 400) {
        color: red;
        justify-content: center;
      }
      @container (min-inline-width: 600px) {
        background: pink;
      }
    `)

    expect(result).toMatchInlineSnapshot(`
      {
        "-webkit-align-items": "center",
        "@container (min-inline-width: 600px)": {
          "background": "pink",
        },
        "@media (min-width: 400)": {
          "color": "red",
          "justify-content": "center",
        },
        "align-items": "center",
        "display": "flex",
      }
    `)
  })

  test('should work if undefined', () => {
    // @ts-ignore
    // can happen if a value is unresolvable in the static analysis step
    // ex: css`${someVar}`
    expect(() => astish(undefined)).not.toThrow()
  })

  test('should work with media queries', () => {
    const res = astish(`
      width: 500px;
      height: 500px;
      background: red;
      @media (min-width: 700px) {
        background: blue;
      }
    `)
    expect(res).toMatchInlineSnapshot(`
      {
        "@media (min-width: 700px)": {
          "background": "blue",
        },
        "background": "red",
        "height": "500px",
        "width": "500px",
      }
    `)
  })

  test('with multiline selectors', () => {
    const res = astish(`
    background: pink;
    & span,
    & p {
      color: blue;
    }
  `)

    expect(res).toMatchInlineSnapshot(`
      {
        "& span, & p": {
          "color": "blue",
        },
        "background": "pink",
      }
    `)
  })
})

/**
 * `newRule` is a module-level `/g` regex, so `exec` carries `lastIndex` between calls.
 *
 * A loop that finishes resets it; one that throws does not. Malformed CSS throws — `{ }`
 * matches neither a property nor a selector, so the property branch reads `undefined` —
 * and the next call then resumes from wherever the last one died. It does not fail there,
 * which is what makes it dangerous: it returns a *shifted* parse, so `color` comes back as
 * `olor`, and a caller that catches the first error sees plausible nonsense from then on.
 * The vite plugin is exactly such a caller.
 */
describe('astish state between calls', () => {
  test.each(['{ }', '{}', ' { } ', 'a{}{}'])('a throw on %j does not shift the next parse', (malformed) => {
    expect(() => astish(malformed)).toThrow()

    expect(astish('color: red.300; padding: 4px;')).toEqual({ color: 'red.300', padding: '4px' })
  })

  test('a parse that returns nothing does not shift the next one either', () => {
    // These do not throw; they exhaust the tree and return `undefined`. Pinned as the
    // current answer for malformed input rather than endorsed — what matters here is that
    // the call after them is unaffected.
    expect(astish('}}}')).toBeUndefined()
    expect(astish('color: red;}')).toBeUndefined()

    expect(astish('color: red.300; padding: 4px;')).toEqual({ color: 'red.300', padding: '4px' })
  })

  test('repeated parses of the same input agree', () => {
    const once = astish('color: red.300; padding: 4px;')
    const twice = astish('color: red.300; padding: 4px;')

    expect(twice).toEqual(once)
  })
})
