import { describe, expect, test } from 'vitest'
import { createCss } from '../src/classname'

/**
 * Grouping names a class after a whole `css()` call, so a call the build never saw returns
 * a class with no rule and the element renders with nothing. `knownGroups` lets the runtime
 * notice that and name the declarations atomically instead — degrading to what
 * `cssMode: 'atomic'` would have produced rather than to a blank element.
 */
const makeContext = (extra: Record<string, unknown> = {}) => ({
  utility: {
    prefix: '',
    hasShorthand: false,
    resolveShorthand: (prop: string) => prop,
    transform: (prop: string, value: unknown) => ({ className: `${prop}_${value}` }),
    toHash: (path: string[], hashFn: (str: string) => string) => hashFn(path.join(':')),
  },
  conditions: {
    breakpoints: { keys: ['sm', 'md'] },
    shift: (paths: string[]) => paths,
    finalize: (paths: string[]) => paths,
  },
  ...extra,
})

const styles = { color: 'red', padding: '4px' }

describe('knownGroups', () => {
  test('without a registry the runtime is unchanged', () => {
    const grouped = createCss(makeContext({ grouped: true }) as never)
    const className = grouped(styles)

    expect(className).not.toContain(' ')
    expect(className).toBe(createCss(makeContext({ grouped: true }) as never)(styles))
  })

  test('a known group returns its single class', () => {
    const bare = createCss(makeContext({ grouped: true }) as never)
    const expected = bare(styles)

    const guarded = createCss(makeContext({ grouped: true, knownGroups: new Set([expected]) }) as never)

    expect(guarded(styles)).toBe(expected)
  })

  // The group class is *kept* alongside the atomic names rather than replaced. That is what
  // makes an incomplete registry harmless: a registry lags the stylesheet as a matter of
  // when files land, and replacing the class would turn every such lag into an element
  // stripped of styles it really had.
  test('an unknown group keeps its class and adds the atomic names', () => {
    const bare = createCss(makeContext({ grouped: true }) as never)
    const guarded = createCss(makeContext({ grouped: true, knownGroups: new Set<string>() }) as never)
    const atomic = createCss(makeContext() as never)

    expect(guarded(styles)).toBe(`${bare(styles)} ${atomic(styles)}`)
    expect(guarded(styles)).toContain('color_red padding_4px')
  })

  test('the atomic half is named exactly as atomic mode names it', () => {
    const guarded = createCss(makeContext({ grouped: true, knownGroups: new Set<string>() }) as never)
    const bare = createCss(makeContext({ grouped: true }) as never)
    const atomic = createCss(makeContext() as never)

    // Whatever the group class is, the remainder has to be what `cssMode: 'atomic'` would
    // have produced — the fallback is only useful if it reaches rules the build emitted.
    const withoutGroup = (value: string) => value.split(' ').slice(1).join(' ')

    for (const input of [
      styles,
      { color: 'red', _hover: { color: 'blue' }, md: { padding: '4px' } },
      { color: 'red!' },
      { padding: ['1px', '2px'] },
    ]) {
      expect(guarded(input).split(' ')[0]).toBe(bare(input))
      expect(withoutGroup(guarded(input))).toBe(atomic(input))
    }
  })

  test('the fallback preserves an important marker', () => {
    const guarded = createCss(makeContext({ grouped: true, knownGroups: new Set<string>() }) as never)
    expect(guarded({ color: 'red!' })).toContain('!')
  })

  test('an empty style object is still empty, registry or not', () => {
    const guarded = createCss(makeContext({ grouped: true, knownGroups: new Set<string>() }) as never)
    expect(guarded({})).toBe('')
  })

  // The registry must be exact. A structure that can answer `true` for a class it does not
  // hold returns a group with no rule behind it — the failure this exists to remove.
  test('a registry that answers true for everything never falls back', () => {
    const always = { has: () => true }
    const guarded = createCss(makeContext({ grouped: true, knownGroups: always }) as never)
    const bare = createCss(makeContext({ grouped: true }) as never)

    expect(guarded(styles)).toBe(bare(styles))
  })
})
