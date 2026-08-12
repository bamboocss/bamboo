import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { mkdirSync, rmSync, writeFileSync } from 'node:fs'
import { esc } from '@bamboocss/shared'
import { describe, expect, test } from 'vitest'
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

  const renamedKey = (bundle: Record<string, unknown>) =>
    Object.keys(bundle).find((name) => name !== CHUNK_NAME && name.endsWith('.css'))

  test('renames the asset and rewrites chunk code when referencedFiles is absent', () => {
    const { bundle, entry } = bundleWith(chunk())

    expect(() => optimizeStaticCssAssets(bundle as never, sessionWithPruning())).not.toThrow()

    const next = renamedKey(bundle)
    expect(next).toBeDefined()
    expect(next).not.toBe(CSS_NAME)
    expect(bundle[CSS_NAME]).toBeUndefined()
    // The rename is worthless if the importer still points at the old name.
    expect(entry.code).toContain(next!)
    expect(entry.code).not.toContain(CSS_NAME)
  })

  test('rewrites referencedFiles when the bundler does provide it', () => {
    const { bundle, entry } = bundleWith(chunk([CSS_NAME]))

    optimizeStaticCssAssets(bundle as never, sessionWithPruning())

    expect(entry.referencedFiles).toEqual([renamedKey(bundle)])
  })

  // Renaming replaces an entry in `bundle`, which Rolldown does not support: it logs that the
  // assignment is ignored and drops the asset, so the build exits 0 having shipped no
  // stylesheet at all and the app renders unstyled. Pruning without renaming is the safe
  // subset — correct bytes, weaker cache key.
  test('prunes without renaming when renaming is not available', () => {
    const { bundle, entry } = bundleWith(chunk())

    optimizeStaticCssAssets(bundle as never, sessionWithPruning(), { rename: false })

    expect(Object.keys(bundle)).toContain(CSS_NAME)
    expect(String((bundle[CSS_NAME] as { source: string }).source)).not.toContain('345.6789px')
    // Still carries the marker, so the emitted-asset guard does not read this as a lost sheet.
    expect(String((bundle[CSS_NAME] as { source: string }).source)).toContain('--made-with-bamboo')
    expect(entry.code).toContain(CSS_NAME)
  })

  test('leaves the asset name alone when pruning changed nothing', () => {
    const { bundle } = bundleWith(chunk())

    optimizeStaticCssAssets(bundle as never, createStaticCompilationSession())

    expect(Object.keys(bundle)).toContain(CSS_NAME)
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
