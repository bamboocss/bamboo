import { describe, expect, test } from 'vitest'
import { walkObject } from '../src'

describe('walk object', () => {
  test('should walk and transform', () => {
    const obj = {
      a: { b: { c: 3 } },
    }

    const result = walkObject(obj, (value) => {
      return `value is ${value}`
    })

    expect(result).toMatchInlineSnapshot(`
      {
        "a": {
          "b": {
            "c": "value is 3",
          },
        },
      }
    `)
  })

  test('should walk and stop at array', () => {
    const obj = {
      a: { b: { c: [1, 2, 3] } },
    }

    const result = walkObject(
      obj,
      (value) => {
        return `value is ${value}`
      },
      {
        stop(value) {
          return Array.isArray(value)
        },
      },
    )

    expect(result).toMatchInlineSnapshot(`
      {
        "a": {
          "b": {
            "c": "value is 1,2,3",
          },
        },
      }
    `)
  })

  test('should walk and stop at max depth', () => {
    const obj = {
      a: { b: { c: [1, 2, 3] } },
    }

    const result = walkObject(
      obj,
      (value) => {
        return `value is ${JSON.stringify(value)}`
      },
      {
        stop(_, path) {
          return path.length > 2
        },
      },
    )

    expect(result).toMatchInlineSnapshot(`
      {
        "a": {
          "b": "value is {"c":[1,2,3]}",
        },
      }
    `)
  })

  test('should not set prop with nullish value', () => {
    const shorthands = {
      flexDir: 'flexDirection',
    }

    const obj = {
      flexDir: 'row',
      flexDirection: undefined,
    }

    const result = walkObject(obj, (value) => value, {
      getKey(prop) {
        // @ts-ignore
        return shorthands[prop] ?? prop
      },
    })

    expect(result).toMatchInlineSnapshot(`
      {
        "flexDirection": "row",
      }
    `)
  })

  test('each leaf gets a path the predicate may mutate', () => {
    const seen: string[][] = []

    walkObject({ _hover: { color: 'red', padding: '4px', margin: '8px' } }, (value, path) => {
      // `createCss` hands the path straight to `sortConditions`, which sorts it in place. A
      // path shared between siblings would come back reordered for the next one — so this is
      // what stops `inner` from reusing one array down a level.
      path.reverse()
      seen.push([...path])
      return value
    })

    expect(seen).toEqual([
      ['color', '_hover'],
      ['padding', '_hover'],
      ['margin', '_hover'],
    ])
  })
})
