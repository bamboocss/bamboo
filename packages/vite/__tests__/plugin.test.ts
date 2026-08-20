import { logger } from '@bamboocss/logger'
import { isStaticCompilerActive } from '@bamboocss/node/static-compiler'
import { rmSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, test } from 'vitest'
import { VIRTUAL_CSS_ID } from '../src/css'
import { bamboocss, isGeneratedOutput } from '../src/plugin'

/**
 * The plugin wrapper, separate from the fold itself.
 *
 * `bamboocss()` returns two plugins: the css emitter, which is the integration and runs in
 * dev and build alike, and the compiler, which runs in both modes. These assert the strict
 * contract a user relies on before any config is loaded.
 */
const plugins = (options?: Parameters<typeof bamboocss>[0]) => {
  const list = bamboocss(options)
  const css = list.find((p) => p.name === 'bamboocss:css')!
  const fold = list.find((p) => p.name === 'bamboocss:compiler')!
  return { list, css, fold }
}

const callTransform = async (plugin: { transform?: unknown }, code: string, id: string) => {
  const hook = plugin.transform as any
  const handler = typeof hook === 'function' ? hook : hook?.handler
  if (!handler) throw new Error('plugin has no transform hook')
  return handler.call({} as never, code, id, {} as never)
}

const hookOf = <T>(hook: T | { handler: T } | undefined): T | undefined =>
  typeof hook === 'function' ? hook : (hook as { handler: T } | undefined)?.handler

const SOURCE = `import { css } from 'styled-system/css'\nexport const cls = css({ color: 'red.300' })\n`

describe('plugin contract', () => {
  test('announces the compiler synchronously, even when option validation rejects construction', () => {
    const realm = globalThis as Record<symbol, unknown>
    const flag = Symbol.for('bamboocss.static-compiler')
    realm[flag] = false

    expect(() => bamboocss({ maxRecipeStates: 0 })).toThrow('positive safe integer')
    expect(isStaticCompilerActive()).toBe(true)
  })

  test('returns the css emitter and the fold, in that order', () => {
    const { list } = plugins()

    // The css plugin owns the extraction the fold's context reads from, so it goes first.
    expect(list.map((p) => p.name)).toEqual(['bamboocss:css', 'bamboocss:compiler'])
  })

  test('the fold runs before other plugins', () => {
    // Runs `pre` so it sees module source as close as possible to what the CSS
    // extractor reads off disk.
    expect(plugins().fold.enforce).toBe('pre')
  })

  test('the compiler and css emitter both apply in development and builds', () => {
    expect(plugins().fold.apply).toBeUndefined()
    expect(plugins().css.apply).toBeUndefined()
  })

  /**
   * One instance for the whole build, not one per environment.
   *
   * Vite re-reads the config file once per environment and calls the plugin factory again, so
   * without this a project listing `bamboocss()` in `vite.config.ts` — every project — got a
   * fresh instance per environment: its own compilation session, its own context, its own
   * ts-morph project. Every cross-environment guarantee here is written against a shared
   * session, and none of them held. Nothing else can catch the flag going missing, because a
   * second instance is silently *consistent with itself*.
   */
  test('one instance serves every environment of a build', () => {
    expect(plugins().fold.sharedDuringBuild).toBe(true)
    expect(plugins().css.sharedDuringBuild).toBe(true)
  })

  test('output lifecycle plugins stay flat and follow a reordered output slot', () => {
    const { fold } = plugins()
    const firstUserPlugin = { name: 'test:first-output' }
    const secondUserPlugin = { name: 'test:second-output' }
    const first = { plugins: [firstUserPlugin] }
    const second = { plugins: [secondUserPlugin] }
    const input = { output: [first, second] }
    const options = hookOf(fold.options)!
    const context = { environment: { name: 'client' } }
    const names = (output: typeof first) => (output.plugins as Array<{ name?: string }>).map((plugin) => plugin.name)

    options.call(context as never, input as never)
    expect(names(first)).toEqual([
      'bamboocss:output-start:client:0',
      firstUserPlugin.name,
      'bamboocss:output-finalizer:client:0',
    ])
    expect(names(second)).toEqual([
      'bamboocss:output-start:client:1',
      secondUserPlugin.name,
      'bamboocss:output-finalizer:client:1',
    ])

    // Repeated resolution is idempotent, while swapping reused output objects replaces their
    // private slot identity without nesting or moving the user's plugin.
    options.call(context as never, input as never)
    input.output = [second, first]
    options.call(context as never, input as never)
    expect(names(second)).toEqual([
      'bamboocss:output-start:client:0',
      secondUserPlugin.name,
      'bamboocss:output-finalizer:client:0',
    ])
    expect(names(first)).toEqual([
      'bamboocss:output-start:client:1',
      firstUserPlugin.name,
      'bamboocss:output-finalizer:client:1',
    ])
  })

  test('the css emitter answers only for its own id', () => {
    const { css } = plugins()
    const resolve = css.resolveId as any

    expect(resolve.call({} as never, VIRTUAL_CSS_ID)).toBe(`\0${VIRTUAL_CSS_ID}`)
    expect(resolve.call({} as never, './styles.css')).toBeNull()
  })

  test('recipe state limits must be positive safe integers', () => {
    expect(() => plugins({ maxRecipeStates: 0 })).toThrow('positive safe integer')
    expect(() => plugins({ maxRecipeStates: 1.5 })).toThrow('positive safe integer')
    expect(() => plugins({ maxRecipeStates: 1 })).not.toThrow()
  })

  /**
   * The option `pruneCss` replaced, rejected rather than ignored.
   *
   * Vite loads `vite.config.ts` through esbuild, which strips types without checking them, so a
   * removed option reaches this function as an ordinary extra key — no type error unless the
   * project separately runs `tsc` over its config, which most do not. Ignoring it would switch
   * pruning and renaming back on for exactly the projects that turned them off on purpose.
   *
   * Asserted on `false`, the only value anyone set: `renameCssAsset: true` was the default and
   * still throws, which is right — the name is gone either way.
   */
  test('the removed renameCssAsset option is rejected, not ignored', () => {
    const removed = { renameCssAsset: false } as unknown as Parameters<typeof bamboocss>[0]

    expect(() => plugins(removed)).toThrow('`renameCssAsset` has been replaced by `pruneCss`')
    expect(() => plugins({ pruneCss: false })).not.toThrow()
    expect(() => plugins({})).not.toThrow()
  })

  test('the compiler cannot be disabled', async () => {
    const plugin = plugins().fold
    const hook = plugin.buildStart
    const handler = typeof hook === 'function' ? hook : hook?.handler

    // With the transform on, `buildStart` resolves a config — and there is none at this
    // cwd, so it rejects. Reaching for one at all is the observation.
    await expect(handler?.call({} as never, {} as never)).rejects.toBeTruthy()
  })
})

