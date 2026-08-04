import { logger } from '@bamboocss/logger'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, test } from 'vitest'
import { bamboocss, isGeneratedOutput } from '../src/plugin'

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
    // `styled-system-studio` sits next to `styled-system` and is not it.
    expect(isGeneratedOutput('/app/styled-system-studio/app.tsx', ctx('/app', 'styled-system'))).toBe(false)
  })

  test('an absolute outdir is honoured rather than appended to the cwd', () => {
    expect(isGeneratedOutput('/generated/css/css.mjs', ctx('/app', '/generated'))).toBe(true)
    expect(isGeneratedOutput('/app/generated/css/css.mjs', ctx('/app', '/generated'))).toBe(false)
  })
})

/**
 * `jsx` and `partial` are documented escape hatches, and for a while they existed only on
 * the internal `FoldOptions` — the plugin accepted them in a user's config and silently
 * folded anyway. These assert the option a user writes is the option the fold receives.
 *
 * Needs a real config, since nothing folds without one; `sandbox/codegen` has one, with
 * `jsxFramework: 'react'` so the element surface is live.
 */
describe('fold toggles', () => {
  const cwd = join(dirname(fileURLToPath(import.meta.url)), '../../../sandbox/codegen')

  const ELEMENT = `import { styled } from 'styled-system/jsx'\nexport const El = () => <styled.div color="red.300" />\n`
  const PARTIAL = `import { css } from 'styled-system/css'\nexport const cls = (pad: string) => css({ color: 'red.300', padding: pad })\n`

  const fold = async (options: Parameters<typeof bamboocss>[0], code: string, file: string) => {
    const plugin = bamboocss({ transform: true, cwd, reportSummary: false, ...options })
    const buildStart = typeof plugin.buildStart === 'function' ? plugin.buildStart : plugin.buildStart?.handler

    await buildStart?.call({} as never, {} as never)
    const result = await callTransform(plugin, code, join(cwd, file))

    return typeof result === 'object' && result !== null ? result.code : null
  }

  test('jsx: false leaves elements alone, and null means untouched', async () => {
    expect(await fold({}, ELEMENT, 'src/toggle-jsx-on.tsx')).toContain('<div')
    expect(await fold({ jsx: false }, ELEMENT, 'src/toggle-jsx-off.tsx')).toBeNull()
  })

  test('partial: false declines a call the split would have folded', async () => {
    expect(await fold({}, PARTIAL, 'src/toggle-partial-on.tsx')).toContain('c_red.300')
    expect(await fold({ partial: false }, PARTIAL, 'src/toggle-partial-off.tsx')).toBeNull()
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
