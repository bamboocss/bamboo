import { describe, test, expect } from 'vitest'
import { patternParser } from './fixture'

describe('pattern jsx', () => {
  test('should extract', () => {
    const code = `
       import { flex, center as aliased } from "styled-system/patterns"

       function Button() {
         return (
            <div>
               <div className={flex({ align: "center" })}>Click me</div>
               <div className={aliased({ justify: "flex-end" })}>Click me</div>
            </div>
        )
       }
     `

    expect(patternParser(code)).toMatchInlineSnapshot(`
      Map {
        "flex" => Set {
          {
            "box": {
              "column": 32,
              "endColumn": 57,
              "endLineNumber": 7,
              "line": 7,
              "node": "CallExpression",
              "type": "map",
              "value": Map {
                "align" => {
                  "column": 46,
                  "endColumn": 54,
                  "endLineNumber": 7,
                  "line": 7,
                  "node": "StringLiteral",
                  "type": "literal",
                  "value": "center",
                },
              },
            },
            "data": [
              {
                "align": "center",
              },
            ],
            "name": "flex",
            "type": "pattern",
          },
        },
        "center" => Set {
          {
            "box": {
              "column": 32,
              "endColumn": 64,
              "endLineNumber": 8,
              "line": 8,
              "node": "CallExpression",
              "type": "map",
              "value": Map {
                "justify" => {
                  "column": 51,
                  "endColumn": 61,
                  "endLineNumber": 8,
                  "line": 8,
                  "node": "StringLiteral",
                  "type": "literal",
                  "value": "flex-end",
                },
              },
            },
            "data": [
              {
                "justify": "flex-end",
              },
            ],
            "name": "center",
            "type": "pattern",
          },
        },
      }
    `)
  })
})
