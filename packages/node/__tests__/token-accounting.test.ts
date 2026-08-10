import { createContext as createFixtureContext } from '@bamboocss/fixture'
import { describe, expect, test } from 'vitest'
import type { BambooContext } from '../src/create-context'
import { accountTokenReferences } from '../src/token-accounting'
import { pruneTokensForBuild } from '../src/token-references'

/**
 * The accounting behind `pruneUnusedTokens: 'strict'`, against a real ts-morph project.
 *
 * Two properties are under test, and only one of them is about bytes:
 *
 * - **accepted implies recorded** — every reference the pass accepts contributes its path, so
 *   the keep set cannot disagree with the decision to prune. The predecessor of this module
 *   accepted from the syntax tree while a text regex built the keep set, and
 *   `import { token as t }` + `t('colors.red.300')` was accepted while keeping nothing.
 * - **anything unreadable declines** — and a decline is free, because the caller falls back to
 *   keeping every declaration. So the interesting failure is an *accept* of something whose
 *   path the build cannot actually resolve; a spurious decline only costs bytes.
 */
const FILE = 'app/src/app.tsx'

const analyse = (code: string, file = FILE) => {
  const ctx = createFixtureContext() as unknown as BambooContext
  const absolute = ctx.runtime.path.abs(ctx.config.cwd, file)

  ctx.project.addSourceFile(absolute, code)
  ctx.getFiles = () => [file]
  ctx.runtime = { ...ctx.runtime, fs: { ...ctx.runtime.fs, readFileSync: () => code } } as BambooContext['runtime']

  return accountTokenReferences(ctx)
}

const imports = "import { token } from 'styled-system/tokens'\n"

describe('accepted references record the path they ask for', () => {
  test.each([
    ['a literal path', `${imports}export const a = token('colors.red.300')`, 'colors.red.300'],
    ['the .value half', `${imports}export const a = token.value('spacing.4')`, 'spacing.4'],
    [
      'an aliased import — the shape that broke the predecessor',
      `import { token as t } from 'styled-system/tokens'\nexport const a = t('colors.red.300')`,
      'colors.red.300',
    ],
    [
      'a namespace import',
      `import * as ds from 'styled-system/tokens'\nexport const a = ds.token('colors.red.300')`,
      'colors.red.300',
    ],
    [
      'a namespaced method',
      `import * as ds from 'styled-system/tokens'\nexport const a = ds.token.value('spacing.4')`,
      'spacing.4',
    ],
    ['a no-substitution template', `${imports}export const a = token(\`colors.red.300\`)`, 'colors.red.300'],
  ])('%s', (_label, code, expected) => {
    const { paths, declined } = analyse(code)

    expect(declined).toEqual([])
    expect(paths.has(expected)).toBe(true)
  })

  /**
   * The path is read through `getLiteralValue()`, never off the source text. A path recorded
   * raw would carry the escape and look up nothing — accepted, and keeping no declaration.
   */
  test('an escaped literal records its decoded value', () => {
    const { paths, declined } = analyse(`${imports}export const a = token('colors.red.\\u0033\\u0030\\u0030')`)

    expect(declined).toEqual([])
    expect(paths.has('colors.red.300')).toBe(true)
  })

  test('a file that never mentions a token is not read at all', () => {
    const { paths, declined } = analyse(`export const a = 1`)

    expect(declined).toEqual([])
    expect(paths.size).toBe(0)
  })
})

