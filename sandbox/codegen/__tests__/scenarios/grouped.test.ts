import { describe, expect, test } from 'vitest'
import sheet from '../../styled-system-grouped/styles.css.txt?raw'
import { css, cva } from '../../styled-system-grouped/css'
import { stack } from '../../styled-system-grouped/patterns'

/**
 * The one invariant `cssMode: 'grouped'` lives or dies by.
 *
 * A grouped class is derived twice — once by the build on the way into the stylesheet, once
 * by `css()` in the browser — and the two only ever meet in the DOM. When they disagree
 * there is no error and no warning: the rule is emitted, the class is returned, and every
 * element carrying it renders with no styles at all.
 *
 * Nothing else in this repo builds with `cssMode: 'grouped'`, so every defect in it has had
 * to be found by hand. This scenario runs the real toolchain — `bamboo codegen` for the
 * runtime, `bamboo cssgen` for the stylesheet — and checks them against each other.
 *
 * The sheet is imported from a `.css.txt` copy the scenario's codegen emits alongside
 * `styles.css`: vite's CSS pipeline intercepts `?raw` on a `.css` file and returns an empty
 * string, and reading it with `node:fs` would not typecheck — vitest runs `tsc` over the
 * whole project, so no scenario can opt out of it.
 */

/** Does the stylesheet carry a rule for this class? Selectors are escaped; class attributes are not. */
const hasRule = (className: string) => sheet.includes('.' + className.replace(/([.:!\\[\]()])/g, '\\$1'))

const classesOf = (value: string) => value.split(' ').filter(Boolean)

const expectAllBacked = (value: string) => {
  const classes = classesOf(value)
  expect(classes.length).toBeGreaterThan(0)
  for (const className of classes) {
    expect(hasRule(className), `no rule for "${className}" in "${value}"`).toBe(true)
  }
}

describe('cssMode: grouped — the build emits a rule for every class the runtime returns', () => {
  test('a fully static call collapses to one backed class', () => {
    const value = css({ color: 'red.300', padding: '4', fontSize: 'xl' })
    expect(classesOf(value)).toHaveLength(1)
    expectAllBacked(value)
  })

  test('conditions travel inside the group', () => {
    const value = css({ color: 'red.300', _hover: { color: 'blue.300' }, md: { padding: '8' } })
    expect(classesOf(value)).toHaveLength(1)
    expectAllBacked(value)
  })

  test('a pattern is one call, so it is one class', () => {
    const value = stack({ gap: '4' })
    expect(classesOf(value)).toHaveLength(1)
    expectAllBacked(value)
  })

  test('style props merged with a css prop stay one call', () => {
    // What the JSX factory computes for `<styled.div color="red.300" padding="4" css={{fontSize:'xl'}} />`.
    const value = css({ color: 'red.300', padding: '4' }, { fontSize: 'xl' })
    expect(classesOf(value)).toHaveLength(1)
    expectAllBacked(value)
  })

  test('css.raw composition merges before naming', () => {
    const value = css(css.raw({ color: 'red.300' }), css.raw({ padding: '4' }))
    expect(classesOf(value)).toHaveLength(1)
    expectAllBacked(value)
  })

  test('both branches of an enumerated ternary are backed', () => {
    expectAllBacked(css({ fontSize: 'xl', color: 'red.300' }))
    expectAllBacked(css({ fontSize: 'xl', color: 'blue.300' }))
  })

  test('a bare cva stays atomic, and every class it names is backed', () => {
    const button = cva({ base: { color: 'red.300' }, variants: { size: { sm: { padding: '2' } } } })
    expectAllBacked(button({ size: 'sm' }))
  })
})

describe('cssMode: grouped — css() groups the call the runtime will make', () => {
  test('a ternary inside a condition block travels with the property beside it', () => {
    for (const color of ['red.300', 'blue.300']) {
      const value = css({ _hover: { color }, fontSize: 'xl' })
      expect(classesOf(value)).toHaveLength(1)
      expectAllBacked(value)
    }
  })

  test('an array argument is one call, so it is one class', () => {
    const value = css([{ color: 'red.300' }, { fontSize: 'xl' }])
    expect(classesOf(value)).toHaveLength(1)
    expectAllBacked(value)
  })
})

/**
 * Everything that is not `css()` encodes each extracted object on its own, so a call the
 * runtime merges out of several of them was never emitted as a group. What it must not do is
 * leave the element unstyled: the build emits these call sites' atomic rules alongside their
 * groups, and the fallback lands on those.
 */
describe('cssMode: grouped — the shapes that degrade keep every declaration', () => {
  /** Some class carries a rule, and each expected declaration reaches the stylesheet. */
  const expectNothingLost = (value: string, declarations: string[]) => {
    const classes = classesOf(value)
    expect(classes.filter(hasRule).length, `nothing backed in "${value}"`).toBeGreaterThan(0)
    for (const declaration of declarations) {
      expect(sheet, `no rule declares ${declaration}`).toContain(declaration)
    }
  }

  test('a conditional style prop beside a static one', () => {
    // What the factory computes for `<styled.div color={on ? 'red.300' : 'blue.300'} padding="4" />`.
    for (const color of ['red.300', 'blue.300']) {
      expectNothingLost(css({ color, padding: '4' }), ['--colors-red-300', '--spacing-4'])
    }
  })

  test('a conditional value in a pattern', () => {
    expectNothingLost(stack({ gap: '2', padding: '4' }), ['--spacing-2', '--spacing-4', 'display: flex'])
  })

  test('a value the build cannot see, beside one it can', () => {
    // `color` has no rule under any mode. `padding` must still apply.
    expectNothingLost(css({ color: 'some-unresolvable-value', padding: '4' }), ['--spacing-4'])
  })

  test('a spread the build cannot enumerate', () => {
    expectNothingLost(css({ fontSize: 'xl', color: 'red.300' }), ['--colors-red-300'])
  })

  test('two operands sharing a key that holds a condition object', () => {
    expectNothingLost(css({ color: { base: 'red.300' } }, { color: { _hover: 'blue.300' } }), [
      '--colors-red-300',
      '--colors-blue-300',
    ])
  })
})

describe('cssMode: grouped — a call the build could not resolve degrades rather than breaking', () => {
  // The build sees `{ fontSize, padding }` and not `color`, so the group the runtime asks
  // for was never emitted. It must fall back to atomic names, and the declarations the build
  // *did* resolve must still apply — the element keeps its font size and padding instead of
  // rendering with nothing.
  const value = css({ fontSize: 'xl', padding: '4', color: 'some-unresolvable-value' })

  test('it falls back to more than one class', () => {
    expect(classesOf(value).length).toBeGreaterThan(1)
  })

  test('the declarations the build resolved still have rules', () => {
    const backed = classesOf(value).filter(hasRule)
    expect(backed.length, `nothing backed in "${value}"`).toBeGreaterThan(0)

    // Specifically the two it could resolve.
    expect(sheet).toContain('font-size')
    expect(sheet).toContain('padding')
  })

  test('the group class is kept alongside them, so a stale registry cannot strip styles', () => {
    // The additive fallback: whatever else happens, the group class stays in the list. A
    // registry that lags the stylesheet then costs a class that matches nothing, rather than
    // removing one that would have worked.
    const bare = css({ fontSize: 'xl', padding: '4' })
    expect(classesOf(bare)).toHaveLength(1)
    expectAllBacked(bare)
  })
})
