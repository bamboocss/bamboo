import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { mkdirSync, rmSync, writeFileSync } from 'node:fs'
import { esc } from '@bamboocss/shared'
import { describe, expect, test, vi } from 'vitest'
import { asError, bamboocssCss, optimizeStaticCssAssets, VIRTUAL_CSS_ID } from '../src/css'
import { createStaticCompilationSession } from '../src/static-session'

/**
 * The css plugin is the integration: without it nothing emits a stylesheet and every class
 * the generated runtime returns names a rule that does not exist. So these assert that a
 * real config produces real css through the virtual module, not merely that the hooks are
 * shaped correctly.
 *
 * `sandbox/codegen` is used because it carries a real bamboo config and real source.
 */
const cwd = join(dirname(fileURLToPath(import.meta.url)), '../../../sandbox/codegen')

const hookOf = <T>(hook: T | { handler: T } | undefined): T | undefined =>
  typeof hook === 'function' ? hook : (hook as { handler: T } | undefined)?.handler

const load = async (id: string, command: 'build' | 'serve' = 'build') => {
  const plugin = bamboocssCss({ cwd, session: createStaticCompilationSession() })
  const resolvedConfig = hookOf(plugin.configResolved)
  await resolvedConfig?.call({} as never, { command, build: { sourcemap: false } } as never)
  const resolved = hookOf(plugin.resolveId)!.call({} as never, id, undefined, {} as never)
  if (typeof resolved !== 'string') return null

  const watched: string[] = []
  const ctx = { addWatchFile: (file: string) => watched.push(file) }
  const css = await hookOf(plugin.load)!.call(ctx as never, resolved, undefined as never)

  return { css: typeof css === 'string' ? css : (css as { code: string })?.code, watched }
}

