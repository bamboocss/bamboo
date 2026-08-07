import { describe, expect, test } from 'vitest'
import { createCss, createMergeCss } from '../src/classname'
import { memo } from '../src/memo'
import { cloneStyles } from '../src/clone-styles'

const makeContext = () => ({
  hash: false,
  utility: {
    prefix: '',
    hasShorthand: false,
    resolveShorthand: (p: string) => p,
    transform: (prop: string, value: any) => ({ className: `${prop}_${value}` }),
    toHash: (path: string[], h: (s: string) => string) => h(path.join(':')),
  },
  conditions: { breakpoints: { keys: [] }, shift: (v: string[]) => v, finalize: (v: string[]) => v },
})

const buildCss = () => {
  const ctx = makeContext()
  const cssFn = createCss(ctx)
  const { mergeCss, mergeCssUncached } = createMergeCss(ctx)
  // Mirrors the shape `generateCssFn` emits: the uncached merge under `css`'s own memo,
  // the cached one under `.raw`, which user code calls with no memo above it.
  const css: any = memo((...styles: any[]) => cssFn(mergeCssUncached(...styles)))
  css.raw = (...styles: any[]) => cloneStyles(mergeCss(...styles))
  return css
}

/**
 * A style object whose single property counts how often it is read.
 *
 * Every pass over the arguments reads it exactly once — hashing, snapshotting, the equality
 * check and the merge alike — which turns work that is otherwise internal to `memo` into
 * something a test can assert on.
 */
const countingStyle = () => {
  let reads = 0
  const style: Record<string, unknown> = {}
  Object.defineProperty(style, 'color', {
    configurable: true,
    enumerable: true,
    get: () => {
      reads++
      return 'red'
    },
  })
  return { reads: () => reads, style }
}

