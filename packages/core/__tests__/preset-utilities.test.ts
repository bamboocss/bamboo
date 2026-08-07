import { createRuleProcessor } from '@bamboocss/fixture'
import { describe, expect, test } from 'vitest'

/**
 * The utility transforms, which had almost no coverage: `effects.ts` sat at 10% statements,
 * `focus-ring.ts` at 10.5%, and the utilities as a group at 48.4%, with the `transform` bodies
 * making up most of the untested part. They are the code that decides what CSS an element
 * gets, so a defect in one is wrong output rather than a crash — and two were found by simply
 * running them.
 *
 * These assert the shape each transform is responsible for rather than snapshotting whole
 * rules: a snapshot records whatever the code does, including what it does wrong, which is how
 * `outline: 'none'` sat broken without a failing test.
 */
type Styles = Parameters<ReturnType<typeof createRuleProcessor>['css']>[0]

const css = (styles: Styles) => createRuleProcessor().css(styles).toCss().replace(/\s+/g, ' ').trim()

/** The value a declaration was given, with whitespace normalized. */
const value = (styles: Styles, property: string) =>
  css(styles)
    .match(new RegExp(`(?:^|[{;] )${property}:\\s*([^;}]+)`))?.[1]
    ?.trim()

describe('token resolution happens before the transform', () => {
  /**
   * The bug class this group exists for. A utility that declares `values` as a *token
   * category* has its value resolved before `transform` runs, so a transform comparing
   * against the value as written never matches.
   *
   * `outline` did exactly that: `values: 'borders'` turned `'none'` into `var(--borders-none)`
   * before the `value === 'none'` branch could see it, so the branch was dead and
   * `outline: 'none'` emitted a reference to a token no preset defines — invalid at
   * computed-value time, so the declaration was dropped and the outline was never reset.
   */
  test('outline: none resets the outline rather than referencing a token', () => {
    expect(value({ outline: 'none' }, 'outline')).toBe('2px solid transparent')
    expect(value({ outline: 'none' }, 'outline-offset')).toBe('2px')
    expect(css({ outline: 'none' })).not.toContain('--borders-none')
  })

  test('the ring shorthand resolves the same way', () => {
    expect(value({ ring: 'none' }, 'outline')).toBe('2px solid transparent')
  })

  test('a literal outline still passes through', () => {
    expect(value({ outline: '1px solid red' }, 'outline')).toBe('1px solid red')
  })

  /**
   * These compare against the value too, and are safe for a reason worth recording: their
   * `values` is a plain array, which is an enum of accepted keywords rather than a token
   * category, so nothing is resolved before the transform sees it.
   */
  test('an array of values is not token-resolved, so its keywords still match', () => {
    expect(value({ float: 'start' }, 'float')).toBe('left')
    expect(css({ float: 'start' })).toContain('[dir="rtl"]')
    expect(value({ scrollbar: 'hidden' }, 'scrollbar-width')).toBe('none')
  })

  test('a transform with no values at all sees the raw value', () => {
    expect(value({ lineClamp: 'none' }, '-webkit-line-clamp')).toBe('unset')
    expect(value({ lineClamp: '3' }, '-webkit-line-clamp')).toBe('3')
  })
})

describe('vendor-prefixed properties emit both spellings', () => {
  // A prefixed-only declaration silently does nothing in an engine that wants the standard
  // one, and vice versa. Each of these exists to write the pair.
  test.each([
    { input: { appearance: 'none' } as Styles, prefixed: '-webkit-appearance', standard: 'appearance' },
    {
      input: { backfaceVisibility: 'hidden' } as Styles,
      prefixed: '-webkit-backface-visibility',
      standard: 'backface-visibility',
    },
    { input: { clipPath: 'circle(50%)' } as Styles, prefixed: '-webkit-clip-path', standard: 'clip-path' },
    { input: { hyphens: 'auto' } as Styles, prefixed: '-webkit-hyphens', standard: 'hyphens' },
    { input: { maskImage: 'url(a.svg)' } as Styles, prefixed: '-webkit-mask-image', standard: 'mask-image' },
    { input: { maskSize: 'cover' } as Styles, prefixed: '-webkit-mask-size', standard: 'mask-size' },
    {
      input: { textSizeAdjust: 'none' } as Styles,
      prefixed: '-webkit-text-size-adjust',
      standard: 'text-size-adjust',
    },
    {
      input: { boxDecorationBreak: 'clone' } as Styles,
      prefixed: '-webkit-box-decoration-break',
      standard: 'box-decoration-break',
    },
    { input: { backgroundClip: 'text' } as Styles, prefixed: '-webkit-background-clip', standard: 'background-clip' },
    { input: { userSelect: 'none' } as Styles, prefixed: '-webkit-user-select', standard: 'user-select' },
  ])('$standard', ({ input, prefixed, standard }) => {
    const out = css(input)
    expect(out, `missing ${prefixed}`).toContain(`${prefixed}:`)
    expect(out, `missing ${standard}`).toMatch(new RegExp(`(?:^|[{;] )${standard}:`))
  })
})

