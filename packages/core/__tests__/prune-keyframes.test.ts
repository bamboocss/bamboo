import postcss, { type Container } from 'postcss'
import { describe, expect, test } from 'vitest'
import { pruneKeyframes } from '../src/prune-keyframes'

/**
 * Keyframe pruning is opt-in and one-directional: it can only make the stylesheet
 * smaller, and the failure it must never produce is an animation that plays against a
 * `@keyframes` that is no longer there. Every case below is either "this is genuinely
 * unreachable" or "this looks unreachable but is not".
 */
const build = (css: string) => postcss.parse(css) as unknown as Container

const prune = (
  target: string,
  scan: string[] = [],
  names: string[] = ['fade-in', 'spin', 'slide-up'],
  keep?: string[],
  reachableVars?: Set<string> | 'all',
) => {
  const targetRoot = build(target)
  const result = pruneKeyframes({
    scan: [targetRoot, ...scan.map(build)],
    target: targetRoot,
    keyframeNames: new Set(names),
    keep: keep ? new Set(keep) : undefined,
    reachableVars,
  })
  return { css: targetRoot.toString(), ...result }
}

const KEYFRAMES = `
@keyframes fade-in { from { opacity: 0 } to { opacity: 1 } }
@keyframes spin { to { transform: rotate(360deg) } }
@keyframes slide-up { from { translate: 0 8px } }
`

describe('unreachable keyframes are removed', () => {
  test('nothing references anything', () => {
    const { css, removed } = prune(KEYFRAMES)

    expect(removed).toBe(3)
    expect(css).not.toContain('@keyframes')
  })

  test('only the unreferenced ones go', () => {
    const { css, removed } = prune(KEYFRAMES, ['.a { animation-name: spin }'])

    expect(removed).toBe(2)
    expect(css).toContain('@keyframes spin')
    expect(css).not.toContain('@keyframes fade-in')
  })

  test('a keyframe the theme does not declare is never touched', () => {
    const css = `@keyframes vendor-thing { from { opacity: 0 } }`
    const result = prune(css, [], ['fade-in'])

    // Only names in the allow-list are removable, so a `globalCss` keyframe survives.
    expect(result.removed).toBe(0)
    expect(result.css).toContain('@keyframes vendor-thing')
  })

  test('an empty allow-list is a no-op', () => {
    const result = prune(KEYFRAMES, [], [])

    expect(result.removed).toBe(0)
    expect(result.css).toContain('@keyframes fade-in')
  })
})

describe('references that must keep a keyframe alive', () => {
  const cases: Array<{ name: string; decl: string }> = [
    { name: 'animation-name', decl: '.a { animation-name: fade-in }' },
    { name: 'shorthand, name last', decl: '.a { animation: 1s ease-out fade-in }' },
    { name: 'shorthand, name first', decl: '.a { animation: fade-in 1s ease-out }' },
    { name: 'shorthand with every longhand', decl: '.a { animation: 3s ease-in 1s 2 reverse both paused fade-in }' },
    { name: 'comma-separated list, first', decl: '.a { animation-name: fade-in, other }' },
    { name: 'comma-separated list, second', decl: '.a { animation-name: other, fade-in }' },
    { name: 'two animations in one shorthand', decl: '.a { animation: 1s fade-in, 2s other }' },
    { name: 'vendor-prefixed property', decl: '.a { -webkit-animation-name: fade-in }' },
    { name: 'uppercase property', decl: '.a { ANIMATION-NAME: fade-in }' },
    { name: 'through a used custom property', decl: ':root { --enter: fade-in 1s } .a { animation: var(--enter) }' },
    {
      name: 'through a chain of used custom properties',
      decl: ':root { --enter: fade-in 1s; --motion: var(--enter) } .a { animation: var(--motion) }',
    },
    { name: 'inside a media query', decl: '@media (min-width: 40rem) { .a { animation: fade-in 1s } }' },
    {
      name: 'inside a nested at-rule',
      decl: '@supports (display: grid) { @media print { .a { animation: fade-in 1s } } }',
    },
    { name: 'inside the keyframe layer itself', decl: '.a { animation: fade-in 1s }' },
  ]

  test.each(cases)('$name', ({ decl }) => {
    const { css } = prune(KEYFRAMES, [decl])

    expect(css).toContain('@keyframes fade-in')
  })

  test('an explicit keep entry survives with no css reference at all', () => {
    const { css, removed } = prune(KEYFRAMES, [], ['fade-in', 'spin', 'slide-up'], ['fade-in'])

    expect(removed).toBe(2)
    expect(css).toContain('@keyframes fade-in')
  })
})

