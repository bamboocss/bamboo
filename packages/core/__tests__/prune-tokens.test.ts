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

  /**
   * A colour palette maps virtual properties onto real ones. Those virtual properties are
   * not themselves removable, so the walk has to pass through them; stopping there leaves
   * the rule pointing at colours that are no longer declared.
   */
  test('follows a chain through a custom property it cannot remove', () => {
    const { css } = prune(':root{--colors-red-300:#f00;--colors-blue-300:#00f}', {
      uses: '.cp_red{--colors-color-palette-300:var(--colors-red-300)}.c{color:var(--colors-color-palette-300)}',
      tokenVars: ['--colors-red-300', '--colors-blue-300'],
    })

    expect(css).toContain('--colors-red-300')
    expect(css).not.toContain('--colors-blue-300')
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

/**
 * Registrations are derived from the config, so a preset ships its whole set whether or not
 * the app draws a gradient. One for a name the stylesheet neither declares nor reads has
 * nothing to contain, so the same reachability that drops a token declaration drops it.
 */
describe('pruneTokenVars: @property registrations', () => {
  const pruneProps = (baseCss: string, options: { uses?: string; registered: string[]; tokenVars?: string[] }) => {
    const base = parse(baseCss)
    const tokens = parse('')
    const result = pruneTokenVars({
      scan: [base, tokens, parse(options.uses ?? '')],
      target: tokens,
      tokenVars: new Set(options.tokenVars ?? []),
      registeredProperties: new Set(options.registered),
      propertyTarget: base,
    })
    return { css: base.toString(), ...result }
  }

  test('drops a registration for a property nothing declares or reads', () => {
    const { css, removedProperties } = pruneProps('@property --blur{syntax:"*";inherits:false}', {
      registered: ['--blur'],
    })

    expect(css).toBe('')
    expect(removedProperties).toBe(1)
  })

  test('keeps one whose property the stylesheet reads', () => {
    const { css, removedProperties } = pruneProps('@property --blur{syntax:"*";inherits:false}', {
      uses: '.blur_4px{--blur:blur(4px);filter:var(--blur, )}',
      registered: ['--blur'],
    })

    expect(css).toContain('--blur')
    expect(removedProperties).toBe(0)
  })

  /**
   * Why this is a post-pass over the finished sheet rather than a gate on which utility the
   * project used. `--gradient-stops` is declared once, on `backgroundGradient`, and composed
   * by `bgLinear`, `bgRadial`, `bgConic` and `textGradient` — so a project using only
   * `bgRadial` uses the property without using the utility that registers it. Gating on the
   * declaring utility would drop it and let a parent's gradient inherit again.
   */
  test('keeps one composed by a utility other than the one that registered it', () => {
    const { css, removedProperties } = pruneProps('@property --gradient-stops{syntax:"*";inherits:false}', {
      uses: '.bg-radial{--gradient-stops:red,blue;background-image:radial-gradient(var(--gradient-stops))}',
      registered: ['--gradient-stops'],
    })

    expect(css).toContain('--gradient-stops')
    expect(removedProperties).toBe(0)
  })

  test('never removes a registration the utilities did not declare', () => {
    // A user's own, written through `globalVars`. Theirs to keep, the same way `tokenVars`
    // bounds which declarations are eligible above.
    const { css, removedProperties } = pruneProps('@property --mine{syntax:"*";inherits:false}', {
      registered: ['--blur'],
    })

    expect(css).toContain('--mine')
    expect(removedProperties).toBe(0)
  })
})
