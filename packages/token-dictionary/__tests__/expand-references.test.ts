import { expect, test } from 'vitest'
import { TokenDictionary } from '../src/dictionary'

test('expand references in value', () => {
  const dictionary = new TokenDictionary({
    tokens: {
      colors: {
        primary: { value: '#000' },
        red: {
          300: { value: '#red300' },
          500: { value: '#red500' },
        },
        blue: {
          500: { value: '#blue500' },
          700: { value: '#blue700' },
        },
      },
    },
  })

  dictionary.init()

  expect(dictionary.expandReferenceInValue('token(colors.red.300)')).toMatchInlineSnapshot(`"var(--colors-red-300)"`)
})

test('expand references in value - token fn', () => {
  const dictionary = new TokenDictionary({
    tokens: {
      colors: {
        primary: { value: '#000' },
        red: {
          300: { value: '#red300' },
          500: { value: '#red500' },
        },
        blue: {
          500: { value: '#blue500' },
          700: { value: '#blue700' },
        },
      },
    },
  })

  dictionary.init()

  expect(dictionary.expandReferenceInValue('token(colors.red.300)')).toMatchInlineSnapshot(`"var(--colors-red-300)"`)
})

test('expand references in value - multiple token fn', () => {
  const dictionary = new TokenDictionary({
    tokens: {
      colors: {
        primary: { value: '#000' },
        red: {
          300: { value: '#red300' },
          500: { value: '#red500' },
        },
        blue: {
          500: { value: '#blue500' },
          700: { value: '#blue700' },
        },
      },
    },
  })

  dictionary.init()

  expect(dictionary.expandReferenceInValue('token(colors.red.300) token(colors.blue.500)')).toMatchInlineSnapshot(
    `"var(--colors-red-300) var(--colors-blue-500)"`,
  )
})

test('expand references in value - token fn with var fallback', () => {
  const dictionary = new TokenDictionary({
    tokens: {
      colors: {
        primary: { value: '#000' },
        red: {
          300: { value: '#red300' },
          500: { value: '#red500' },
        },
        blue: {
          500: { value: '#blue500' },
          700: { value: '#blue700' },
        },
      },
    },
  })

  dictionary.init()

  expect(dictionary.expandReferenceInValue('token(colors.red.300, var(--some-var))')).toMatchInlineSnapshot(
    `"token(colors.red.300, var(--some-var))"`,
  )
})

test('expand references in value - token fn with var fallback that also has a fallback', () => {
  const dictionary = new TokenDictionary({
    tokens: {
      colors: {
        primary: { value: '#000' },
        red: {
          300: { value: '#red300' },
          500: { value: '#red500' },
        },
        blue: {
          500: { value: '#blue500' },
          700: { value: '#blue700' },
        },
      },
    },
  })

  dictionary.init()

  expect(dictionary.expandReferenceInValue('token(colors.red.300, var(--some-var, purple))')).toMatchInlineSnapshot(
    `"token(colors.red.300, var(--some-var, purple))"`,
  )
})

test('expand references in value - token fn with var fallback that also has a var fallback', () => {
  const dictionary = new TokenDictionary({
    tokens: {
      colors: {
        primary: { value: '#000' },
        red: {
          300: { value: '#red300' },
          500: { value: '#red500' },
        },
        blue: {
          500: { value: '#blue500' },
          700: { value: '#blue700' },
        },
      },
    },
  })

  dictionary.init()

  expect(
    dictionary.expandReferenceInValue('token(colors.red.300, var(--some-var, var(--another-var, purple)))'),
  ).toMatchInlineSnapshot(`"token(colors.red.300, var(--some-var, var(--another-var, purple)))"`)
})

test('expand references in value - duplicate ref with special characters', () => {
  const dictionary = new TokenDictionary({
    tokens: {
      sizes: {
        0.5: { value: '0.125rem' },
      },
    },
  })

  dictionary.init()

  expect(
    dictionary.expandReferenceInValue('0 token(sizes.0.5) token(sizes.0.5) rgba(92, 225, 113, 0.25)'),
  ).toMatchInlineSnapshot(`"0 var(--sizes-0\\.5) var(--sizes-0\\.5) rgba(92, 225, 113, 0.25)"`)
})
