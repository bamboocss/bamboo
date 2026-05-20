import { describe, expect, test } from 'vitest'
import { importParser } from './fixture'

describe('extract imports', () => {
  test('should work', () => {
    const code = `
    import { css as nCss } from "@bamboo/css"

    css({ bg: "red" })
    `

    expect(importParser(code, { importMap: '@bamboo' })).toMatchInlineSnapshot(`
      [
        {
          "alias": "nCss",
          "kind": "named",
          "mod": "@bamboo/css",
          "name": "css",
        },
      ]
    `)
  })
})