describe('unreadable references decline', () => {
  test.each([
    ['a path from a constant', `${imports}const K = 'colors.red.300'\nexport const a = token(K)`],
    ['a path from a parameter', `${imports}export const a = (p) => token(p)`],
    ['a renamed binding', `${imports}const t = token\nexport const a = t('colors.red.300')`],
    ['the binding passed as a value', `${imports}export const a = [token].map((f) => f('colors.red.300'))`],
    ['a call with no argument', `${imports}export const a = token()`],
    ['a computed member', `${imports}export const a = token['value']('colors.red.300')`],
    ['the binding re-exported', `export { token } from 'styled-system/tokens'`],
    ['a star re-export', `export * from 'styled-system/tokens'`],
    ['a namespace enumerated', `import * as ds from 'styled-system/tokens'\nexport const a = Object.keys(ds)`],
    [
      'a require of the artifact',
      `const { token } = require('styled-system/tokens')\nexport const a = token('spacing.4')`,
    ],
    [
      'a dynamic import',
      `${imports}export const l = async () => (await import('styled-system/tokens')).token('spacing.4')`,
    ],
    ['an import-equals', `import ds = require('styled-system/tokens')\nexport const a = ds.token('spacing.4')`],
    // The barrel case: no artifact specifier and no `token(`-shaped call, so keying on either
    // would miss it. Keying on the imported *name* catches it.
    [
      'an unclassified module exporting token',
      `import { token as t } from '@acme/ui'\nexport const a = (n) => t(\`colors.\${n}\`)`,
    ],
    ['an unclassified namespace read as .token', `import * as ui from '@acme/ui'\nexport const a = (n) => ui.token(n)`],
    // The artifact exports only `token` today. Anything else is a shape this does not model,
    // and treating it as "not the artifact" is the lenient direction.
    [
      'a named import that is not token',
      `import { somethingElse } from 'styled-system/tokens'\nexport const a = (n) => somethingElse(n)`,
    ],
    [
      'a default import from the artifact',
      `import token from 'styled-system/tokens'\nexport const a = token('spacing.4')`,
    ],
    // A bare `token` this pass never bound came from somewhere it could not follow.
    ['an unbound token identifier', `export const a = (p) => token(p)`],
    // `token.var` is gone. It is `undefined` at runtime, so a call of it is not something this
    // pass can account for — and declining keeps every declaration, which is the safe answer.
    ['the removed .var alias', `${imports}export const a = token.var('colors.red.300')`],
    [
      'the removed alias on a namespace',
      `import * as ds from 'styled-system/tokens'\nexport const a = ds.token.var('colors.red.300')`,
    ],
    // Every file is handed to ts-morph as TSX, so a construct valid in `.ts` and invalid in
    // TSX parses into a JsxElement that swallows the rest of the file. The bytes match, so
    // only the tree shows it — every call below the offending line ceases to exist.
    ['a generic arrow in a .ts file', `${imports}export const id = <T>(x: T) => x\nexport const a = (k) => token(k)`],
    [
      'an old-style type assertion',
      `${imports}const el = <HTMLElement>document.body\nexport const a = (k) => token(k)`,
    ],
    // `.token` on an object this pass never bound — between the named-import and namespace
    // branches, and reached through a barrel.
    [
      'a token member on an untracked object',
      `import { theme } from '@acme/ui'\nexport const a = (k) => theme.token(k)`,
    ],
    [
      'a token member on a call result',
      `import { useTheme } from '@acme/ui'\nexport const a = (k) => useTheme().token(k)`,
    ],
    ['a computed token member', `import * as ui from '@acme/ui'\nexport const a = (k) => ui['token'](k)`],
    // Nests inside a namespace, where a top-level statement scan missed it.
    [
      'a nested import-equals',
      `namespace N {\n  import ds = require('styled-system/tokens')\n  export const a = (k) => ds.token(k)\n}`,
    ],
    // The identifier is `token`; comparing the spelling let it past every name check.
    [
      'an escaped identifier in a barrel import',
      `import { \\u0074oken as t } from '@ds'\nexport const a = (k) => t(k)`,
    ],
  ])('%s', (_label, code) => {
    expect(analyse(code).declined.length).toBeGreaterThan(0)
  })

  test('a declined file still reports where to look', () => {
    const [entry] = analyse(`${imports}\nexport const a = (p) => token(p)`).declined

    expect(entry!.filePath).toContain('app.tsx')
    expect(entry!.line).toBe(3)
    expect(entry!.reason).toBe('unresolved-reference')
  })

  /**
   * The syntax pass can only speak for a file it reads exactly as the bundler compiles it.
   * A single-file component is stored post-transform, and `parser:before` can rewrite any
   * extension, so the guard is on the texts differing rather than on the extension.
   */
  test('a file whose parsed copy differs from disk declines', () => {
    const ctx = createFixtureContext() as unknown as BambooContext
    const absolute = ctx.runtime.path.abs(ctx.config.cwd, FILE)

    ctx.project.addSourceFile(absolute, `${imports}export const a = token('colors.red.300')`)
    ctx.getFiles = () => [FILE]
    ctx.runtime = {
      ...ctx.runtime,
      fs: { ...ctx.runtime.fs, readFileSync: () => `${imports}export const a = token(RUNTIME_KEY)` },
    } as BambooContext['runtime']

    const { declined } = accountTokenReferences(ctx)
    expect(declined.map((entry) => entry.reason)).toEqual(['transformed'])
  })
})

