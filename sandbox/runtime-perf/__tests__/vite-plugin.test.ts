import { mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import bamboocss from '@bamboocss/vite'
import { build, type Rollup } from 'vite'
import { afterEach, describe, expect, test } from 'vitest'

/**
 * The plugin driven by a real Vite build, rather than by calling its hooks directly.
 *
 * The fold engine is covered thoroughly on its own, but everything between it and Vite
 * was only asserted at the contract boundary: that `transform` is opt-in, that `apply`
 * is `build`, that the id filter rejects assets. None of that shows the plugin actually
 * loads a config, reaches the fold, and puts the result in the bundle — which is the
 * part a user experiences.
 */
const here = dirname(fileURLToPath(import.meta.url))
const cwd = join(here, '..')

const bundle = async (options: Parameters<typeof bamboocss>[0]) => {
  const result = (await build({
    root: cwd,
    logLevel: 'silent',
    plugins: [bamboocss({ cwd, ...options })],
    build: {
      write: false,
      minify: false,
      lib: { entry: join(here, '../src/parity/tree.tsx'), formats: ['es'], fileName: 'tree' },
      rollupOptions: { external: [/^react/, /styled-system/] },
    },
  })) as Rollup.RollupOutput[]

  return result[0]!.output.map((chunk) => ('code' in chunk ? chunk.code : '')).join('\n')
}

describe('vite plugin, real build', () => {
  test('folds through an actual build when enabled', async () => {
    const code = await bundle({ transform: true })

    // A folded class string, produced by the fold and carried into the bundle.
    expect(code).toContain('c_blue600')
    // The factory element it replaced is gone.
    expect(code).not.toContain('styled.span')
  }, 60_000)

  test('leaves the bundle alone when the transform is off', async () => {
    // Explicit, now that the fold is on by default: this is the opt-out being exercised.
    const code = await bundle({ transform: false })

    // Still the factory call, so nothing folded.
    expect(code).toContain('styled')
    expect(code).not.toContain('c_blue600')
  }, 60_000)

  /**
   * Each declining shape is named individually, because a fold that corrupts one of them
   * corrupts it in a way only that shape shows. Matching loosely — any `rest` anywhere in
   * the bundle — passes just as well when the element it was meant to describe has been
   * rewritten into a div.
   */
  test('declining shapes survive a real build', async () => {
    const code = await bundle({ transform: true })

    // Still calling `css` at runtime, with the value that made each one decline.
    expect(code).toContain('padding: { base: "sm", md: tone }')
    expect(code).toContain('...rest')

    // And the dynamic pattern call site still calls the pattern.
    expect(code).toContain('flex({ direction: "column", gap: tone')

    // The dynamic call site is lowered rather than keeping its call. Matched by its
    // arguments rather than by the helper's name, which the bundler is free to rename.
    expect(code).toMatch(/\w+\("c_", "color", tone\)/)
    expect(code).not.toContain('css({ color: tone })')

    // A lowered ternary, both arms resolved, through a real build.
    expect(code).toContain('flag ? "c_red600" : "c_green600"')

    // And one whose arms would collide on a single property, left whole.
    expect(code).toContain(`mx: flag ? "xs" : "sm"`)
  }, 60_000)
})

/**
 * A rebuild, driven by Vite's own watcher.
 *
 * The plugin refreshes a changed module in `watchChange`, which only works if the bundler
 * calls that hook before the rebuild reads anything. That ordering is Vite's to keep, not
 * bamboo's, and calling the hook by hand — which is what the unit tests in
 * `packages/vite` do — asserts the effect of the refresh while assuming the schedule.
 * This is the assumption, run.
 */
describe('vite plugin, real rebuild', () => {
  const fixtureDir = join(cwd, '__watch-tmp')
  const dependency = join(fixtureDir, 'dep.ts')
  const entry = join(fixtureDir, 'entry.ts')
  const outDir = join(fixtureDir, 'out')

  const writeDependency = (color: string) => writeFileSync(dependency, `export const shared = { color: '${color}' }\n`)

  afterEach(() => rmSync(fixtureDir, { force: true, recursive: true }))

  test('an edited module is re-read before the rebuild folds against it', async () => {
    mkdirSync(fixtureDir, { recursive: true })
    writeDependency('blue600')
    writeFileSync(
      entry,
      `import { css } from '../styled-system/css'\nimport { shared } from './dep'\nexport const cls = css(shared)\n`,
    )

    const watcher = (await build({
      root: cwd,
      logLevel: 'silent',
      plugins: [bamboocss({ cwd, transform: true, reportSummary: false })],
      build: {
        watch: {},
        minify: false,
        outDir,
        emptyOutDir: false,
        lib: { entry, formats: ['es'], fileName: 'entry' },
        rollupOptions: { external: [/styled-system/] },
      },
    })) as Rollup.RollupWatcher

    /** Resolves on the next completed build, so an edit can be awaited rather than slept on. */
    const nextBuild = () =>
      new Promise<void>((resolve, reject) => {
        const onEvent = (event: { code: string; error?: Error }) => {
          if (event.code === 'END') {
            watcher.off('event', onEvent)
            resolve()
          } else if (event.code === 'ERROR') {
            watcher.off('event', onEvent)
            reject(event.error)
          }
        }
        watcher.on('event', onEvent)
      })

    // Whatever the build wrote, rather than a name derived from the format and the
    // package's `type` — the assertion is about the contents, not about Vite's naming.
    const output = () =>
      readdirSync(outDir)
        .filter((file) => file.endsWith('.js') || file.endsWith('.mjs'))
        .map((file) => readFileSync(join(outDir, file), 'utf8'))
        .join('\n')

    try {
      await nextBuild()
      expect(output()).toContain('"c_blue600"')

      const rebuilt = nextBuild()
      // Edited a beat after the first build rather than immediately. The watcher arms
      // itself once that build settles, and a write landing before then is either missed
      // or folded into the same debounce window — which reads as "the rebuild never
      // happened" rather than as a race. Waiting longer only makes this more reliable.
      await new Promise((settle) => setTimeout(settle, 800))
      writeDependency('red600')
      await rebuilt

      // The assertion the whole hook exists for. Without the refresh this is still
      // `c_blue600` — and stays that way for the life of the watch session.
      expect(output()).toContain('"c_red600"')
      expect(output()).not.toContain('"c_blue600"')
    } finally {
      await watcher.close()
    }
  }, 120_000)
})
