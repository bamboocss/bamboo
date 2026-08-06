import type { Config } from '@bamboocss/types'
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

  test('evaluates the fallback() helper, including under an alias', () => {
    const withHelper = parseAndExtract(`
    import { css, fallback } from "styled-system/css"
    css({ height: fallback('100dvh', '100vh') })
    `)
    expect(withHelper.css).toContain('height: 100vh')
    expect(withHelper.css).toContain('height: 100dvh')

    const aliased = parseAndExtract(`
    import { css, fallback as fb } from "styled-system/css"
    css({ height: fb('100dvh', '100vh') })
    `)
    expect(aliased.css).toContain('height: 100vh')
    expect(aliased.css).toContain('height: 100dvh')
  })

  test("leaves a project's own fallback helper alone", () => {
    // `getName` echoes back an identifier it does not know, so without confirming the
    // import this would shadow the local function and emit `fallback(50vh)`.
    const result = parseAndExtract(`
    import { css } from "styled-system/css"
    const fallback = (value) => value
    css({ height: fallback('50vh') })
    `)
    expect(result.css).toContain('height: 50vh')
    expect(result.css).not.toContain('fallback(')
  })

  test('does not shadow a recipe or pattern named fallback', () => {
    // `fallback` is an ordinary word, unlike `cva`. Registering it on the css matcher put it
    // ahead of recipes in parser dispatch, and the recipe emitted nothing at all.
    const config = {
      theme: { extend: { recipes: { fallback: { className: 'fb', base: { color: 'red' }, variants: {} } } } },
    } as unknown as Config

    const result = parseAndExtract(`import { fallback } from "styled-system/recipes"\nfallback()`, config)
    expect(result.css).toContain('color: red')
  })

  test('drops a declaration whose candidate could not be resolved', () => {
    // Joining an unresolved candidate in would build a class the runtime helper never
    // produces — a rule matching nothing at all.
    const result = parseAndExtract(`
    import { css, fallback } from "styled-system/css"
    declare const runtime: string
    css({ color: 'red', height: fallback(runtime, '100vh') })
    `)
    expect(result.css).toContain('color: red')
    expect(result.css).not.toContain('fallback(')
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
