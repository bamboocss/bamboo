import { expect, test } from 'vitest'
import { TokenDictionary } from '../src/dictionary'

test('color-mix', () => {
  const dictionary = new TokenDictionary({
    tokens: {
      colors: {
        pink: { value: '#ff00ff' },
        border: { value: 'token(colors.pink/30)' },
        ref: { value: 'token(colors.border/40)' },
      },
      opacity: {
        half: { value: 0.5 },
      },
    },
  })

  dictionary.init()

  expect(dictionary.expandReferenceInValue('token(colors.pink/30)')).toMatchInlineSnapshot(
    `"color-mix(in srgb, var(--colors-pink) 30%, transparent)"`,
  )
  expect(dictionary.expandReferenceInValue('token(colors.border/40)')).toMatchInlineSnapshot(
    `"color-mix(in srgb, var(--colors-border) 40%, transparent)"`,
  )
  expect(dictionary.expandReferenceInValue('token(colors.border/half)')).toMatchInlineSnapshot(
    `"color-mix(in srgb, var(--colors-border) 50%, transparent)"`,
  )

  expect(dictionary.view.vars).toMatchInlineSnapshot(`
    Map {
      "base" => Map {
        "--colors-pink" => "#ff00ff",
        "--colors-border" => "color-mix(in srgb, var(--colors-pink) 30%, transparent)",
        "--colors-ref" => "color-mix(in srgb, var(--colors-border) 40%, transparent)",
        "--opacity-half" => 0.5,
      },
    }
  `)
})

test('color-mix with semanticTokens', () => {
  const dictionary = new TokenDictionary({
    tokens: {
      colors: {
        black: { value: 'black' },
        white: { value: 'white' },
      },
    },
    semanticTokens: {
      colors: {
        fg: {
          default: {
            value: { base: 'token(colors.black/87)', _dark: 'token(colors.white)' },
          },
        },
      },
    },
  })

  dictionary.init()

  expect(dictionary.expandReferenceInValue('token(colors.black/87)')).toMatchInlineSnapshot(
    `"color-mix(in srgb, var(--colors-black) 87%, transparent)"`,
  )

  expect(dictionary.view.vars).toMatchInlineSnapshot(`
    Map {
      "base" => Map {
        "--colors-black" => "black",
        "--colors-white" => "white",
        "--colors-fg-default" => "color-mix(in srgb, var(--colors-black) 87%, transparent)",
      },
      "_dark:value" => Map {
        "--colors-fg-default" => "var(--colors-white)",
      },
    }
  `)
})
