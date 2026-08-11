import { createContext } from '@bamboocss/fixture'
import { describe, expect, test } from 'vitest'

/**
 * `css(recipe.raw(props), …)` — a composition the build reads as the identity `css.raw` means.
 *
 * `.raw` on a recipe or a pattern takes *props* and returns *styles*. Reading it as the
 * identity composes the props instead, so the recipe's own declarations never reach the
 * stylesheet and its variant names are handed to the encoder as though they were properties.
 * The browser then asks for classes no rule backs and the element renders without them.
 *
 * Nothing here resolves that — running the recipe at extraction time to get it right is a
 * larger change, and emitting the wrong styles would be worse than emitting none. What these
 * pin is that it is no longer *silent*.
 */
const parse = (code: string) => {
  const ctx: any = createContext({})
  ctx.project.addSourceFile('app/src/test.tsx', code)
  const result = ctx.project.parseSourceFile('app/src/test.tsx')
  return {
    unresolved: (result?.unresolved ?? []) as Array<{ reason: string; prop?: string }>,
    css: () => {
      const sheet = ctx.createSheet()
      ctx.appendParserCss(sheet)
      return ctx.getCss(sheet)
    },
  }
}

describe('a raw composition the build cannot resolve', () => {
  test.each([
    [
      'an inline recipe',
      `import { css, cva } from 'styled-system/css'\nconst textInput = cva({ base: { color: 'red.300' } })\nexport const a = css(textInput.raw(), { fontFamily: 'monospace' })`,
      'textInput',
    ],
    [
      'a config recipe',
      `import { css } from 'styled-system/css'\nimport { buttonStyle } from 'styled-system/recipes'\nexport const a = css(buttonStyle.raw({ size: 'sm' }), { fontFamily: 'monospace' })`,
      'buttonStyle',
    ],
    [
      'a pattern',
      `import { css } from 'styled-system/css'\nimport { flex } from 'styled-system/patterns'\nexport const a = css(flex.raw({ gap: '4' }), { fontFamily: 'monospace' })`,
      'flex',
    ],
  ])('%s is reported', (_label, code, prop) => {
    const { unresolved } = parse(code)

    expect(unresolved.map((entry) => `${entry.reason}:${entry.prop}`)).toContain(`unresolved-raw:${prop}`)
  })

  /** The one `.raw` the identity is right for: it returns the object it was handed. */
  test('css.raw composition is not reported, and does reach the stylesheet', () => {
    const { unresolved, css } = parse(
      `import { css } from 'styled-system/css'\nconst base = css.raw({ color: 'red.300' })\nexport const a = css(base, { fontFamily: 'monospace' })`,
    )

    expect(unresolved).toEqual([])
    expect(css()).toContain('c_red\\.300')
  })

  /** Calling the recipe is the shape that works — and it is what the diagnostic points at. */
  test('calling the recipe is not reported', () => {
    const { unresolved } = parse(
      `import { cva, cx, css } from 'styled-system/css'\nconst textInput = cva({ base: { color: 'red.300' } })\nexport const a = cx(textInput({}), css({ fontFamily: 'monospace' }))`,
    )

    expect(unresolved).toEqual([])
  })
})