describe('file filtering', () => {
  const ignored = [
    '/app/node_modules/pkg/index.js',
    '/app/src/styles.css',
    '/app/src/logo.svg',
    '/app/index.html',
    '/app/src/data.json',
    // Virtual modules: no file on disk for the extractor to read, so a class folded
    // here would have nothing emitting a rule for it.
    '\0virtual:generated.tsx',
    '\0plugin-virtual:entry.ts',
    // Queries that make Vite serve a wrapper rather than the module's own source. The query
    // is stripped before the extension is tested, so without this these look like the file
    // itself — and the wrapper's text then overwrote the real file in the parser, breaking
    // every later fold that resolved against it.
    '/app/src/theme.tsx?raw',
    '/app/src/theme.tsx?url',
    '/app/src/heavy.ts?worker',
    '/app/src/heavy.ts?sharedworker',
    '/app/src/heavy.ts?worker&inline',
  ]

  test.each(ignored)('%s is not transformed', async (id) => {
    const plugin = plugins().fold

    // Returns before touching the context, so no config resolution is attempted.
    await expect(callTransform(plugin, SOURCE, id)).resolves.toBeNull()
  })

  /**
   * The queries that must still fold, which is why the rejection above is a deny list.
   *
   * Vite appends `?t=` to a module after an edit, and `?import` when a dynamic import is
   * rewritten. Rejecting an unrecognised query would stop folding the file a user just saved —
   * silently, since a declined transform says nothing and pruning then removes the rules its
   * atoms would have kept — so only the wrappers Vite actually generates are named.
   *
   * `?worker_file` is the trap: it is how the dev server serves a worker's *real* source, and
   * it contains "worker", so it is the obvious thing to add to the list above. Adding it would
   * stop folding every worker module in dev.
   */
  test.each(['?t=1712345678901', '?import', '?worker_file&type=module'])(
    'a %s id is still the module itself',
    async (query) => {
      const cwd = join(dirname(fileURLToPath(import.meta.url)), '../../../sandbox/codegen')
      const plugin = plugins({ cwd, reportSummary: false }).fold
      const buildStart = typeof plugin.buildStart === 'function' ? plugin.buildStart : plugin.buildStart?.handler
      await buildStart?.call({} as never, {} as never)

      const result = await callTransform(plugin, SOURCE, `${join(cwd, 'src/query-suffixed.tsx')}${query}`)

      expect(result, 'the module was folded despite its query').not.toBeNull()
    },
  )
})

