import { describe, expect, test } from 'vitest'
import { parseAndExtract } from './fixture'

describe('extract namespace', () => {
  test('TS namespaces - patterns', () => {
    const code = `
        import * as p from "styled-system/patterns"
    
        p.stack({ mt: "40px" })
         `

    const result = parseAndExtract(code)

    expect(result.json).toMatchInlineSnapshot(`
          [
            {
              "data": [
                {
                  "mt": "40px",
                },
              ],
              "name": "stack",
              "type": "pattern",
            },
          ]
        `)

    expect(result.css).toMatchInlineSnapshot(`
      "@layer utilities {
        .gap_8px {
          gap: 8px;
      }

        .d_flex {
          display: flex;
      }

        .flex-d_column {
          flex-direction: column;
      }

        .mt_40px {
          margin-top: 40px;
      }
      }"
    `)
  })

  test('TS namespaces - recipes', () => {
    const code = `
        import * as recipes from "styled-system/recipes"
    
        recipes.cardStyle({ rounded: true })
         `
    const result = parseAndExtract(code)
    expect(result.json).toMatchInlineSnapshot(`
          [
            {
              "data": [
                {
                  "rounded": true,
                },
              ],
              "name": "cardStyle",
              "type": "recipe",
            },
          ]
        `)

    expect(result.css).toMatchInlineSnapshot(`
          "@layer recipes {
            .card--rounded_true {
              border-radius: 0.375rem;
          }
          }"
        `)
  })

  test('TS namespaces - css', () => {
    const code = `
        import * as bamboo from "styled-system/css"
    
        bamboo.css({ color: "red" })
        bamboo.cva({ base: { color: "blue" } })
        bamboo.sva({ base: { root: { color: "green" } } })
         `
    const result = parseAndExtract(code)
    expect(result.json).toMatchInlineSnapshot(`
          [
            {
              "data": [
                {
                  "color": "red",
                },
              ],
              "name": "css",
              "type": "css",
            },
            {
              "data": [
                {
                  "base": {
                    "color": "blue",
                  },
                },
              ],
              "name": "cva",
              "type": "cva",
            },
            {
              "data": [
                {
                  "base": {
                    "root": {
                      "color": "green",
                    },
                  },
                  "slots": [
                    "root",
                  ],
                },
              ],
              "name": "sva",
              "type": "sva",
            },
          ]
        `)

    expect(result.css).toMatchInlineSnapshot(`
      "@layer utilities {
        .c_red {
          color: red;
      }

        .c_blue {
          color: blue;
      }

        .c_green {
          color: green;
      }
      }"
    `)
  })

  test('TS namespaces - jsx', () => {
    const code = `
        import * as JSX from "styled-system/jsx"
    
        const App = () => {
          return <>
          <JSX.styled.div color="red" />
          <JSX.Stack color="blue" />
          <JSX.Grid color="green" />
          </>
        }
         `
    const result = parseAndExtract(code)
    expect(result.json).toMatchInlineSnapshot(`
      [
        {
          "data": [
            {
              "color": "red",
            },
          ],
          "name": "styled.div",
          "type": "jsx-factory",
        },
        {
          "data": [
            {
              "color": "blue",
            },
          ],
          "name": "Stack",
          "type": "jsx-pattern",
        },
        {
          "data": [
            {
              "color": "green",
            },
          ],
          "name": "Grid",
          "type": "jsx-pattern",
        },
      ]
    `)

    expect(result.css).toMatchInlineSnapshot(`
      "@layer utilities {
        .gap_8px {
          gap: 8px;
      }

        .c_red {
          color: red;
      }

        .d_flex {
          display: flex;
      }

        .flex-d_column {
          flex-direction: column;
      }

        .c_blue {
          color: blue;
      }

        .d_grid {
          display: grid;
      }

        .c_green {
          color: green;
      }
      }"
    `)
  })

  test('TS namespaces - ignore not from bamboo', () => {
    const code = `
        import * as bamboo from "not-bamboo"
    
        bamboo.css({ color: "red" })
        bamboo.cva({ base: { color: "blue" } })
        bamboo.sva({ base: { root: { color: "green" } } })
         `
    const result = parseAndExtract(code)
    expect(result.json).toMatchInlineSnapshot(`[]`)

    expect(result.css).toMatchInlineSnapshot(`""`)
  })

  test('TS namespaces - JSX factory', () => {
    const code = `
        import * as bambooJsx from '../styled-system/jsx';
    
        bambooJsx.styled('div', { base: { color: 'red' } })
        const App = () => <bambooJsx.styled.span color="blue">Hello</bambooJsx.styled.span>
         `
    const result = parseAndExtract(code)
    expect(result.json).toMatchInlineSnapshot(`
      [
        {
          "data": [
            {
              "base": {
                "color": "red",
              },
            },
          ],
          "name": "styled",
          "type": "cva",
        },
        {
          "data": [
            {
              "color": "blue",
            },
          ],
          "name": "styled.span",
          "type": "jsx-factory",
        },
      ]
    `)

    expect(result.css).toMatchInlineSnapshot(`
      "@layer utilities {
        .c_red {
          color: red;
      }

        .c_blue {
          color: blue;
      }
      }"
    `)
  })

  test('TS namespaces - ignore not from bamboo', () => {
    const code = `
        import * as bamboo from "not-bamboo"
    
        bamboo.css({ color: "red" })
        bamboo.cva({ base: { color: "blue" } })
        bamboo.sva({ base: { root: { color: "green" } } })
         `
    const result = parseAndExtract(code)
    expect(result.json).toMatchInlineSnapshot(`[]`)

    expect(result.css).toMatchInlineSnapshot(`""`)
  })
})
