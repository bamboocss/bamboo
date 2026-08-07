import { describe, expect, test } from 'vitest'
import { memo } from '../src/memo'
import { splitProps } from '../src/split-props'

describe('split props', () => {
  test('it works with array split', () => {
    const obj = { a: 1, b: 2, c: 3, d: 4 }
    const [a, b, c] = splitProps(obj, ['a', 'b'], ['c'])

    expect(a).toEqual({ a: 1, b: 2 })
    expect(b).toEqual({ c: 3 })
    expect(c).toEqual({ d: 4 })
  })

  test('it works with predicate split', () => {
    const obj = { a: 1, b: 2, c: 3, d: 4 }
    const result = splitProps(obj, (key) => key === 'a' || key === 'b')

    expect(result).toMatchInlineSnapshot(`
      [
        {
          "a": 1,
          "b": 2,
        },
        {
          "c": 3,
          "d": 4,
        },
      ]
    `)
  })

  test('it works with predicate split and array split', () => {
    const obj = { a: 1, b: 2, c: 3, d: 4 }
    const [a, b, c] = splitProps(obj, (key) => key === 'a' || key === 'b', ['c'])

    expect(a).toEqual({ a: 1, b: 2 })
    expect(b).toEqual({ c: 3 })
    expect(c).toEqual({ d: 4 })
  })

  /**
   * Everything below survived the move off property descriptors. Only accessors did not,
   * which is the last case here.
   */
  test('a named group keeps the order it named its keys in', () => {
    const obj = { c: 3, a: 1, b: 2 }
    const [named] = splitProps(obj, ['a', 'b', 'c'])

    // Not `toEqual`, which ignores order. `cva` merges variant props in iteration order,
    // so reordering them changes which variant wins when two set the same property.
    expect(Object.keys(named)).toEqual(['a', 'b', 'c'])
  })

  test('a predicate group keeps the order the props were written in', () => {
    const obj = { c: 3, a: 1, b: 2 }
    const [matched] = splitProps(obj, (key) => key !== 'a')

    expect(Object.keys(matched)).toEqual(['c', 'b'])
  })

  test('the first group to name a key takes it', () => {
    const [first, second, rest] = splitProps({ a: 1, b: 2 }, ['a'], ['a', 'b'])

    expect(first).toEqual({ a: 1 })
    expect(second).toEqual({ b: 2 })
    expect(rest).toEqual({})
  })

  test('a key set to undefined still belongs to the group that names it', () => {
    const [named, rest] = splitProps({ a: undefined, b: 2 }, ['a'])

    expect('a' in named).toBe(true)
    expect(rest).toEqual({ b: 2 })
  })

  test('an inherited member is not claimed', () => {
    const obj = Object.create({ inherited: 'no' }) as Record<string, unknown>
    obj.own = 'yes'

    const [named, rest] = splitProps(obj, ['inherited'])

    expect(named).toEqual({})
    expect(rest).toEqual({ own: 'yes' })
  })

  test('a non-enumerable own property reaches the rest bucket, still hidden', () => {
    const obj = { a: 1 }
    Object.defineProperty(obj, 'hidden', { value: 2, enumerable: false })

    const [, rest] = splitProps(obj, ['a'])

    // Present, but not enumerable — otherwise the rest bucket, which is spread onto the
    // element, would put it in the DOM where it had been invisible.
    expect(Object.getOwnPropertyNames(rest)).toContain('hidden')
    expect(Object.keys(rest)).not.toContain('hidden')
  })

  test('an accessor stays an accessor, unread', () => {
    let reads = 0
    const obj = {
      get a() {
        reads++
        return 1
      },
      b: 2,
    }

    const [named] = splitProps(obj, ['a'])

    // Solid compiles props to accessors, so reading one during the split runs whatever it
    // wraps. `createStyleContext` splits a component's props, and an eager read there
    // builds the children before their provider exists.
    expect(reads).toBe(0)
    expect(Object.getOwnPropertyDescriptor(named, 'a')?.get).toBeInstanceOf(Function)
    expect(named.a).toBe(1)
    expect(reads).toBe(1)
  })

  test('splitting does not run a getter that builds something', () => {
    const order: string[] = []
    const props = {
      variant: 'solid',
      get children() {
        order.push('children built')
        return 'child'
      },
    }

    const [named, rest] = splitProps(props, ['variant'])
    order.push('split done')

    // The shape `createStyleContext` relies on: the split happens, then the consumer
    // decides when the children are built.
    expect(order).toEqual(['split done'])
    expect(named).toEqual({ variant: 'solid' })
    expect(rest.children).toBe('child')
    expect(order).toEqual(['split done', 'children built'])
  })

  test('the rest bucket keeps the order the props were written in', () => {
    const [, rest] = splitProps({ c: 3, a: 1, b: 2 }, ['a'])

    // The parser reads the rest bucket as the style props it encodes, and class names are
    // joined in insertion order, so this order reaches the emitted CSS.
    expect(Object.keys(rest)).toEqual(['c', 'b'])
  })

  test('an own __proto__ is carried as an own property', () => {
    const props = JSON.parse('{"__proto__":{"polluted":1},"a":2}') as Record<string, unknown>

    const [named, rest] = splitProps(props, ['__proto__'])

    // Assigning this key would run the prototype setter: the value would vanish from the
    // bucket and reappear as its prototype.
    expect(Object.getOwnPropertyNames(named)).toEqual(['__proto__'])
    expect(Object.getPrototypeOf(named)).toBe(Object.prototype)
    expect(rest).toEqual({ a: 2 })
  })

  test('a group naming an Object.prototype member gets nothing', () => {
    const [named, rest] = splitProps({ a: 1 }, ['toString', 'constructor'])

    // Reading the bulk descriptor map by key resolved through `Object.prototype`, so
    // these used to be claimed and land in the bucket as `undefined`.
    expect(Object.getOwnPropertyNames(named)).toEqual([])
    expect(Object.getOwnPropertyNames(rest)).toEqual(['a'])
  })

  test('a key with no descriptor behind it is skipped, not thrown on', () => {
    // A proxy may answer `ownKeys` with a key it then reports no descriptor for, and a
    // predicate with a side effect can delete one in between. Neither is exotic enough to
    // crash a build over, and the descriptor map this replaced simply skipped them.
    const phantom = new Proxy({ a: 1 } as Record<string, unknown>, { ownKeys: () => ['a', 'b'] })
    expect(splitProps(phantom, ['a'])).toEqual([{ a: 1 }, {}])
    expect(splitProps(phantom, ['b'])).toEqual([{}, { a: 1 }])

    const vanishing = { a: 1, b: 2, c: 3 } as Record<string, unknown>
    const result = splitProps(vanishing, (key) => {
      if (key === 'a') delete vanishing.c
      return key === 'a'
    })
    expect(result).toEqual([{ a: 1 }, { b: 2 }])
  })

  test('a named group asks the props object nothing about keys it does not have', () => {
    let asked = 0
    const target = { visual: 'outline' }
    const counted = new Proxy(target as Record<string, unknown>, {
      getOwnPropertyDescriptor: (t, key) => {
        asked++
        return Reflect.getOwnPropertyDescriptor(t, key)
      },
    })

    // Every question is a trap on the props Solid hands over, so asking about absent keys
    // makes a recipe's variant list cost more than the props it is splitting. It also
    // used to *claim* them, putting `undefined` in the bucket.
    const [variants, rest] = splitProps(counted, ['visual', 'size', 'tone', 'shape'])

    expect(asked).toBe(Object.keys(target).length)
    expect(Object.keys(variants)).toEqual(['visual'])
    expect(rest).toEqual({})
  })

  test('an own property named after one is claimed normally', () => {
    const [named, rest] = splitProps({ toString: 'x', a: 1 }, ['toString'])

    // The other half of the same bug: with an own key of that name, deleting it from the
    // descriptor map unmasked the prototype's, so a phantom `toString` also reached the
    // rest bucket.
    expect(named).toEqual({ toString: 'x' })
    expect(Object.getOwnPropertyNames(rest)).toEqual(['a'])
  })

  test('a predicate is called with the key alone', () => {
    const seen: unknown[][] = []
    splitProps({ a: 1, b: 2 }, (...args: unknown[]) => {
      seen.push(args)
      return args[0] === 'a'
    })

    // Handing the predicate to `filter` directly passed `(key, index, allKeys)`. The extra
    // arguments are invisible to a one-parameter predicate but not to a memoized one, which
    // reads its whole argument list.
    expect(seen).toEqual([['a'], ['b']])
  })

  test('a memoized predicate keys its cache on the prop name, not the surrounding props', () => {
    let calls = 0
    const predicate = memo((key: string) => {
      calls++
      return key === 'color'
    })

    splitProps({ color: 'red', padding: '4px' }, predicate)
    const afterFirst = calls

    // Same prop names, different surrounding key set. Under the old arity the memo keyed on
    // `(key, index, allKeys)`, so nothing here could hit and the cache grew per prop set.
    splitProps({ color: 'blue', margin: '8px', id: 'x' }, predicate)

    expect(afterFirst).toBe(2)
    expect(calls).toBe(afterFirst + 2) // only `margin` and `id` are new
  })
})

