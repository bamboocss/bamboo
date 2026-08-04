import postcss from 'postcss'
import { pruneTokenVars } from '../src/prune-tokens'

const parse = (css: string) => postcss.parse(css)

const prune = (
  tokenCss: string,
  options: { uses?: string; tokenVars: string[]; keep?: string[] } = { tokenVars: [] },
) => {
  const target = parse(tokenCss)
  const scan = [target, parse(options.uses ?? '')]

  const result = pruneTokenVars({
    scan,
    target,
    tokenVars: new Set(options.tokenVars),
    keep: options.keep ? new Set(options.keep) : undefined,
  })

  return { css: target.toString(), ...result }
}

describe('pruneTokenVars', () => {
  test('drops a token nothing references', () => {
    const { css, removed } = prune(':root{--colors-red-500:#f00;--colors-blue-500:#00f}', {
      uses: '.text_red{color:var(--colors-red-500)}',
      tokenVars: ['--colors-red-500', '--colors-blue-500'],
    })

    expect(css).toMatchInlineSnapshot(`":root{--colors-red-500:#f00}"`)
    expect(removed).toBe(1)
  })

  /**
   * The regression this whole pass has to avoid. `preset-base` declares the filter and
   * gradient composition properties on the universal selector so that a parent's value
   * cannot inherit into a descendant. They look unreferenced, and removing them changes
   * rendering. Only names the token system declares are eligible.
   */
  test('never removes a custom property outside the token set', () => {
    const { css, removed } = prune('*,::before{--blur:/*-*/ /*-*/;--brightness:/*-*/ /*-*/}', {
      tokenVars: ['--colors-red-500'],
    })

    expect(css).toContain('--blur')
    expect(css).toContain('--brightness')
    expect(removed).toBe(0)
  })

  test('keeps a token reached through another token', () => {
    const { css } = prune(':root{--colors-text:var(--colors-gray-600);--colors-gray-600:#555;--colors-gray-100:#eee}', {
      uses: '.c{color:var(--colors-text)}',
      tokenVars: ['--colors-text', '--colors-gray-600', '--colors-gray-100'],
    })

    expect(css).toContain('--colors-text')
    expect(css).toContain('--colors-gray-600')
    // only reachable via the pruned chain, so it goes
    expect(css).not.toContain('--colors-gray-100')
  })

  test('does not treat a reference from an unreachable token as a use', () => {
    const { css, removed } = prune(':root{--a:var(--b);--b:#000}', { tokenVars: ['--a', '--b'] })

    // both go, and the rule left holding nothing goes with them
    expect(css).toMatchInlineSnapshot(`""`)
    expect(removed).toBe(2)
  })

  test('honours the keep set for references it cannot see', () => {
    const { css } = prune(':root{--colors-pink-400:#f0f;--colors-lime-950:#010}', {
      tokenVars: ['--colors-pink-400', '--colors-lime-950'],
      keep: ['--colors-pink-400'],
    })

    expect(css).toContain('--colors-pink-400')
    expect(css).not.toContain('--colors-lime-950')
  })

  test('leaves custom properties declared inside keyframes alone', () => {
    const { css, removed } = prune('@keyframes pulse{from{--colors-red-500:#f00}}', {
      tokenVars: ['--colors-red-500'],
    })

    expect(css).toContain('--colors-red-500')
    expect(removed).toBe(0)
  })

  test('keeps an empty keyframe but drops a rule left empty', () => {
    const { css } = prune('@keyframes spin{}\n:root{--colors-red-500:#f00}', { tokenVars: ['--colors-red-500'] })

    expect(css).toContain('@keyframes spin')
    expect(css).not.toContain(':root')
  })

  test('drops a conditional at-rule left empty, keeping one that still has rules', () => {
    const { css } = prune(
      '@media (prefers-color-scheme:dark){:root{--colors-a:#000}}@media print{:root{--colors-b:#fff}}',
      { uses: '.x{color:var(--colors-b)}', tokenVars: ['--colors-a', '--colors-b'] },
    )

    expect(css).not.toContain('prefers-color-scheme')
    expect(css).toContain('print')
    expect(css).toContain('--colors-b')
  })

  test('reads a reference through whitespace and a fallback', () => {
    const { css } = prune(':root{--colors-red-500:#f00}', {
      uses: '.a{color:var( --colors-red-500 , #fff )}',
      tokenVars: ['--colors-red-500'],
    })

    expect(css).toContain('--colors-red-500')
  })

  test('does nothing when the token set is empty', () => {
    const { css, removed } = prune(':root{--colors-red-500:#f00}', { tokenVars: [] })

    expect(css).toBe(':root{--colors-red-500:#f00}')
    expect(removed).toBe(0)
  })
})