describe('the virtual stylesheet', () => {
  test('resolves only its own id', () => {
    const plugin = bamboocssCss({ cwd, session: createStaticCompilationSession() })
    const resolve = hookOf(plugin.resolveId)!

    expect(resolve.call({} as never, VIRTUAL_CSS_ID, undefined, {} as never)).toBe(`\0${VIRTUAL_CSS_ID}`)
    // Anything else belongs to another plugin, including a real file that happens to be css.
    expect(resolve.call({} as never, './app.css', undefined, {} as never)).toBeNull()
    expect(resolve.call({} as never, 'styled-system/styles.css', undefined, {} as never)).toBeNull()
  })

  test('emits a stylesheet the runtime can match against', async () => {
    const result = await load(VIRTUAL_CSS_ID)

    expect(result).not.toBeNull()
    const css = result!.css

    // The layer statement is what orders bamboo against a project's own css, and the
    // sentinel is what every other integration uses to recognise a generated sheet.
    expect(css).toContain('@layer reset, base, tokens, utilities')
    expect(css).not.toContain('@layer reset, base, tokens, recipes, utilities')
    expect(css).toContain('--made-with-bamboo')
    // Real utilities, from the sandbox's real source rather than from a fixture.
    expect(css).toMatch(/@layer utilities\{/)
    expect(css.length).toBeGreaterThan(1000)
  }, 60_000)

  test('registers the extracted files, so an edit invalidates the sheet', async () => {
    const result = await load(VIRTUAL_CSS_ID)

    // `vite build --watch` rebuilds a module only when something it declared as a
    // dependency changes. Without this the stylesheet would be generated once and then
    // stay stale for the rest of the session.
    expect(result!.watched.length).toBeGreaterThan(0)
    expect(result!.watched.some((file) => file.endsWith('.tsx'))).toBe(true)
  }, 60_000)

  test('recipe declarations are atoms and recipe rules are never emitted', async () => {
    const fixtureDir = join(cwd, 'src/__static-composition-css-test')
    const fixture = join(fixtureDir, 'styles.ts')
    mkdirSync(fixtureDir, { recursive: true })
    writeFileSync(
      fixture,
      `
        import { css, cva } from '../../styled-system/css'
        const box = cva({ base: { width: '[123.4567px]' } })
        export const recipe = box()
        export const utility = css({ width: '[123.4567px]' })
      `,
    )

    try {
      const compiled = (await load(VIRTUAL_CSS_ID))!.css

      expect(compiled.match(/width:\s*123\.4567px/g)).toHaveLength(1)
      expect(compiled).not.toMatch(/@layer recipes\{/)
      expect(compiled).toMatch(/@layer utilities\{/)
    } finally {
      rmSync(fixtureDir, { recursive: true, force: true })
    }
  }, 60_000)

  test('development emits the same atom representation without a recipe sheet', async () => {
    const fixtureDir = join(cwd, 'src/__static-composition-dev-test')
    const fixture = join(fixtureDir, 'styles.ts')
    mkdirSync(fixtureDir, { recursive: true })
    writeFileSync(
      fixture,
      `import { cva } from '../../styled-system/css'\nexport const box = cva({ base: { width: '[456.789px]' } })\n`,
    )

    try {
      const css = (await load(VIRTUAL_CSS_ID, 'serve'))!.css

      expect(css).not.toMatch(/@layer recipes\{/)
      expect(css).toContain('width: 456.789px')
      expect(css).toContain('width: 456.789px')
    } finally {
      rmSync(fixtureDir, { recursive: true, force: true })
    }
  }, 60_000)
})

/**
 * `optimizeStaticCssAssets` walks a bundle Vite handed us, not one we built. Rollup's types
 * promise every field these touch, but the peer range is `vite: ">=5"` — which covers a
 * Rollup-compatible bundler — and any plugin can put a chunk-shaped entry in the bundle
 * before this runs. A client hit an undefined `referencedFiles` and shipped a patched `dist`.
 *
 * These drive the function over hand-built bundles, so a shape Rollup never produces can be
 * asserted. The end-to-end rename is covered against real Rollup in
 * `sandbox/runtime-perf/__tests__/vite-plugin.test.ts`; that path cannot express this one.
 */
describe('late CSS asset renaming', () => {
  const CSS_NAME = 'assets/index-aaaaaaaa.css'

  const prunableSheet = () =>
    `@layer reset, base, tokens, recipes, utilities;` +
    `@layer utilities{.h_\\[345\\.6789px\\]{height:345.6789px}}` +
    `:root{--made-with-bamboo:🌱}`

  const sessionWithPruning = () => {
    const session = createStaticCompilationSession()
    session.prunableClasses.add(esc('h_[345.6789px]'))
    return session
  }

  const CHUNK_NAME = 'assets/entry-bbbbbbbb.js'

  interface TestChunk {
    type: 'chunk'
    fileName: string
    code: string
    map: null
    referencedFiles?: string[]
  }

  const cssAsset = () => ({ type: 'asset' as const, fileName: CSS_NAME, names: [], source: prunableSheet() })

  /** `referencedFiles` omitted entirely, which is the shape Rollup's type says cannot happen. */
  const chunk = (referencedFiles?: string[]): TestChunk => ({
    type: 'chunk',
    fileName: CHUNK_NAME,
    code: `import ${JSON.stringify(`./${CSS_NAME}`)}\n`,
    map: null,
    ...(referencedFiles ? { referencedFiles } : {}),
  })

  /** The bundle is mutated in place, so the entry is held rather than read back out by key. */
  const bundleWith = (entry: TestChunk) => ({
    bundle: { [CSS_NAME]: cssAsset(), [CHUNK_NAME]: entry } as Record<string, unknown>,
    entry,
  })

  /** The rename moves `fileName` in place; re-keying `bundle` is what Rolldown refuses. */
  const renamedName = (bundle: Record<string, unknown>) =>
    (bundle[CSS_NAME] as { fileName: string } | undefined)?.fileName

  test('renames the asset and rewrites chunk code when referencedFiles is absent', () => {
    const { bundle, entry } = bundleWith(chunk())

    expect(() => optimizeStaticCssAssets(bundle as never, sessionWithPruning())).not.toThrow()

    const next = renamedName(bundle)
    expect(next).toBeDefined()
    expect(next).not.toBe(CSS_NAME)
    // The rename is worthless if the importer still points at the old name.
    expect(entry.code).toContain(next!)
    expect(entry.code).not.toContain(CSS_NAME)
  })

  test('rewrites referencedFiles when the bundler does provide it', () => {
    const { bundle, entry } = bundleWith(chunk([CSS_NAME]))

    optimizeStaticCssAssets(bundle as never, sessionWithPruning())

    expect(entry.referencedFiles).toEqual([renamedName(bundle)])
  })

  test('leaves the asset name alone when pruning changed nothing', () => {
    const { bundle } = bundleWith(chunk())

    optimizeStaticCssAssets(bundle as never, createStaticCompilationSession())

    expect(Object.keys(bundle)).toContain(CSS_NAME)
  })

  /**
   * `prune: false` is what `pruneCss: false` passes, and what a build environment that is not
   * the last one of its run passes, since the environments still to come can each add to
   * reachability.
   *
   * Byte-identical rather than reprinted through postcss with removal disabled: the rename is
   * driven by the bytes changing, so a reprint that only moved whitespace would give the
   * stylesheet a new content-hashed name for no change in what it contains.
   *
   * This is also the only way to decline the rename, and that is the point. Pruned bytes under
   * the unpruned sheet's name is how a stale stylesheet outlives a deploy, so a caller that
   * cannot accept a renamed asset has to give up the pruning too — there is no longer an
   * argument that asks for the unsafe half.
   */
  test('leaves the sheet untouched, byte for byte, when pruning is held back', () => {
    const { bundle, entry } = bundleWith(chunk())

    const result = optimizeStaticCssAssets(bundle as never, sessionWithPruning(), { prune: false })

    const asset = bundle[CSS_NAME] as { source: string; fileName: string }
    expect(asset.source).toBe(prunableSheet())
    expect(asset.fileName).toBe(CSS_NAME)
    expect(entry.code).toContain(CSS_NAME)
    // Reported so the caller can say the sheet was seen and deliberately left whole.
    expect(result.sheets).toBe(1)
  })
})

/**
 * Pruning never goes off in silence.
 *
 * It is the difference between the stylesheet a project extracted and the one it ships, and
 * there are two ways for it not to happen — the user asked, or an environment of this run has
 * not been compiled yet. Both print, and the docs promise they do. Nothing asserted that until
 * now: swapping the two branches, or deleting either, broke no test.
 *
 * Driven through the real `generateBundle` hook rather than `optimizeStaticCssAssets`, because
 * the branch under test is the caller's, not the helper's.
 */
describe('saying why the stylesheet was not pruned', () => {
  const sheet =
    `@layer reset, base, tokens, recipes, utilities;` +
    `@layer utilities{.h_\\[345\\.6789px\\]{height:345.6789px}}` +
    `:root{--made-with-bamboo:🌱}`

  const generate = async (options: { pruneCss?: boolean; pending?: string[] }) => {
    const session = createStaticCompilationSession()
    session.prunableClasses.add(esc('h_[345.6789px]'))
    if (options.pending) {
      session.expectedEnvironments = new Set(['client', ...options.pending])
      session.startedEnvironments.add('client')
    }

    const plugin = bamboocssCss({ cwd, session, pruneCss: options.pruneCss })
    const handler = hookOf(plugin.generateBundle)!
    const bundle = { 'a.css': { type: 'asset', fileName: 'a.css', names: [], source: sheet } }

    const lines: string[] = []
    const spy = vi.spyOn(console, 'log').mockImplementation((...args) => void lines.push(args.join(' ')))
    try {
      await handler.call({ environment: { name: 'client' } } as never, {} as never, bundle as never, {} as never)
    } finally {
      spy.mockRestore()
    }
    return { lines: lines.join('\n'), source: String(bundle['a.css']!.source) }
  }

  test('says so when the user turned it off', async () => {
    const { lines, source } = await generate({ pruneCss: false })

    expect(lines).toContain('pruneCss: false')
    expect(source, 'nothing removed').toContain('345.6789px')
  })

  test('says which environment it is waiting on', async () => {
    const { lines, source } = await generate({ pending: ['ssr'] })

    expect(lines).toContain('ssr')
    expect(lines).toContain('not been compiled')
    expect(source, 'nothing removed').toContain('345.6789px')
  })

  /**
   * The user's own setting wins the explanation. Blaming an uncompiled environment for a
   * choice they made in their config sends them to debug the wrong thing entirely.
   */
  test('attributes it to the setting rather than the environment when both apply', async () => {
    const { lines } = await generate({ pruneCss: false, pending: ['ssr'] })

    expect(lines).toContain('pruneCss: false')
    expect(lines).not.toContain('not been compiled')
  })

  test('says nothing when it did prune', async () => {
    const { lines, source } = await generate({})

    expect(lines).not.toContain('pruning')
    expect(source, 'the unreachable atom went').not.toContain('345.6789px')
  })
})

/**
 * Whatever a hook throws while the dev server is serving must be an object.
 *
 * Vite's dev error middleware puts what it is handed into a `WeakSet` to deduplicate it, and
 * `WeakSet.add` throws `TypeError: Invalid value used in weak set` for a primitive. The real
 * failure is then replaced by a stack trace about weak sets, in the one mode where the
 * terminal is where the user would have read it. It surfaced twice: once from `transform`
 * compiling a module, once from `load` answering a request for the stylesheet.
 */
describe('thrown values are always objects', () => {
  test.each([['a string' as unknown], [undefined], [null], [42], [Symbol('nope')]])(
    'normalizes %p into an Error carrying the original',
    (thrown) => {
      const error = asError(thrown, 'failed to compile app/x.tsx')

      expect(error).toBeInstanceOf(Error)
      // The whole point: an object, so Vite can deduplicate it rather than crash on it.
      expect(() => new WeakSet().add(error)).not.toThrow()
      expect(error.message).toContain('failed to compile app/x.tsx')
      expect(error.message).toContain(String(thrown))
      expect((error as Error & { cause?: unknown }).cause).toBe(thrown)
    },
  )

  test('an Error passes through untouched, keeping its stack', () => {
    const original = new TypeError('the real problem')
    expect(asError(original, 'context')).toBe(original)
  })
})

/**
 * Reachability keys are escaped at most once.
 *
 * `esc` is idempotent for a name that needs no escaping and not otherwise: `d_flex` survives
 * any number of passes, while `--scrollbar-width_10px` becomes `\--scrollbar-width_10px` and
 * then `\\--scrollbar-width_10px`. A key escaped twice matches no rule in the sheet, so the
 * atom is pruned and its elements render unstyled — and it happens *only* to names that need
 * escaping, which is why it presented as "every custom property and vendor-prefixed property
 * lost its rule" while flat declarations were untouched.
 */
describe('marking a class used', () => {
  const markedBy = (className: string) => {
    const session = createStaticCompilationSession()
    session.markClassUsed(className)
    return [...session.usedClasses]
  }

  test.each([
    ['--scrollbar-width_10px', '\\--scrollbar-width_10px'],
    ['-webkit-line-clamp_2', '\\-webkit-line-clamp_2'],
    ['hover:c_red.300', 'hover\\:c_red\\.300'],
    ['d_flex', 'd_flex'],
  ])('escapes %p once', (semantic, selector) => {
    expect(markedBy(semantic)).toEqual([selector])
  })

  // The same name arriving already in selector form must not be escaped a second time.
  test.each([['\\--scrollbar-width_10px'], ['hover\\:c_red\\.300']])('leaves %p alone', (selector) => {
    expect(markedBy(selector)).toEqual([selector])
  })

  test('splits a multi-atom string and escapes each part once', () => {
    expect(markedBy('--size_sizes.3 d_flex')).toEqual(['\\--size_sizes\\.3', 'd_flex'])
  })
})
