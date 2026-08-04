import { describe, expect, test } from 'vitest'
import { collectTokenReferences } from '../src/token-references'

const tokenVars: Record<string, string> = {
  'colors.pink.400': 'var(--colors-pink-400)',
  'colors.purple.600': 'var(--colors-purple-600)',
  'spacing.4': 'var(--spacing-4)',
  'spacing.-4': 'calc(var(--spacing-4) * -1)',
}

const createContext = (files: Record<string, string>) =>
  ({
    config: { cwd: '/app' },
    getFiles: () => Object.keys(files),
    runtime: {
      fs: {
        readFileSync: (file: string) => {
          const content = files[file.replace('/app/', '')]
          if (content == null) throw new Error(`ENOENT: ${file}`)
          return content
        },
      },
      path: { abs: (cwd: string, file: string) => `${cwd}/${file}` },
    },
    tokens: { view: { getVar: (path: string) => tokenVars[path] } },
  }) as any

const collect = (files: Record<string, string>, results: any[] = []) =>
  collectTokenReferences(createContext(files), results as any)

describe('collectTokenReferences', () => {
  test('finds token.var(), which the extractor does not report', () => {
    expect(collect({ 'a.tsx': `const c = token.var('colors.pink.400')` })).toEqual(new Set(['--colors-pink-400']))
  })

  test('finds a plain token() call', () => {
    expect(collect({ 'a.tsx': `token('spacing.4')` })).toEqual(new Set(['--spacing-4']))
  })

  test('finds a custom property written by hand', () => {
    const refs = collect({ 'a.tsx': `style={{ color: 'var(--colors-teal-300)' }}` })

    expect(refs).toEqual(new Set(['--colors-teal-300']))
  })

  test('reads through the whitespace a formatter may introduce', () => {
    expect(collect({ 'a.tsx': `token . var ( "colors.purple.600" )` })).toEqual(new Set(['--colors-purple-600']))
  })

  test('ignores a call that merely ends in token', () => {
    expect(collect({ 'a.tsx': `getToken('colors.pink.400'); myToken('spacing.4')` })).toEqual(new Set())
  })

  test('ignores a path that names no token', () => {
    expect(collect({ 'a.tsx': `token('colors.nope.999')` })).toEqual(new Set())
  })

  test('includes paths the extractor resolved, which text alone would miss', () => {
    const results = [{ token: [{ data: ['colors.purple.600'] }] }]

    expect(collect({ 'a.tsx': `token(indirect)` }, results)).toEqual(new Set(['--colors-purple-600']))
  })

  test('survives a file that disappears between glob and read', () => {
    const ctx = createContext({ 'a.tsx': `token('spacing.4')` })
    ctx.getFiles = () => ['a.tsx', 'gone.tsx']

    expect(collectTokenReferences(ctx, [])).toEqual(new Set(['--spacing-4']))
  })

  /**
   * A negative token's value is `calc(var(--spacing-4) * -1)`, so the reference to keep is
   * the positive token's declaration — and reading only the first match would still find
   * it. Guard the general shape instead: every reference in the value, not just one.
   */
  test('keeps every reference in a resolved value, not only the first', () => {
    expect(collect({ 'a.tsx': `token('spacing.-4')` })).toEqual(new Set(['--spacing-4']))
  })
})
