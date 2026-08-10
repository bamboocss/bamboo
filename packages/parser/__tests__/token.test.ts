import { describe, expect, test } from 'vitest'
import { cssParser, tokenParser } from './fixture'

describe('token extraction and resolution', () => {
  test('should resolve token() used in css() object', () => {
    const code = `
      import { token } from '../styled-system/tokens'
      import { css } from '../styled-system/css'

      const styles = css({
        color: token('colors.red.500'),
        backgroundColor: token('colors.gray.100')
      })
    `
    const result = cssParser(code)

    expect(result.css.size).toBe(1)
    const cssResult = Array.from(result.css)[0]
    expect(cssResult.data).toMatchInlineSnapshot(`
      [
        {
          "backgroundColor": "var(--colors-gray-100)",
          "color": "var(--colors-red-500)",
        },
      ]
    `)
  })

  test('should resolve token() in template literal to match runtime behavior', () => {
    const code = `
      import { token } from '../styled-system/tokens'
      import { css } from '../styled-system/css'

      const styles = css({
        border: \`1px solid \${token('colors.gray.400')}\`
      })
    `
    const result = cssParser(code)

    expect(result.css.size).toBe(1)
    const cssResult = Array.from(result.css)[0]
    // The border value should be resolved as "1px solid #9ca3af", matching runtime
    expect(cssResult.data).toMatchInlineSnapshot(`
      [
        {
          "border": "1px solid var(--colors-gray-400)",
        },
      ]
    `)
  })

  test('should resolve multiple token() calls in css() object', () => {
    const code = `
      import { token } from '../styled-system/tokens'
      import { css } from '../styled-system/css'

      const styles = css({
        color: token('colors.red.500'),
        backgroundColor: token('colors.gray.100'),
        borderColor: token('colors.blue.300')
      })
    `
    const result = cssParser(code)

    expect(result.css.size).toBe(1)
    const cssResult = Array.from(result.css)[0]
    expect(cssResult.data).toMatchInlineSnapshot(`
      [
        {
          "backgroundColor": "var(--colors-gray-100)",
          "borderColor": "var(--colors-blue-300)",
          "color": "var(--colors-red-500)",
        },
      ]
    `)
  })

  test('should resolve token() with custom import path', () => {
    const code = `
      import { token } from '@workspace/styled-system/tokens'
      import { css } from '@workspace/styled-system/css'

      const styles = css({
        padding: token('spacing.4')
      })
    `
    const result = cssParser(code)

    expect(result.css.size).toBe(1)
    const cssResult = Array.from(result.css)[0]
    expect(cssResult.data).toMatchInlineSnapshot(`
      [
        {
          "padding": "var(--spacing-4)",
        },
      ]
    `)
  })

  test('should resolve token() with aliased import', () => {
    const code = `
      import { token as t } from '../styled-system/tokens'
      import { css } from '../styled-system/css'

      const styles = css({
        color: t('colors.green.400')
      })
    `
    const result = cssParser(code)

    expect(result.css.size).toBe(1)
    const cssResult = Array.from(result.css)[0]
    expect(cssResult.data).toMatchInlineSnapshot(`
      [
        {
          "color": "var(--colors-green-400)",
        },
      ]
    `)
  })

  test('should resolve token.var() in css() object', () => {
    const code = `
      import { token } from '../styled-system/tokens'
      import { css } from '../styled-system/css'

      const styles = css({
        color: token.var('colors.blue.500')
      })
    `
    const result = cssParser(code)

    expect(result.css.size).toBe(1)
    const cssResult = Array.from(result.css)[0]
    expect(cssResult.data).toMatchInlineSnapshot(`
      [
        {
          "color": "var(--colors-blue-500)",
        },
      ]
    `)
  })

  test('should resolve token() in nested template literals', () => {
    const code = `
      import { token } from '../styled-system/tokens'
      import { css } from '../styled-system/css'

      const styles = css({
        boxShadow: \`0 0 10px \${token('colors.red.200')}, 0 0 20px \${token('colors.blue.200')}\`
      })
    `
    const result = cssParser(code)

    expect(result.css.size).toBe(1)
    const cssResult = Array.from(result.css)[0]
    expect(cssResult.data).toMatchInlineSnapshot(`
      [
        {
          "boxShadow": "0 0 10px var(--colors-red-200), 0 0 20px var(--colors-blue-200)",
        },
      ]
    `)
  })

  test('should resolve semantic token() to CSS variable for conditional tokens', () => {
    const code = `
      import { token } from '../styled-system/tokens'
      import { css } from '../styled-system/css'

      const styles = css({
        color: token('colors.primary'),
        backgroundColor: token('colors.button.thick')
      })
    `
    const result = cssParser(code)

    expect(result.css.size).toBe(1)
    const cssResult = Array.from(result.css)[0]
    // Semantic tokens with conditions should resolve to CSS variables
    expect(cssResult.data).toMatchInlineSnapshot(`
      [
        {
          "backgroundColor": "var(--colors-button-thick)",
          "color": "var(--colors-primary)",
        },
      ]
    `)
  })

  test('should resolve colorPalette token() to CSS variable', () => {
    const code = `
      import { token } from '../styled-system/tokens'
      import { css } from '../styled-system/css'

      const styles = css({
        color: token('colors.colorPalette.500')
      })
    `
    const result = cssParser(code)

    expect(result.css.size).toBe(1)
    const cssResult = Array.from(result.css)[0]
    // colorPalette tokens are virtual and should resolve to CSS variables
    expect(cssResult.data).toMatchInlineSnapshot(`
      [
        {
          "color": "var(--colors-color-palette-500)",
        },
      ]
    `)
  })

  test('should use fallback value when token() path does not exist', () => {
    const code = `
      import { token } from '../styled-system/tokens'
      import { css } from '../styled-system/css'

      const styles = css({
        color: token('colors.nonexistent.token', '#fallback'),
        backgroundColor: token('spacing.unknown', '2rem')
      })
    `
    const result = cssParser(code)

    expect(result.css.size).toBe(1)
    const cssResult = Array.from(result.css)[0]
    // Should use fallback values when token path doesn't exist
    expect(cssResult.data).toMatchInlineSnapshot(`
      [
        {
          "backgroundColor": "2rem",
          "color": "#fallback",
        },
      ]
    `)
  })

  test('should use fallback value when token.var() path does not exist', () => {
    const code = `
      import { token } from '../styled-system/tokens'
      import { css } from '../styled-system/css'

      const styles = css({
        color: token.var('colors.nonexistent.token', 'var(--fallback-color)'),
        padding: token.var('spacing.unknown', 'var(--fallback-spacing)')
      })
    `
    const result = cssParser(code)

    expect(result.css.size).toBe(1)
    const cssResult = Array.from(result.css)[0]
    // Should use fallback values when token path doesn't exist
    expect(cssResult.data).toMatchInlineSnapshot(`
      [
        {
          "color": "var(--fallback-color)",
          "padding": "var(--fallback-spacing)",
        },
      ]
    `)
  })

  test('should resolve token() with existing path and ignore fallback', () => {
    const code = `
      import { token } from '../styled-system/tokens'
      import { css } from '../styled-system/css'

      const styles = css({
        color: token('colors.red.500', '#ignored'),
        padding: token('spacing.4', '999px')
      })
    `
    const result = cssParser(code)

    expect(result.css.size).toBe(1)
    const cssResult = Array.from(result.css)[0]
    // Should use actual token value and ignore fallback when token exists
    expect(cssResult.data).toMatchInlineSnapshot(`
      [
        {
          "color": "var(--colors-red-500)",
          "padding": "var(--spacing-4)",
        },
      ]
    `)
  })

  test('should resolve token.var() with existing path and ignore fallback', () => {
    const code = `
      import { token } from '../styled-system/tokens'
      import { css } from '../styled-system/css'

      const styles = css({
        color: token.var('colors.blue.500', 'var(--ignored)'),
        margin: token.var('spacing.8', 'var(--also-ignored)')
      })
    `
    const result = cssParser(code)

    expect(result.css.size).toBe(1)
    const cssResult = Array.from(result.css)[0]
    // Should use actual CSS variable and ignore fallback when token exists
    expect(cssResult.data).toMatchInlineSnapshot(`
      [
        {
          "color": "var(--colors-blue-500)",
          "margin": "var(--spacing-8)",
        },
      ]
    `)
  })
})

