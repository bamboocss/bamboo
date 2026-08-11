import { createContext } from '@bamboocss/fixture'
import { logger } from '@bamboocss/logger'
import { afterEach, describe, expect, test, vi } from 'vitest'

/**
 * `unresolvedToken` grades a style value shaped like a token path that names no token.
 *
 * The value is emitted as written — `background: 'accent.default'` ships as
 * `background: accent.default` — which parses, so the stylesheet is valid and no build step
 * objects. The browser drops the declaration at compute time and the style is simply absent,
 * surfacing as "this colour never applied" a long way from the typo that caused it. That
 * warned on every build with no way to escalate: `validation` grades the config rather than
 * the source, and `prune.unresolvedPath` is about a `token()` call the prune scan cannot
 * follow, which is a different question about a token that usually exists.
 *
 * Driven through a real build rather than by calling `transform` directly. The two disagree:
 * the decoder memoizes each atom by hash, so on the second build of the same source
 * `transform` is not re-entered at all — which is exactly the case an earlier version of this
 * check got wrong, passing a build whose source was still broken.
 */
const build = (severity: 'off' | 'warn' | 'error' | undefined, source: string) => {
  const ctx = createContext(severity ? ({ unresolvedToken: severity } as any) : undefined) as any
  const files: string[] = []

  const write = (src: string) => {
    const file = ctx.runtime.path.abs(ctx.config.cwd, 'src/app.tsx')
    const existing = ctx.project.getSourceFile(file)
    if (existing) existing.replaceWithText(src)
    else ctx.project.addSourceFile(file, src)
    if (!files.includes(file)) files.push(file)
  }

  ctx.getFiles = () => files
  write(source)

  const run = () => {
    ctx.parseFiles()
    const sheet = ctx.createSheet()
    ctx.appendBaselineCss(sheet)
    ctx.appendParserCss(sheet)
    return ctx.getCss(sheet)
  }

  return { ctx, run, write }
}

const styled = (value: string, prop = 'background') => `
  import { css } from 'styled-system/css'
  export const App = () => <div className={css({ ${prop}: '${value}' })} />
`

const messages = (spy: ReturnType<typeof vi.spyOn>) => spy.mock.calls.map((c: unknown[]) => String(c[1])).join('\n')

afterEach(() => vi.restoreAllMocks())

describe('default', () => {
  test("is 'warn' — what it did before the option existed", () => {
    const spy = vi.spyOn(logger, 'warn').mockImplementation(() => {})
    const { run } = build(undefined, styled('accent.default'))

    expect(() => run()).not.toThrow()
    expect(messages(spy)).toMatch(/Unknown token `accent.default`/)
  })
})

describe("'off'", () => {
  test('says nothing and does not fail', () => {
    const spy = vi.spyOn(logger, 'warn').mockImplementation(() => {})
    const { run } = build('off', styled('accent.default'))

    expect(() => run()).not.toThrow()
    expect(messages(spy)).not.toMatch(/Unknown token/)
  })

  test('the css is unchanged — the option grades a report, not the output', () => {
    const off = build('off', styled('accent.default'))
    vi.spyOn(logger, 'warn').mockImplementation(() => {})
    const warn = build('warn', styled('accent.default'))

    expect(off.run()).toBe(warn.run())
  })
})

describe("'error'", () => {
  test('fails the build, naming the property and the value', () => {
    const { run } = build('error', styled('accent.default'))

    expect(() => run()).toThrowError(/`background: accent.default`/)
  })

  test('names the category to check the path against', () => {
    const { run } = build('error', styled('accent.default'))

    expect(() => run()).toThrowError(/`colors` tokens/)
  })

  test('does not also warn, which would report every finding twice', () => {
    const spy = vi.spyOn(logger, 'warn').mockImplementation(() => {})
    const { run } = build('error', styled('accent.default'))

    expect(() => run()).toThrow()
    expect(messages(spy)).not.toMatch(/Unknown token/)
  })

  test('reports one finding per mistake, not one per condition', () => {
    const { run } = build(
      'error',
      `
      import { css } from 'styled-system/css'
      export const App = () => (
        <div className={css({ background: { base: 'accent.default', _hover: 'accent.default', md: 'accent.default' } })} />
      )
      `,
    )

    expect(() => run()).toThrowError(/^1 style value\(s\)/)
  })

  test('collects every distinct mistake into one report', () => {
    const { run } = build(
      'error',
      `
      import { css } from 'styled-system/css'
      export const App = () => <div className={css({ background: 'accent.default', color: 'brand.fg' })} />
      `,
    )

    const error = (() => {
      try {
        run()
      } catch (e) {
        return e as Error
      }
    })()

    expect(error?.message).toMatch(/^2 style value\(s\)/)
    expect(error?.message).toMatch(/accent\.default/)
    expect(error?.message).toMatch(/brand\.fg/)
  })

  test('a value marked as a literal is not a finding', () => {
    const { run } = build('error', styled('[accent.default]'))
    expect(() => run()).not.toThrow()
  })

  test('a resolvable token is not a finding', () => {
    const { run } = build('error', styled('red.300'))
    expect(() => run()).not.toThrow()
  })

  test('a property that enumerates nothing is not a finding', () => {
    // `gridTemplateAreas` draws from no token category, so every value of it is a literal and
    // none of them can be wrong. Without this the check reports any dotted string it meets.
    const { run } = build('error', styled('a.b', 'gridTemplateAreas'))
    expect(() => run()).not.toThrow()
  })

  test('a property that does enumerate is judged against its own set', () => {
    // The other side of the same guard, and the reason it is not simply "skip odd-looking
    // values": `fontFamily` draws from `fonts`, so a dotted value it does not enumerate is a
    // real finding rather than a false one.
    const { run } = build('error', styled('Helvetica.Neue', 'fontFamily'))
    expect(() => run()).toThrowError(/`fonts` tokens/)
  })
})