/**
 * The wiring, because an accounting pass that never changes the outcome is worse than none —
 * it reads as coverage. These assert the third argument `pruneTokensForBuild` hands
 * `pruneTokens`: `true` means "keep every declaration", which is the default's behaviour and
 * the fallback for anything declined.
 */
describe('pruneUnusedTokens: strict', () => {
  const blanketKeepFor = (code: string, pruneUnusedTokens: boolean | 'strict') => {
    const ctx = createFixtureContext({ pruneUnusedTokens }) as unknown as BambooContext
    const absolute = ctx.runtime.path.abs(ctx.config.cwd, FILE)

    ctx.project.addSourceFile(absolute, code)
    ctx.getFiles = () => [FILE]
    ctx.runtime = { ...ctx.runtime, fs: { ...ctx.runtime.fs, readFileSync: () => code } } as BambooContext['runtime']

    let seen: { keep?: Set<string>; blanket?: boolean } = {}
    ctx.pruneTokens = ((_sheet: unknown, keep?: Set<string>, blanket?: boolean) => {
      seen = { keep, blanket }
      return { removed: 0, kept: 0 }
    }) as BambooContext['pruneTokens']

    pruneTokensForBuild(ctx, {} as never, [])
    return seen
  }

  const staticCall = `${imports}export const a = token('colors.red.300')`
  const dynamicCall = `${imports}export const a = (p) => token(p)`

  test('drops the blanket keep when every reference resolves', () => {
    const { keep, blanket } = blanketKeepFor(staticCall, 'strict')

    expect(blanket).toBe(false)
    // And the token it does ask for survives by name, which is the half that makes dropping
    // the blanket safe rather than merely smaller.
    expect(keep?.has('--colors-red-300')).toBe(true)
  })

  test('keeps the blanket when a reference does not resolve', () => {
    expect(blanketKeepFor(dynamicCall, 'strict').blanket).toBe(true)
  })

  test('the default keeps the blanket either way, so strict can only prune more', () => {
    expect(blanketKeepFor(staticCall, true).blanket).toBe(true)
    expect(blanketKeepFor(dynamicCall, true).blanket).toBe(true)
  })

  /**
   * A decline defers to the default's own gate rather than keeping everything outright. The
   * two differ here: this file declines — the import cannot be classified — while the default's
   * text scan finds no token call, so an unconditional keep would make `strict` ship *more*
   * than the default. That is the one case where enabling it could have cost bytes.
   */
  test('a decline falls back to the default answer, never past it', () => {
    const barrel = `import { token as t } from '@acme/ui'\nexport const a = (p) => t(p)`

    expect(blanketKeepFor(barrel, 'strict').blanket).toBe(false)
    expect(blanketKeepFor(barrel, true).blanket).toBe(false)
  })
})