/**
 * A standalone token call — one whose result is not a style-object value.
 *
 * Inside a style object the extractor resolves the call and the enclosing `css()` entry
 * carries it, which is what the suite above covers. On its own there is no enclosing entry,
 * and for a long time a method call produced no entry at all: the callee is a property
 * access, so the name never matched `matchFn` and the call was dropped before anything
 * downstream could see it. That is what left `token.var()` unfoldable.
 */
describe('standalone token calls', () => {
  const tokenEntries = (code: string) => Array.from(tokenParser(code))

  test('separates the reference from the value', () => {
    const byType = tokenEntries(`
      import { token } from '../styled-system/tokens'

      export const ref = token('colors.blue.500')
      export const alias = token.var('colors.blue.500')
      export const value = token.value('colors.blue.500')
    `).map((item) => [item.type, item.data])

    // `token()` and `token.var()` land in one bucket because they resolve identically. Only
    // `.value` is distinct, and the fold reads that to decide which half to inline.
    expect(byType).toEqual([
      ['token', ['colors.blue.500']],
      ['token', ['colors.blue.500']],
      ['tokenValue', ['colors.blue.500']],
    ])
  })

  test('is recorded under an aliased import', () => {
    const entries = tokenEntries(`
      import { token as t } from '../styled-system/tokens'
      export const ref = t.var('colors.blue.500')
      export const value = t.value('colors.blue.500')
    `)

    expect(entries.map((entry) => entry.type)).toEqual(['token', 'tokenValue'])
  })

  test('resolves a path built from a constant, which a text scan cannot', () => {
    const entries = tokenEntries(`
      import { token } from '../styled-system/tokens'

      const KEY = 'colors.blue.500'
      export const ref = token.var(KEY)
    `)

    // This is what the extractor buys over the regex in `token-references.ts`, which reads
    // `KEY` literally and looks up nothing. Reported here, the token's declaration is kept
    // through pruning by name rather than by the blanket exemption.
    expect(entries).toHaveLength(1)
    expect(entries[0]!.type).toBe('token')
    expect(entries[0]!.data).toEqual(['colors.blue.500'])
  })

  test('is not recorded for a same-named function from somewhere else', () => {
    expect(
      tokenEntries(`
        import { token } from '@acme/design'
        export const ref = token.var('colors.blue.500')
      `),
    ).toHaveLength(0)
  })
})

