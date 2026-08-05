import { describe, expect, test } from 'vitest'
import { parseAndExtract } from './fixture'

/**
 * `viewTransition()` emits rules against `::view-transition-*` pseudo-elements rather
 * than classes on the element, so almost nothing about it goes through the atomic path
 * these tests usually exercise. Two things are worth pinning down: that slot bodies are
 * still ordinary style objects, and that the class the CSS is written against is the one
 * the runtime returns — a class nothing matches is the failure mode here, and it is
 * invisible in output that otherwise looks correct.
 */
describe('viewTransition', () => {
  test('emits the bag class and one rule per slot', () => {
    const code = `
    import { viewTransition } from 'styled-system/css'

    const slide = viewTransition({
      group: { animationDuration: '0.4s', animationTimingFunction: 'ease-in-out' },
      imagePair: { isolation: 'isolate' },
      old: { animationName: 'fade-out' },
      new: { animationName: 'fade-in' },
    })
    `

    // The class is `vt_golYYs` here and in the codegen sandbox's runtime test, written
    // literally in both so a change to how it is derived breaks them rather than being
    // reproduced by each test's own arithmetic.
    expect(parseAndExtract(code).css).toMatchInlineSnapshot(`
      "@layer utilities {
        .vt_golYYs {
          view-transition-class: vt_golYYs;
      }

        ::view-transition-group(.vt_golYYs) {
          animation-duration: 0.4s;
          animation-timing-function: ease-in-out;
      }

        ::view-transition-image-pair(.vt_golYYs) {
          isolation: isolate;
      }

        ::view-transition-old(.vt_golYYs) {
          animation-name: fade-out;
      }

        ::view-transition-new(.vt_golYYs) {
          animation-name: fade-in;
      }
      }"
    `)
  })

  /**
   * At-rule conditions only. A selector condition lowers to a descendant combinator or a
   * trailing class, and neither can reach a `::view-transition-*` pseudo-element — it is
   * not a descendant of anything, and nothing can follow it. See the limitations in the
   * docs; this pins the half that works.
   */
  test('resolves tokens, breakpoints and at-rule conditions inside a slot', () => {
    const code = `
    import { viewTransition } from 'styled-system/css'

    const t = viewTransition({
      group: { bg: 'red.300', _motionReduce: { animationDuration: '0.01s' }, md: { color: 'green.300' } },
    })
    `

    expect(parseAndExtract(code).css).toMatchInlineSnapshot(`
      "@layer utilities {
        .vt_cAQlRA {
          view-transition-class: vt_cAQlRA;
      }

        ::view-transition-group(.vt_cAQlRA) {
          background: var(--colors-red-300);
      }

        @media screen and (min-width: 48rem) {
          ::view-transition-group(.vt_cAQlRA) {
            color: var(--colors-green-300);
      }
      }

        @media (prefers-reduced-motion: reduce) {
          ::view-transition-group(.vt_cAQlRA) {
            animation-duration: 0.01s;
      }
      }
      }"
    `)
  })

  /**
   * A responsive array has to become a breakpoint object before the slot body is
   * serialized whole. Left as an array it walks into `0:`/`1:` declarations, which is not
   * CSS at all — and the type permits the array, so nothing upstream would catch it.
   */
  test('expands a responsive array inside a slot', () => {
    const code = `
    import { viewTransition } from 'styled-system/css'
    const t = viewTransition({ group: { animationDuration: ['0.2s', '0.4s'] } })
    `

    const { css } = parseAndExtract(code)
    expect(css).toContain('animation-duration: 0.2s')
    expect(css).toMatch(/@media screen and \(min-width: 40rem\)/)
    expect(css).not.toMatch(/\b0:\s/)
  })

  test('records the call in the parser result', () => {
    const code = `
    import { viewTransition } from 'styled-system/css'
    const t = viewTransition({ old: { animationName: 'fade-out' } })
    `

    expect(parseAndExtract(code).json).toMatchInlineSnapshot(`
      [
        {
          "data": [
            {
              "old": {
                "animationName": "fade-out",
              },
            },
          ],
          "name": "viewTransition",
          "type": "viewTransition",
        },
      ]
    `)
  })

  test('two calls with the same options emit one set of rules', () => {
    const code = `
    import { viewTransition } from 'styled-system/css'

    const a = viewTransition({ old: { animationName: 'fade-out' } })
    const b = viewTransition({ old: { animationName: 'fade-out' } })
    `

    const { css } = parseAndExtract(code)
    expect(css.match(/view-transition-class/g)).toHaveLength(1)
  })

  test('an aliased import is still extracted', () => {
    const code = `
    import { viewTransition as vt } from 'styled-system/css'
    const t = vt({ old: { animationName: 'fade-out' } })
    `

    expect(parseAndExtract(code).css).toContain('::view-transition-old(')
  })

  test('a namespace import is still extracted', () => {
    const code = `
    import * as bamboo from 'styled-system/css'
    const t = bamboo.viewTransition({ old: { animationName: 'fade-out' } })
    `

    expect(parseAndExtract(code).css).toContain('::view-transition-old(')
  })

  test('a local viewTransition that is not the import is left alone', () => {
    const code = `
    const viewTransition = (options) => 'not-bamboo'
    const t = viewTransition({ old: { animationName: 'fade-out' } })
    `

    expect(parseAndExtract(code).css).toBe('')
  })

  test('an empty bag emits nothing', () => {
    const code = `
    import { viewTransition } from 'styled-system/css'
    const t = viewTransition({})
    `

    expect(parseAndExtract(code).css).toBe('')
  })

  /**
   * The extractor drops a nullish property before this code sees it, so a build that
   * distinguished `{ new: undefined }` from `{}` would emit CSS under a class the runtime
   * never returns — losing the static slots along with it. Asserting the class, not just
   * which rules appear: the earlier version of this test checked the rules and passed
   * while the class was wrong.
   */
  test.each([
    ['undefined', 'undefined'],
    ['null', 'null'],
    ['absent', undefined],
  ])('a %s slot lands on the same class as an absent one', (_label, spelling) => {
    const slot = spelling === undefined ? '' : `, new: ${spelling}`
    const code = `
    import { viewTransition } from 'styled-system/css'
    const t = viewTransition({ old: { animationName: 'fade-out' }${slot} })
    `

    const { css } = parseAndExtract(code)
    // The class the generated runtime returns for this bag, pinned literally.
    expect(css).toContain('.vt_ksOGxk')
    expect(css).toContain('::view-transition-old(.vt_ksOGxk)')
    expect(css).not.toContain('::view-transition-new(')
  })

  /**
   * `viewTransition` is an ordinary enough name for a project to have a recipe called it.
   * Dispatching on the name alone read theirs as this one and emitted nothing at all.
   */
  test('a recipe named viewTransition is still a recipe', () => {
    const code = `
    import { viewTransition } from 'styled-system/recipes'
    const t = viewTransition({ size: 'sm' })
    `

    const { css, json } = parseAndExtract(code, {
      theme: {
        extend: {
          recipes: {
            viewTransition: {
              className: 'vtr',
              base: { color: 'red' },
              variants: { size: { sm: { fontSize: '12px' } } },
            },
          },
        },
      },
    })

    expect(json[0]).toMatchObject({ type: 'recipe' })
    expect(css).toContain('font-size: 12px')
    expect(css).not.toContain('view-transition-class')
  })

  test('is not extracted under template-literal syntax, where it is not generated', () => {
    const code = `
    import { viewTransition } from 'styled-system/css'
    const t = viewTransition({ old: { animationName: 'fade-out' } })
    `

    expect(parseAndExtract(code, { syntax: 'template-literal' }).css).toBe('')
  })

  test('the class carries the config prefix', () => {
    const code = `
    import { viewTransition } from 'styled-system/css'
    const t = viewTransition({ old: { animationName: 'fade-out' } })
    `

    const { css } = parseAndExtract(code, { prefix: 'bamboo' })
    expect(css).toContain('.bamboo-vt_')
    expect(css).toContain('::view-transition-old(.bamboo-vt_')
    // The value has to be the finalized class, not the unprefixed base, or the rules
    // would be written against a class nothing sets.
    expect(css).toMatch(/view-transition-class:\s*bamboo-vt_/)
  })
})
