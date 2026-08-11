import { createGeneratorContext } from '@bamboocss/fixture'
import type { SystemStyleObject } from '@bamboocss/types'
import { describe, expect, test } from 'vitest'
import { createRuleProcessor } from './fixture'

/**
 * The extra bundles here go under `extend`, not straight onto `theme.mixins`.
 *
 * They used to live under `animationStyles`, a separate key from the fixture's `textStyles`, so
 * both survived without anyone saying so. One key means a bare `mixins` *replaces* the preset's
 * — which quietly emptied the `headline` assertions below when these tests were first migrated.
 */
function css(styles: SystemStyleObject) {
  return createRuleProcessor({
    theme: {
      extend: {
        mixins: {
          'scale-fade-in': {
            value: {
              transformOrigin: 'var(--transform-origin)',
              animationName: 'scale-in, fade-in',
            },
          },
          'scale-fade-out': {
            value: {
              transformOrigin: 'var(--transform-origin)',
              animationName: 'scale-out, fade-out',
            },
          },
        },
      },
    },
  })
    .css(styles)
    .toCss()
}

describe('compositions', () => {
  test('should assign composition', () => {
    const ctx = createGeneratorContext()
    const result = ctx.utility.transform('mixin', 'headline.h2')
    expect(result).toMatchInlineSnapshot(`
      {
        "className": "mixin_headline.h2",
        "layer": "compositions",
        "styles": {
          "@media (width >= 64rem)": {
            "fontSize": "2rem",
          },
          "fontSize": "1.5rem",
          "fontWeight": "var(--font-weights-bold)",
        },
      }
    `)

    expect(ctx.utility.transform('mixin', 'headline.h5')).toMatchInlineSnapshot(`
      {
        "className": "mixin_headline.h5",
        "layer": "compositions",
        "styles": {},
      }
    `)
  })

  test('should respect the layer', () => {
    expect(css({ mixin: 'headline.h1' })).toMatchInlineSnapshot(`
      "@layer utilities {
        @layer compositions {
          .mixin_headline\\.h1 {
            font-size: 2rem;
            font-weight: var(--font-weights-bold);
      }
        }
      }"
    `)

    expect(css({ mixin: 'headline.h2' })).toMatchInlineSnapshot(`
      "@layer utilities {
        @layer compositions {
          .mixin_headline\\.h2 {
            font-size: 1.5rem;
            font-weight: var(--font-weights-bold);
      }

          @media (width >= 64rem) {
            .mixin_headline\\.h2 {
              font-size: 2rem;
      }
      }
        }
      }"
    `)
  })

  test('should resolve DEFAULT', () => {
    expect(css({ mixin: 'headline' })).toMatchInlineSnapshot(`
      "@layer utilities {
        @layer compositions {
          .mixin_headline {
            font-size: 1.5rem;
            font-weight: var(--font-weights-bold);
      }
        }
      }"
    `)
  })

  test('should resolve animation styles', () => {
    expect(css({ mixin: 'scale-fade-in' })).toMatchInlineSnapshot(`
      "@layer utilities {
        @layer compositions {
          .mixin_scale-fade-in {
            transform-origin: var(--transform-origin);
            animation-name: scale-in, fade-in;
      }
        }
      }"
    `)
  })
})
