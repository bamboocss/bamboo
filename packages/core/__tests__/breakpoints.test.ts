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
            "max": "48rem",
            "min": "40rem",
            "name": "sm",
          },
        ],
        [
          "md",
          {
            "max": "64rem",
            "min": "48rem",
            "name": "md",
          },
        ],
        [
          "lg",
          {
            "max": "80rem",
            "min": "64rem",
            "name": "lg",
          },
        ],
        [
          "xl",
          {
            "max": "96rem",
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
          "max": "80rem",
          "min": "64rem",
          "name": "lg",
        },
        "md": {
          "max": "64rem",
          "min": "48rem",
          "name": "md",
        },
        "sm": {
          "max": "48rem",
          "min": "40rem",
          "name": "sm",
        },
        "xl": {
          "max": "96rem",
          "min": "80rem",
          "name": "xl",
        },
      }
    `)

    expect(bp.ranges).toMatchInlineSnapshot(`
      {
        "2xl": "(width >= 96rem)",
        "2xlDown": "(width < 96rem)",
        "2xlOnly": "(width >= 96rem)",
        "lg": "(width >= 64rem)",
        "lgDown": "(width < 64rem)",
        "lgOnly": "(width >= 64rem) and (width < 80rem)",
        "lgTo2xl": "(width >= 64rem) and (width < 96rem)",
        "lgToXl": "(width >= 64rem) and (width < 80rem)",
        "md": "(width >= 48rem)",
        "mdDown": "(width < 48rem)",
        "mdOnly": "(width >= 48rem) and (width < 64rem)",
        "mdTo2xl": "(width >= 48rem) and (width < 96rem)",
        "mdToLg": "(width >= 48rem) and (width < 64rem)",
        "mdToXl": "(width >= 48rem) and (width < 80rem)",
        "sm": "(width >= 40rem)",
        "smDown": "(width < 40rem)",
        "smOnly": "(width >= 40rem) and (width < 48rem)",
        "smTo2xl": "(width >= 40rem) and (width < 96rem)",
        "smToLg": "(width >= 40rem) and (width < 64rem)",
        "smToMd": "(width >= 40rem) and (width < 48rem)",
        "smToXl": "(width >= 40rem) and (width < 80rem)",
        "xl": "(width >= 80rem)",
        "xlDown": "(width < 80rem)",
        "xlOnly": "(width >= 80rem) and (width < 96rem)",
        "xlTo2xl": "(width >= 80rem) and (width < 96rem)",
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
          @media (width >= 48rem){
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
          @media (width < 48rem){
              .foo{
                  color: red;
              }
          }
          "
    `)
  })
})

/**
 * A breakpoint in a unit nothing can convert to pixels.
 *
 * These used to be the hard case. Building the upper half of a range meant stepping the next
 * breakpoint down by 0.04px, stepping down meant arithmetic, and the arithmetic ran
 * `parseFloat` over whatever `toPx` returned — which is a number for plenty of strings that
 * are not pixel values. `50vw` read as `50`, so a `vw` breakpoint came out sixteen times too
 * small; `calc(…)` read as `NaN`, which is not a media query at all. Both are valid CSS, so
 * nothing downstream complained and the styles simply never applied. Guarding the conversion
 * fixed the corruption but left these units overlapping their neighbour by a whole unit,
 * because an inclusive `max-width` cannot express "up to but not including" without it.
 *
 * An exclusive `<` can, in any unit, without doing arithmetic on the value at all. So there is
 * no longer a conversion here to get wrong — which is worth holding in place, since the way
 * this failed was silent.
 */
describe('breakpoints in units that do not convert to pixels', () => {
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

  test('a unit that does not convert bounds its range exactly, with no overlap', () => {
    expect(rangeFor({ sm: '30vw', md: '40vw', lg: '50vw' })).toBe('@media (width >= 40vw) and (width < 50vw)')
  })

  test('an expression is left as written rather than becoming NaN', () => {
    const range = rangeFor({ sm: '30em', md: 'calc(40em + 0px)', lg: '50em' })
    expect(range).not.toContain('NaN')
    expect(range).toContain('calc(40em + 0px)')
  })

  test('adjacent ranges meet exactly, leaving no viewport unmatched', () => {
    const bp = new Breakpoints({ sm: '640px', md: '768px' })
    expect(bp.ranges.smOnly).toBe('(width >= 40rem) and (width < 48rem)')
    expect(bp.ranges.md).toBe('(width >= 48rem)')
  })
})

/**
 * A scale is ordered before its ranges are built, and the upper bound of `Only` and `To` comes
 * from the *next* entry. Get the order wrong and the two bounds of a range come out inverted —
 * `(width >= 30rem) and (width < 25rem)` — which is valid CSS matching no viewport at all.
 *
 * Ordering used to be `parseInt`, which reads the leading digits and ignores the unit. That was
 * survivable while only the `min` bound was generated, since a monotonic `min` is monotonic in
 * any order; it stopped being survivable when the upper bound started coming from a neighbour.
 * `validateBreakpoints` rejects a mixed-unit theme, but container sizes go through this same
 * code with no equivalent check.
 */
describe('breakpoints whose values sort differently than they read', () => {
  test('a larger value in a smaller-looking unit still sorts above', () => {
    // 400px is 25rem, so `sm` is the smaller of the two despite reading as the larger number.
    const bp = new Breakpoints({ sm: '400px', md: '30rem' })
    expect(bp.keys).toEqual(['base', 'sm', 'md'])
    expect(bp.ranges.smOnly).toBe('(width >= 25rem) and (width < 30rem)')
  })

  test('a scale declared out of order is still bounded the right way round', () => {
    const bp = new Breakpoints({ big: '80rem', small: '40rem' })
    expect(bp.ranges.smallOnly).toBe('(width >= 40rem) and (width < 80rem)')
  })

  test('an empty value is left out of the query rather than emitting an unbounded operator', () => {
    const bp = new Breakpoints({ sm: '', md: '48rem' })
    for (const query of Object.values(bp.ranges)) {
      expect(query).not.toMatch(/[<>]=?\s*\)/)
    }
  })
})