/**
 * The generated `styled-system` is bamboo's own runtime rather than user source, and it
 * is not in the project's `include`, so handing it to the fold only produces parse
 * errors. Which files those are is decided by `outdir`, which is a user setting — so the
 * question is where the boundary sits, not whether one exists.
 */
describe('generated output', () => {
  const ctx = (cwd: string, outdir: string) => ({ config: { cwd, outdir } })

  test('the default outdir is recognised', () => {
    expect(isGeneratedOutput('/app/styled-system/css/css.mjs', ctx('/app', 'styled-system'))).toBe(true)
    expect(isGeneratedOutput('/app/src/Button.tsx', ctx('/app', 'styled-system'))).toBe(false)
  })

  test('a nested outdir is recognised', () => {
    expect(isGeneratedOutput('/app/src/styled-system/jsx/index.mjs', ctx('/app', 'src/styled-system'))).toBe(true)
  })

  /**
   * The case a bare last-segment match gets wrong. Generating into `src/styles` must not
   * make every directory called `styles` generated — that is where an app is most likely
   * to keep the style calls this transform exists to fold, and the loss would be silent.
   */
  test('a directory sharing the outdir name elsewhere in the tree is user source', () => {
    const config = ctx('/app', 'src/styles')

    expect(isGeneratedOutput('/app/src/styles/css/css.mjs', config)).toBe(true)
    expect(isGeneratedOutput('/app/packages/ui/styles/Button.tsx', config)).toBe(false)
    expect(isGeneratedOutput('/app/src/features/styles/theme.ts', config)).toBe(false)
  })

  test('a sibling whose name merely starts with the outdir is user source', () => {
    // `styled-system-static` sits next to `styled-system` and is not it.
    expect(isGeneratedOutput('/app/styled-system-static/app.tsx', ctx('/app', 'styled-system'))).toBe(false)
  })

  test('an absolute outdir is honoured rather than appended to the cwd', () => {
    expect(isGeneratedOutput('/generated/css/css.mjs', ctx('/app', '/generated'))).toBe(true)
    expect(isGeneratedOutput('/app/generated/css/css.mjs', ctx('/app', '/generated'))).toBe(false)
  })
})

