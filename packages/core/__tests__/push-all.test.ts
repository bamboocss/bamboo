import { describe, expect, test } from 'vitest'
import { pushAll } from '../src/push-all'

/**
 * The reason this exists rather than `target.push(...source)`: spreading passes every element
 * as an argument, and past roughly a hundred thousand of them they stop fitting on the stack.
 * How far past depends on how deep the stack already is, so no size is reliably safe.
 *
 * `sortStyleRules` runs on every build and appends every rule in the stylesheet this way, and
 * a `staticCss` rule naming every utility with a wildcard already reaches ~15,000 objects
 * against this repo's own fixture.
 */
describe('pushAll', () => {
  test('appends in order, after what is already there', () => {
    const target = [1, 2]
    pushAll(target, [3, 4, 5])

    expect(target).toEqual([1, 2, 3, 4, 5])
  })

  test('an empty source changes nothing', () => {
    const target = [1]
    pushAll(target, [])

    expect(target).toEqual([1])
  })

  test('a source that would overflow a spread still lands whole', () => {
    // Spreading this many throws `RangeError: Maximum call stack size exceeded`. Asserted
    // below so the premise cannot quietly stop being true.
    const source = Array.from({ length: 200_000 }, (_, i) => i)
    const spread: number[] = []
    expect(() => spread.push(...source)).toThrow(RangeError)

    const target: number[] = []
    pushAll(target, source)

    expect(target).toHaveLength(source.length)
    expect(target[0]).toBe(0)
    expect(target.at(-1)).toBe(source.length - 1)
  })

  test('appending an array to itself terminates', () => {
    // The loop reads `length` once. Re-reading it per iteration would grow the array as fast
    // as it walked it and never finish.
    const target = [1, 2, 3]
    pushAll(target, target)

    expect(target).toEqual([1, 2, 3, 1, 2, 3])
  })

  test('a hole is copied as undefined, as a spread would', () => {
    const target: (number | undefined)[] = []
    // eslint-disable-next-line no-sparse-arrays
    pushAll(target, [1, , 3])

    expect(target).toEqual([1, undefined, 3])
    expect(target).toHaveLength(3)
  })
})
