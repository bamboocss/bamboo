import { describe, expect, test } from 'vitest'
import {
  collectKeyframeReferences,
  collectRenderedElements,
  collectTokenReferences,
  tokensReachableFromJs,
} from '../src/token-references'

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

describe('collectRenderedElements', () => {
  const collectElements = (files: Record<string, string>, tracked: Record<string, string> = {}) =>
    collectRenderedElements(createContext(files, tracked))

  test('finds the elements a source file renders', () => {
    expect(collectElements({ 'a.tsx': `<div><span /><br/></div>` })).toEqual(new Set(['div', 'span', 'br']))
  })

  test('ignores a component, which is not an element', () => {
    expect(collectElements({ 'a.tsx': `<Button /><Table>x</Table>` })).toEqual(new Set())
  })

  /**
   * The scan reads whatever `include` covers, not only what the parser understands, so an
   * entry template is reachable by listing it. That matters more than it sounds: `index.html`
   * and `app.html` are where `<table>`, `<noscript>` and the rest of a page's static markup
   * usually live, and the conventional `./src/**` glob does not cover them -- so by default
   * `prunePreflight` drops the reset for every element that appears only there.
   */
  test('reads a non-source file, so an html entry can be listed in include', () => {
    expect(collectElements({ 'index.html': `<body><table><td>x</td></table></body>` })).toEqual(
      new Set(['body', 'table', 'td']),
    )
  })

  /**
   * The limitation, pinned so it stays a known one. Nothing outside `include` is read, and
   * an element that only ever appears there loses its reset with no error and no warning.
   * This is why `prunePreflight` is opt-in and cannot be made a default.
   */
  test('does not see markup that include does not cover', () => {
    const ctx = createContext({ 'a.tsx': `<div />` })
    // On disk, but absent from `getFiles` -- exactly what an unlisted `index.html` is.
    ctx.runtime.fs.readFileSync = (file: string) => (file.endsWith('a.tsx') ? `<div />` : `<table />`)

    expect(collectRenderedElements(ctx)).toEqual(new Set(['div']))
  })

  test('falls back to the project when the file cannot be read from disk', () => {
    expect(collectElements({}, { 'a.tsx': `<article />` })).toEqual(new Set(['article']))
  })

  /**
   * The opposite preference to the other two collectors, and deliberate. `parseSourceFile`
   * replaces an SFC's text with transformed tsx, and every framework transform here is lossy
   * in the same direction: `svelteToTsx` and `vueToTsx` both `catch { return '' }`, a Vue SFC
   * with no `<template>` becomes the literal `<template>undefined</template>`, and svelte
   * strips `<script>`. Each drops every element in the file and takes its reset rules along.
   */
  test('reads the file rather than the transformed copy the project holds', () => {
    const ctx = createContext({ 'a.svelte': `<table><td>x</td></table>` }, { 'a.svelte': `` })

    expect(collectRenderedElements(ctx)).toEqual(new Set(['table', 'td']))
  })

  /** Same reasoning in the other direction: a `parser:before` hook's output still counts. */
  test('finds an element only the parsed copy has', () => {
    const ctx = createContext({ 'a.pug': `table` }, { 'a.pug': `const render = <table />` })

    expect(collectRenderedElements(ctx)).toEqual(new Set(['table']))
  })

  test('finds an element written at the very end of a file', () => {
    expect(collectElements({ 'a.tsx': `<br` })).toEqual(new Set(['br']))
  })

  /**
   * `elementOf` lowercases what it reads out of a selector, so a camel-cased element -- SVG
   * has several -- could never have matched a name stored as written. Uppercase-initial is
   * still ignored entirely: that is a component, not an element.
   */
  test('lowercases, to match how the selector side reads an element', () => {
    expect(collectElements({ 'a.tsx': `<clipPath /><linearGradient />` })).toEqual(
      new Set(['clippath', 'lineargradient']),
    )
  })
})

/**
 * The gate on the blanket keeps in `getAlwaysKeptTokenVars`. When it reads false, the token
 * declarations held open purely so `token()` can answer at runtime are pruned like any other.
 */