describe('memo', () => {
  test('two structurally equal but distinct objects share a cache entry', () => {
    let calls = 0
    const fn = memo((o: any) => {
      calls++
      return o.a + o.b
    })

    expect(fn({ a: 1, b: 2 })).toBe(3)
    expect(fn({ a: 1, b: 2 })).toBe(3)
    expect(calls).toBe(1)
  })

  test('mutating an argument between calls never serves a stale result', () => {
    let calls = 0
    const fn = memo((o: any) => {
      calls++
      return `${o.color}`
    })

    const style = { color: 'red' }
    expect(fn(style)).toBe('red')

    style.color = 'blue'
    expect(fn(style)).toBe('blue')
    expect(calls).toBe(2)

    // and the original value is still keyed correctly afterwards
    expect(fn({ color: 'red' })).toBe('red')
  })

  test('extra and missing keys are not treated as equal', () => {
    const fn = memo((o: any) => Object.keys(o).join(','))

    expect(fn({ a: 1 })).toBe('a')
    expect(fn({ a: 1, b: 2 })).toBe('a,b')
    expect(fn({ a: 1 })).toBe('a')
  })

  test('nested arguments fall back to the string key and stay correct', () => {
    let calls = 0
    const fn = memo((o: any) => {
      calls++
      return JSON.stringify(o)
    })

    expect(fn({ _hover: { color: 'red' } })).toBe('{"_hover":{"color":"red"}}')
    expect(fn({ _hover: { color: 'red' } })).toBe('{"_hover":{"color":"red"}}')
    expect(calls).toBe(1)

    expect(fn({ _hover: { color: 'blue' } })).toBe('{"_hover":{"color":"blue"}}')
    expect(calls).toBe(2)
  })

  test('many distinct scalar arguments all keep hitting', () => {
    // `isCssProperty(prop)` is called per prop per render with hundreds of distinct
    // names. Bucketing scalars by a shared hash capped the useful set at the
    // per-bucket limit and dropped the hit rate to zero past it.
    let calls = 0
    const fn = memo((prop: string) => {
      calls++
      return prop.length
    })

    const props = Array.from({ length: 400 }, (_, i) => `property${i}`)
    for (const prop of props) fn(prop)
    expect(calls).toBe(400)

    calls = 0
    for (let round = 0; round < 10; round++) {
      for (const prop of props) expect(fn(prop)).toBe(prop.length)
    }
    expect(calls).toBe(0)
  })

  test('scalars of different types are not conflated', () => {
    const fn = memo((v: any) => typeof v)

    expect(fn(1)).toBe('number')
    expect(fn('1')).toBe('string')
    expect(fn(true)).toBe('boolean')
    expect(fn(null)).toBe('object')
    expect(fn(undefined)).toBe('undefined')
  })

  test('an array is not conflated with a numerically keyed object', () => {
    // Both enumerate as key '0', but the wrapped function reads them differently.
    let calls = 0
    const fn = memo((...args: any[]) => {
      calls++
      return JSON.stringify(args)
    })

    expect(fn(['x'])).toBe('[["x"]]')
    expect(fn({ 0: 'x' })).toBe('[{"0":"x"}]')
    expect(calls).toBe(2)
  })

  test('inherited properties are not treated as the object own', () => {
    // The memo must see what `Object.keys`/`JSON.stringify` see, not what a
    // prototype walk sees.
    let calls = 0
    const fn = memo((...args: any[]) => {
      calls++
      return JSON.stringify(args)
    })

    expect(fn(Object.create({ color: 'red' }))).toBe('[{}]')
    expect(fn({ color: 'red' })).toBe('[{"color":"red"}]')
    expect(calls).toBe(2)
  })

  test('cache is bounded so a long-lived process cannot grow without limit', () => {
    let calls = 0
    const fn = memo((o: any) => {
      calls++
      return o.n
    })

    // Far more distinct keys than the cache retains.
    for (let i = 0; i < 40_000; i++) fn({ n: i })
    expect(calls).toBe(40_000)

    // The earliest keys must have been dropped rather than retained forever.
    calls = 0
    fn({ n: 0 })
    expect(calls).toBe(1)
  })

  test('does not keep the caller argument object alive', () => {
    const fn = memo((o: any) => o.tag)

    // Held only by the cache once the caller drops it. The cache stores a value
    // snapshot, so the original must be collectable.
    let arg: any = { tag: 'x' }
    const seen = new WeakSet<object>()
    seen.add(arg)
    fn(arg)

    // The stored entry must be a different object than the one handed in.
    const secondCall = { tag: 'x' }
    expect(fn(secondCall)).toBe('x')
    expect(seen.has(secondCall)).toBe(false)

    arg = null
    expect(fn({ tag: 'x' })).toBe('x')
  })

  test('a mutation that collides on identity is still not served stale', () => {
    let calls = 0
    const fn = memo((o: any) => {
      calls++
      return o.v
    })

    const o = { v: 'a' }
    expect(fn(o)).toBe('a')
    // Same instance, changed value: the comparison runs against the cache's own
    // copy, so identity can never short-circuit it.
    o.v = 'b'
    expect(fn(o)).toBe('b')
    o.v = 'a'
    expect(fn(o)).toBe('a')
    expect(calls).toBe(2)
  })

  test('a repeated working set keeps hitting once warm', () => {
    let calls = 0
    const fn = memo((o: any) => {
      calls++
      return o.n
    })

    for (let i = 0; i < 200; i++) fn({ n: i })
    expect(calls).toBe(200)

    calls = 0
    for (let round = 0; round < 20; round++) {
      for (let i = 0; i < 200; i++) fn({ n: i })
    }
    expect(calls).toBe(0)
  })
})

