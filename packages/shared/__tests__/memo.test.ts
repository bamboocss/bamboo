import { describe, expect, test } from 'vitest'
import { createCss, createMergeCss } from '../src/classname'
import { memo } from '../src/memo'
import { mergeProps } from '../src/merge-props'

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
  const { mergeCss } = createMergeCss(ctx)
  // Mirrors the shape `generateCssFn` emits, including the copy on `.raw`.
  const css: any = memo((...styles: any[]) => cssFn(mergeCss(...styles)))
  css.raw = (...styles: any[]) => mergeProps({}, mergeCss(...styles))
  return css
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

  test('a merged result does not alias its sources nested objects', () => {
    const ctx = makeContext()
    const { mergeCss } = createMergeCss(ctx)

    const source = { _hover: { color: 'red.500' } }
    const merged: any = mergeCss(source)

    // The cache holds this result and hands it out again, so it must not point at
    // the caller's own nested object.
    expect(merged._hover).not.toBe(source._hover)

    merged._hover.color = 'MUTATED'
    expect(source._hover.color).toBe('red.500')
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

  test('arrays in a merged result are copied, not shared', () => {
    const ctx = makeContext()
    const { mergeCss } = createMergeCss(ctx)

    const source = { padding: ['1', '2'] }
    const merged: any = mergeCss(source)

    expect(merged.padding).not.toBe(source.padding)
    expect(merged.padding).toEqual(['1', '2'])
  })

  test('mutating a style object between css() calls yields the new class', () => {
    const css = buildCss()
    const style = { color: 'red' }

    expect(css(style)).toBe('color_red')
    style.color = 'blue'
    expect(css(style)).toBe('color_blue')
  })
})