describe('compiler', () => {
  const cwd = join(dirname(fileURLToPath(import.meta.url)), '../../../sandbox/codegen')

  const fold = async (options: Parameters<typeof bamboocss>[0], code: string, file: string) => {
    const plugin = plugins({ cwd, reportSummary: false, ...options }).fold
    const buildStart = typeof plugin.buildStart === 'function' ? plugin.buildStart : plugin.buildStart?.handler

    await buildStart?.call({} as never, {} as never)
    const result = await callTransform(plugin, code, join(cwd, file))

    return typeof result === 'object' && result !== null ? result.code : null
  }

  test('foreign recipe caches are isolated between environment transforms', async () => {
    const recipePath = join(cwd, 'src/__environment-recipe.tsx')
    const consumerPath = join(cwd, 'src/__environment-recipe-consumer.tsx')
    const consumer = `import { badge } from './__environment-recipe'\n` + `export const className = badge()\n`
    const recipe = (width: string) =>
      `import { cva } from 'styled-system/css'\n` + `export const badge = cva({ base: { width: '[${width}]' } })\n`
    const plugin = plugins({ cwd, reportSummary: false }).fold
    const buildStart = hookOf(plugin.buildStart)!
    const transform = hookOf(plugin.transform)!
    const compile = async (environment: string, width: string) => {
      const context = { addWatchFile() {}, environment: { name: environment } }
      await buildStart.call(context as never, {} as never)
      await transform.call(context as never, recipe(width), recipePath, {} as never)
      return transform.call(context as never, consumer, consumerPath, {} as never)
    }

    writeFileSync(recipePath, recipe('70.101px'))
    writeFileSync(consumerPath, consumer)
    try {
      const client = await compile('client', '70.101px')
      const ssr = await compile('ssr', '70.202px')
      const clientCode = typeof client === 'string' ? client : client?.code
      const ssrCode = typeof ssr === 'string' ? ssr : ssr?.code

      expect(clientCode).toContain('w_[70.101px]')
      expect(ssrCode).toContain('w_[70.202px]')
      expect(ssrCode).not.toContain('w_[70.101px]')
    } finally {
      rmSync(recipePath, { force: true })
      rmSync(consumerPath, { force: true })
    }
  })

  test('watches the Project resolution closure through a re-export bridge', async () => {
    const dependency = join(cwd, 'src/__resolution-watch-dependency.ts')
    const bridge = join(cwd, 'src/__resolution-watch-bridge.ts')
    const unrelated = join(cwd, 'src/__resolution-watch-unrelated.ts')
    const entry = join(cwd, 'src/__resolution-watch-entry.tsx')
    const source =
      `import { css } from 'styled-system/css'\n` +
      `import { shared } from './__resolution-watch-bridge'\n` +
      `import { runtime } from './__resolution-watch-unrelated'\n` +
      `export const className = css(shared)\nexport { runtime }\n`
    writeFileSync(dependency, `export const shared = { color: 'red.300' }\n`)
    writeFileSync(bridge, `export { shared } from './__resolution-watch-dependency'\n`)
    writeFileSync(unrelated, `export const runtime = Math.random()\n`)
    writeFileSync(entry, source)

    const plugin = plugins({ cwd, reportSummary: false }).fold
    const watched: string[] = []
    const context = { addWatchFile: (file: string) => watched.push(file), environment: { name: 'client' } }

    try {
      await hookOf(plugin.buildStart)?.call(context as never, {} as never)
      const result = await hookOf(plugin.transform)?.call(context as never, source, entry, {} as never)
      const code = typeof result === 'string' ? result : result?.code

      expect(code).toContain('c_red.300')
      expect(watched.sort()).toEqual([bridge, dependency].sort())
    } finally {
      rmSync(dependency, { force: true })
      rmSync(bridge, { force: true })
      rmSync(unrelated, { force: true })
      rmSync(entry, { force: true })
    }
  })

  test('watches and invalidates every source read while evaluating an imported helper', async () => {
    const leaf = join(cwd, 'src/__evaluated-helper-leaf.ts')
    const helper = join(cwd, 'src/__evaluated-helper.ts')
    const unrelated = join(cwd, 'src/__evaluated-helper-unrelated.ts')
    const entry = join(cwd, 'src/__evaluated-helper-entry.tsx')
    const source =
      `import { css } from 'styled-system/css'\n` +
      `import { decorate } from './__evaluated-helper'\n` +
      `import { runtime } from './__evaluated-helper-unrelated'\n` +
      `export const className = css(decorate())\nexport { runtime }\n`
    const tone = (color: string) => `export const tone = { color: '${color}' }\n`
    const decorate = () =>
      `import { tone } from './__evaluated-helper-leaf'\n` +
      `export const decorate = () => ({ ...tone, padding: '2' })\n`
    writeFileSync(leaf, tone('red.300'))
    writeFileSync(helper, decorate())
    writeFileSync(unrelated, `export const runtime = Math.random()\n`)
    writeFileSync(entry, source)

    const plugin = plugins({ cwd, reportSummary: false }).fold
    const watched: string[] = []
    const environment = { name: 'client' }
    const context = { addWatchFile: (file: string) => watched.push(file), environment }
    const transform = hookOf(plugin.transform)!
    const transformed = { id: entry }
    const invalidated: string[] = []
    const graph = {
      getModuleById: (id: string) => (id === entry ? transformed : undefined),
      getModulesByFile: () => undefined,
      invalidateModule: (module: typeof transformed) => invalidated.push(module.id),
    }

    try {
      await hookOf(plugin.buildStart)?.call(context as never, {} as never)
      const first = await transform.call(context as never, source, entry, {} as never)
      const firstCode = typeof first === 'string' ? first : first?.code

      expect(firstCode).toContain('c_red.300')
      expect(watched.sort()).toEqual([helper, leaf].sort())
      expect(watched).not.toContain(unrelated)

      writeFileSync(leaf, tone('blue.500'))
      hookOf(plugin.watchChange)?.call({} as never, leaf, { event: 'update' } as never)
      const update = hookOf(plugin.hotUpdate)?.call(
        { environment: { ...environment, moduleGraph: graph } } as never,
        { file: leaf, modules: [] } as never,
      )

      expect(invalidated, 'the dependency map reaches the compiled importer').toEqual([entry])
      expect(update).toEqual([transformed])

      watched.length = 0
      const second = await transform.call(context as never, source, entry, {} as never)
      const secondCode = typeof second === 'string' ? second : second?.code
      expect(secondCode).toContain('c_blue.500')
      expect(secondCode).not.toContain('c_red.300')
      expect(watched.sort(), 'the authoritative transform retains the evaluated closure').toEqual([helper, leaf].sort())

      invalidated.length = 0
      writeFileSync(leaf, tone('red.300'))
      hookOf(plugin.watchChange)?.call({} as never, leaf, { event: 'update' } as never)
      const repeatedUpdate = hookOf(plugin.hotUpdate)?.call(
        { environment: { ...environment, moduleGraph: graph } } as never,
        { file: leaf, modules: [] } as never,
      )

      expect(invalidated, 'the next edit still reaches the compiled importer').toEqual([entry])
      expect(repeatedUpdate).toEqual([transformed])
      const third = await transform.call(context as never, source, entry, {} as never)
      const thirdCode = typeof third === 'string' ? third : third?.code
      expect(thirdCode).toContain('c_red.300')
      expect(thirdCode).not.toContain('c_blue.500')

      const localSource =
        `import { css } from 'styled-system/css'\n` +
        `import { decorate } from './__evaluated-helper'\n` +
        `export const className = css({ color: 'green.400' })\nexport { decorate }\n`
      watched.length = 0
      writeFileSync(entry, localSource)
      const local = await transform.call(context as never, localSource, entry, {} as never)
      const localCode = typeof local === 'string' ? local : local?.code
      expect(localCode).toContain('c_green.400')
      expect(watched, 'a changed importer does not retain its old semantic targets').toEqual([])
    } finally {
      rmSync(leaf, { force: true })
      rmSync(helper, { force: true })
      rmSync(unrelated, { force: true })
      rmSync(entry, { force: true })
    }
  })

  test('replays evaluated-helper reads into independent query and environment states', async () => {
    const leaf = join(cwd, 'src/__cached-helper-leaf.ts')
    const helper = join(cwd, 'src/__cached-helper.ts')
    const entry = join(cwd, 'src/__cached-helper-entry.tsx')
    const clientId = `${entry}?client`
    const ssrId = `${entry}?ssr`
    const source =
      `import { css } from 'styled-system/css'\n` +
      `import { decorate } from './__cached-helper'\n` +
      `export const className = css(decorate())\n`
    const tone = (color: string) => `export const tone = { color: '${color}' }\n`
    writeFileSync(leaf, tone('red.300'))
    writeFileSync(
      helper,
      `import { tone } from './__cached-helper-leaf'\n` + `export const decorate = () => ({ ...tone, padding: '2' })\n`,
    )
    writeFileSync(entry, source)

    const plugin = plugins({ cwd, reportSummary: false }).fold
    const buildStart = hookOf(plugin.buildStart)!
    const transform = hookOf(plugin.transform)!
    const watchChange = hookOf(plugin.watchChange)!
    const hotUpdate = hookOf(plugin.hotUpdate)!
    const watched = { client: [] as string[], ssr: [] as string[] }
    const context = (name: keyof typeof watched) => ({
      addWatchFile: (file: string) => watched[name].push(file),
      environment: { name },
    })
    const clientModule = { id: clientId }
    const ssrModule = { id: ssrId }
    const invalidated = { client: [] as string[], ssr: [] as string[] }
    const graph = (name: keyof typeof invalidated, module: typeof clientModule) => ({
      getModuleById: (id: string) => (id === module.id ? module : undefined),
      getModulesByFile: () => undefined,
      invalidateModule: (candidate: typeof module) => invalidated[name].push(candidate.id),
    })

    try {
      await buildStart.call(context('client') as never, {} as never)
      const client = await transform.call(context('client') as never, source, clientId, {} as never)
      await buildStart.call(context('ssr') as never, {} as never)
      const ssr = await transform.call(context('ssr') as never, source, ssrId, {} as never)
      const codeOf = (result: typeof client) => (typeof result === 'string' ? result : result?.code)

      expect(codeOf(client)).toContain('c_red.300')
      expect(codeOf(ssr)).toContain('c_red.300')
      expect(watched.client.sort()).toEqual([helper, leaf].sort())
      expect(watched.ssr.sort(), 'the global cache hit replays reads into SSR').toEqual([helper, leaf].sort())

      writeFileSync(leaf, tone('blue.500'))
      watchChange.call({} as never, leaf, { event: 'update' } as never)
      const clientUpdate = hotUpdate.call(
        { environment: { name: 'client', moduleGraph: graph('client', clientModule) } } as never,
        { file: leaf, modules: [] } as never,
      )
      const ssrUpdate = hotUpdate.call(
        { environment: { name: 'ssr', moduleGraph: graph('ssr', ssrModule) } } as never,
        { file: leaf, modules: [] } as never,
      )

      expect(invalidated.client).toEqual([clientId])
      expect(invalidated.ssr).toEqual([ssrId])
      expect(clientUpdate).toEqual([clientModule])
      expect(ssrUpdate).toEqual([ssrModule])

      watched.client.length = 0
      watched.ssr.length = 0
      const nextClient = await transform.call(context('client') as never, source, clientId, {} as never)
      const nextSsr = await transform.call(context('ssr') as never, source, ssrId, {} as never)
      expect(codeOf(nextClient)).toContain('c_blue.500')
      expect(codeOf(nextSsr)).toContain('c_blue.500')
      expect(watched.client.sort()).toEqual([helper, leaf].sort())
      expect(watched.ssr.sort()).toEqual([helper, leaf].sort())
    } finally {
      rmSync(leaf, { force: true })
      rmSync(helper, { force: true })
      rmSync(entry, { force: true })
    }
  })

  test('stylesheet ownership is taken from the current environment generation', async () => {
    const entry = join(cwd, 'src/__environment-css-owner.tsx')
    const source =
      `import { css } from 'styled-system/css'\n` + `export const className = css({ width: '[70.303px]' })\n`
    const { css, fold: compiler } = plugins({ cwd, reportSummary: false })
    const config = { command: 'build', root: cwd, build: { sourcemap: false } }
    await hookOf(css.configResolved)?.call({} as never, config as never)
    await hookOf(compiler.configResolved)?.call({} as never, config as never)
    const resolvedCss = hookOf(css.resolveId)!.call({} as never, VIRTUAL_CSS_ID, undefined, {} as never) as string
    const environment = (name: string) => ({ name, config: { build: { emitAssets: true } } })
    const compile = async (name: string, importsCss: boolean) => {
      const currentEnvironment = environment(name)
      const ids = [entry, ...(importsCss ? [resolvedCss] : [])]
      const context = {
        addWatchFile() {},
        environment: currentEnvironment,
        getModuleIds: () => ids.values(),
        getModuleInfo: () => null,
      }
      await hookOf(compiler.buildStart)?.call(context as never, {} as never)
      await hookOf(compiler.transform)?.call(context as never, source, entry, {} as never)
      hookOf(compiler.buildEnd)?.call(context as never, undefined as never)
    }

    writeFileSync(entry, source)
    try {
      // `server` served the virtual module in an older generation. The completed sibling owns
      // the live stylesheet now, while the server's current graph deliberately does not.
      await hookOf(css.load)?.call(
        { addWatchFile() {}, environment: environment('server') } as never,
        resolvedCss,
        undefined as never,
      )
      await hookOf(css.load)?.call(
        { addWatchFile() {}, environment: environment('client') } as never,
        resolvedCss,
        undefined as never,
      )
      await compile('client', true)
      await compile('server', false)

      const generateBundle = hookOf(css.generateBundle)!
      await expect(
        generateBundle.call({ environment: environment('server') } as never, {} as never, {} as never, false),
      ).resolves.toBeUndefined()
    } finally {
      rmSync(entry, { force: true })
    }
  }, 60_000)

  test('merges recipe and css styles before class allocation', async () => {
    const source = `
      import { css, cva, cx } from 'styled-system/css'
      const badge = cva({ base: { display: 'flex', color: 'red.300' } })
      export const cls = cx(badge(), css({ display: 'flex', color: 'blue.500' }))
    `

    const code = await fold({}, source, 'src/static-composition.tsx')
    expect(code).toContain('"d_flex c_blue.500"')
    expect(code).not.toContain('cx(badge()')
  })

  test('static composition lowers a finite dynamic recipe to a StyleSet lookup', async () => {
    const plugin = plugins({
      cwd,
      reportSummary: false,
    }).fold
    const buildStart = typeof plugin.buildStart === 'function' ? plugin.buildStart : plugin.buildStart?.handler
    const buildEnd = typeof plugin.buildEnd === 'function' ? plugin.buildEnd : plugin.buildEnd?.handler

    await buildStart?.call({} as never, {} as never)
    const result = await callTransform(
      plugin,
      `
        import { cva } from 'styled-system/css'
        const badge = cva({ variants: { tone: { quiet: { color: 'gray.500' } } } })
        export const className = (tone) => badge({ tone })
      `,
      join(cwd, 'src/static-composition-dynamic.tsx'),
    )

    expect(result?.code).toContain('cvaMap([tone]')
    await expect(Promise.resolve().then(() => buildEnd?.call({} as never, undefined as never))).resolves.toBeUndefined()
  })

  test('the compiler removes a recipe decision table when cx makes every leaf identical', async () => {
    const plugin = plugins({
      cwd,
      reportSummary: false,
    }).fold
    const buildStart = typeof plugin.buildStart === 'function' ? plugin.buildStart : plugin.buildStart?.handler
    const buildEnd = typeof plugin.buildEnd === 'function' ? plugin.buildEnd : plugin.buildEnd?.handler

    await buildStart?.call({} as never, {} as never)
    const result = await callTransform(
      plugin,
      `
        import { css, cva, cx } from 'styled-system/css'
        const badge = cva({ variants: { tone: { quiet: { color: 'gray.500' } } } })
        export const className = (tone) => cx(badge({ tone }), css({ color: 'blue.500' }))
      `,
      join(cwd, 'src/static-composition-dynamic-cx.tsx'),
    )

    expect(result?.code).not.toContain('cvaMap(')
    expect(result?.code).toContain('=> "c_blue.500"')
    expect(result?.code).toContain('c_blue.500')
    await expect(Promise.resolve().then(() => buildEnd?.call({} as never, undefined as never))).resolves.toBeUndefined()
  })

  // Compaction belongs to the core `hash` option, which applies to every build path rather
  // than only this one. The compiler emits the names the stylesheet is written under, so the
  // two cannot disagree — which is what a second, Vite-only renaming layer kept getting wrong.
  test('static composition emits the atom names the stylesheet uses', async () => {
    const code = await fold(
      {},
      `import { css } from 'styled-system/css'\nexport const className = css({ display: 'flex', color: 'blue.500' })`,
      'src/static-composition-names.tsx',
    )

    expect(code).toContain('d_flex')
    expect(code).toContain('c_blue.500')
  })

  test('keeps cx as a tiny joiner when external arguments cannot be analyzed', async () => {
    const plugin = plugins({ cwd, reportSummary: false }).fold
    const buildStart = typeof plugin.buildStart === 'function' ? plugin.buildStart : plugin.buildStart?.handler
    const buildEnd = typeof plugin.buildEnd === 'function' ? plugin.buildEnd : plugin.buildEnd?.handler

    await buildStart?.call({} as never, {} as never)
    const transformed = await callTransform(
      plugin,
      `import { cx } from 'styled-system/css'\nexport const className = (external) => cx(external, 'selected')`,
      join(cwd, 'src/static-composition-dynamic-cx.tsx'),
    )

    expect(transformed).toBeNull()
    await expect(Promise.resolve().then(() => buildEnd?.call({} as never, undefined as never))).resolves.not.toThrow()
  })

  test('static composition rejects a runtime css value', async () => {
    const plugin = plugins({ cwd, reportSummary: false }).fold
    const buildStart = typeof plugin.buildStart === 'function' ? plugin.buildStart : plugin.buildStart?.handler
    const buildEnd = typeof plugin.buildEnd === 'function' ? plugin.buildEnd : plugin.buildEnd?.handler

    await buildStart?.call({} as never, {} as never)
    await callTransform(
      plugin,
      `import { css } from 'styled-system/css'\nexport const className = (tone) => css({ color: tone })`,
      join(cwd, 'src/static-composition-leaf.tsx'),
    )

    await expect(Promise.resolve().then(() => buildEnd?.call({} as never, undefined as never))).rejects.toThrow(
      'css() — dynamic',
    )
  })

  test('static composition rejects reflective reads of an inline recipe', async () => {
    const plugin = plugins({ cwd, reportSummary: false }).fold
    const buildStart = typeof plugin.buildStart === 'function' ? plugin.buildStart : plugin.buildStart?.handler
    const buildEnd = typeof plugin.buildEnd === 'function' ? plugin.buildEnd : plugin.buildEnd?.handler

    await buildStart?.call({} as never, {} as never)
    await callTransform(
      plugin,
      `
        import { cva } from 'styled-system/css'
        const badge = cva({ base: { color: 'red.300' } })
        export const className = badge()
        export const raw = badge.raw()
      `,
      join(cwd, 'src/static-composition-reflective-recipe.tsx'),
    )

    await expect(Promise.resolve().then(() => buildEnd?.call({} as never, undefined as never))).rejects.toThrow(
      'badge — runtime-binding',
    )
  })
})