describe('css runtime caching', () => {
  test('repeated identical css() calls serialize exactly once', () => {
    const ctx = makeContext()
    let transforms = 0
    ctx.utility.transform = (prop: string, value: any) => {
      transforms++
      return { className: `${prop}_${value}` }
    }
    const cssFn = createCss(ctx)
    const { mergeCss } = createMergeCss(ctx)
    const css = memo((...styles: any[]) => cssFn(mergeCss(...styles)))

    for (let i = 0; i < 10_000; i++) css({ color: 'red', padding: '4px' })

    // one per declared property, for the whole 10k renders
    expect(transforms).toBe(2)
  })

  /**
   * `css` is already memoized on its argument list, so the merge underneath it must not be
   * keyed on that list as well. Reaching the merge at all means the outer cache missed, and a
   * miss means these arguments have not been seen — so an inner cache keyed on the same
   * arguments can only miss too, after paying a hash and a snapshot to discover it. The
   * redundancy is structural, not a matter of hit rate.
   *
   * Counted rather than timed, so it holds on any machine, per the note in CLAUDE.md. Reads
   * of the argument break down as:
   *
   *     miss   hash(1) + snapshot(1) + the merge itself(2)      = 4
   *     hit    hash(1) + the equality check confirming it(1)    = 2
   *
   * With the inner memo in place a miss cost 6: its own hash and snapshot on top.
   */
  test('a css() miss does not pay for a second cache keyed on the same arguments', () => {
    const css = buildCss()
    const probe = countingStyle()

    expect(css(probe.style)).toBe('color_red')
    expect(probe.reads()).toBe(4)
  })

  test('a css() hit reads its argument only to find and confirm the entry', () => {
    const css = buildCss()
    const first = countingStyle()
    css(first.style)

    const second = countingStyle()
    expect(css(second.style)).toBe('color_red')
    expect(second.reads()).toBe(2)
  })

  test('the merge stays memoized for callers that reach it directly', () => {
    const ctx = makeContext()
    let merges = 0
    const { mergeCss } = createMergeCss({
      ...ctx,
      // `resolve` normalizes each operand, so this runs once per merge that is not served
      // from the cache.
      utility: {
        ...ctx.utility,
        resolveShorthand: (p: string) => {
          merges++
          return p
        },
      },
    })

    // `cva` merges once per active variant on every resolve, with no memo above it.
    for (let i = 0; i < 100; i++) mergeCss({ color: 'red' }, { padding: '4px' })
    expect(merges).toBeLessThan(100)
  })

  test('css.raw does not hand the same mutable object to different callers', () => {
    const css = buildCss()

    const a = css.raw({ color: 'red' })
    const b = css.raw({ color: 'red' })
    expect(a).not.toBe(b)

    // mutating one caller's result must not corrupt anyone else
    a.color = 'MUTATED'
    expect(css.raw({ color: 'red' })).toEqual({ color: 'red' })
    expect(css({ color: 'red' })).toBe('color_red')
  })

  test('the raw boundary, not the merge, is what breaks aliasing', () => {
    const ctx = makeContext()
    const { mergeCss } = createMergeCss(ctx)

    // Merging stays cheap and aliases its sources — it runs on every cache miss.
    const source = { _hover: { color: 'red.500' } }
    expect((mergeCss(source) as any)._hover).toBe(source._hover)

    // The copy that protects the cache happens where the value reaches user code.
    expect((cloneStyles(mergeCss(source)) as any)._hover).not.toBe(source._hover)
  })

  test('css.raw hands out a deep copy, so nested mutation cannot poison the cache', () => {
    const css = buildCss()

    const a = css.raw({ _hover: { color: 'red.500' } })
    const b = css.raw({ _hover: { color: 'red.500' } })
    expect(a._hover).not.toBe(b._hover)

    a._hover.color = 'MUTATED'
    expect(css.raw({ _hover: { color: 'red.500' } })._hover.color).toBe('red.500')
    expect(css({ _hover: { color: 'red.500' } })).not.toContain('MUTATED')
  })

  test('arrays reaching user code are copied, not shared', () => {
    const ctx = makeContext()
    const { mergeCss } = createMergeCss(ctx)

    const source = { padding: ['1', '2'] }
    const raw: any = cloneStyles(mergeCss(source))

    expect(raw.padding).not.toBe(source.padding)
    expect(raw.padding).toEqual(['1', '2'])
  })

  test('mutating a style object between css() calls yields the new class', () => {
    const css = buildCss()
    const style = { color: 'red' }

    expect(css(style)).toBe('color_red')
    style.color = 'blue'
    expect(css(style)).toBe('color_blue')
  })
})
