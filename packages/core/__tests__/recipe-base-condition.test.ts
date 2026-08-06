import { describe, expect, test } from 'vitest'
import { createRuleProcessor } from './fixture'

/**
 * A recipe's base and its variants have to end up in the *same* cascade layer.
 *
 * Base rules used to be nested in `@layer _base` inside `@layer recipes`, with the variant
 * rules unlayered alongside. A layer's own unlayered rules beat its nested sublayers
 * whatever their selectors say — layer order outranks specificity — so a base declaration
 * written under a condition lost to an unconditional variant declaration *even while the
 * condition held*. Verified in Chromium: the hover style computed to `none`.
 *
 * The identical config through `cva` merges in JS and keeps the hover style, so the two
 * pipelines disagreed on the same input.
 */
const processor = () =>
  createRuleProcessor({
    theme: {
      extend: {
        recipes: {
          btn: {
            className: 'btn',
            base: {
              boxShadow: '4px 4px 0px 0px black',
              _hover: { boxShadow: '6px 6px 0px 0px black' },
            },
            variants: { color: { black: { boxShadow: 'none' } } },
          },
        },
      },
    },
  } as never)

describe('recipe base and variants share one cascade layer', () => {
  const css = () =>
    (processor() as never as { recipe: (n: string, v: object) => { toCss: () => string } })
      .recipe('btn', { color: 'black' })
      .toCss()

  test('no nested _base layer separates them', () => {
    expect(css()).not.toContain('@layer _base')
  })

  test('base is emitted before the variant, so an equal-specificity variant still wins', () => {
    const out = css()
    // `.btn` and `.btn--color_black` are both a single class, so only order can decide —
    // which is why base has to come first.
    expect(out.indexOf('.btn {')).toBeLessThan(out.indexOf('.btn--color_black'))
  })

  test("the base's conditional rule outlives the variant, by specificity", () => {
    const out = css()
    // Both rules present in one layer; the hover selector carries more specificity, so it
    // applies while hovering instead of being outranked by layer order.
    expect(out).toContain('box-shadow: 6px 6px 0px 0px black')
    expect(out).toContain('box-shadow: none')
    expect(out.match(/@layer\s+recipes/g)).toHaveLength(1)
  })
})
