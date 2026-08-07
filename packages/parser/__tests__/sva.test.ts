import { describe, expect, test } from 'vitest'
import { parseAndExtract, svaParser } from './fixture'

describe('ast parser / sva', () => {
  test('should parse', () => {
    const code = `
    import {sva} from "styled-system/css"

    const button = sva({
        slots: ['label', 'icon'],
        base: {
            label: {
            color: 'red',
            },
            icon: {
            fontSize: 'lg',
            },
        },
    })
     `

    expect(svaParser(code)).toMatchInlineSnapshot(`
      {
        "sva": Set {
          {
            "box": {
              "column": 20,
              "endColumn": 7,
              "endLineNumber": 14,
              "line": 4,
              "node": "CallExpression",
              "type": "map",
              "value": Map {
                "slots" => {
                  "column": 16,
                  "endColumn": 33,
                  "endLineNumber": 5,
                  "line": 5,
                  "node": "ArrayLiteralExpression",
                  "type": "array",
                  "value": [
                    {
                      "column": 17,
                      "endColumn": 24,
                      "endLineNumber": 5,
                      "line": 5,
                      "node": "StringLiteral",
                      "type": "literal",
                      "value": "label",
                    },
                    {
                      "column": 26,
                      "endColumn": 32,
                      "endLineNumber": 5,
                      "line": 5,
                      "node": "StringLiteral",
                      "type": "literal",
                      "value": "icon",
                    },
                  ],
                },
                "base" => {
                  "column": 15,
                  "endColumn": 10,
                  "endLineNumber": 13,
                  "line": 6,
                  "node": "ObjectLiteralExpression",
                  "type": "map",
                  "value": Map {
                    "label" => {
                      "column": 20,
                      "endColumn": 14,
                      "endLineNumber": 9,
                      "line": 7,
                      "node": "ObjectLiteralExpression",
                      "type": "map",
                      "value": Map {
                        "color" => {
                          "column": 20,
                          "endColumn": 25,
                          "endLineNumber": 8,
                          "line": 8,
                          "node": "StringLiteral",
                          "type": "literal",
                          "value": "red",
                        },
                      },
                    },
                    "icon" => {
                      "column": 19,
                      "endColumn": 14,
                      "endLineNumber": 12,
                      "line": 10,
                      "node": "ObjectLiteralExpression",
                      "type": "map",
                      "value": Map {
                        "fontSize" => {
                          "column": 23,
                          "endColumn": 27,
                          "endLineNumber": 11,
                          "line": 11,
                          "node": "StringLiteral",
                          "type": "literal",
                          "value": "lg",
                        },
                      },
                    },
                  },
                },
              },
            },
            "data": [
              {
                "base": {
                  "icon": {
                    "fontSize": "lg",
                  },
                  "label": {
                    "color": "red",
                  },
                },
                "slots": [
                  "label",
                  "icon",
                ],
              },
            ],
            "name": "sva",
            "type": "sva",
          },
        },
      }
    `)
  })

  test('unresolvable slots', () => {
    const code = `
    import { sva } from 'styled-system/css'
    import { slots } from './slots'

    const card = sva({
      slots,
      base: {
        root: {
          p: '6',
          m: '4',
          w: 'md',
          boxShadow: 'md',
          borderRadius: 'md',
          _dark: { bg: '#262626', color: 'white' },
        },
        content: {
          textStyle: 'lg',
        },
        title: {
          textStyle: 'xl',
          fontWeight: 'semibold',
          pb: '2',
        },
      },
    })
     `
    const result = parseAndExtract(code)
    expect(result.json).toMatchInlineSnapshot(`
      [
        {
          "data": [
            {
              "base": {
                "content": {
                  "textStyle": "lg",
                },
                "root": {
                  "_dark": {
                    "bg": "#262626",
                    "color": "white",
                  },
                  "borderRadius": "md",
                  "boxShadow": "md",
                  "m": "4",
                  "p": "6",
                  "w": "md",
                },
                "title": {
                  "fontWeight": "semibold",
                  "pb": "2",
                  "textStyle": "xl",
                },
              },
            },
          ],
          "name": "sva",
          "type": "sva",
        },
      ]
    `)

    expect(result.css).toMatchInlineSnapshot(`
      "@layer recipes.slots {
        .sva_gbRdhD__root {
          padding: var(--spacing-6);
          margin: var(--spacing-4);
          border-radius: var(--radii-md);
          box-shadow: var(--shadows-md);
          width: var(--sizes-md);
      }

        [data-theme=dark] .sva_gbRdhD__root,.dark .sva_gbRdhD__root,.sva_gbRdhD__root.dark,.sva_gbRdhD__root[data-theme=dark] {
          background: #262626;
          color: var(--colors-white);
      }

        .sva_gbRdhD__title {
          font-weight: var(--font-weights-semibold);
          padding-bottom: var(--spacing-2);
      }
      }"
    `)
  })

  test('unresolvable slots - spread', () => {
    const code = `
    import { sva } from 'styled-system/css'
    const parts = ['positioner', 'content']

    const card = sva({
      slots: [...parts],
      base: {
        root: {
          p: '6',
        },
      },
    })
     `
    const result = parseAndExtract(code)
    expect(result.json).toMatchInlineSnapshot(`
      [
        {
          "data": [
            {
              "base": {
                "root": {
                  "p": "6",
                },
              },
              "slots": [
                undefined,
              ],
            },
          ],
          "name": "sva",
          "type": "sva",
        },
      ]
    `)

    expect(result.css).toMatchInlineSnapshot(`
      "@layer recipes.slots {
        .sva_gaUUaS__root {
          padding: var(--spacing-6);
      }
      }"
    `)
  })

  test('unresolvable + concat - spread', () => {
    const code = `
      import { anatomy } from '@/slots'
      import { sva } from 'styled-system/css'

      const card = sva({
        slots: [...anatomy().keys(), 'slots', 'here'],
        className: 'tt',
        base: {
          a: {
            backgroundColor: 'red',
          },
        },
      })
     `

    const result = parseAndExtract(code)
    expect(result.css).toMatchInlineSnapshot(`
      "@layer recipes.slots {
        .tt__a {
          background-color: red;
      }
      }"
    `)
  })
})