describe('tokensReachableFromJs', () => {
  const reachable = (files: Record<string, string>, tracked: Record<string, string> = {}) =>
    tokensReachableFromJs(createContext(files, tracked))

  test.each([
    ['a plain call', `token('spacing.4')`],
    ['token.var()', `const c = token.var('colors.pink.400')`],
    ['an import of the artifact', `import { token } from 'styled-system/tokens'`],
    ['an aliased import of the artifact', `import { token as t } from '@/styled-system/tokens'`],
    ['a relative import', `import { token } from '../../styled-system/tokens'`],
    // `outdir` is configurable, so the artifact is only at `styled-system/` by default. Each
    // of these wrote an import that a literal `styled-system/tokens` match did not see.
    ['a custom outdir', `export { token as designToken } from 'design-system/tokens'`],
    ['a tsconfig path alias', `import { token as t } from '@ds/tokens'`],
    ['a relative import with a custom outdir', `import { token as t } from '../design-system/tokens'`],
    ['the .js extension NodeNext requires', `import { token as t } from '../styled-system/tokens.js'`],
    ['a custom outdir with an extension', `import { token as t } from '../design-system/tokens.mjs'`],
    // The artifact is a directory, so this is the only specifier NodeNext accepts for it.
    ['the directory artifact spelled out', `import { token as t } from 'styled-system/tokens/index.mjs'`],
    ['a relative directory artifact', `export { token } from '../styled-system/tokens/index.js'`],
    ['a require', `const { token: t } = require('@ds/tokens')`],
    ['a dynamic import', `const { token } = await import('@ds/tokens')`],
    // The gate has to see a call a formatter has wrapped, or the alignment below breaks.
    ['a call split across lines', `const c = token\n  .var(KEY)`],
    ['a call with spaces around the dot', `const c = token . var(KEY)`],
  ])('is true for %s', (_label, source) => {
    expect(reachable({ 'a.tsx': source })).toBe(true)
  })

  test('is false when nothing reaches for a token', () => {
    expect(reachable({ 'a.tsx': `const x = 1`, 'b.css': `.a{color:red}` })).toBe(false)
  })

  /**
   * The import test is anchored to an import keyword rather than matching any string with a
   * `/tokens` segment. Without that anchor an ordinary route or link reads as an import of
   * the artifact and switches the whole optimisation off, saying nothing -- and `/tokens` is
   * a common enough url that this repo's own docs would have tripped it.
   */
  test.each([
    ['a fetch of an api route', `await fetch('/api/tokens')`],
    ['a route definition', `router.get('/tokens', handler)`],
    ['a documentation link', `<a href="/docs/theming/tokens">tokens</a>`],
    ['an object key', `const routes = { '/tokens': Page }`],
  ])('is false for %s, which is not an import', (_label, source) => {
    expect(reachable({ 'a.tsx': source })).toBe(false)
  })

  /**
   * A single-file component is stored post-transform, and those transforms lose things --
   * `vueToTsx` keeps only `<script setup>` when both blocks are present, and both plugins
   * return an empty string if the parse throws. So the scan reads the file as well.
   */
  test('sees a call the framework transform dropped', () => {
    const ctx = createContext({ 'a.vue': `<script>token('spacing.4')</script>` }, { 'a.vue': `const render = <div/>` })

    expect(tokensReachableFromJs(ctx)).toBe(true)
  })

  /**
   * And the parsed copy is still read, because `parser:before` is the documented way to teach
   * bamboo a format it does not know -- a template compiled to tsx by such a hook holds
   * nothing the raw file would show.
   */
  test('sees a call only the parsed copy has', () => {
    const ctx = createContext({ 'a.pug': `div= brandColour` }, { 'a.pug': `token('spacing.4')` })

    expect(tokensReachableFromJs(ctx)).toBe(true)
  })

  /**
   * The property the no-results callers rest on, and the reason narrowing the blanket keeps
   * did not break them. `collectTokenReferences` resolves a path only from a string literal,
   * so `token(key)` is invisible to it — and the watch rebuild and the PostCSS plugin pass no
   * parser results to make up the difference. This gate is deliberately looser than that
   * scan: it asks whether a token is reached at all, not which one, so the very shape the
   * scan cannot resolve is the shape that keeps every declaration alive.
   */
  test('is true for a path the reference scan cannot resolve', () => {
    expect(reachable({ 'a.tsx': `const key = 'spacing.4'; token(key)` })).toBe(true)
  })

  /**
   * The same property asserted as a coupling rather than an example, because it is what the
   * callers passing no parser results rest on and it has already been broken once: this file
   * allowed whitespace around the `.` of `token.var` and the gate did not, so a formatter
   * wrapping `token\n  .var(SOME_CONST)` was invisible to both.
   *
   * For every spelling of a call: a path the scan can resolve is resolved, and the same
   * spelling with a path it cannot resolve turns the gate on instead.
   */
  test.each([
    ['token(%)', `token(%)`],
    ['token (%)', `token (%)`],
    ['token.var(%)', `token.var(%)`],
    ['token .var(%)', `token .var(%)`],
    ['token. var(%)', `token. var(%)`],
    ['token . var(%)', `token . var(%)`],
    ['token\\n.var(%)', `token\n  .var(%)`],
    ['token\\n. var(%)', `token\n  . var(%)`],
  ])('the gate covers whatever the reference scan cannot resolve: %s', (_label, spelling) => {
    const literal = spelling.replace('%', `'spacing.4'`)
    const constant = spelling.replace('%', 'KEY')

    // Resolvable: the scan reads the path out, so the gate never has to carry it.
    expect(collect({ 'a.tsx': literal })).toEqual(new Set(['--spacing-4']))

    // Unresolvable: the scan comes up empty, so the gate has to hold every declaration open.
    expect(collect({ 'a.tsx': constant })).toEqual(new Set())
    expect(reachable({ 'a.tsx': constant })).toBe(true)
  })

  /**
   * The known gap, pinned so it stays known. A binding renamed away from `token` matches
   * neither this nor the reference scan, so its declarations are pruned and the call returns
   * a `var()` that nothing declares. Before the gate existed the blanket keeps covered it.
   * It is why an explicit override is worth having.
   */
  test('is false for a binding renamed away from token', () => {
    expect(reachable({ 'a.tsx': `import { token as t } from './tokens-helper'; t('spacing.4')` })).toBe(false)
  })
})