describe('transform axes write the variables their composer reads', () => {
  /**
   * `translate`, `rotate` and `scale` each compose one declaration from per-axis variables,
   * and register them with `@property`. An axis utility writing a variable the composer does
   * not read produces a class that changes nothing at all.
   */
  test.each([
    { input: { translateX: '4' } as Styles, variable: '--translate-x' },
    { input: { translateY: '4' } as Styles, variable: '--translate-y' },
    { input: { translateZ: '10px' } as Styles, variable: '--translate-z' },
    { input: { rotateX: '45deg' } as Styles, variable: '--rotate-x' },
    { input: { rotateY: '45deg' } as Styles, variable: '--rotate-y' },
    { input: { rotateZ: '45deg' } as Styles, variable: '--rotate-z' },
    { input: { scaleX: '1.5' } as Styles, variable: '--scale-x' },
    { input: { scaleY: '2' } as Styles, variable: '--scale-y' },
    { input: { borderSpacingX: '2' } as Styles, variable: '--border-spacing-x' },
    { input: { borderSpacingY: '2' } as Styles, variable: '--border-spacing-y' },
  ])('$variable', ({ input, variable }) => {
    expect(value(input, variable), `${variable} was not written`).toBeDefined()
  })

  test('an axis variable is read by the composed declaration', () => {
    expect(value({ translate: 'auto' }, 'translate')).toContain('var(--translate-x)')
    expect(value({ rotate: 'auto' }, 'rotate')).toContain('var(--rotate-x)')
    expect(value({ scale: 'auto' }, 'scale')).toContain('var(--scale-x)')
  })
})

describe('utilities that style children rather than the element', () => {
  // The selector is the whole point of these: written against the element instead of its
  // children, `spaceX` would indent the container rather than separate what is inside it.
  const CHILD = '> :not([hidden]) ~ :not([hidden])'

  test.each([
    { input: { spaceX: '4' } as Styles, name: 'spaceX', property: 'margin-inline-start' },
    { input: { spaceY: '4' } as Styles, name: 'spaceY', property: 'margin-top' },
    { input: { divideX: '2' } as Styles, name: 'divideX', property: 'border-inline-start-width' },
    { input: { divideY: '2' } as Styles, name: 'divideY', property: 'border-top-width' },
    { input: { divideColor: 'red.300' } as Styles, name: 'divideColor', property: 'border-color' },
    { input: { divideStyle: 'dashed' } as Styles, name: 'divideStyle', property: 'border-style' },
  ])('$name targets the adjacent children', ({ input, property }) => {
    const out = css(input)
    expect(out).toContain(CHILD)
    expect(out).toContain(`${property}:`)
  })
})

describe('border radius groups expand to their corners', () => {
  test.each([
    { input: { borderTopRadius: 'md' } as Styles, corners: ['border-top-left-radius', 'border-top-right-radius'] },
    {
      input: { borderBottomRadius: 'md' } as Styles,
      corners: ['border-bottom-left-radius', 'border-bottom-right-radius'],
    },
    { input: { borderLeftRadius: 'md' } as Styles, corners: ['border-top-left-radius', 'border-bottom-left-radius'] },
    {
      input: { borderRightRadius: 'md' } as Styles,
      corners: ['border-top-right-radius', 'border-bottom-right-radius'],
    },
    { input: { borderStartRadius: 'md' } as Styles, corners: ['border-start-start-radius', 'border-end-start-radius'] },
    { input: { borderEndRadius: 'md' } as Styles, corners: ['border-start-end-radius', 'border-end-end-radius'] },
  ])('$corners', ({ input, corners }) => {
    const out = css(input)
    for (const corner of corners) expect(out, `missing ${corner}`).toContain(`${corner}:`)
    // The token has to resolve, not be emitted as the key that was written.
    expect(out).toContain('var(--radii-md)')
  })
})

