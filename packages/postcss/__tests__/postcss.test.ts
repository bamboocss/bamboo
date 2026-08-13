import { join } from 'path'
import postcss from 'postcss'
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'fs'
import { rm } from 'fs/promises'
import { logger } from '@bamboocss/logger'
import { afterAll, describe, expect, test, vi } from 'vitest'

import bamboocss, { builder, type PluginOptions } from '../src/index'

async function run(input: string, options: PluginOptions, from?: string) {
  const result = await postcss([bamboocss(options)]).process(input, { from: from || '/foo.css' })
  return result
}

describe('PostCSS plugin', () => {
  test('skip node modules files', async () => {
    const input = '@layer reset, base, tokens, recipes, utilities;'
    const result = await run(input, {}, '/node_modules/foo.css')

    expect(result.css).toBe(input)
  })

  test('skip non-css files', async () => {
    const input = '@layer reset, base, tokens, recipes, utilities;'
    const result = await run(input, {}, '/foo.js')

    expect(result.css).toBe(input)
  })

  test('use configured log file', async () => {
    const input = '@layer reset, base, tokens, recipes, utilities;'
    const configPath = join(__dirname, 'samples', 'bamboo.config.cjs')
    const logFilePath = join(__dirname, 'samples', 'bamboo.log')

    await run(input, { logfile: logFilePath, configPath })

    logger.info('test', 'foo')

    expect(existsSync(logFilePath)).toBe(true)
    await rm(logFilePath, { force: true })
  })

  test('process correctly css file', async () => {
    const input = '@layer reset, base, tokens, recipes, utilities;'
    const configPath = join(__dirname, 'samples', 'bamboo.config.cjs')

    const result = await run(input, { configPath })

    expect(result.css.length).toBeGreaterThan(2)
  })

  test('register `include` as dependencies', async () => {
    const input = '@layer reset, base, tokens, recipes, utilities;'
    const configPath = join(__dirname, 'samples', 'bamboo.config.cjs')

    const result = await run(input, { configPath })

    expect(result.messages).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          type: 'dir-dependency',
          glob: '**/*.{ts,tsx,jsx}',
          plugin: 'bamboocss',
          parent: '/foo.css',
        }),
        expect.objectContaining({
          type: 'dir-dependency',
          glob: '**/*.{css,pcss}',
          plugin: 'bamboocss',
          parent: '/foo.css',
        }),
      ]),
    )
  })

  test('register bamboo config as dependency', async () => {
    const input = '@layer reset, base, tokens, recipes, utilities;'
    const configPath = join(__dirname, 'samples', 'bamboo.config.cjs')

    const result = await run(input, { configPath })

    expect(result.messages).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          type: 'dependency',
          file: expect.stringContaining('bamboo.config.cjs'),
          plugin: 'bamboocss',
          parent: '/foo.css',
        }),
      ]),
    )
  })

  /**
   * A Vite project emitting the stylesheet through PostCSS gets no source compilation, and
   * nothing about the result says so: the stylesheet is right, the app renders, and the style
   * engine ships to the client. Bamboo's own React Router guide described that setup, so a
   * project reaches it by following the docs rather than by choosing it.
   *
   * Each case gets a project directory of its own because the warning is once per project, and
   * `builder` holds the first context it resolved — the same reason the race-condition test
   * below clears it.
   */
  describe('Vite without the source compiler', () => {
    const COMPILER_FLAG = Symbol.for('bamboocss.static-compiler')
    const projects: string[] = []

    const project = (name: string, options: { vite: boolean; include?: string[] }) => {
      const dir = join(__dirname, `samples-${name}`)
      projects.push(dir)
      mkdirSync(dir, { recursive: true })

      const config = String(readFileSync(join(__dirname, 'samples', 'bamboo.config.cjs')))
      writeFileSync(
        join(dir, 'bamboo.config.cjs'),
        options.include ? config.replace(/include: \[[^\]]*\]/, `include: ${JSON.stringify(options.include)}`) : config,
      )
      if (options.vite) writeFileSync(join(dir, 'vite.config.ts'), 'export default {}\n')
      return dir
    }

    // `cwd` as well as `configPath`, which is what a project has: the Vite config sits at the
    // root the build runs from, and that is the directory a resolved Bamboo config reports.
    const warningsFrom = async (dir: string, options: PluginOptions = {}) => {
      builder.context = undefined
      const warn = vi.spyOn(logger, 'warn').mockImplementation(() => {})
      try {
        await run('@layer reset, base, tokens, recipes, utilities;', {
          configPath: join(dir, 'bamboo.config.cjs'),
          cwd: dir,
          ...options,
        })
        return warn.mock.calls.filter(([, message]) => String(message).includes('Vite config'))
      } finally {
        warn.mockRestore()
      }
    }

    afterAll(() => {
      builder.context = undefined
      for (const dir of projects) rmSync(dir, { force: true, recursive: true })
    })

    test.sequential('warns when a Vite config sits beside the Bamboo config', async () => {
      const dir = project('vite-postcss', { vite: true })

      expect(await warningsFrom(dir)).toHaveLength(1)
      // Once per project, not once per stylesheet: a project with several entry CSS files
      // would otherwise repeat it for each.
      expect(await warningsFrom(dir)).toHaveLength(0)
    })

    test.sequential('says nothing without a Vite config', async () => {
      expect(await warningsFrom(project('postcss-only', { vite: false }))).toHaveLength(0)
    })

    /**
     * The exception, not a false positive. `@bamboocss/vite` transforms JavaScript and
     * TypeScript; a `.svelte` file is a template it leaves alone. Moving such a project onto it
     * would prune every rule only its components reach — reachability comes from what the
     * compiler saw — and render the pages unstyled. PostCSS is the right integration there.
     */
    test.sequential('says nothing to a project whose components it could not compile', async () => {
      const dir = project('vite-svelte', { vite: true, include: ['./src/**/*.{js,svelte,ts}'] })

      expect(await warningsFrom(dir)).toHaveLength(0)
    })

    test.sequential('`runtimeStyling` declares the intent and silences it', async () => {
      const dir = project('vite-deliberate', { vite: true })

      expect(await warningsFrom(dir, { runtimeStyling: true })).toHaveLength(0)
    })

    // Last, because the flag it sets belongs to the process and cannot be scoped to a project.
    test.sequential('says nothing when a Bamboo source compiler is loaded', async () => {
      const dir = project('vite-compiled', { vite: true })
      const globals = globalThis as Record<symbol, unknown>

      globals[COMPILER_FLAG] = true
      try {
        expect(await warningsFrom(dir)).toHaveLength(0)
      } finally {
        delete globals[COMPILER_FLAG]
      }
    })
  })

  test.sequential('`Builder` instance race condition when postcss invokes bamboo processing simultaneously', async () => {
    builder.context = undefined
    const setupContextSpy = vi.spyOn(builder, 'setupContext')

    const setupOrder: string[] = []
    const setupOriginal = builder.setup
    const setupSpy = vi.spyOn(builder, 'setup').mockImplementation((...args) => {
      setupOrder.push('enter')
      return setupOriginal.apply(this, args).finally(() => setupOrder.push('leave'))
    })

    try {
      const input = '@layer reset, base, tokens, recipes, utilities;'
      const configPath = join(__dirname, 'samples', 'bamboo.config.cjs')

      await Promise.all([1, 2, 3, 4].map(() => run(input, { configPath })))

      expect(setupContextSpy).toHaveBeenCalledTimes(1)
      expect(setupOrder).toEqual(['enter', 'leave', 'enter', 'leave', 'enter', 'leave', 'enter', 'leave'])
    } finally {
      setupContextSpy.mockRestore()
      setupSpy.mockRestore()
    }
  })
})