/**
 * Token calls inside a style object, where the path is not spelled at the call.
 *
 * The top-level fold already followed a constant or a template literal into a token path;
 * inside a style object the resolution required a string literal, so
 * `css({ color: token(BRAND) })` produced no declaration at all for that property while
 * `const c = token(BRAND)` resolved fine. Silently missing css, and the same class as a `.ts`
 * file mis-parsed as tsx: nothing errors, the rule just never exists.
 *
 * The namespaced call is the second half. It asked whether `ds` — the namespace — was a token
 * function, which it never is, so `ds.token(...)` in a style object resolved to nothing too.
 */
describe('token paths inside a style object', () => {
  const styles = (code: string) => Array.from(cssParser(code).css)[0]?.data

  test('resolves a path held in a constant', () => {
    expect(
      styles(`
        import { token } from '../styled-system/tokens'
        import { css } from '../styled-system/css'

        const BRAND = 'colors.blue.500'
        const s = css({ color: token(BRAND) })
      `),
    ).toEqual([{ color: 'var(--colors-blue-500)' }])
  })

  test('resolves a path built as a template literal', () => {
    expect(
      styles(`
        import { token } from '../styled-system/tokens'
        import { css } from '../styled-system/css'

        const SHADE = '500'
        const s = css({ color: token(\`colors.blue.\${SHADE}\`) })
      `),
    ).toEqual([{ color: 'var(--colors-blue-500)' }])
  })

  test('resolves .value through a constant too', () => {
    expect(
      styles(`
        import { token } from '../styled-system/tokens'
        import { css } from '../styled-system/css'

        const SPACE = 'spacing.8'
        const s = css({ margin: token.value(SPACE) })
      `),
    ).toEqual([{ margin: '2rem' }])
  })

  test('resolves a namespaced call', () => {
    expect(
      styles(`
        import * as ds from '../styled-system/tokens'
        import { css } from '../styled-system/css'

        const s = css({ color: ds.token('colors.blue.500') })
      `),
    ).toEqual([{ color: 'var(--colors-blue-500)' }])
  })

  test('resolves a namespaced .value call', () => {
    expect(
      styles(`
        import * as ds from '../styled-system/tokens'
        import { css } from '../styled-system/css'

        const s = css({ margin: ds.token.value('spacing.8') })
      `),
    ).toEqual([{ margin: '2rem' }])
  })

  test('still leaves a genuinely runtime path alone', () => {
    expect(
      styles(`
        import { token } from '../styled-system/tokens'
        import { css } from '../styled-system/css'

        export const make = (shade) => css({ color: token(\`colors.blue.\${shade}\`) })
      `),
    ).toEqual([{}])
  })
})
