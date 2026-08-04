import { logger } from '@bamboocss/logger'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, test } from 'vitest'
import { bamboocss } from '../src/plugin'

/**
 * The plugin wrapper, separate from the fold itself.
 *
 * These assert the contract a user relies on before any config is even loaded: that
 * the transform is opt-in, that it is build-only, and that it does not reach for a
 * bamboo config when it has nothing to do. A regression in any of those would either
 * silently rewrite code nobody asked to rewrite, or make every Vite project pay for
 * config resolution it does not need.
 */
const callTransform = async (plugin: ReturnType<typeof bamboocss>, code: string, id: string) => {
  const hook = plugin.transform
  const handler = typeof hook === 'function' ? hook : hook?.handler
  if (!handler) throw new Error('plugin has no transform hook')
  return handler.call({} as never, code, id, {} as never)
}

const SOURCE = `import { css } from 'styled-system/css'\nexport const cls = css({ color: 'red.300' })\n`

describe('plugin contract', () => {
  test('is named and runs before other plugins', () => {
    const plugin = bamboocss()

    expect(plugin.name).toBe('bamboocss')
    // Runs `pre` so it sees module source as close as possible to what the CSS
    // extractor reads off disk.
    expect(plugin.enforce).toBe('pre')
  })

  test('applies to build only', () => {
    expect(bamboocss().apply).toBe('build')
    expect(bamboocss({ transform: true }).apply).toBe('build')
  })

  test('transform is off by default', async () => {
    const plugin = bamboocss()

    // No config is loaded and nothing is rewritten. If this ever returned a result it
    // would mean opting in was no longer required.
    await expect(callTransform(plugin, SOURCE, '/app/src/a.tsx')).resolves.toBeNull()
  })

  test('buildStart does not load config when the transform is off', async () => {
    const plugin = bamboocss()
    const hook = plugin.buildStart
    const handler = typeof hook === 'function' ? hook : hook?.handler

    // Would throw trying to resolve a bamboo config if it did any work.
    await expect(handler?.call({} as never, {} as never)).resolves.toBeUndefined()
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

  test.each(ignored)('%s is not transformed even when enabled', async (id) => {
    const plugin = bamboocss({ transform: true })

    // Returns before touching the context, so no config resolution is attempted.
    await expect(callTransform(plugin, SOURCE, id)).resolves.toBeNull()
  })
})

describe('coverage summary', () => {
  const callBuildEnd = async (plugin: ReturnType<typeof bamboocss>) => {
    const hook = plugin.buildEnd
    const handler = typeof hook === 'function' ? hook : hook?.handler
    return handler?.call({} as never, undefined as never)
  }

  test('is on by default and off when asked', () => {
    // The option exists so a build can opt out; the default is on, because without it
    // there is no signal that the transform did anything at all.
    expect(() => bamboocss({ transform: true })).not.toThrow()
    expect(() => bamboocss({ transform: true, reportSummary: false })).not.toThrow()
  })

  test('says nothing when the transform is off', async () => {
    await expect(callBuildEnd(bamboocss())).resolves.toBeUndefined()
  })

  test('says nothing when no module was transformed', async () => {
    // A build that folded nothing and declined nothing has no coverage to report, and a
    // "0/0" line would be noise in every project not using the transform.
    await expect(callBuildEnd(bamboocss({ transform: true }))).resolves.toBeUndefined()
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
    const plugin = bamboocss({ transform: true, cwd })

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
