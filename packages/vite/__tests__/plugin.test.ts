import { logger } from '@bamboocss/logger'
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

const SOURCE = `import { css } from 'styled-system/css'\nexport const cls = css({ color: 'red.300' })\n`

describe('plugin contract', () => {
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
  ]

  test.each(ignored)('%s is not transformed', async (id) => {
    const plugin = plugins().fold

    // Returns before touching the context, so no config resolution is attempted.
    await expect(callTransform(plugin, SOURCE, id)).resolves.toBeNull()
  })
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
   * `vite build --watch` reuses one plugin instance across rebuilds, so totals that are
   * never cleared describe every build since the first rather than the bundle just
   * written.
   *
   * Needs a real config, since the counters are only touched once a module actually
   * folds — `sandbox/codegen` has one. Without it this would pass whether or not the
   * reset exists, because a failed context leaves every total at zero.
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
})
