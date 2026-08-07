import { describe, expect, test } from 'vitest'
import { collectKeyframeReferences, collectTokenReferences } from '../src/token-references'

const tokenVars: Record<string, string> = {
  'colors.pink.400': 'var(--colors-pink-400)',
  'colors.purple.600': 'var(--colors-purple-600)',
  'spacing.4': 'var(--spacing-4)',
  'spacing.-4': 'calc(var(--spacing-4) * -1)',
}

/**
 * `files` sit on disk; `tracked` are the ones the project has already parsed and holds in
 * memory. Most tests leave the project empty so the disk fallback stays exercised.
 */
const createContext = (files: Record<string, string>, tracked: Record<string, string> = {}) =>
  ({
    config: { cwd: '/app' },
    getFiles: () => Object.keys({ ...files, ...tracked }),
    project: {
      getSourceFile: (file: string) => {
        const content = tracked[file.replace('/app/', '')]
        return content == null ? undefined : { getFullText: () => content }
      },
    },
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

  test('reads text the project already holds instead of going to disk', () => {
    // Absent from `files`, so a disk read would throw ENOENT and skip the file.
    const ctx = createContext({}, { 'a.tsx': `token.var('colors.pink.400')` })

    expect(collectTokenReferences(ctx, [])).toEqual(new Set(['--colors-pink-400']))
  })

  test('falls back to disk for a file the project does not track', () => {
    const ctx = createContext({ 'styles.css': `.a{color:var(--colors-teal-300)}` }, { 'a.tsx': `token('spacing.4')` })

    expect(collectTokenReferences(ctx, [])).toEqual(new Set(['--colors-teal-300', '--spacing-4']))
  })
})

/**
 * The keyframes half, which had no test at all.
 *
 * `pruneKeyframes` drops any `@keyframes` the theme declares but nothing references, so a
 * name this fails to find is an animation that stops working in production and not in dev —
 * the stylesheet is smaller and the element simply never animates. A name it finds when it
 * should not only costs bytes, so the two directions are not symmetric: a false negative is
 * a bug, a false positive is waste.
 */
describe('collectKeyframeReferences', () => {
  const collectKeyframes = (files: Record<string, string>, names: string[], tracked: Record<string, string> = {}) =>
    collectKeyframeReferences(createContext(files, tracked), names)

  test('finds a name used in a file', () => {
    expect(collectKeyframes({ 'a.tsx': `css({ animation: 'spin 1s linear' })` }, ['spin'])).toEqual(new Set(['spin']))
  })

  test('does not match a name that is only part of a longer word', () => {
    // The reason the match is word-bounded: `spinner` must not keep `spin` alive.
    expect(collectKeyframes({ 'a.tsx': `const spinner = 1` }, ['spin'])).toEqual(new Set())
  })

  test('matches a name adjacent to punctuation rather than whitespace', () => {
    expect(collectKeyframes({ 'a.tsx': `animation:'fade-in 1s'` }, ['fade-in'])).toEqual(new Set(['fade-in']))
  })

  test('finds several names across several files', () => {
    const files = { 'a.tsx': `animation: 'spin'`, 'b.tsx': `animation: 'pulse'` }
    expect(collectKeyframes(files, ['spin', 'pulse', 'wiggle'])).toEqual(new Set(['spin', 'pulse']))
  })

  test('declares nothing when the theme declares nothing', () => {
    // Returns before touching the filesystem at all.
    expect(collectKeyframes({ 'a.tsx': `animation: 'spin'` }, [])).toEqual(new Set())
  })

  test('reads text the project already holds instead of going to disk', () => {
    expect(collectKeyframes({}, ['spin'], { 'a.tsx': `animation: 'spin'` })).toEqual(new Set(['spin']))
  })

  test('skips a file it cannot read rather than failing the build', () => {
    // `b.tsx` is listed by `getFiles` but absent from both the project and disk, so reading
    // it throws. The name in `a.tsx` still has to be found.
    const ctx = createContext({ 'a.tsx': `animation: 'spin'` }, {})
    ctx.getFiles = () => ['missing.tsx', 'a.tsx']

    expect(collectKeyframeReferences(ctx, ['spin'])).toEqual(new Set(['spin']))
  })

  test('a name containing regex syntax is matched literally', () => {
    // `escapeRegExp` exists for this: an unescaped `.` would match any character, so
    // `fade.in` would be kept alive by `fadeXin`.
    expect(collectKeyframes({ 'a.tsx': `animation: 'fadeXin'` }, ['fade.in'])).toEqual(new Set())
    expect(collectKeyframes({ 'a.tsx': `animation: 'fade.in'` }, ['fade.in'])).toEqual(new Set(['fade.in']))
  })

  test('stops scanning once every declared name is accounted for', () => {
    // The early exit is a performance guarantee, so it is asserted by observation: a file
    // after the last match must not be read.
    const read: string[] = []
    const ctx = createContext({ 'a.tsx': `animation: 'spin'`, 'z.tsx': `nothing` }, {})
    const original = ctx.runtime.fs.readFileSync
    ctx.runtime.fs.readFileSync = (file: string) => {
      read.push(file)
      return original(file)
    }

    collectKeyframeReferences(ctx, ['spin'])
    expect(read.some((file) => file.endsWith('z.tsx'))).toBe(false)
  })
})
