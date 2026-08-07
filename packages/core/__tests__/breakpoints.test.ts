import { fixturePreset } from '@bamboocss/fixture'
import postcss from 'postcss'
import { describe, expect, test } from 'vitest'
import { Breakpoints } from '../src/breakpoints'

const breakpoints = fixturePreset.theme.breakpoints!
const parse = (value: string) => {
  const root = postcss.parse(value)
  const bp = new Breakpoints(breakpoints)
  bp.expandScreenAtRule(root)
  return root.toString()
}

describe('Breakpoints', () => {
  test('should resolve breakpoints', () => {
    const bp = new Breakpoints(breakpoints)
    expect(bp.sorted).toMatchInlineSnapshot(`
      [
        [
          "sm",
          {
            "max": "47.9975rem",
            "min": "40rem",
            "name": "sm",
          },
        ],
        [
          "md",
          {
            "max": "63.9975rem",
            "min": "48rem",
            "name": "md",
          },
        ],
        [
          "lg",
          {
            "max": "79.9975rem",
            "min": "64rem",
            "name": "lg",
          },
        ],
        [
          "xl",
          {
            "max": "95.9975rem",
            "min": "80rem",
            "name": "xl",
          },
        ],
        [
          "2xl",
          {
            "max": undefined,
            "min": "96rem",
            "name": "2xl",
          },
        ],
      ]
    `)

    expect(bp.values).toMatchInlineSnapshot(`
      {
        "2xl": {
          "max": undefined,
          "min": "96rem",
          "name": "2xl",
        },
        "lg": {
          "max": "79.9975rem",
          "min": "64rem",
          "name": "lg",
        },
        "md": {
          "max": "63.9975rem",
          "min": "48rem",
          "name": "md",
        },
        "sm": {
          "max": "47.9975rem",
          "min": "40rem",
          "name": "sm",
        },
        "xl": {
          "max": "95.9975rem",
          "min": "80rem",
          "name": "xl",
        },
      }
    `)

    expect(bp.ranges).toMatchInlineSnapshot(`
      {
        "2xl": "screen and (min-width: 96rem)",
        "2xlDown": "screen and (max-width: 95.9975rem)",
        "2xlOnly": "screen and (min-width: 96rem)",
        "lg": "screen and (min-width: 64rem)",
        "lgDown": "screen and (max-width: 63.9975rem)",
        "lgOnly": "screen and (min-width: 64rem) and (max-width: 79.9975rem)",
        "lgTo2xl": "screen and (min-width: 64rem) and (max-width: 95.9975rem)",
        "lgToXl": "screen and (min-width: 64rem) and (max-width: 79.9975rem)",
        "md": "screen and (min-width: 48rem)",
        "mdDown": "screen and (max-width: 47.9975rem)",
        "mdOnly": "screen and (min-width: 48rem) and (max-width: 63.9975rem)",
        "mdTo2xl": "screen and (min-width: 48rem) and (max-width: 95.9975rem)",
        "mdToLg": "screen and (min-width: 48rem) and (max-width: 63.9975rem)",
        "mdToXl": "screen and (min-width: 48rem) and (max-width: 79.9975rem)",
        "sm": "screen and (min-width: 40rem)",
        "smDown": "screen and (max-width: 39.9975rem)",
        "smOnly": "screen and (min-width: 40rem) and (max-width: 47.9975rem)",
        "smTo2xl": "screen and (min-width: 40rem) and (max-width: 95.9975rem)",
        "smToLg": "screen and (min-width: 40rem) and (max-width: 63.9975rem)",
        "smToMd": "screen and (min-width: 40rem) and (max-width: 47.9975rem)",
        "smToXl": "screen and (min-width: 40rem) and (max-width: 79.9975rem)",
        "xl": "screen and (min-width: 80rem)",
        "xlDown": "screen and (max-width: 79.9975rem)",
        "xlOnly": "screen and (min-width: 80rem) and (max-width: 95.9975rem)",
        "xlTo2xl": "screen and (min-width: 80rem) and (max-width: 95.9975rem)",
      }
    `)
  })

  test('should expand screen', () => {
    const css = parse(`
    @breakpoint md{
        .foo{
            color: red;
        }
    }
    `)

    expect(css).toMatchInlineSnapshot(`
      "
          @media screen and (min-width: 48rem){
              .foo{
                  color: red;
              }
          }
          "
    `)
  })

  test('breakpoint down', () => {
    const css = parse(`
    @breakpoint mdDown{
        .foo{
            color: red;
        }
    }
    `)

    expect(css).toMatchInlineSnapshot(`
      "
          @media screen and (max-width: 47.9975rem){
              .foo{
                  color: red;
              }
          }
          "
    `)
  })
})

/**
 * A breakpoint whose unit the arithmetic cannot read.
 *
 * `adjust` steps a breakpoint down by 0.04px to build the `max-width` half of a range, and it
 * used to do that by running `parseFloat` over whatever `toPx` handed back. `parseFloat`
 * returns a number for plenty of strings that are not pixel values — `50vw` is `50`, `40EM`
 * is `40` — so a unit it did not recognise was silently read as pixels and the range came out
 * sixteen times too small. A `calc()` gave `NaN`, which is not a media query at all.
 *
 * Both are still valid CSS, so nothing downstream would have complained. The styles simply
 * never applied.
 */
describe('breakpoints in units the arithmetic cannot convert', () => {
  const rangeFor = (values: Record<string, string>) => {
    const root = postcss.parse(`@breakpoint mdOnly{ .foo{ color: red } }`)
    new Breakpoints(values).expandScreenAtRule(root)
    return root
      .toString()
      .match(/@media[^{]*/)?.[0]
      ?.trim()
  }

  test('an uppercase unit converts the same as a lowercase one', () => {
    expect(rangeFor({ sm: '30EM', md: '40EM', lg: '50EM' })).toBe(rangeFor({ sm: '30em', md: '40em', lg: '50em' }))
  })

  test('a unit that does not convert is left as written', () => {
    // An overlap of one unit between adjacent ranges is the cost of not reinterpreting it.
    expect(rangeFor({ sm: '30vw', md: '40vw', lg: '50vw' })).toBe(
      '@media screen and (min-width: 40vw) and (max-width: 50vw)',
    )
  })

  test('an expression is left as written rather than becoming NaN', () => {
    const range = rangeFor({ sm: '30em', md: 'calc(40em + 0px)', lg: '50em' })
    expect(range).not.toContain('NaN')
    expect(range).toContain('calc(40em + 0px)')
  })
})
