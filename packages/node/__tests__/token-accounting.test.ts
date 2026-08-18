import { logger } from '@bamboocss/logger'
import { createContext as createFixtureContext } from '@bamboocss/fixture'
import { describe, expect, test, vi } from 'vitest'
import type { PruneOptions } from '@bamboocss/types'
import type { BambooContext } from '../src/create-context'
import { accountTokenReferences } from '../src/token-accounting'
import { pruneTokensForBuild, tokensReachableFromJs } from '../src/token-references'

/**
 * The accounting behind `prune: { tokens: true, unresolvedPath: 'error' }`, against a real ts-morph project.
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

/**
 * The walk is skipped for a file that cannot name the artifact, which is the common case by a
 * wide margin. What the fast path must not do is skip a file that declines for a reason having
 * nothing to do with spelling `token` — a specifier this cannot read *could* be the artifact,
 * and dropping that decline drops the keep it was standing in for.
 *
 * `export const a = 1` pins none of this: it declines either way. These are the shapes that
 * separate the two.
 */
describe('the fast path skips only files with nothing to account for', () => {
  test.each([
    ['a dynamic import of a computed specifier', 'export const l = (p) => import(`./pages/${p}`)'],
    ['a require of a computed specifier', 'export const l = (n) => require(n)'],
  ])('%s still declines', (_label, code) => {
    expect(code).not.toContain('token')
    expect(analyse(code).declined.length).toBeGreaterThan(0)
  })

  test.each([
    ['a plain module', `export const a = 1`],
    ['an unrelated static import', `import { useState } from 'react'\nexport const a = useState`],
  ])('%s does not', (_label, code) => {
    expect(analyse(code).declined).toEqual([])
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
    // The same hand-off, written as two statements. The statement walk only sees the spelling
    // carrying a specifier, and `accountedPath` reads an export specifier as a binding site — so
    // this recorded nothing, declined nothing, and pruned as though the export were not there.
    // A sibling package importing the barrel then asked for a declaration the build had deleted.
    ['the binding re-exported separately', `${imports}export { token }`],
    ['the binding re-exported under another name', `${imports}export { token as brandToken }`],
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
})

/**
 * A local binding named `token` is not the artifact, and reading off one is not a reference the
 * build cannot follow.
 *
 * The walk keyed on the spelling alone, so `items.map((token) => token.value)` — token *objects*,
 * the obvious name for them — declined once per read. One decline keeps every declaration in the
 * project, so this was the difference between `accounted` pruning and `accounted` emitting a
 * byte-identical stylesheet with a wall of warnings. It did exactly that on this repository's own
 * documentation site: 40 declines across seven components, none of them a token call, holding 500
 * declarations where 146 are referenced.
 */
describe('a local binding of the name is not the artifact', () => {
  test.each([
    ['a parameter', `export const a = (token) => token.value`],
    ['an arrow parameter in a callback', `export const a = (xs) => xs.map((token) => token.extensions.prop)`],
    ['a destructured parameter', `export const a = ({ token }) => token.value`],
    ['an array-destructured parameter', `export const a = ([token]) => token.value`],
    ['a renamed destructured parameter', `export const a = ({ x: token }) => token.value`],
    ['a function declaration', `function token() {}\nexport const a = token()`],
    ['a class declaration', `class token {}\nexport const a = new token()`],
    ['a named function expression', `export const a = function token() { return token }`],
    ['a catch variable', `export const a = () => { try { f() } catch (token) { return token.message } }`],
    // Destructured off a parameter — the shape the documentation site's components are written in.
    ['a destructure off a parameter', `export const a = (props) => { const { token } = props\n  return token.value }`],
    [
      'a destructure off a member of a parameter',
      `export const a = (props) => { const { token } = props.data\n  return token.value }`,
    ],
    // A type member names a property and reads nothing.
    ['a property signature', `interface P { token: Token }\nexport const a = (p: P) => p`],
    ['a class property', `export class C { token = 1 }`],
    // The shape that matters most: the artifact is imported *and* a nested scope shadows it.
    // The inner reads are the parameter, and only the outer call is the artifact.
    ['a parameter shadowing the imported binding', `${imports}export const a = (xs) => xs.map((token) => token.value)`],
  ])('%s', (_label, code) => {
    expect(analyse(code).declined).toEqual([])
  })

  test('the shadow does not swallow a real reference beside it', () => {
    const { paths, declined } = analyse(
      `${imports}export const a = (xs) => xs.map((token) => token.value)\n` +
        `export const b = token('colors.red.300')`,
    )

    expect(declined).toEqual([])
    expect(paths.has('colors.red.300')).toBe(true)
  })

  /**
   * The shadow is scoped, not file-wide. A reference outside the shadowing scope is still the
   * artifact, and still has to be read — accepting it while recording nothing is the one failure
   * this module exists to make unrepresentable.
   */
  test('a reference outside the shadowing scope still declines', () => {
    const { declined } = analyse(
      `${imports}export const a = (xs) => xs.map((token) => token.value)\n` + `export const b = (k) => token(k)`,
    )

    expect(declined.map((entry) => entry.reason)).toEqual(['unresolved-reference'])
  })
})

describe('shapes a local binding must not excuse', () => {
  test.each([
    // A variable's initializer can be anything, the artifact included, so these keep declining.
    ['a const assigned from a call', `const { token } = useTheme()\nexport const a = (k) => token(k)`],
    // A namespace import is not a local binding, and a barrel could make it the artifact. This is
    // the case the initializer test is rooted at a *local* binding to exclude.
    [
      'a destructure off a namespace import',
      `import * as ui from '@acme/ui'\nconst { token } = ui\nexport const a = (k) => token(k)`,
    ],
    [
      'a destructure off an imported object',
      `import { theme } from '@acme/ui'\nconst { token } = theme\nexport const a = (k) => token(k)`,
    ],
    ['a const assigned the binding', `${imports}const token2 = token\nexport const a = token2('colors.red.300')`],
    [
      'a destructured require',
      `const { token } = require('styled-system/tokens')\nexport const a = token('spacing.4')`,
    ],
    // A property *name* is not a use of a local binding, so a `token` parameter elsewhere in the
    // file says nothing about whether `theme.token(k)` reaches the artifact through a barrel.
    [
      'a token member on an untracked object, beside a shadow',
      `import { theme } from '@acme/ui'\nexport const a = (token) => token.value\nexport const b = (k) => theme.token(k)`,
    ],
  ])('%s', (_label, code) => {
    expect(analyse(code).declined.length).toBeGreaterThan(0)
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
const blanketKeepFor = (code: string, prune: PruneOptions) => {
  const ctx = createFixtureContext({ prune }) as unknown as BambooContext
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

/**
 * `ts.forEachChild` walks the parse tree and does not descend into JSDoc, but ts-morph's
 * `getDescendantsOfKind` reaches it. When the identifier scan moved to a raw walk for speed, the
 * JSDoc descent had to be added back by hand — 72 of the 1,116 source files in this repository
 * carry an identifier visible only that way.
 *
 * Nothing else in this suite would catch dropping it, which is why these are here. A reference the
 * pass cannot see is not declined *and* not accounted — it simply is not there, so the artifact
 * prunes as though the file never mentioned the token, and the rule goes missing at runtime with
 * no failing build to say so.
 */
describe('a reference the parse tree alone does not reach is still a reference', () => {
  test.each([
    ['a link in a doc comment', `${imports}/** @see {@link token} */\nexport const a = 1`],
    ['a type query in a doc comment', `${imports}/** @type {typeof token} */\nexport const a = 1`],
  ])('%s', (_label, code) => {
    expect(analyse(code).declined.length).toBeGreaterThan(0)
  })
})

describe('pruneUnusedTokens: strict', () => {
  const staticCall = `${imports}export const a = token('colors.red.300')`
  const dynamicCall = `${imports}export const a = (p) => token(p)`

  test('drops the blanket keep when every reference resolves', () => {
    const { keep, blanket } = blanketKeepFor(staticCall, { tokens: true, unresolvedPath: 'error' })

    expect(blanket).toBe(false)
    // And the token it does ask for survives by name, which is the half that makes dropping
    // the blanket safe rather than merely smaller.
    expect(keep?.has('--colors-red-300')).toBe(true)
  })

  test('throws on a reference that does not resolve', () => {
    // `strict` is an assertion. A reference that breaks it fails the build rather than warning
    // and quietly keeping every declaration, which is the same silence the flag removes.
    expect(() => blanketKeepFor(dynamicCall, { tokens: true, unresolvedPath: 'error' })).toThrow(
      /could not be resolved/,
    )
  })

  /**
   * The default accounts. It used to keep the blanket whenever javascript reached for a token at
   * all — one `token()` call anywhere kept every declaration — and the accounting was a thing to
   * opt into. Now a path it can read is kept by name and only a path it cannot forces the blanket.
   */
  test('the default prunes a resolvable call and keeps the blanket for an unresolvable one', () => {
    const resolvable = blanketKeepFor(staticCall, {})

    expect(resolvable.blanket).toBe(false)
    expect(resolvable.keep?.has('--colors-red-300')).toBe(true)

    expect(blanketKeepFor(dynamicCall, {}).blanket).toBe(true)
  })

  /** Silent by default: the fallback is an inference, not an assertion the user asked to check. */
  test('the default does not report what it could not follow', () => {
    const warn = vi.spyOn(logger, 'warn').mockImplementation(() => undefined)

    try {
      blanketKeepFor(dynamicCall, {})
      expect(warn).not.toHaveBeenCalled()

      warn.mockClear()
      blanketKeepFor(dynamicCall, { unresolvedPath: 'warn' })
      expect(warn).toHaveBeenCalled()
    } finally {
      warn.mockRestore()
    }
  })

  test('keeping everything is still sayable', () => {
    expect(blanketKeepFor(staticCall, { tokens: false }).blanket).toBeUndefined()
  })

  /**
   * A file the pass cannot read does *not* throw — a single-file component is stored
   * post-transform and a `.ts` file using a generic arrow parses as tsx, and neither is
   * something the author wrote wrongly. Those warn and fall back to the default's own gate,
   * which is what keeps `strict` usable for whole framework families.
   */
  test('a file it cannot read warns and falls back rather than throwing', () => {
    const ctx = createFixtureContext({
      prune: { tokens: true, unresolvedPath: 'error' },
    }) as unknown as BambooContext
    const absolute = ctx.runtime.path.abs(ctx.config.cwd, FILE)

    // Parsed and on-disk texts differ, which is how a transformed file arrives.
    ctx.project.addSourceFile(absolute, `${imports}export const a = token('colors.red.300')`)
    ctx.getFiles = () => [FILE]
    ctx.runtime = {
      ...ctx.runtime,
      fs: { ...ctx.runtime.fs, readFileSync: () => `${imports}export const a = token(RUNTIME)` },
    } as BambooContext['runtime']

    let blanket: boolean | undefined
    ctx.pruneTokens = ((_sheet: unknown, _keep?: Set<string>, seen?: boolean) => {
      blanket = seen
      return { removed: 0, kept: 0 }
    }) as BambooContext['pruneTokens']

    expect(() => pruneTokensForBuild(ctx, {} as never, [])).not.toThrow()
    expect(blanket).toBe(true)
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
  const readsFor = (code: string, prune: PruneOptions, onDisk = code) => {
    const ctx = createFixtureContext({ prune }) as unknown as BambooContext
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
          return onDisk
        },
      },
    } as BambooContext['runtime']
    ctx.pruneTokens = (() => ({
      reachable: undefined,
      removed: 0,
      removedProperties: 0,
      kept: 0,
    })) as BambooContext['pruneTokens']

    pruneTokensForBuild(ctx, {} as never, [])
    return { reads, files: files.length }
  }

  const resolved = `${imports}export const a = token('colors.red.300')`

  test.each([
    ['the default', { tokens: true } as PruneOptions, resolved, resolved],
    ['asserting, everything resolved', { tokens: true, unresolvedPath: 'error' } as PruneOptions, resolved, resolved],
    // The path that used to read three times: a decline still consults the gate. A *file*
    // decline, since a reference decline now throws before it gets there — the parsed copy
    // differing from disk is how a transformed component arrives.
    [
      'asserting, with a file decline',
      { tokens: true, unresolvedPath: 'error' } as PruneOptions,
      resolved,
      `${imports}export const a = token(RUNTIME)`,
    ],
  ])('%s', (_label, mode, code, onDisk) => {
    const { reads, files } = readsFor(code, mode, onDisk)

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
    const ctx = createFixtureContext({
      prune: { tokens: true, unresolvedPath: 'error' },
    }) as unknown as BambooContext
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
    const ctx = createFixtureContext({
      prune: { tokens: true, unresolvedPath: 'error' },
    }) as unknown as BambooContext
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

/**
 * Which declines fail the build, and which only report.
 *
 * The split is the whole design of `strict`-as-an-error, and moving a reason across it fails
 * no other test. Only `unresolved-reference` throws: it is the one that says a *token* path
 * could not be followed. Everything else was written under a premise this would break —
 * declining was free, so every branch that could not prove a shape declined — and several of
 * those shapes are ordinary code with nothing to do with tokens.
 */
describe('strict fails only on an unresolved token reference', () => {
  const run = (code: string) => {
    const ctx = createFixtureContext({
      prune: { tokens: true, unresolvedPath: 'error' },
    }) as unknown as BambooContext
    const absolute = ctx.runtime.path.abs(ctx.config.cwd, FILE)

    ctx.project.addSourceFile(absolute, code)
    ctx.getFiles = () => [FILE]
    ctx.runtime = { ...ctx.runtime, fs: { ...ctx.runtime.fs, readFileSync: () => code } } as BambooContext['runtime']
    ctx.pruneTokens = (() => ({
      reachable: undefined,
      removed: 0,
      removedProperties: 0,
      kept: 0,
    })) as BambooContext['pruneTokens']

    return () => pruneTokensForBuild(ctx, {} as never, [])
  }

  test('a dynamic token path fails the build', () => {
    expect(run(`${imports}export const a = (p) => token(p)`)).toThrow(/could not be resolved/)
  })

  test('the error carries a code a caller can match on', () => {
    try {
      run(`${imports}export const a = (p) => token(p)`)()
      throw new Error('expected a throw')
    } catch (error) {
      expect((error as { code?: string }).code).toBe('ERR_BAMBOO_TOKEN_REFERENCE_UNRESOLVED')
    }
  })

  /**
   * Routine code that happens to trip a decline. Under the old premise these were free; failing
   * a build over a route-splitting `import()` would be indefensible.
   */
  test.each([
    ['a dynamic import of anything', 'export const load = (n) => import(`./pages/${n}.tsx`)'],
    [
      'an import-equals whose path merely contains "token"',
      `import lexer = require('./tokenizer')\nexport const a = lexer`,
    ],
    [
      'a barrel that cannot be classified',
      `import { token as t } from '@acme/ui'\nexport const a = t('colors.red.300')`,
    ],
    ['a re-export of the artifact', `export { token } from 'styled-system/tokens'`],
  ])('%s reports rather than failing', (_label, code) => {
    expect(run(code)).not.toThrow()
  })

  /**
   * The property the fallback rests on: a decline defers to what the cheap text scan would have
   * answered rather than keeping everything. A barrel reaches no token *this scan can see*, so
   * there is nothing for the blanket to protect and it stays off.
   *
   * Compared against `tokensReachableFromJs` rather than against a second accounting run — the
   * two `prune` values this used to pass differ only in reporting, so it asserted a tautology.
   */
  test('a reported decline never keeps more than the text scan would', () => {
    const barrel = `import { token as t } from '@acme/ui'\nexport const a = (p) => t(p)`
    const ctx = createFixtureContext() as unknown as BambooContext
    ctx.project.addSourceFile(ctx.runtime.path.abs(ctx.config.cwd, FILE), barrel)
    ctx.getFiles = () => [FILE]
    ctx.runtime = { ...ctx.runtime, fs: { ...ctx.runtime.fs, readFileSync: () => barrel } } as BambooContext['runtime']

    expect(tokensReachableFromJs(ctx)).toBe(false)
    expect(blanketKeepFor(barrel, { unresolvedPath: 'error' }).blanket).toBe(false)
  })
})
