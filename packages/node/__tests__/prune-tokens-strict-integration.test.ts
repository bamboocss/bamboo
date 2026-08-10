import { createContext as createFixtureContext } from '@bamboocss/fixture'
import { describe, expect, test } from 'vitest'
import type { BambooContext } from '../src/create-context'
import { pruneTokensForBuild } from '../src/token-references'

/**
 * `pruneUnusedTokens: 'strict'` end to end, against the real prune and the emitted css.
 *
 * Every other test of this feature stubs `ctx.pruneTokens` and asserts the arguments it was
 * handed. That proves the accounting decided correctly and nothing about what ships — and no
 * sandbox sets the flag, so until this file the whole path had never run against a real
 * stylesheet. The one severe bug a reviewer found in it, a throw swallowed by the watcher, was
 * invisible for exactly that reason: nothing executed the code, only its inputs.
 *
 * So this builds a real sheet, prunes it for real, and reads the css that comes out.
 */
const FILE = 'app/src/app.tsx'

const buildCss = (source: string, pruneUnusedTokens: boolean | 'strict' = 'strict') => {
  const ctx = createFixtureContext({
    pruneUnusedTokens,
    // Stands in for what extraction would contribute, so the sheet has a utility layer.
    staticCss: { css: [{ properties: { color: ['red.300'] } }] },
    // A custom property exported for something outside the stylesheet to read. Nothing in the
    // css references `--brand`, so the colour behind it looks unreachable — this is the shape
    // that stranded one, and the only way the dangling check below can fail at all. Without
    // it every `var()` in the sheet is a *direct* reference, which `pruneTokenVars` roots by
    // construction and which therefore cannot dangle however badly the pass is broken.
    globalCss: { ':root': { '--brand': 'token(colors.pink.500)' } },
  }) as unknown as BambooContext

  const absolute = ctx.runtime.path.abs(ctx.config.cwd, FILE)
  ctx.project.addSourceFile(absolute, source)
  ctx.getFiles = () => [FILE]
  ctx.runtime = { ...ctx.runtime, fs: { ...ctx.runtime.fs, readFileSync: () => source } } as BambooContext['runtime']

  const sheet = ctx.createSheet()
  ctx.appendLayerParams(sheet)
  ctx.appendBaselineCss(sheet)

  pruneTokensForBuild(ctx, sheet, [])

  return ctx.getCss(sheet)
}

const declares = (css: string, name: string) => new RegExp(`\\${name}\\s*:`).test(css)
const declarationCount = (css: string) => [...css.matchAll(/(--[a-z0-9-]+)\s*:/g)].length

const imports = "import { token } from 'styled-system/tokens'\n"

describe('pruneUnusedTokens: strict, against the emitted css', () => {
  /**
   * The whole point of the flag. Reaching for a token from javascript keeps every declaration
   * under the default; asserting that the paths resolve keeps only what is asked for.
   */
  /**
   * Through an *aliased* import. The plain spelling proves less than it appears to: the
   * non-strict text scan matches `token('…')` literally and adds the path itself, so the
   * assertion survives deleting the strict accounting's entire contribution to the keep set.
   * `t('…')` is invisible to that regex, so only the accounting can keep it — which is the
   * "accepted implies recorded" invariant this whole feature rests on.
   */
  test('a resolved path keeps its token and drops the rest', () => {
    const css = buildCss(`import { token as t } from 'styled-system/tokens'\nexport const brand = t('colors.blue.500')`)

    expect(declares(css, '--colors-blue-500')).toBe(true)
    // Not pink: `globalCss` exports `--brand: var(--colors-pink-500)`, so that one is kept on
    // its own merits and asserting its absence would be asserting a bug.
    expect(declares(css, '--colors-teal-500')).toBe(false)
  })

  test('the default keeps everything for the same source', () => {
    const strict = buildCss(`${imports}export const brand = token('colors.blue.500')`)
    const relaxed = buildCss(`${imports}export const brand = token('colors.blue.500')`, true)

    expect(declares(relaxed, '--colors-teal-500')).toBe(true)
    expect(declarationCount(strict)).toBeLessThan(declarationCount(relaxed))
  })

  /**
   * A template with a static head cannot name one token, but it bounds what it can reach — so
   * the category survives and everything else goes. Asserted on the stylesheet rather than on
   * the keep set, because a prefix that matched the keep set and not the emitted declarations
   * would be exactly the silent failure this feature exists to avoid.
   */
  test('a bounded path keeps its category and nothing else', () => {
    const css = buildCss(`${imports}export const brand = (s) => token(\`colors.\${s}\`)`)

    expect(declares(css, '--colors-blue-500')).toBe(true)
    expect(declares(css, '--colors-pink-500')).toBe(true)
    // A different category the expression cannot reach. Not `--spacing-4`: the negative margin
    // in `staticCss` references it through `calc(var(--spacing-4) * -1)`, so the css scan keeps
    // it on its own merits and asserting its absence would be asserting a bug.
    expect(declares(css, '--spacing-16')).toBe(false)
    expect(declares(css, '--font-sizes-3xl')).toBe(false)
  })

  test('a path the build cannot follow fails the build', () => {
    expect(() => buildCss(`${imports}export const brand = (p) => token(p)`)).toThrow(/could not be resolved/)
  })

  /**
   * Every `var()` the surviving stylesheet references must still have a declaration behind it.
   * This is the property that matters — everything above is a proxy for it — and it is cheap
   * to check directly once the css is in hand.
   */
  test.each([
    ['a resolved path', `${imports}export const brand = token('colors.blue.500')`],
    ['a bounded path', `${imports}export const brand = (s) => token(\`colors.\${s}\`)`],
    ['a bounded negative', `${imports}export const gutter = (s) => token(\`spacing.\${s}\`)`],
  ])('leaves no dangling token variable — %s', (_label, source) => {
    const css = buildCss(source)

    // `\\.` is part of the name: the fixture declares `--spacing-0\\.5` and friends, and a
    // pattern stopping at the backslash would read a dangling `var(--spacing-4\\.5)` as a live
    // reference to the declared `--spacing-4`.
    const declared = new Set([...css.matchAll(/(--[a-z0-9\\.-]+)\s*:/g)].map((match) => match[1]))
    const referenced = [...css.matchAll(/var\(\s*(--[a-z0-9\\.-]+)/g)].map((match) => match[1])

    const dangling = referenced.filter((name) => !declared.has(name!))

    expect([...new Set(dangling)]).toEqual([])
  })
})