/**
 * One walk over the source files, whatever the mode.
 *
 * The keep set, the reachability gate and the strict accounting all want the same two copies
 * of the same files, and each used to fetch them itself — so a strict build opened every file
 * three times: once to collect references, once to account, and once more for the gate
 * whenever the accounting declined.
 *
 * Counted rather than timed, so it runs in CI and fails on the regression rather than on a
 * busy machine. A second walk reappearing is exactly the shape that would otherwise go
 * unnoticed, since nothing about the output changes.
 */
describe('pruneTokensForBuild reads each file once', () => {
  const readsFor = (code: string, pruneUnusedTokens: boolean | 'strict') => {
    const ctx = createFixtureContext({ pruneUnusedTokens }) as unknown as BambooContext
    const files = ['app/src/a.tsx', 'app/src/b.tsx', 'app/src/c.tsx']

    for (const file of files) ctx.project.addSourceFile(ctx.runtime.path.abs(ctx.config.cwd, file), code)
    ctx.getFiles = () => files

    let reads = 0
    ctx.runtime = {
      ...ctx.runtime,
      fs: {
        ...ctx.runtime.fs,
        readFileSync: () => {
          reads++
          return code
        },
      },
    } as BambooContext['runtime']
    ctx.pruneTokens = (() => ({ removed: 0, kept: 0 })) as BambooContext['pruneTokens']

    pruneTokensForBuild(ctx, {} as never, [])
    return { reads, files: files.length }
  }

  test.each([
    ['the default', true as const, `${imports}export const a = token('colors.red.300')`],
    ['strict, everything resolved', 'strict' as const, `${imports}export const a = token('colors.red.300')`],
    // The path that used to read three times: a decline still consults the gate.
    ['strict, with a decline', 'strict' as const, `${imports}export const a = (p) => token(p)`],
  ])('%s', (_label, mode, code) => {
    const { reads, files } = readsFor(code, mode)

    expect(reads).toBe(files)
  })
})

/**
 * A reference bounded by a prefix rather than resolved to a path.
 *
 * `` token(`colors.${shade}`) `` cannot say which token it wants, but it can say which it
 * cannot: whatever it produces begins `colors.`. Declining it kept every declaration in the
 * project — 468 on the default preset against 68 for the old, narrower exemption — where
 * bounding it keeps the category and nothing else.
 *
 * This is the shape the repo's own docs site uses, and the reason it was worth doing: the
 * static head was already sitting in the source and was thrown away.
 */
describe('a prefix bounds what a dynamic path can reach', () => {
  test('records the head instead of declining', () => {
    const { paths, prefixes, declined } = analyse(`${imports}export const a = (s) => token(\`colors.\${s}\`)`)

    expect(declined).toEqual([])
    expect(paths.size).toBe(0)
    expect(prefixes).toEqual(new Set(['colors.']))
  })

  test('an empty head bounds nothing, so it still declines', () => {
    const { prefixes, declined } = analyse(`${imports}export const a = (s) => token(\`\${s}\`)`)

    expect(prefixes.size).toBe(0)
    expect(declined.length).toBeGreaterThan(0)
  })

  test('a further substitution does not loosen the bound', () => {
    const { prefixes, declined } = analyse(`${imports}export const a = (a, b) => token(\`colors.\${a}.\${b}\`)`)

    expect(declined).toEqual([])
    expect(prefixes).toEqual(new Set(['colors.']))
  })

  test('the bound survives the .value half and a namespace', () => {
    const { prefixes, declined } = analyse(
      `import * as ds from 'styled-system/tokens'\nexport const a = (s) => ds.token.value(\`spacing.\${s}\`)`,
    )

    expect(declined).toEqual([])
    expect(prefixes).toEqual(new Set(['spacing.']))
  })

  /**
   * The point of the bound: it keeps a category, not a project. Asserted on the keep set the
   * build actually hands `pruneTokens`, because that is what decides the stylesheet.
   */
  test('keeps the bounded category and drops the rest', () => {
    const ctx = createFixtureContext({ pruneUnusedTokens: 'strict' }) as unknown as BambooContext
    const code = `${imports}export const a = (s) => token(\`colors.\${s}\`)`
    const absolute = ctx.runtime.path.abs(ctx.config.cwd, FILE)

    ctx.project.addSourceFile(absolute, code)
    ctx.getFiles = () => [FILE]
    ctx.runtime = { ...ctx.runtime, fs: { ...ctx.runtime.fs, readFileSync: () => code } } as BambooContext['runtime']

    let seen: { keep?: Set<string>; blanket?: boolean } = {}
    ctx.pruneTokens = ((_sheet: unknown, keep?: Set<string>, blanket?: boolean) => {
      seen = { keep, blanket }
      return { removed: 0, kept: 0 }
    }) as BambooContext['pruneTokens']

    pruneTokensForBuild(ctx, {} as never, [])

    expect(seen.blanket).toBe(false)
    expect(seen.keep?.has('--colors-red-300')).toBe(true)
    // A different category the expression cannot reach.
    expect(seen.keep?.has('--spacing-4')).toBe(false)
  })
})

