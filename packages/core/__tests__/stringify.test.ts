import { describe, expect, test } from 'vitest'
import { stringify } from '../src/stringify'

describe('stringify', () => {
  test('should convert', () => {
    expect(stringify({ whiteSpace: 'nowrap' })).toMatchInlineSnapshot(`
      "white-space: nowrap;
      "
    `)

    expect(stringify({ '--welcome-x': '20' })).toMatchInlineSnapshot(`
      "--welcome-x: 20;
      "
    `)
  })

  test('convert @scope in nesting', () => {
    expect(
      stringify({
        '.parent': {
          color: 'blue',
          '@scope (& > .scope) to (& .limit)': { '& .content': { color: 'red' } },
        },
      }),
    ).toMatchInlineSnapshot(`
      ".parent {color: blue;
      }@scope (.parent > .scope) to (.parent .limit) {.parent .content {color: red;
      }
      }
      "
    `)
  })

  /**
   * A parent carrying a combinator, nested under a selector that mentions `&` twice, is the one
   * shape that reaches the `:is(...)` branch in `getResolvedSelectors`. The two regexes deciding
   * it were global, and `.test()` advances `lastIndex` on a match — so the branch was taken on
   * the first call and skipped on the next, from the same input. Repeating the call is the whole
   * point of this test: one call passes either way.
   */
  test('a combinator parent resolves the same on every call', () => {
    const styles = () => ({ '.a .b': { '&:hover &': { color: 'red' } } })

    const outputs = Array.from({ length: 4 }, () => stringify(styles()))

    expect(new Set(outputs).size).toBe(1)
    // `:is()` rather than a bare parent: `.a .b:hover .a .b` selects a different element set.
    expect(outputs[0]).toMatchInlineSnapshot(`
      ":is(.a .b):hover :is(.a .b) {color: red;
      }
      "
    `)
  })
})