describe('name matching', () => {
  test('a longer name containing a declared one does not keep it', () => {
    // `fade-in-slow` is a different animation; it must not rescue `fade-in`.
    const { css } = prune(KEYFRAMES, ['.a { animation-name: fade-in-slow }'])

    expect(css).not.toContain('@keyframes fade-in')
  })

  test('a declared name appearing in a non-animation property does not keep it', () => {
    const { css } = prune(KEYFRAMES, ['.a { content: "spin" }'])

    expect(css).not.toContain('@keyframes spin')
  })

  test('an unreferenced custom property does not keep a keyframe alive', () => {
    // The case that decides whether this pass is worth having. A preset declares
    // `--animations-spin: spin 1s linear infinite` whether or not anything uses that
    // token; reading the declaration as a reference keeps every keyframe it ships.
    const { css } = prune(KEYFRAMES, [':root { --animations-spin: spin 1s linear infinite }'])

    expect(css).not.toContain('@keyframes spin')
  })

  test('a surviving custom property keeps the keyframe it names', () => {
    // The other half of the case above, and the one that was wrong. `pruneTokenVars` roots
    // reachability at what the css references *plus* what is reachable from outside it —
    // a `token()` call, a `prune.keepTokens` pattern, a theme, a `globalCss` export. So a
    // declaration nothing in the sheet points at can still ship, and deleting the keyframe
    // it names strands it: valid css, and the animation never plays.
    const scan = [':root { --animations-spin: spin 1s linear infinite }']
    const { css, removed } = prune(KEYFRAMES, scan, undefined, undefined, new Set(['--animations-spin']))

    expect(css).toContain('@keyframes spin')
    // Only that one. A survivor is not a licence to keep the rest.
    expect(removed).toBe(2)
  })

  test('reachability follows a chain of surviving custom properties', () => {
    const scan = [':root { --enter: var(--drawer-in); --drawer-in: fade-in 400ms }']
    const { css } = prune(KEYFRAMES, scan, undefined, undefined, new Set(['--enter']))

    expect(css).toContain('@keyframes fade-in')
  })

  test("`'all'` keeps every keyframe a declaration names", () => {
    // What "no token pass ran" means: nothing was removed, so every declaration in the
    // sheet is still standing and every keyframe one of them names ships with it.
    const scan = [':root { --animations-spin: spin 1s linear infinite }']
    const { css } = prune(KEYFRAMES, scan, undefined, undefined, 'all')

    expect(css).toContain('@keyframes spin')
    expect(css).not.toContain('@keyframes fade-in')
  })

  test('a keyframe named like a keyword errs toward keeping', () => {
    // `ease` as a name is indistinguishable from `ease` as a timing function without
    // parsing the shorthand grammar. Keeping it is the safe read.
    const target = `@keyframes ease { from { opacity: 0 } }`
    const result = prune(target, ['.a { animation: 1s ease other }'], ['ease'])

    expect(result.removed).toBe(0)
  })
})

describe('prefixed rules', () => {
  test('a prefixed keyframe is removed with its standard twin', () => {
    const target = `
      @keyframes fade-in { from { opacity: 0 } }
      @-webkit-keyframes fade-in { from { opacity: 0 } }
    `
    const result = prune(target, [], ['fade-in'])

    expect(result.removed).toBe(2)
    expect(result.css).not.toContain('keyframes')
  })

  test('a prefixed keyframe is kept when the standard one is referenced', () => {
    const target = `
      @keyframes fade-in { from { opacity: 0 } }
      @-webkit-keyframes fade-in { from { opacity: 0 } }
    `
    const result = prune(target, ['.a { animation: fade-in 1s }'], ['fade-in'])

    expect(result.removed).toBe(0)
  })
})

describe('reporting', () => {
  test('counts what it removed and what it kept', () => {
    const result = prune(KEYFRAMES, ['.a { animation: spin 1s }'])

    expect(result).toMatchObject({ removed: 2, kept: 1 })
  })
})

describe('quoted names', () => {
  // `animation-name` accepts `<custom-ident> | <string>`, so the name may be quoted.
  test.each([
    ['double quotes', '.a { animation-name: "fade-in" }'],
    ['single quotes', ".a { animation-name: 'fade-in' }"],
    ['quoted inside a list', '.a { animation-name: other, "fade-in" }'],
  ])('%s keeps the keyframe', (_name, decl) => {
    const { css } = prune(KEYFRAMES, [decl])

    expect(css).toContain('@keyframes fade-in')
  })
})

describe('keyframe steps', () => {
  test('a step naming another keyframe keeps it', () => {
    const target = `
      @keyframes fade-in { from { animation: spin 1s } }
      @keyframes spin { to { transform: rotate(360deg) } }
    `
    const { css } = prune(target, ['.a { animation: fade-in 1s }'], ['fade-in', 'spin'])

    expect(css).toContain('@keyframes spin')
  })
})