/**
 * The shapes I had verified by hand and left unpinned, plus the one the bounding exists for.
 */
describe('prefix bounding — the cases that were only checked by hand', () => {
  /**
   * The real call site. A `string`-typed substitution does not satisfy the generated `Token`
   * union, so a typed caller writes the assertion — and reading only the outermost node
   * declined it, which meant the motivating example bounded nothing.
   */
  test('an assertion around the template still bounds', () => {
    const { prefixes, declined } = analyse(
      `import { Token, token } from 'styled-system/tokens'\nexport const a = (k: string) => token(\`animations.\${k}\` as Token)`,
    )

    expect(declined).toEqual([])
    expect(prefixes).toEqual(new Set(['animations.']))
  })

  test('a type imported beside the value does not decline', () => {
    const { declined } = analyse(
      `import { Token, token } from 'styled-system/tokens'\nexport const a = (k: Token) => token(k)`,
    )

    // Declines for the dynamic path, not for the `Token` import.
    expect(declined.map((entry) => entry.reason)).toEqual(['unresolved-reference'])
  })

  /** A binding that is *called* still declines, whatever it is named — a barrel could re-export. */
  test('a differently-named import used as a value still declines', () => {
    const { declined } = analyse(
      `import { somethingElse } from 'styled-system/tokens'\nexport const a = (n) => somethingElse(n)`,
    )

    expect(declined.map((entry) => entry.reason)).toContain('unsupported-import')
  })

  /**
   * A negative token has no declaration of its own — `getVar` gives `calc(var(--spacing-4) *
   * -1)` — so a bound that matched it while keeping nothing would be the exact
   * accepted-but-unkept failure this module exists to prevent.
   */
  test('a bounded negative token keeps its positive counterpart', () => {
    const ctx = createFixtureContext({ pruneUnusedTokens: 'strict' }) as unknown as BambooContext
    const code = `${imports}export const a = (s) => token(\`spacing.\${s}\`)`
    const absolute = ctx.runtime.path.abs(ctx.config.cwd, FILE)

    ctx.project.addSourceFile(absolute, code)
    ctx.getFiles = () => [FILE]
    ctx.runtime = { ...ctx.runtime, fs: { ...ctx.runtime.fs, readFileSync: () => code } } as BambooContext['runtime']

    let keep: Set<string> | undefined
    ctx.pruneTokens = ((_sheet: unknown, seen?: Set<string>) => {
      keep = seen
      return { removed: 0, kept: 0 }
    }) as BambooContext['pruneTokens']

    pruneTokensForBuild(ctx, {} as never, [])

    expect(keep?.has('--spacing-4')).toBe(true)
  })

  test('a decline alongside a bound still keeps everything', () => {
    const { prefixes, declined } = analyse(
      `${imports}const t = token\nexport const a = (s) => token(\`colors.\${s}\`)\nexport const b = t('spacing.4')`,
    )

    expect(prefixes.size).toBeGreaterThan(0)
    expect(declined.length).toBeGreaterThan(0)
  })
})