describe('coverage summary', () => {
  const callBuildEnd = async (plugin: { buildEnd?: unknown }) => {
    const hook = plugin.buildEnd as any
    const handler = typeof hook === 'function' ? hook : hook?.handler
    return handler?.call({} as never, undefined as never)
  }

  test('is on by default and off when asked', () => {
    // The option exists so a build can opt out; the default is on, because without it
    // there is no signal that the transform did anything at all.
    expect(() => bamboocss()).not.toThrow()
    expect(() => bamboocss({ reportSummary: false })).not.toThrow()
  })

  test('says nothing before any module is transformed', async () => {
    await expect(callBuildEnd(plugins().fold)).resolves.toBeUndefined()
  })

  test('says nothing when no module was transformed', async () => {
    // A build that folded nothing and declined nothing has no coverage to report, and a
    // "0/0" line would be noise in every project not using the transform.
    await expect(callBuildEnd(plugins().fold)).resolves.toBeUndefined()
  })

  /**
   * `vite build --watch` reuses one plugin instance across rebuilds, so per-file results that
   * are never cleared describe every build since the first rather than the bundle just
   * written.
   *
   * Needs a real config, since a file is only recorded once a module actually folds —
   * `sandbox/codegen` has one. Without it this would pass whether or not the reset exists,
   * because a failed context records nothing either way.
   */
  test('counts are reset per build, so a watch rebuild reports only itself', async () => {
    const cwd = join(dirname(fileURLToPath(import.meta.url)), '../../../sandbox/codegen')
    const plugin = plugins({ cwd }).fold

    const logged: string[] = []
    const info = logger.info
    ;(logger as { info: typeof logger.info }).info = (_type: string, message: string) => {
      logged.push(message)
    }

    const buildStart = typeof plugin.buildStart === 'function' ? plugin.buildStart : plugin.buildStart?.handler

    try {
      await buildStart?.call({} as never, {} as never)
      const folded = await callTransform(plugin, SOURCE, join(cwd, 'src/watch-a.tsx'))
      await callBuildEnd(plugin)

      // The summary only reports when something was counted, so this is what makes the
      // second half meaningful.
      expect(folded).not.toBeNull()
      expect(logged).toHaveLength(1)

      // A second build that transformed nothing must have nothing to report.
      await buildStart?.call({} as never, {} as never)
      await callBuildEnd(plugin)

      expect(logged).toHaveLength(1)
    } finally {
      ;(logger as { info: typeof logger.info }).info = info
    }
  })

  /**
   * The summary still prints in dev, even for a project that configures `builder`.
   *
   * A build defers the summary until every environment of the run has compiled, so a client
   * and an SSR bundle produce one line rather than a partial and a total. Dev satisfies that
   * gate's premise in name only: a resolved config always lists both `client` and `ssr`, so
   * configuring `builder` announces two environments — while the dev server starts `buildStart`
   * and `buildEnd` for the client alone. The remaining environment is one that was never going
   * to start, and waiting for it stopped the summary printing at all, for exactly the framework
   * projects that configure `builder`.
   */
  test('the summary is not deferred in dev, where only one environment ever starts', async () => {
    const cwd = join(dirname(fileURLToPath(import.meta.url)), '../../../sandbox/codegen')
    // Both halves of one `bamboocss()` call, so they share the session the gate reads.
    const { css, fold } = plugins({ cwd })

    const logged: string[] = []
    const info = logger.info
    ;(logger as { info: typeof logger.info }).info = (_type: string, message: string) => {
      logged.push(message)
    }

    const hook = <T>(h: T | { handler: T } | undefined): T | undefined =>
      typeof h === 'function' ? h : (h as { handler: T } | undefined)?.handler

    try {
      // A dev server's resolved config: `builder` configured, and both environments listed —
      // which is what Vite always resolves, in serve as well as build.
      await hook(css.configResolved)?.call(
        {} as never,
        {
          command: 'serve',
          build: { sourcemap: false },
          builder: {},
          environments: { client: {}, ssr: {} },
        } as never,
      )
      await hook(fold.configResolved)?.call({} as never, { command: 'serve' } as never)

      // Only the client ever starts: `perEnvironmentStartEndDuringDev` is off by default.
      await hook(fold.buildStart)?.call({ environment: { name: 'client' } } as never, {} as never)
      const folded = await callTransform(fold, SOURCE, join(cwd, 'src/dev-summary.tsx'))
      await callBuildEnd(fold)

      expect(folded).not.toBeNull()
      expect(logged, 'dev still reports coverage').toHaveLength(1)
    } finally {
      ;(logger as { info: typeof logger.info }).info = info
    }
  })
})
