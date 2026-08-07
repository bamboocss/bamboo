import { createGeneratorContext } from '@bamboocss/fixture'
import { describe, expect, test } from 'vitest'

/**
 * A utility that composes one declaration out of several variables registers them itself, so
 * the guarantee that a variable exists sits with the code that reads it.
 *
 * What the registration buys is `inherits: false`. Custom properties inherit, so without it a
 * parent's `--blur` reaches every descendant and blurs subtrees that never asked. That used
 * to be prevented by assigning all of them a default on `*, ::before, ::after, ::backdrop`,
 * which worked but put 33 declarations on every element in the document.
 */
const cssFor = (utilities: Record<string, unknown>) => {
  const ctx = createGeneratorContext({ utilities } as never)
  const sheet = ctx.createSheet()
  sheet.processGlobalCss({})
  return sheet.toCss()
}

/**
 * One `@property` block by name.
 *
 * The fixture extends `preset-base`, so its own registrations are in this output too and an
 * assertion against the whole stylesheet would pass on somebody else's rule.
 */
const blockFor = (css: string, name: string) => {
  const match = css.match(new RegExp(`@property ${name} \\{[^}]*\\}`, 'g'))
  return { count: match?.length ?? 0, text: match?.join('\n') ?? '' }
}

describe('utility custom properties', () => {
  test('a utility registers the properties it composes', () => {
    const css = cssFor({
      myFilter: {
        className: 'my-filter',
        customProperties: {
          '--my-blur': { inherits: false, syntax: '*' },
        },
        values: { auto: 'var(--my-blur, )' },
      },
    })

    expect(css).toContain('@property --my-blur')
    expect(css).toContain("syntax: '*'")
    expect(css).toContain('inherits: false')
  })

  test('no initial value is declared when none is given', () => {
    // The guaranteed-invalid value is what a `var(--x, )` read expects: the reference falls
    // back to its own empty value and composes to nothing. Naming a value here — `initial`
    // was the old default — substitutes that token into the composition instead, which took
    // `filter` from a list of functions to something invalid.
    const css = cssFor({
      myFilter: {
        className: 'my-filter',
        customProperties: { '--my-blur': { inherits: false, syntax: '*' } },
      },
    })

    expect(blockFor(css, '--my-blur').text).not.toContain('initial-value')
  })

  test('an initial value is declared when one is given', () => {
    const css = cssFor({
      myScale: {
        className: 'my-scale',
        customProperties: { '--my-scale-x': { inherits: false, initialValue: '1', syntax: '*' } },
        values: { auto: 'var(--my-scale-x)' },
      },
    })

    expect(blockFor(css, '--my-scale-x').text).toContain('initial-value: 1')
  })

  test('two utilities naming the same property register it once, first declaration winning', () => {
    // The reader and the writer of a variable both have a claim on declaring it, so a
    // duplicate is expected rather than a mistake. Re-registering would emit the property
    // twice; letting the later definition win would let one utility retype a variable another
    // already registered, changing how an existing value computes at a distance.
    const css = cssFor({
      aDeclaredFirst: {
        className: 'a',
        customProperties: { '--shared': { inherits: false, initialValue: 'first', syntax: '*' } },
      },
      bDeclaredSecond: {
        className: 'b',
        customProperties: { '--shared': { inherits: false, initialValue: 'second', syntax: '*' } },
      },
    })

    const block = blockFor(css, '--shared')
    expect(block.count).toBe(1)
    expect(block.text).toContain('initial-value: first')
  })

  test('a utility declaring none registers nothing of its own', () => {
    const css = cssFor({ plain: { className: 'plain', property: 'color' } })
    expect(blockFor(css, '--plain').count).toBe(0)
  })

  test('the base preset registers what its utilities compose, and nothing it does not', () => {
    const css = cssFor({})

    // Composed by `filter`, read with an empty fallback.
    expect(blockFor(css, '--blur').count).toBe(1)
    // Composed by `translate`'s `auto-3d`. Never covered by the universal reset this
    // replaced, so it inherited: a parent's `--translate-z` moved its children.
    expect(blockFor(css, '--translate-z').count).toBe(1)
    // In that reset, but read and written by nothing at all.
    expect(blockFor(css, '--skew-x').count).toBe(0)
    expect(blockFor(css, '--rotate').count).toBe(0)
  })

  test('a composed var a descendant can re-declare does not inherit into it', () => {
    const css = cssFor({})

    // A child setting only `bgGradient` used to compose its gradient from whichever colours
    // an ancestor declared, because these inherited. Read bare rather than with a fallback,
    // so an unset one must stay guaranteed-invalid and drop the gradient — which is what
    // registering without an `initialValue` gives.
    for (const name of ['--gradient-from', '--gradient-to', '--gradient-via', '--gradient-via-stops']) {
      expect(blockFor(css, name).count).toBe(1)
    }
    // Written by every utility that reads them, so registering only stops the inheritance.
    expect(blockFor(css, '--gradient-stops').count).toBe(1)
    expect(blockFor(css, '--gradient-position').count).toBe(1)

    // Same shape for the `transition` shorthand: a descendant using it inside an element
    // that set a duration or an easing used to inherit that element's timing.
    for (const name of ['--transition-prop', '--transition-duration', '--transition-easing']) {
      expect(blockFor(css, name).count).toBe(1)
    }

    expect(blockFor(css, '--focus-ring-color').count).toBe(1)
  })

  test('a focus ring var whose only effect is on a subtree keeps inheriting', () => {
    const css = cssFor({})

    // `focusRingColor` and friends emit *only* a variable — no declaration of their own — so
    // theming a subtree's rings from an ancestor is the sole thing they do. Registering them
    // would turn that into silent dead CSS, which is why they are deliberately absent.
    for (const name of ['--focus-ring-color-prop', '--focus-ring-width', '--focus-ring-style', '--focus-ring-offset']) {
      expect(blockFor(css, name).count).toBe(0)
    }
  })
})
