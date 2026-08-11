import { describe, expect, test } from 'vitest'
import { css, cssLeaf } from '../styled-system/css/css'

/**
 * `cssLeaf` is what the source transform rewrites a single dynamic style leaf into, so
 * the only thing worth asserting is that it agrees with the `css()` call it replaced —
 * against the real generated runtime, not a stand-in.
 *
 * The prefix is what the transform resolves at build time. It is written literally here
 * rather than derived, so a change to how class names are built fails this rather than
 * being reproduced by the test's own arithmetic.
 */
const agrees = (prefix: string, prop: string, value: unknown) => {
  // Cast because the point is to compare arbitrary runtime values against a typed API:
  // `{ [prop]: value }` with a `string` key cannot be proven to be a `SystemStyleObject`,
  // and narrowing it would rule out exactly the shapes worth testing.
  const styles = { [prop]: value } as Parameters<typeof css>[0]

  expect(cssLeaf(prefix, prop, value), `${prop}: ${String(value)}`).toBe(css(styles))
}

describe('cssLeaf', () => {
  test('token and raw values', () => {
    for (const value of ['blue.300', 'red.500', '#abc', 'rgb(1 2 3)', 'var(--x)', '4px', 'calc(1px+2px)']) {
      agrees('c_', 'color', value)
    }
  })

  test('values that need the slow path', () => {
    for (const value of ['red !important', 'red!', '0 auto', 'a\nb', '  padded  ', 'calc(1px + 2px)']) {
      agrees('c_', 'color', value)
    }
  })

  test('non-string scalars', () => {
    agrees('sr_', 'srOnly', true)
    agrees('sr_', 'srOnly', false)
    agrees('op_', 'opacity', 0)
    agrees('z_', 'zIndex', 4)
  })

  test('null and undefined produce no class', () => {
    agrees('c_', 'color', null)
    agrees('c_', 'color', undefined)
    expect(cssLeaf('c_', 'color', null)).toBe('')
  })

  test('an array falls back, and the fallback is what rejects it', () => {
    // `cssLeaf` cannot name the property in a diagnostic — it is handed a prefix — so it
    // declines and lets `css()` throw, which can.
    expect(() => cssLeaf('c_', 'color', ['red.300', 'blue.500'])).toThrow('An array is not a style value: "color".')
  })

  test('a condition object falls back and still nests', () => {
    agrees('c_', 'color', { base: 'red.300', md: 'blue.500' })
    expect(cssLeaf('c_', 'color', { base: 'red.300', md: 'blue.500' })).toContain('md:')
  })

  test('a shorthand resolves the same way through both paths', () => {
    agrees('p_', 'p', '4')
    agrees('bg-c_', 'bgColor', 'red.300')
  })

  test('a property with no utility behind it still agrees', () => {
    agrees('-webkit-line-clamp_', 'WebkitLineClamp', '3')
  })
})