describe('focus ring', () => {
  // Every variant reads the same colour variable, so a project can set the colour once and
  // have it reach whichever variant a component chose.
  test.each(['outside', 'inside', 'mixed'])('%s resolves through the shared colour variable', (variant) => {
    const out = css({ focusRing: variant } as Styles)
    expect(out).toContain('--focus-ring-color:')
    expect(out).toContain('outline-color:')
    expect(out).toContain(':is(:focus, [data-focus])')
  })

  test('none removes the outline instead of drawing one', () => {
    expect(css({ focusRing: 'none' })).toContain('outline: none')
  })

  test('the colour utility writes the variable the ring reads', () => {
    expect(value({ focusRingColor: 'red.300' }, '--focus-ring-color-prop')).toBe('var(--colors-red-300)')
  })
})

describe('gradients compose into one image', () => {
  test.each([
    { input: { backgroundLinear: 'to-r' } as Styles, fn: 'linear-gradient' },
    { input: { backgroundRadial: 'circle' } as Styles, fn: 'radial-gradient' },
    { input: { backgroundConic: 'from 0deg' } as Styles, fn: 'conic-gradient' },
  ])('$fn', ({ input, fn }) => {
    const out = css(input)
    expect(out).toContain(`${fn}(`)
    expect(out).toContain('--gradient-stops:')
  })

  test('a stop position is written where the stop list reads it', () => {
    expect(value({ gradientFromPosition: '10%' }, '--gradient-from-position')).toBe('10%')
    expect(value({ gradientToPosition: '90%' }, '--gradient-to-position')).toBe('90%')
    expect(value({ gradientViaPosition: '50%' }, '--gradient-via-position')).toBe('50%')
  })

  test('a via colour switches the stop list to the three-stop form', () => {
    const out = css({ gradientVia: 'red.300' })
    expect(out).toContain('--gradient-via:')
    expect(out).toContain('--gradient-via-stops:')
  })

  test('text gradients clip the background to the text', () => {
    const out = css({ textGradient: 'to-r' })
    expect(out).toContain('-webkit-background-clip: text')
    expect(out).toContain('color: transparent')
  })
})

describe('transitions write both the variable and the property', () => {
  // The variable is what `transition` reads; the longhand is what applies when it is used on
  // its own. Emitting only one of the two makes the pair silently order-dependent.
  test.each([
    {
      input: { transitionDuration: 'fast' } as Styles,
      variable: '--transition-duration',
      property: 'transition-duration',
    },
    {
      input: { transitionTimingFunction: 'default' } as Styles,
      variable: '--transition-easing',
      property: 'transition-timing-function',
    },
    {
      input: { transitionProperty: 'opacity' } as Styles,
      variable: '--transition-prop',
      property: 'transition-property',
    },
  ])('$property', ({ input, variable, property }) => {
    expect(value(input, variable), `${variable} missing`).toBeDefined()
    expect(value(input, property), `${property} missing`).toBeDefined()
  })

  test('the shorthand reads each variable with a fallback, so it works alone', () => {
    const out = css({ transition: 'all' })
    expect(out).toContain('var(--transition-prop,')
    expect(out).toContain('var(--transition-easing,')
    expect(out).toContain('var(--transition-duration,')
  })
})

describe('helpers', () => {
  test('srOnly hides visually while staying reachable', () => {
    const out = css({ srOnly: true })
    expect(out).toContain('position: absolute')
    expect(out).toContain('clip: rect(0, 0, 0, 0)')
    // `display: none` would take it out of the accessibility tree, which is the opposite of
    // what this is for.
    expect(out).not.toContain('display: none')
  })

  test('truncate needs all three declarations to do anything', () => {
    const out = css({ truncate: true })
    for (const declaration of ['overflow: hidden', 'text-overflow: ellipsis', 'white-space: nowrap']) {
      expect(out).toContain(declaration)
    }
  })

  test('boxSize sets both axes', () => {
    expect(value({ boxSize: '4' }, 'width')).toBe('var(--sizes-4)')
    expect(value({ boxSize: '4' }, 'height')).toBe('var(--sizes-4)')
  })

  test('scrollbar hidden covers the vendor pseudo-element as well as the standard property', () => {
    const out = css({ scrollbar: 'hidden' })
    expect(out).toContain('scrollbar-width: none')
    expect(out).toContain('::-webkit-scrollbar')
  })
})