/**
 * One array group takes a path of its own — it is what every call site in the project
 * passes, and the general path pays for several groups and predicates on every call.
 *
 * Two implementations of the same rules can drift, so this pins them against each other
 * rather than restating the rules a third time. The general path is reached by passing a
 * second, empty group, which is enough to disqualify the fast path while claiming nothing.
 *
 * Not by passing the group as a *predicate*: an array bucket is ordered by the group and a
 * predicate bucket by the props, so those two were never equivalent and comparing them
 * tests nothing about this change.
 */
describe('the single-group path agrees with the general one', () => {
  const cases: Array<[string, Record<string, unknown>, string[]]> = [
    ['plain', { a: 1, b: 2, c: 3 }, ['a', 'b']],
    ['group naming absent keys', { a: 1 }, ['a', 'nope', 'gone']],
    ['nothing claimed', { a: 1, b: 2 }, ['x']],
    ['everything claimed', { a: 1, b: 2 }, ['a', 'b']],
    ['empty group', { a: 1 }, []],
    ['empty props', {}, ['a']],
    ['duplicate keys in the group', { a: 1, b: 2 }, ['a', 'a', 'b']],
    ['prototype names', { constructor: 1, toString: 2, a: 3 }, ['toString']],
    ['group order differs from props order', { c: 3, a: 1, b: 2 }, ['b', 'a']],
  ]

  test.each(cases)('%s', (_name, props, group) => {
    const fast = splitProps(props, group)
    const [claimed, , rest] = splitProps(props, group, [])
    const general = [claimed, rest]

    expect(fast).toEqual(general)
    // Order is not cosmetic — `cva` merges variant props in iteration order and the parser
    // reads the rest bucket as the style props it encodes.
    expect(Object.keys(fast[0] as object)).toEqual(Object.keys(general[0] as object))
    expect(Object.keys(fast[1] as object)).toEqual(Object.keys(general[1] as object))
  })

  test('an accessor stays lazy on the fast path', () => {
    let reads = 0
    const props = {
      b: 2,
      get a() {
        reads++
        return 1
      },
    }

    const [named] = splitProps(props, ['a'])
    expect(reads).toBe(0)
    expect((named as { a: number }).a).toBe(1)
    expect(reads).toBe(1)
  })
})
