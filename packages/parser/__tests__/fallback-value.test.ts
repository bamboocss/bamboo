import { describe, expect, test } from 'vitest'
import { parseAndExtract } from './fixture'

describe('fallback values', () => {
  test('extracts from a css() call and emits every candidate', () => {
    const code = `
    import { css } from "styled-system/css"

    css({ height: "fallback(calc(100dvh - 100px), calc(100vh - 100px))" })
    `

    const result = parseAndExtract(code)

    expect(result.css).toContain('height: calc(100vh - 100px)')
    expect(result.css).toContain('height: calc(100dvh - 100px)')
    // Least-preferred first, so the browser keeps the preferred one it can parse.
    expect(result.css.indexOf('calc(100vh - 100px)')).toBeLessThan(result.css.indexOf('calc(100dvh - 100px)'))
  })

  test('extracts from a jsx style prop', () => {
    const code = `
    import { styled } from "styled-system/jsx"

    const App = () => <styled.div cursor="fallback(-webkit-grab, grab, move)" />
    `

    const result = parseAndExtract(code)

    expect(result.css).toContain('cursor: move')
    expect(result.css).toContain('cursor: grab')
    expect(result.css).toContain('cursor: -webkit-grab')
  })

  test('extracts from a recipe variant', () => {
    const code = `
    import { cva } from "styled-system/css"

    const tall = cva({
      variants: {
        size: {
          full: { height: "fallback(100dvh, 100vh)" },
        },
      },
    })
    `

    const result = parseAndExtract(code)

    expect(result.css).toContain('height: 100vh')
    expect(result.css).toContain('height: 100dvh')
  })
})
