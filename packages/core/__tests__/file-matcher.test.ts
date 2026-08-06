import { createContext } from '@bamboocss/fixture'
import { describe, expect, test } from 'vitest'

describe('file matcher', () => {
  test('imports', () => {
    const ctx = createContext()

    const file = ctx.imports.file([
      { mod: 'styled-system/css', name: 'css', alias: 'css' },
      // import { css as xcss } from 'styled-system/css'
      { mod: 'styled-system/css', name: 'css', alias: 'xcss' },
      // import { cva } from 'styled-system/css'
      { mod: 'styled-system/css', name: 'cva', alias: 'cva' },
    ])

    expect(file.getAliases('cva')).toMatchInlineSnapshot(`
      [
        "cva",
      ]
    `)
    expect(file.getAliases('css')).toMatchInlineSnapshot(`
      [
        "css",
        "xcss",
      ]
    `)
    expect(file.getName('xcss')).toMatchInlineSnapshot('"css"')
  })

  test('imports - multiple sources', () => {
    const ctx = createContext({ importMap: ['styled-system', '@acme/org'] })

    const file = ctx.imports.file([
      { mod: 'styled-system/css', name: 'cva', alias: 'cva' },
      { mod: 'styled-system/patterns', name: 'stack', alias: 'stack' },
      { mod: '@acme/org/css', name: 'cva', alias: 'cvaAcme' },
      { mod: '@acme/org/patterns', name: 'stack', alias: 'stackAcme' },

      { mod: '@wrong/org/css', name: 'cva', alias: 'cvaWrong' },
      { mod: '@wrong/org/patterns', name: 'stack', alias: 'stackWrong' },
    ])

    expect(file.matchFn('cva')).toMatchInlineSnapshot('true')
    expect(file.matchFn('cvaAcme')).toMatchInlineSnapshot('true')
    expect(file.isValidPattern('stack')).toMatchInlineSnapshot('true')
    expect(file.isValidPattern('stackAcme')).toMatchInlineSnapshot('true')

    expect(file.isValidPattern('randxxx')).toMatchInlineSnapshot('false')
    expect(file.matchFn('cvaWrong')).toMatchInlineSnapshot(`false`)
    expect(file.matchFn('stackWrong')).toMatchInlineSnapshot(`false`)
  })

  test('isBambooComponent', () => {
    const ctx = createContext()

    const file = ctx.imports.file([{ mod: 'styled-system/recipes', name: 'buttonStyle', alias: 'buttonStyle' }])

    // a recipe's jsx tag
    expect(file.isBambooComponent('ButtonStyle')).toMatchInlineSnapshot('true')
    // should match arbitrary tag names (so we can track style props)
    expect(file.isBambooComponent('RandomJsx')).toMatchInlineSnapshot(`false`)
    expect(file.isBambooComponent('random')).toMatchInlineSnapshot('false')
  })

  test('match tag', () => {
    const ctx = createContext()

    const file = ctx.imports.file([{ mod: 'styled-system/recipes', name: 'buttonStyle', alias: 'buttonStyle' }])

    // a recipe's own jsx tag
    expect(file.matchTag('ButtonStyle')).toMatchInlineSnapshot('true')
    // an arbitrary component carries nothing the build can read
    expect(file.matchTag('RandomJsx')).toMatchInlineSnapshot('false')
    expect(file.matchTag('random')).toMatchInlineSnapshot('false')
  })

  test('is valid pattern', () => {
    // works because we have patterns loaded in the context (via preset-base)
    const ctx = createContext()

    const file = ctx.imports.file([
      { mod: 'styled-system/patterns', name: 'stack', alias: 'stack' },
      { mod: 'styled-system/patterns', name: 'vstack', alias: '__vstack' },
    ])

    expect(file.isValidPattern('randxxx')).toMatchInlineSnapshot('false')
    expect(file.isValidPattern('stack')).toMatchInlineSnapshot('true')

    expect(file.isValidPattern('__vstack')).toMatchInlineSnapshot('true')
    expect(file.isValidPattern('vstack')).toMatchInlineSnapshot('true')
  })

  test('is valid recipe', () => {
    const ctx = createContext({
      theme: {
        extend: {
          recipes: {
            button: {},
            badge: {},
          },
        },
      },
    })

    const file = ctx.imports.file([
      { mod: 'styled-system/recipes', name: 'badge', alias: 'badge' },
      { mod: 'styled-system/recipes', name: 'button', alias: 'buttonStyle' },
    ])

    expect(file.isValidRecipe('randxxx')).toMatchInlineSnapshot('false')
    expect(file.isValidRecipe('button')).toMatchInlineSnapshot('true')

    expect(file.isValidRecipe('buttonStyle')).toMatchInlineSnapshot('true')
    expect(file.isValidRecipe('button')).toMatchInlineSnapshot('true')
    expect(file.isValidRecipe('xxxbutton')).toMatchInlineSnapshot('false')
  })

  test('is raw fn', () => {
    const ctx = createContext()

    const file = ctx.imports.file([
      { mod: 'styled-system/css', name: 'css', alias: 'xcss' },
      { mod: 'styled-system/css', name: 'cva', alias: 'cva' },
      { mod: 'styled-system/patterns', name: 'stack', alias: 'stack' },
    ])

    expect(file.isRawFn('css')).toMatchInlineSnapshot('true')
    expect(file.isRawFn('xcss')).toMatchInlineSnapshot('true') // xcss is an alias for css, should be true

    expect(file.isRawFn('css.raw')).toMatchInlineSnapshot('true')
    expect(file.isRawFn('xcss.raw')).toMatchInlineSnapshot('true') // xcss.raw should work too
    expect(file.isRawFn('stack.raw')).toMatchInlineSnapshot('true')

    expect(file.isRawFn('cva.raw')).toMatchInlineSnapshot('true') // cva is imported, should be true
  })

  test('is raw fn with sva aliases', () => {
    const ctx = createContext()

    const file = ctx.imports.file([
      { mod: 'styled-system/css', name: 'css', alias: 'styledCss' },
      { mod: 'styled-system/css', name: 'cva', alias: 'componentVariant' },
      { mod: 'styled-system/css', name: 'sva', alias: 'slotVariant' },
    ])

    // Test aliased css functions
    expect(file.isRawFn('styledCss')).toMatchInlineSnapshot('true')
    expect(file.isRawFn('styledCss.raw')).toMatchInlineSnapshot('true')

    // Test aliased cva functions
    expect(file.isRawFn('componentVariant')).toMatchInlineSnapshot('true')
    expect(file.isRawFn('componentVariant.raw')).toMatchInlineSnapshot('true')

    // Test aliased sva functions
    expect(file.isRawFn('slotVariant')).toMatchInlineSnapshot('true')
    expect(file.isRawFn('slotVariant.raw')).toMatchInlineSnapshot('true')

    // Test non-aliased should still work
    expect(file.isRawFn('css')).toMatchInlineSnapshot('true')
    expect(file.isRawFn('css.raw')).toMatchInlineSnapshot('true')

    // Test non-existent aliases
    expect(file.isRawFn('randomAlias')).toMatchInlineSnapshot('false')
    expect(file.isRawFn('randomAlias.raw')).toMatchInlineSnapshot('false')
  })

  test('namespace', () => {
    const ctx = createContext()

    // import * as p from 'styled-system/patterns'
    const file = ctx.imports.file([{ mod: 'styled-system/patterns', name: 'p', alias: 'p', kind: 'namespace' }])

    expect(file.isValidPattern('p.stack')).toMatchInlineSnapshot(`true`)
    expect(file.isValidPattern('p.grid')).toMatchInlineSnapshot(`true`)
  })

  test('matchTagProp - a recipe variant, and nothing else', () => {
    const ctx = createContext()

    const file = ctx.imports.file([{ mod: 'styled-system/recipes', name: 'buttonStyle', alias: 'buttonStyle' }])

    // a variant the recipe declares
    expect(file.matchTagProp('ButtonStyle', 'size')).toBe(true)

    // with no style props, nothing else on a tag is a style
    expect(file.matchTagProp('ButtonStyle', 'css')).toBe(false)
    expect(file.matchTagProp('ButtonStyle', 'color')).toBe(false)
    expect(file.matchTagProp('ButtonStyle', 'onClick')).toBe(false)
    expect(file.matchTagProp('MyComponent', 'size')).toBe(false)
  })
})