/**
 * A token path can carry `!important` or a `/opacity` modifier, and the path underneath is
 * still a path that either names a token or does not. Tested as written, every one of these
 * fails `TOKEN_PATH` on the modifier's own punctuation and reads as a value with no token in
 * it — so `background: accent.default!` shipped a declaration the browser drops, silently.
 *
 * The normalization used to sit in `assertNoUnresolvedTokens`, which gave `'error'` sight of
 * `!` that `'warn'` did not have, and gave neither any sight of `/`. It lives in the shared
 * predicate now, so the modes cannot disagree — the pairs below are what pins that down.
 */
describe('modifiers on the path', () => {
  const forms = {
    'important, tight': 'accent.default!',
    'important, long': 'accent.default!important',
    'important, spaced': 'accent.default !important',
    'opacity modifier': 'accent.default/50',
  }

  for (const [name, value] of Object.entries(forms)) {
    test(`'error' sees through a bad path with an ${name}`, () => {
      const { run } = build('error', styled(value))
      expect(() => run()).toThrowError(/`background: accent.default`/)
    })

    test(`'warn' sees through a bad path with an ${name}, exactly as 'error' does`, () => {
      const spy = vi.spyOn(logger, 'warn').mockImplementation(() => {})
      const { run } = build('warn', styled(value))

      expect(() => run()).not.toThrow()
      expect(messages(spy)).toMatch(/Unknown token `accent.default`/)
    })
  }

  test('a resolvable path is still fine wearing a modifier', () => {
    // The other half, and the one that would break first: strip too eagerly, or judge the
    // stripped path against the wrong set, and every `red.300!` in a real codebase fails.
    for (const value of ['red.300!', 'red.300 !important', 'red.300/50']) {
      const { run } = build('error', styled(value))
      expect(() => run(), value).not.toThrow()
    }
  })

  test('one finding for one typo, however it is spelled', () => {
    const { run } = build(
      'error',
      `
      import { css } from 'styled-system/css'
      export const App = () => (
        <div className={css({ background: { base: 'accent.default', _hover: 'accent.default!', md: 'accent.default/50' } })} />
      )
      `,
    )

    expect(() => run()).toThrowError(/^1 style value\(s\)/)
  })

  test('a slash is only a modifier where a modifier means something', () => {
    // `/` opens an opacity modifier on a property drawing from `colors`, and is ordinary
    // syntax everywhere else — `font: 12px/1.5 serif`, `gridArea: 1 / 2 / 3 / 4`. Asserted on
    // the normalization rather than through a build because `TOKEN_PATH` rejects a slash
    // outright, so a mis-cut here cannot surface as a finding either way. It would surface as
    // the opposite: a real typo going unreported because the path was cut somewhere it should
    // not have been.
    const { ctx } = build('error', styled('red.300'))

    expect(ctx.utility.bareTokenPath('background', 'accent.default/50')).toBe('accent.default')
    expect(ctx.utility.bareTokenPath('fontFamily', 'Helvetica/Neue.Bold')).toBe('Helvetica/Neue.Bold')
    expect(ctx.utility.bareTokenPath('gridArea', '1 / 2 / 3 / 4')).toBe('1 / 2 / 3 / 4')
  })
})

describe('across rebuilds', () => {
  /**
   * The case that decides the design. The decoder memoizes each atom by hash, so a second
   * build of the same source never re-enters `transform` — a check that accumulated findings
   * as transforms ran would clear its record and then pass a build whose source is still
   * broken, which is worse than any false positive.
   *
   * Reading the sheet instead makes the question stateless: does the css about to be written
   * contain the declaration.
   */
  test('a still-broken source fails every rebuild, not just the first', () => {
    const { run } = build('error', styled('accent.default'))

    expect(() => run()).toThrow()
    expect(() => run()).toThrow()
    expect(() => run()).toThrow()
  })

  test('a clean source stays green across rebuilds', () => {
    const { run } = build('error', styled('red.300'))

    expect(() => run()).not.toThrow()
    expect(() => run()).not.toThrow()
  })
})
