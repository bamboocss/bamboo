import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { logger } from '@bamboocss/logger'
import { esc } from '@bamboocss/shared'
import bamboocss from '@bamboocss/vite'
import { build, createBuilder as createVite7Builder, createServer, type Plugin as VitePlugin, type Rollup } from 'vite'
import { build as buildVite8, createBuilder, type Plugin } from 'vite8'
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'

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

/** Keep a watcher's extraction graph inside its own fixture instead of all scratch files. */
const writeIsolatedBambooConfig = (path: string, include: string[]) =>
  writeFileSync(
    path,
    `import base from './bamboo.config'\n` + `export default { ...base, include: ${JSON.stringify(include)} }\n`,
  )

const readOutputFiles = (directory: string, extension: string) =>
  existsSync(directory)
    ? readdirSync(directory)
        .filter((file) => file.endsWith(extension))
        .sort()
        .map((file) => readFileSync(join(directory, file), 'utf8'))
        .join('\n')
    : ''

describe('vite plugin, real build', () => {
  test('shares recipe and utility atoms through a real build', async () => {
    const entry = join(cwd, 'src/__static-composition-test.tsx')
    writeFileSync(
      entry,
      `
        import 'virtual:bamboo.css'
        import { css, cva, cx, viewTransition } from '../styled-system/css'
        const box = cva({
          base: { width: '[123.4567px]', color: 'red600' },
          variants: {
            state: {
              selected: { height: '[234.5678px]' },
              unreachable: { height: '[345.6789px]' },
            },
          },
        })
        export const className = cx(box({ state: 'selected' }), css({ width: '[123.4567px]', color: 'blue600' }))
        const dynamicBadge = cva({
          base: { minWidth: '[456.789px]' },
          variants: {
            tone: {
              compact: { maxWidth: '[567.891px]' },
              expanded: { maxWidth: '[678.912px]' },
            },
          },
          defaultVariants: { tone: 'compact' },
          compoundVariants: [{ tone: 'expanded', css: { opacity: 0.75 } }],
        })
        export const dynamicClassName = (tone) => dynamicBadge({ tone })
        export const transitionClassName = viewTransition({ old: { opacity: 0.314159 } })
      `,
    )

    try {
      const result = (await build({
        root: cwd,
        logLevel: 'silent',
        // The sandbox's PostCSS config targets its browser entry URL; this library-mode
        // fixture exercises Vite's CSS asset graph directly and needs no additional plugins.
        css: { postcss: { plugins: [] } },
        plugins: [bamboocss({ cwd, reportSummary: false })],
        build: {
          write: false,
          minify: false,
          lib: { entry, formats: ['es'], fileName: 'static-composition' },
          rollupOptions: { external: [/^react/] },
        },
      })) as Rollup.RollupOutput[]

      const css = result[0]!.output
        .map((output) => ('source' in output && typeof output.source === 'string' ? output.source : ''))
        .join('\n')
      const js = result[0]!.output.map((output) => ('code' in output ? output.code : '')).join('\n')

      expect(js).toMatch(/"[\w[]\S*_\S+ \S+_\S+/)
      expect(js).toContain('w_[123.4567px]')
      expect(js).toContain('c_blue600')
      expect(js).toContain('h_[234.5678px]')
      expect(js).not.toContain('red600')
      expect(js).not.toContain('createCss')
      expect(js).not.toContain('viewTransition(')
      expect(js).toContain('cvaMap')
      expect(css).toMatch(/\.\S+_\S+\s*\{/)
      expect(css).toContain('123.4567px')
      expect(css.match(/width:\s*123\.4567px/g)).toHaveLength(1)
      expect(css).toMatch(/height:\s*234\.5678px/)
      expect(css).not.toContain('345.6789px')
      expect(css).toMatch(/min-width:\s*456\.789px/)
      expect(css).toMatch(/max-width:\s*567\.891px/)
      expect(css).toMatch(/max-width:\s*678\.912px/)
      expect(css).toMatch(/opacity:\s*0\.75/)
      expect(css).toMatch(/opacity:\s*0\.314159/)
      expect(css).not.toMatch(/@layer recipes\{/)

      // Execute the emitted decision table, then verify every runtime class has a retained
      // selector. This catches drift between the generated helper, the fold's table format,
      // reachability pruning, and final compact-name rewriting in one assertion chain.
      const built = (await import(`data:text/javascript;base64,${Buffer.from(js).toString('base64')}`)) as {
        dynamicClassName: (tone: unknown) => string
        transitionClassName: string
      }
      const defaultClass = built.dynamicClassName(undefined)
      const compactClass = built.dynamicClassName('compact')
      const expandedClass = built.dynamicClassName('expanded')
      const missingClass = built.dynamicClassName('unknown')
      expect(defaultClass).toBe(compactClass)
      expect(expandedClass).not.toBe(compactClass)
      expect(built.dynamicClassName(null)).toBe(missingClass)
      for (const className of [defaultClass, expandedClass, missingClass]) {
        for (const token of className.split(' ')) expect(css).toContain(`.${esc(token)} {`)
      }
      expect(css).toContain(`.${esc(built.transitionClassName)} {`)
      expect(css).toContain(`view-transition-class: ${built.transitionClassName}`)
      expect(css).toContain(`::view-transition-old(.${esc(built.transitionClassName)})`)
    } finally {
      rmSync(entry, { force: true })
    }
  }, 60_000)

  test('static composition proves the CSS and Vite source graphs agree', async () => {
    const outside = join(cwd, '__static-composition-outside.ts')
    writeFileSync(
      outside,
      `
        import 'virtual:bamboo.css'
        import { css } from './styled-system/css'
        export const className = css({ width: '[987.654px]' })
      `,
    )

    try {
      await expect(
        build({
          root: cwd,
          logLevel: 'silent',
          css: { postcss: { plugins: [] } },
          plugins: [bamboocss({ cwd, reportSummary: false })],
          build: {
            write: false,
            minify: false,
            lib: { entry: outside, formats: ['es'], fileName: 'outside' },
            rollupOptions: { external: [/^react/] },
          },
        }),
      ).rejects.toThrow('outside the CSS extraction graph')
    } finally {
      rmSync(outside, { force: true })
    }
  }, 60_000)

  test('static composition requires its virtual stylesheet to be imported', async () => {
    const entry = join(cwd, 'src/__static-composition-no-css.ts')
    writeFileSync(
      entry,
      `import { css } from '../styled-system/css'\nexport const className = css({ width: '[876.543px]' })\n`,
    )

    try {
      await expect(
        build({
          root: cwd,
          logLevel: 'silent',
          plugins: [bamboocss({ cwd, reportSummary: false })],
          build: {
            write: false,
            minify: false,
            lib: { entry, formats: ['es'], fileName: 'no-css' },
            rollupOptions: { external: [/^react/] },
          },
        }),
      ).rejects.toThrow('was not imported')
    } finally {
      rmSync(entry, { force: true })
    }
  }, 60_000)

  test('CSS asset identity follows late reachability pruning', async () => {
    const entry = join(cwd, 'src/__static-composition-asset-hash.tsx')
    const writeEntry = (tone: 'a' | 'b') =>
      writeFileSync(
        entry,
        `
          import 'virtual:bamboo.css'
          import { cva } from '../styled-system/css'
          const badge = cva({ variants: { tone: {
            a: { width: '[731.111px]' },
            b: { width: '[731.222px]' },
          } } })
          export const className = badge({ tone: '${tone}' })
        `,
      )

    const run = async () => {
      const result = (await build({
        root: cwd,
        logLevel: 'silent',
        css: { postcss: { plugins: [] } },
        plugins: [bamboocss({ cwd, reportSummary: false })],
        build: {
          write: false,
          minify: false,
          lib: { entry, formats: ['es'], fileName: 'asset-hash' },
          rollupOptions: {
            external: [/^react/],
            output: { assetFileNames: 'assets/[name]-[hash][extname]' },
          },
        },
      })) as Rollup.RollupOutput[]
      const asset = result[0]!.output.find((output) => output.type === 'asset' && output.fileName.endsWith('.css'))
      if (!asset) throw new Error('expected a CSS asset')
      return { fileName: asset.fileName, source: String(asset.source) }
    }

    try {
      writeEntry('a')
      const a = await run()
      writeEntry('b')
      const b = await run()

      expect(a.source).toContain('731.111px')
      expect(a.source).not.toContain('731.222px')
      expect(b.source).toContain('731.222px')
      expect(b.source).not.toContain('731.111px')
      expect(a.fileName).not.toBe(b.fileName)
    } finally {
      rmSync(entry, { force: true })
    }
  }, 60_000)

  /**
   * `pruneCss: false` is the whole of the opt-out, and it opts out of both halves.
   *
   * The rename is not separately declinable, because pruned bytes under the unpruned sheet's
   * name is the one combination that ships a stylesheet a CDN will serve stale. So the sheet
   * keeps every rule the source graph produced *and* the name Vite gave it — which is what a
   * downstream consumer computing integrity hashes or a precache manifest from the asset
   * needs, since both are invalidated by a late edit rather than by a late rename.
   */
  test('pruneCss: false ships the whole sheet under Vite’s own name', async () => {
    const entry = join(cwd, 'src/__static-composition-unpruned.tsx')
    writeFileSync(
      entry,
      `
        import 'virtual:bamboo.css'
        import { cva } from '../styled-system/css'
        const badge = cva({ variants: { tone: {
          a: { width: '[733.111px]' },
          b: { width: '[733.222px]' },
        } } })
        export const className = badge({ tone: 'a' })
      `,
    )

    const run = async (pruneCss: boolean) => {
      const result = (await build({
        root: cwd,
        logLevel: 'silent',
        css: { postcss: { plugins: [] } },
        plugins: [bamboocss({ cwd, reportSummary: false, pruneCss })],
        build: {
          write: false,
          minify: false,
          lib: { entry, formats: ['es'], fileName: 'static-composition-unpruned' },
          rollupOptions: {
            external: [/^react/],
            output: { assetFileNames: 'assets/[name]-[hash][extname]' },
          },
        },
      })) as Rollup.RollupOutput[]
      const asset = result[0]!.output.find((output) => output.type === 'asset' && output.fileName.endsWith('.css'))
      if (!asset) throw new Error('expected a CSS asset')
      return { fileName: asset.fileName, source: String(asset.source) }
    }

    try {
      const pruned = await run(true)
      const whole = await run(false)

      // The selected variant is in both; only the unselected one distinguishes them.
      expect(pruned.source).toContain('733.111px')
      expect(pruned.source, 'the variant nothing selects').not.toContain('733.222px')
      expect(whole.source).toContain('733.111px')
      expect(whole.source, 'nothing is removed when pruning is off').toContain('733.222px')

      // Both halves declined together. Asserted as "the pruned name is the unpruned one plus a
      // segment" rather than merely "no `.b-` segment": the two runs feed identical pre-prune
      // CSS to the same Rollup, so Vite's own name is identical across them, and stripping the
      // segment has to land back on it. The weaker form would still pass if the unpruned run
      // had emitted some entirely different asset.
      expect(pruned.fileName).toMatch(/\.b-[^.]+\.css$/)
      expect(pruned.fileName.replace(/\.b-[^.]+\.css$/, '.css'), 'the rename goes with the prune').toBe(whole.fileName)
    } finally {
      rmSync(entry, { force: true })
    }
  }, 60_000)

  /**
   * A `.tsx` the entry also imports as `?raw` must not corrupt the real module.
   *
   * The query has to be stripped before the extension is tested, or nothing matches `.tsx` —
   * and stripping it made `./dep.tsx?raw`, whose text is `export default "…"`, look like the
   * file itself. The transform handed that wrapper to ts-morph under the real file's path, so
   * the next module to fold against that file read the wrapper and found none of its exports.
   *
   * It presented as a build failure blaming source that was already static: "1 call(s) could
   * not be compiled … make the values finite and statically analyzable". And it depended on
   * which of the two ids Rollup transformed last, so moving an import could start it.
   *
   * A consumer is imported on each side of the `?raw` line. Only a consumer folded *after* the
   * wrapper lands is exposed, and which that is depends on the order Rollup happens to
   * transform in — so with one on each side the test cannot quietly stop covering the bug if
   * that order changes, which Rolldown is the likeliest thing to do.
   */
  test('a ?raw import of a .tsx does not corrupt folding against that module', async () => {
    const dep = join(cwd, 'src/__static-composition-raw-dep.tsx')
    const before = join(cwd, 'src/__static-composition-raw-before.tsx')
    const after = join(cwd, 'src/__static-composition-raw-after.tsx')
    const entry = join(cwd, 'src/__static-composition-raw.tsx')

    writeFileSync(dep, `export const shared = { width: '[58.8px]' }\n`)
    const consumer = (height: string) =>
      `import { css } from '../styled-system/css'\n` +
      `import { shared } from './__static-composition-raw-dep'\n` +
      `export const cls = css({ ...shared, height: '[${height}]' })\n`
    writeFileSync(before, consumer('58.1px'))
    writeFileSync(after, consumer('58.2px'))
    writeFileSync(
      entry,
      `import 'virtual:bamboo.css'\n` +
        `import { cls as one } from './__static-composition-raw-before'\n` +
        `import text from './__static-composition-raw-dep.tsx?raw'\n` +
        `import { cls as two } from './__static-composition-raw-after'\n` +
        `export const a = [one, text, two]\n`,
    )

    try {
      const result = (await build({
        root: cwd,
        logLevel: 'silent',
        css: { postcss: { plugins: [] } },
        plugins: [bamboocss({ cwd, reportSummary: false })],
        build: {
          write: false,
          minify: false,
          lib: { entry, formats: ['es'], fileName: 'static-composition-raw' },
          rollupOptions: { external: [/^react/] },
        },
      })) as Rollup.RollupOutput[]

      const css = result[0]!.output
        .map((output) => ('source' in output && typeof output.source === 'string' ? output.source : ''))
        .join('\n')
      const js = result[0]!.output.map((output) => ('code' in output ? output.code : '')).join('\n')

      // Both cross-file folds resolved `shared` from the real module, whichever order they ran
      // in relative to the wrapper, and both atoms have rules.
      expect(js, 'the class folded before the ?raw import').toContain('h_[58.1px]')
      expect(js, 'the class folded after the ?raw import').toContain('h_[58.2px]')
      expect(js, 'the property they share, read from the real module').toContain('w_[58.8px]')
      expect(css).toContain('58.1px')
      expect(css).toContain('58.2px')
      expect(css).toContain('58.8px')
      // The `?raw` module still carries the file as text, which is what it is for.
      expect(js).toContain('export const shared')
    } finally {
      for (const file of [dep, before, after, entry]) rmSync(file, { force: true })
    }
  }, 60_000)

  test('late CSS asset naming updates HTML and manifest references', async () => {
    const html = join(cwd, '__static-composition-index.html')
    const entry = join(cwd, 'src/__static-composition-html.tsx')
    writeFileSync(html, `<script type="module" src="/src/__static-composition-html.tsx"></script>`)
    writeFileSync(
      entry,
      `import 'virtual:bamboo.css'\nimport { css } from '../styled-system/css'\ndocument.body.className = css({ width: '[741.333px]' })\n`,
    )

    try {
      const result = (await build({
        root: cwd,
        logLevel: 'silent',
        css: { postcss: { plugins: [] } },
        plugins: [bamboocss({ cwd, reportSummary: false })],
        build: {
          write: false,
          manifest: true,
          minify: false,
          cssCodeSplit: false,
          rollupOptions: {
            input: html,
            output: { assetFileNames: 'assets/[name]-[hash][extname]' },
          },
        },
      })) as Rollup.RollupOutput

      const css = result.output.find((output) => output.type === 'asset' && output.fileName.endsWith('.css'))
      const builtHtml = result.output.find((output) => output.type === 'asset' && output.fileName.endsWith('.html'))
      const manifest = result.output.find(
        (output) => output.type === 'asset' && output.fileName.endsWith('manifest.json'),
      )
      if (!css || !builtHtml || !manifest) throw new Error('expected CSS, HTML, and manifest assets')

      expect(css.fileName).toMatch(/\.b-[A-Za-z]+\.css$/)
      expect(String(builtHtml.source)).toContain(css.fileName)
      expect(String(manifest.source)).toContain(css.fileName)
    } finally {
      rmSync(html, { force: true })
      rmSync(entry, { force: true })
    }
  }, 60_000)

  test('late CSS references retain chunk sourcemaps', async () => {
    const html = join(cwd, '__static-composition-sourcemap.html')
    const entry = join(cwd, 'src/__static-composition-sourcemap.tsx')
    const lazy = join(cwd, 'src/__static-composition-sourcemap-lazy.tsx')
    writeFileSync(html, `<script type="module" src="/src/__static-composition-sourcemap.tsx"></script>`)
    writeFileSync(
      entry,
      `export const loadBambooStyles = () => import('./__static-composition-sourcemap-lazy')\ndocument.body.onclick = loadBambooStyles\n`,
    )
    writeFileSync(
      lazy,
      `import 'virtual:bamboo.css'\nimport { css } from '../styled-system/css'\nexport const className = css({ width: '[751.444px]' })\n`,
    )

    try {
      const result = (await build({
        root: cwd,
        logLevel: 'silent',
        css: { postcss: { plugins: [] } },
        plugins: [bamboocss({ cwd, reportSummary: false })],
        build: {
          write: false,
          sourcemap: true,
          minify: false,
          rollupOptions: { input: html },
        },
      })) as Rollup.RollupOutput

      const css = result.output.find((output) => output.type === 'asset' && output.fileName.endsWith('.css'))
      const chunk = result.output.find((output) => output.type === 'chunk' && output.isEntry)
      if (!css || !chunk) throw new Error('expected CSS and entry chunk')
      expect(chunk.code).toContain(css.fileName)

      const mapAsset = result.output.find(
        (output) => output.type === 'asset' && output.fileName === `${chunk.fileName}.map`,
      )
      if (!mapAsset) throw new Error('expected an entry sourcemap')

      // Reuse the Vite package's test-only decoder without making this runtime sandbox ship
      // a sourcemap library of its own.
      const { originalPositionFor, TraceMap } = await import(
        join(here, '../../../packages/vite/node_modules/@jridgewell/trace-mapping/dist/trace-mapping.mjs')
      )

      const marker = 'loadBambooStyles'
      const offset = chunk.code.lastIndexOf(marker)
      expect(offset).toBeGreaterThan(-1)
      const before = chunk.code.slice(0, offset).split('\n')
      const original = originalPositionFor(new TraceMap(String(mapAsset.source)), {
        line: before.length,
        column: before.at(-1)!.length,
      })
      expect(original.source).toContain('__static-composition-sourcemap.tsx')
      expect(original.line).toBe(2)
    } finally {
      rmSync(html, { force: true })
      rmSync(entry, { force: true })
      rmSync(lazy, { force: true })
    }
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
describe.sequential('vite plugin, real rebuild', () => {
  const fixtureDir = join(cwd, 'src/__watch-tmp')
  const configPath = join(cwd, '__watch-tmp.bamboo.config.ts')
  const dependency = join(fixtureDir, 'dep.ts')
  const entry = join(fixtureDir, 'entry.tsx')
  const outDir = join(fixtureDir, 'out')

  const writeDependency = (color: string) => writeFileSync(dependency, `export const shared = { color: '${color}' }\n`)

  beforeEach(() => writeIsolatedBambooConfig(configPath, ['./src/__watch-tmp/**/*.{tsx,jsx}']))

  afterEach(() => {
    rmSync(fixtureDir, { force: true, recursive: true })
    rmSync(configPath, { force: true })
  })

  test('an imported local dependency outside include rebuilds JavaScript and CSS', async () => {
    mkdirSync(fixtureDir, { recursive: true })
    writeDependency('blue600')
    writeFileSync(
      entry,
      `import 'virtual:bamboo.css'\nimport { css } from '../../styled-system/css'\nimport { shared } from './dep'\nexport const cls = css(shared)\n`,
    )

    const watchedRuns: string[][] = []
    const watcher = (await build({
      root: cwd,
      logLevel: 'silent',
      css: { postcss: { plugins: [] } },
      plugins: [
        bamboocss({ cwd, configPath, reportSummary: false }),
        {
          name: 'bamboocss:test-watch-closure',
          buildEnd() {
            watchedRuns.push(this.getWatchFiles())
          },
        },
      ],
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
    const output = (...extensions: string[]) =>
      readdirSync(outDir)
        .filter((file) => extensions.some((extension) => file.endsWith(extension)))
        .map((file) => readFileSync(join(outDir, file), 'utf8'))
        .join('\n')

    try {
      await nextBuild()
      expect(output('.js', '.mjs')).toContain('"c_blue600"')
      expect(output('.css')).toContain('blue600')
      expect(watchedRuns.at(-1)).toContain(dependency)

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
      expect(output('.js', '.mjs')).toContain('"c_red600"')
      expect(output('.js', '.mjs')).not.toContain('"c_blue600"')
      expect(output('.css')).toContain('red600')
      expect(output('.css')).not.toContain('blue600')
      expect(watchedRuns.at(-1)).toContain(dependency)
    } finally {
      await watcher.close()
    }
  }, 120_000)

  test('a cached transform replays the reachability used to prune the rebuilt stylesheet', async () => {
    const cachedDependency = join(fixtureDir, 'cached-dep.tsx')
    const styleDependency = join(fixtureDir, 'cached-style.tsx')
    const cachedEntry = join(fixtureDir, 'cached-entry.tsx')
    const rebuildEntry = join(fixtureDir, 'rebuild-entry.tsx')
    const width = '719.314px'
    const transformCalls: string[] = []
    const summaries: string[] = []
    const info = vi.spyOn(logger, 'info').mockImplementation((type, message) => {
      if (type === 'vite:transform') summaries.push(message)
    })
    const config = (watch: boolean) => ({
      root: cwd,
      logLevel: 'silent' as const,
      css: { postcss: { plugins: [] } },
      plugins: [
        bamboocss({ cwd, configPath }),
        {
          name: 'bamboocss:test-cached-transform-probe',
          transform(_code: string, id: string) {
            if (id.split('?')[0] === cachedEntry) transformCalls.push(id)
          },
        },
      ],
      build: {
        ...(watch ? { watch: {} } : { write: false }),
        minify: false,
        outDir,
        emptyOutDir: false,
        lib: {
          entry: { cached: cachedEntry, rebuild: rebuildEntry },
          formats: ['es'] as const,
          fileName: (_format: string, name: string) => `${name}.js`,
        },
        rollupOptions: { external: [/styled-system/] },
      },
    })

    mkdirSync(fixtureDir, { recursive: true })
    writeFileSync(cachedDependency, `export const version = 'first'\n`)
    writeFileSync(styleDependency, `export const shared = { width: '[${width}]' }\n`)
    writeFileSync(
      cachedEntry,
      `import 'virtual:bamboo.css'\nimport { css, cx } from '../../styled-system/css'\nimport { shared } from './cached-style'\nexport const cls = (external) => cx(external, css(shared))\n`,
    )
    writeFileSync(rebuildEntry, `export { version } from './cached-dep'\n`)

    let watcher: Rollup.RollupWatcher | undefined
    const nextBuild = () =>
      new Promise<void>((resolve, reject) => {
        const active = watcher
        if (!active) throw new Error('watcher has not started')
        const onEvent = (event: { code: string; error?: Error }) => {
          if (event.code === 'END') {
            active.off('event', onEvent)
            resolve()
          } else if (event.code === 'ERROR') {
            active.off('event', onEvent)
            reject(event.error)
          }
        }
        active.on('event', onEvent)
      })
    const writtenCss = () =>
      readdirSync(outDir)
        .filter((file) => file.endsWith('.css'))
        .map((file) => readFileSync(join(outDir, file), 'utf8'))
        .join('\n')

    try {
      watcher = (await build(config(true))) as Rollup.RollupWatcher
      await nextBuild()
      expect(transformCalls).toHaveLength(1)
      const cleanCss = writtenCss()
      expect(cleanCss).toContain(width)

      // Remove the first build's hashed asset so only the rebuild's stylesheet can satisfy
      // the assertion below. Vite excludes its own outDir from the watcher.
      rmSync(outDir, { force: true, recursive: true })
      const rebuilt = nextBuild()
      await new Promise((settle) => setTimeout(settle, 800))
      writeFileSync(cachedDependency, `export const version = 'second'\n`)
      await rebuilt

      // Rollup reused Bamboo's transform result for the unchanged entry. The probe is after
      // Bamboo in the same transform pipeline, so it is cached or rerun with it.
      expect(transformCalls, 'the entry took Rollup’s cached transform path').toHaveLength(1)
      const cachedCss = writtenCss()
      expect(summaries).toHaveLength(2)
      expect(summaries[0]).toContain('declined: dynamic=1')
      expect(summaries[1], 'cached coverage and diagnostics must match the clean build').toBe(summaries[0])

      expect(cachedCss).toContain(width)
      expect(cachedCss, 'a cached rebuild must match the first, cache-free build').toBe(cleanCss)
    } finally {
      await watcher?.close()
      info.mockRestore()
    }
  }, 120_000)

  test('fails closed when cached Bamboo metadata uses a stale schema', async () => {
    const staleEntry = join(fixtureDir, 'stale-meta-entry.tsx')
    const trigger = join(fixtureDir, 'stale-meta-trigger.tsx')
    const staleOutDir = join(fixtureDir, 'stale-meta-out')
    const width = '729.414px'
    let transformCalls = 0

    // Runs after Bamboo and deliberately replaces only its serialized cache boundary. The
    // first build still uses Bamboo's in-memory contribution and emits valid JS/CSS; Rollup
    // then retains this stale schema alongside those compiled JS bytes for the rebuild.
    const staleMetadata: VitePlugin = {
      name: 'bamboocss:test-stale-transform-metadata',
      transform(_code, id) {
        if (id.split('?')[0] !== staleEntry) return
        transformCalls++
        return { meta: { 'bamboocss:transform': { version: 1 } } }
      },
    }

    mkdirSync(fixtureDir, { recursive: true })
    writeFileSync(
      staleEntry,
      `import 'virtual:bamboo.css'\n` +
        `import { css } from '../../styled-system/css'\n` +
        `export const className = css({ width: '[${width}]' })\n`,
    )
    writeFileSync(trigger, `export const version = 'first'\n`)

    let watcher: Rollup.RollupWatcher | undefined
    const nextBuild = () =>
      new Promise<Error | undefined>((resolve) => {
        const active = watcher
        if (!active) throw new Error('watcher has not started')
        const onEvent = (event: { code: string; error?: Error }) => {
          if (event.code !== 'END' && event.code !== 'ERROR') return
          active.off('event', onEvent)
          resolve(event.code === 'ERROR' ? event.error : undefined)
        }
        active.on('event', onEvent)
      })
    const written = (extension: string) =>
      readdirSync(staleOutDir)
        .filter((file) => file.endsWith(extension))
        .map((file) => readFileSync(join(staleOutDir, file), 'utf8'))
        .join('\n')

    try {
      watcher = (await build({
        root: cwd,
        logLevel: 'silent',
        css: { postcss: { plugins: [] } },
        plugins: [bamboocss({ cwd, configPath, reportSummary: false }), staleMetadata],
        build: {
          watch: {},
          minify: false,
          outDir: staleOutDir,
          emptyOutDir: false,
          lib: {
            entry: { cached: staleEntry, rebuild: trigger },
            formats: ['es'],
            fileName: (_format, name) => `${name}.js`,
          },
          rollupOptions: { external: [/styled-system/] },
        },
      })) as Rollup.RollupWatcher

      expect(await nextBuild()).toBeUndefined()
      expect(transformCalls).toBe(1)
      expect(written('.js')).toContain(width)
      expect(written('.js')).not.toContain('css(')
      expect(written('.css')).toContain(width)

      rmSync(staleOutDir, { force: true, recursive: true })
      const rebuilt = nextBuild()
      await new Promise((settle) => setTimeout(settle, 800))
      writeFileSync(trigger, `export const version = 'second'\n`)
      const error = await rebuilt

      expect(transformCalls, 'the Bamboo-compiled entry took Rollup’s cached transform path').toBe(1)
      expect(error?.message).toContain('cached transform metadata')
      expect(error?.message).toContain(JSON.stringify(staleEntry))
      expect(error?.message).toContain('version 1; expected schema version 3')
      expect(error?.message).toContain('cached JavaScript may still name CSS classes whose rules would be dropped')
      expect(error?.message).toContain('Restart Vite to invalidate its in-memory transform cache')
    } finally {
      await watcher?.close()
    }
  }, 120_000)

  test('fails closed when a current-schema cached artifact fails integrity', async () => {
    const integrityEntry = join(fixtureDir, 'integrity-meta-entry.tsx')
    const trigger = join(fixtureDir, 'integrity-meta-trigger.tsx')
    const integrityOutDir = join(fixtureDir, 'integrity-meta-out')
    const width = '739.515px'
    let transformCalls = 0
    let compiledCode = ''

    // Read Bamboo's current artifact after its pre transform, then alter one semantic field
    // without access to the instance-private key that sealed it. The first build uses Bamboo's
    // already-applied private copy; Rollup caches these altered bytes and metadata for replay.
    const alteredMetadata: VitePlugin = {
      name: 'bamboocss:test-altered-transform-metadata',
      transform(code, id) {
        if (id.split('?')[0] !== integrityEntry) return
        transformCalls++
        compiledCode = code

        const artifact = this.getModuleInfo(id)?.meta['bamboocss:transform']
        if (!artifact || typeof artifact !== 'object' || Array.isArray(artifact)) {
          throw new Error('test fixture could not observe Bamboo transform metadata')
        }
        expect(artifact).toMatchObject({
          version: 3,
          classNames: [`w_[${width}]`],
          integrity: expect.any(String),
        })
        const integrity = artifact.integrity
        const alteredArtifact = {
          ...artifact,
          // Well-typed and current-schema, but no longer describes the compiled JS above.
          classNames: [],
        }
        expect(alteredArtifact.integrity).toBe(integrity)
        return {
          code,
          map: null,
          meta: {
            'bamboocss:transform': alteredArtifact,
          },
        }
      },
    }

    mkdirSync(fixtureDir, { recursive: true })
    writeFileSync(
      integrityEntry,
      `import 'virtual:bamboo.css'\n` +
        `import { css } from '../../styled-system/css'\n` +
        `export const className = css({ width: '[${width}]' })\n`,
    )
    writeFileSync(trigger, `export const version = 'first'\n`)

    let watcher: Rollup.RollupWatcher | undefined
    const nextBuild = () =>
      new Promise<Error | undefined>((resolve) => {
        const active = watcher
        if (!active) throw new Error('watcher has not started')
        const onEvent = (event: { code: string; error?: Error }) => {
          if (event.code !== 'END' && event.code !== 'ERROR') return
          active.off('event', onEvent)
          resolve(event.code === 'ERROR' ? event.error : undefined)
        }
        active.on('event', onEvent)
      })
    const written = (extension: string) =>
      readdirSync(integrityOutDir)
        .filter((file) => file.endsWith(extension))
        .map((file) => readFileSync(join(integrityOutDir, file), 'utf8'))
        .join('\n')

    try {
      watcher = (await build({
        root: cwd,
        logLevel: 'silent',
        css: { postcss: { plugins: [] } },
        plugins: [bamboocss({ cwd, configPath, reportSummary: false }), alteredMetadata],
        build: {
          watch: {},
          minify: false,
          outDir: integrityOutDir,
          emptyOutDir: false,
          lib: {
            entry: { cached: integrityEntry, rebuild: trigger },
            formats: ['es'],
            fileName: (_format, name) => `${name}.js`,
          },
          rollupOptions: { external: [/styled-system/] },
        },
      })) as Rollup.RollupWatcher

      expect(await nextBuild()).toBeUndefined()
      expect(transformCalls).toBe(1)
      expect(compiledCode).toContain(`w_[${width}]`)
      expect(compiledCode).not.toContain('css(')
      expect(written('.js')).toContain(width)
      expect(written('.css')).toContain(width)

      rmSync(integrityOutDir, { force: true, recursive: true })
      const rebuilt = nextBuild()
      await new Promise((settle) => setTimeout(settle, 800))
      writeFileSync(trigger, `export const version = 'second'\n`)
      const error = await rebuilt

      expect(transformCalls, 'the altered Bamboo entry took Rollup’s cached transform path').toBe(1)
      expect(error?.message).toContain('cached transform metadata')
      expect(error?.message).toContain(JSON.stringify(integrityEntry))
      expect(error?.message).toContain('schema version 3 integrity check')
      expect(error?.message).toContain('cached JavaScript may still name CSS classes whose rules would be dropped')
      expect(error?.message).toContain('Restart Vite to invalidate its in-memory transform cache')
    } finally {
      await watcher?.close()
    }
  }, 120_000)

  test('snapshots accessor-backed cached metadata before validation and replay', async () => {
    const accessorEntry = join(fixtureDir, 'accessor-meta-entry.tsx')
    const trigger = join(fixtureDir, 'accessor-meta-trigger.tsx')
    const accessorOutDir = join(fixtureDir, 'accessor-meta-out')
    const width = '749.616px'
    let transformCalls = 0
    let buildStarts = 0
    let integrityReads = 0
    let alteredClassReads = 0
    let accessorArtifact: Record<string, unknown> | undefined

    // This is the exact old TOCTOU: schema validation reads `integrity` once and sees the
    // signed classes; HMAC verification reads the signed classes and then `integrity` again;
    // the subsequent state copy asks for classes a third time and receives an empty list.
    // Snapshot-first replay asks the external record only once and validates that detached data.
    const accessorMetadata: VitePlugin = {
      name: 'bamboocss:test-accessor-transform-metadata',
      buildStart() {
        buildStarts++
        if (buildStarts > 1) {
          integrityReads = 0
          alteredClassReads = 0
        }
      },
      transform(code, id) {
        if (id.split('?')[0] !== accessorEntry) return
        transformCalls++

        const artifact = this.getModuleInfo(id)?.meta['bamboocss:transform']
        if (!artifact || typeof artifact !== 'object' || Array.isArray(artifact)) {
          throw new Error('test fixture could not observe Bamboo transform metadata')
        }
        expect(artifact).toMatchObject({
          version: 3,
          classNames: [`w_[${width}]`],
          integrity: expect.any(String),
        })
        const signedClassNames = artifact.classNames
        const signedIntegrity = artifact.integrity
        accessorArtifact = { ...artifact }
        Object.defineProperties(accessorArtifact, {
          classNames: {
            enumerable: true,
            get() {
              if (integrityReads < 2) return signedClassNames
              alteredClassReads++
              return []
            },
          },
          integrity: {
            enumerable: true,
            get() {
              integrityReads++
              return signedIntegrity
            },
          },
        })
        return { code, map: null, meta: { 'bamboocss:transform': accessorArtifact } }
      },
    }

    mkdirSync(fixtureDir, { recursive: true })
    writeFileSync(
      accessorEntry,
      `import 'virtual:bamboo.css'\n` +
        `import { css } from '../../styled-system/css'\n` +
        `export const className = css({ width: '[${width}]' })\n`,
    )
    writeFileSync(trigger, `export const version = 'first'\n`)

    let watcher: Rollup.RollupWatcher | undefined
    const nextBuild = () =>
      new Promise<Error | undefined>((resolve) => {
        const active = watcher
        if (!active) throw new Error('watcher has not started')
        const onEvent = (event: { code: string; error?: Error }) => {
          if (event.code !== 'END' && event.code !== 'ERROR') return
          active.off('event', onEvent)
          resolve(event.code === 'ERROR' ? event.error : undefined)
        }
        active.on('event', onEvent)
      })
    const written = (extension: string) =>
      readdirSync(accessorOutDir)
        .filter((file) => file.endsWith(extension))
        .map((file) => readFileSync(join(accessorOutDir, file), 'utf8'))
        .join('\n')

    try {
      watcher = (await build({
        root: cwd,
        logLevel: 'silent',
        css: { postcss: { plugins: [] } },
        plugins: [bamboocss({ cwd, configPath, reportSummary: false }), accessorMetadata],
        build: {
          watch: {},
          minify: false,
          outDir: accessorOutDir,
          emptyOutDir: false,
          lib: {
            entry: { cached: accessorEntry, rebuild: trigger },
            formats: ['es'],
            fileName: (_format, name) => `${name}.js`,
          },
          rollupOptions: { external: [/styled-system/] },
        },
      })) as Rollup.RollupWatcher

      expect(await nextBuild()).toBeUndefined()
      expect(transformCalls).toBe(1)
      const cleanCss = written('.css')
      expect(cleanCss).toContain(width)

      rmSync(accessorOutDir, { force: true, recursive: true })
      const rebuilt = nextBuild()
      await new Promise((settle) => setTimeout(settle, 800))
      writeFileSync(trigger, `export const version = 'second'\n`)

      expect(await rebuilt).toBeUndefined()
      expect(transformCalls, 'the accessor-backed Bamboo entry took Rollup’s cached transform path').toBe(1)
      expect(alteredClassReads, 'replay never read altered reachability from the external object').toBe(0)
      expect(written('.js')).toContain(width)
      expect(written('.css')).toBe(cleanCss)

      // Arm the accessor after replay to prove it really does return the altered value once the
      // integrity read boundary has passed. The detached contribution must remain unaffected.
      while (integrityReads < 2) void accessorArtifact!.integrity
      expect(accessorArtifact!.classNames).toEqual([])
      expect(alteredClassReads).toBe(1)
      expect(written('.css')).toContain(width)
    } finally {
      await watcher?.close()
    }
  }, 120_000)

  test('replays a cached query variant when a sibling module id retransforms', async () => {
    const dual = join(fixtureDir, 'dual.tsx')
    const trigger = join(fixtureDir, 'query-trigger.tsx')
    const queryEntry = join(fixtureDir, 'query-entry.tsx')
    const queryOutDir = join(fixtureDir, 'query-out')
    const widths = { a: '829.141px', b: '829.282px' }
    const transformCalls = { a: 0, b: 0 }

    const queryVariants: VitePlugin = {
      name: 'bamboocss:test-query-variants',
      enforce: 'pre',
      transform(_code, id) {
        const [file, query] = id.split('?')
        if (file !== dual || (query !== 'a' && query !== 'b')) return

        transformCalls[query]++
        // Only `?a` depends on this file. Its edit must rerun that live module id while
        // Rollup keeps `?b` on the transform-cache path.
        if (query === 'a') this.addWatchFile(trigger)

        return {
          code:
            `import { css } from '../../styled-system/css'\n` +
            `export const className = css({ width: '[${widths[query]}]' })\n`,
          map: null,
        }
      },
    }

    mkdirSync(fixtureDir, { recursive: true })
    // The extractor reads the physical source, so both query-specific classes have real rules
    // before the bundler plugin selects one call for each live module id.
    writeFileSync(
      dual,
      `import { css } from '../../styled-system/css'\n` +
        `export const a = css({ width: '[${widths.a}]' })\n` +
        `export const b = css({ width: '[${widths.b}]' })\n`,
    )
    writeFileSync(trigger, `export const version = 'first'\n`)
    writeFileSync(
      queryEntry,
      `import 'virtual:bamboo.css'\n` +
        `export { className as a } from './dual.tsx?a'\n` +
        `export { className as b } from './dual.tsx?b'\n`,
    )

    let watcher: Rollup.RollupWatcher | undefined
    const nextBuild = () =>
      new Promise<void>((resolve, reject) => {
        const active = watcher
        if (!active) throw new Error('watcher has not started')
        const onEvent = (event: { code: string; error?: Error }) => {
          if (event.code === 'END') {
            active.off('event', onEvent)
            resolve()
          } else if (event.code === 'ERROR') {
            active.off('event', onEvent)
            reject(event.error)
          }
        }
        active.on('event', onEvent)
      })
    const writtenCss = () =>
      readdirSync(queryOutDir)
        .filter((file) => file.endsWith('.css'))
        .map((file) => readFileSync(join(queryOutDir, file), 'utf8'))
        .join('\n')

    try {
      watcher = (await build({
        root: cwd,
        logLevel: 'silent',
        css: { postcss: { plugins: [] } },
        plugins: [queryVariants, bamboocss({ cwd, configPath, reportSummary: false })],
        build: {
          watch: {},
          minify: false,
          outDir: queryOutDir,
          emptyOutDir: false,
          lib: { entry: queryEntry, formats: ['es'], fileName: 'query-entry' },
          rollupOptions: { external: [/styled-system/] },
        },
      })) as Rollup.RollupWatcher

      await nextBuild()
      expect(transformCalls).toEqual({ a: 1, b: 1 })
      const cleanCss = writtenCss()
      expect(cleanCss).toContain(widths.a)
      expect(cleanCss).toContain(widths.b)

      rmSync(queryOutDir, { force: true, recursive: true })
      const rebuilt = nextBuild()
      await new Promise((settle) => setTimeout(settle, 800))
      writeFileSync(trigger, `export const version = 'second'\n`)
      await rebuilt

      expect(transformCalls, 'only the watched query variant retransforms').toEqual({ a: 2, b: 1 })
      const cachedCss = writtenCss()
      expect(cachedCss).toContain(widths.a)
      expect(cachedCss).toContain(widths.b)
      expect(cachedCss, 'query-variant cache replay must match the cache-free build').toBe(cleanCss)
    } finally {
      await watcher?.close()
    }
  }, 120_000)

  test('a cached query sibling cannot erase a fresh survivor', async () => {
    const dual = join(fixtureDir, 'survivor-dual.tsx')
    const trigger = join(fixtureDir, 'survivor-trigger.tsx')
    const queryEntry = join(fixtureDir, 'survivor-entry.tsx')
    const survivorOutDir = join(fixtureDir, 'survivor-out')
    const transformCalls = { fresh: 0, cached: 0 }

    const queryVariants: VitePlugin = {
      name: 'bamboocss:test-query-survivor',
      enforce: 'pre',
      transform(_code, id) {
        const [file, query] = id.split('?')
        if (file !== dual || (query !== 'fresh' && query !== 'cached')) return
        transformCalls[query]++

        if (query === 'fresh') {
          this.addWatchFile(trigger)
          if (readFileSync(trigger, 'utf8').includes('second')) {
            return {
              code:
                `import { css } from '../../styled-system/css'\n` +
                `export const className = (width) => css({ width })\n`,
              map: null,
            }
          }
        }

        const width = query === 'fresh' ? '839.141px' : '839.282px'
        return {
          code:
            `import { css } from '../../styled-system/css'\n` +
            `export const className = css({ width: '[${width}]' })\n`,
          map: null,
        }
      },
    }

    mkdirSync(fixtureDir, { recursive: true })
    writeFileSync(
      dual,
      `import { css } from '../../styled-system/css'\n` +
        `export const fresh = css({ width: '[839.141px]' })\n` +
        `export const cached = css({ width: '[839.282px]' })\n`,
    )
    writeFileSync(trigger, `export const version = 'first'\n`)
    writeFileSync(
      queryEntry,
      `import 'virtual:bamboo.css'\n` +
        `export { className as fresh } from './survivor-dual.tsx?fresh'\n` +
        `export { className as cached } from './survivor-dual.tsx?cached'\n`,
    )

    let watcher: Rollup.RollupWatcher | undefined
    const nextBuild = () =>
      new Promise<Error | undefined>((resolve) => {
        const active = watcher
        if (!active) throw new Error('watcher has not started')
        const onEvent = (event: { code: string; error?: Error }) => {
          if (event.code !== 'END' && event.code !== 'ERROR') return
          active.off('event', onEvent)
          resolve(event.code === 'ERROR' ? event.error : undefined)
        }
        active.on('event', onEvent)
      })

    try {
      watcher = (await build({
        root: cwd,
        logLevel: 'silent',
        css: { postcss: { plugins: [] } },
        plugins: [queryVariants, bamboocss({ cwd, configPath, reportSummary: false })],
        build: {
          watch: {},
          minify: false,
          outDir: survivorOutDir,
          emptyOutDir: false,
          lib: { entry: queryEntry, formats: ['es'], fileName: 'survivor-entry' },
          rollupOptions: { external: [/styled-system/] },
        },
      })) as Rollup.RollupWatcher

      expect(await nextBuild()).toBeUndefined()
      expect(transformCalls).toEqual({ fresh: 1, cached: 1 })

      const rebuilt = nextBuild()
      await new Promise((settle) => setTimeout(settle, 800))
      writeFileSync(trigger, `export const version = 'second'\n`)
      const error = await rebuilt

      expect(transformCalls, 'only the survivor-producing query variant retransforms').toEqual({ fresh: 2, cached: 1 })
      expect(error?.message).toContain('css() — dynamic')
    } finally {
      await watcher?.close()
    }
  }, 120_000)
})

/**
 * Every class the compiler emits must have a rule, including conditional ones.
 *
 * The assertions above check `.${token} {`, which only matches a *flat* rule — a conditional
 * atom is `.x:hover {`, `.x::before {`, or nested inside `@media`, so none were covered by
 * anything. A report that conditional styles compiled into class names whose rules never
 * reached the sheet had nothing in the suite that could confirm or refute it, and the cause
 * turned out to be real: reachability pruning deleted them.
 *
 * Kept in this file rather than its own so the heavy real builds stay on one worker; as a
 * separate file it ran concurrently with them and starved the CLI suite's subprocesses.
 */
const conditionalEntry = join(cwd, 'src/__conditional-atoms-test.tsx')

/** Widths are unique per condition, so a missing rule names the shape that lost it. */
const PROBES: Array<[string, string]> = [
  ['flat', '11.1px'],
  ['_hover', '22.2px'],
  ['_before', '33.3px'],
  ['_after', '44.4px'],
  ['_focus', '55.5px'],
  ['md', '66.6px'],
  ['[data-open]', '77.7px'],
  ['recipe base', '88.8px'],
  ['recipe _hover', '99.9px'],
  ['recipe _before', '12.34px'],
  ['recipe variant _focus', '56.78px'],
]

describe('conditional atoms reach the emitted stylesheet', () => {
  afterEach(() => {
    rmSync(conditionalEntry, { force: true })
  })

  test('every emitted class has a rule, and every condition survives', async () => {
    writeFileSync(
      conditionalEntry,
      `
      import 'virtual:bamboo.css'
      import { css, cva } from '../styled-system/css'

      export const flat = css({ width: '[11.1px]' })
      export const hover = css({ _hover: { width: '[22.2px]' } })
      export const before = css({ _before: { content: '""', width: '[33.3px]' } })
      export const after = css({ _after: { content: '""', width: '[44.4px]' } })
      export const focus = css({ _focus: { width: '[55.5px]' } })
      export const media = css({ md: { width: '[66.6px]' } })
      export const dataAttr = css({ '&[data-open]': { width: '[77.7px]' } })

      const box = cva({
        base: {
          width: '[88.8px]',
          _hover: { width: '[99.9px]' },
          _before: { content: '""', width: '[12.34px]' },
        },
        variants: { tone: { loud: { _focus: { width: '[56.78px]' } } } },
      })
      export const recipe = box({ tone: 'loud' })
      `,
    )

    const result = (await build({
      root: cwd,
      logLevel: 'silent',
      css: { postcss: { plugins: [] } },
      plugins: [bamboocss({ cwd, reportSummary: false })],
      build: {
        write: false,
        minify: false,
        lib: { entry: conditionalEntry, formats: ['es'], fileName: 'conditional-atoms' },
        rollupOptions: { external: [/^react/] },
      },
    })) as Rollup.RollupOutput[]

    const css = result[0]!.output
      .map((output) => ('source' in output && typeof output.source === 'string' ? output.source : ''))
      .join('\n')

    // Collected rather than asserted one at a time: which conditions survive and which do
    // not is the diagnostic, and failing on the first hides the shape of the failure.
    const missing = PROBES.filter(([, width]) => !css.includes(width)).map(([label, width]) => `${label} (${width})`)
    expect(missing, 'conditions with no rule in the emitted sheet').toEqual([])
  }, 120_000)
})

/**
 * The plugin driven by Vite 8, whose bundler is Rolldown rather than Rollup.
 *
 * Every other build test in this repo runs on Rollup, and the two differ in ways that are
 * silent rather than loud. `optimizeStaticCssAssets` renamed the pruned stylesheet by
 * replacing an entry in `bundle`; Rolldown does not support that, logs that the assignment
 * is ignored, and *drops the asset*. The build then exited 0 having shipped no CSS at all
 * and the application rendered unstyled — found by a user grepping their own bundle, because
 * nothing here could express a non-Rollup build.
 *
 * `vite8` is an alias for the real Vite 8 package, installed beside the Vite 7 the rest of
 * the sandbox uses. Pinning both means this asserts what a consumer on either actually gets,
 * rather than what our lockfile happens to resolve.
 */
const rolldownEntry = join(cwd, 'src/__rolldown-test.tsx')

/** Each declaration is unique, so an absence names the shape that lost its rule. */
const ROLLDOWN_PROBES: Array<[string, string]> = [
  ['flat', '21.1px'],
  ['_hover', '21.2px'],
  ['_before', '21.3px'],
  ['md', '21.4px'],
  ['[data-open]', '21.5px'],
  ['recipe base', '21.6px'],
  ['recipe conditional', '21.7px'],
]

describe('vite 8 / rolldown', () => {
  afterEach(() => {
    rmSync(rolldownEntry, { force: true })
  })

  test('emits the stylesheet, with every conditional rule intact', async () => {
    writeFileSync(
      rolldownEntry,
      `
      import 'virtual:bamboo.css'
      import { css, cva } from '../styled-system/css'

      export const flat = css({ width: '[21.1px]' })
      export const hover = css({ _hover: { width: '[21.2px]' } })
      export const before = css({ _before: { content: '""', width: '[21.3px]' } })
      export const media = css({ md: { width: '[21.4px]' } })
      export const dataAttr = css({ '&[data-open]': { width: '[21.5px]' } })

      const box = cva({
        base: { width: '[21.6px]', _hover: { width: '[21.7px]' } },
        variants: { tone: { loud: { opacity: 0.5 } } },
      })
      export const recipe = box({ tone: 'loud' })
      `,
    )

    const result = (await buildVite8({
      root: cwd,
      logLevel: 'silent',
      css: { postcss: { plugins: [] } },
      plugins: [bamboocss({ cwd, reportSummary: false })],
      build: {
        write: false,
        minify: false,
        lib: { entry: rolldownEntry, formats: ['es'], fileName: 'rolldown' },
        rollupOptions: { external: [/^react/] },
      },
    })) as Rollup.RollupOutput[]

    const css = result[0]!.output
      .map((output) => ('source' in output && typeof output.source === 'string' ? output.source : ''))
      .join('\n')

    // The failure that motivated this: a green build carrying no stylesheet at all.
    expect(css, 'no emitted asset carries the generated stylesheet').toContain('--made-with-bamboo')

    const missing = ROLLDOWN_PROBES.filter(([, width]) => !css.includes(width)).map(
      ([label, width]) => `${label} (${width})`,
    )
    expect(missing, 'shapes with no rule in the emitted sheet').toEqual([])
  }, 120_000)

  test('rebuilds JavaScript and CSS when an imported local dependency outside include changes', async () => {
    const fixtureDir = join(cwd, 'src/__rolldown-watch-tmp')
    const configPath = join(cwd, '__rolldown-watch-tmp.bamboo.config.ts')
    const dependency = join(fixtureDir, 'dep.ts')
    const entry = join(fixtureDir, 'entry.tsx')
    const outDir = join(fixtureDir, 'out')
    mkdirSync(fixtureDir, { recursive: true })
    writeIsolatedBambooConfig(configPath, ['./src/__rolldown-watch-tmp/**/*.tsx'])
    writeFileSync(dependency, `export const shared = { color: 'blue600' }\n`)
    writeFileSync(
      entry,
      `import 'virtual:bamboo.css'\nimport { css } from '../../styled-system/css'\nimport { shared } from './dep'\nexport const cls = css(shared)\n`,
    )

    const watcher = (await buildVite8({
      root: cwd,
      logLevel: 'silent',
      css: { postcss: { plugins: [] } },
      plugins: [bamboocss({ cwd, configPath, reportSummary: false })],
      build: {
        watch: {},
        minify: false,
        outDir,
        emptyOutDir: false,
        lib: { entry, formats: ['es'], fileName: 'entry' },
        rollupOptions: { external: [/styled-system/] },
      },
    })) as unknown as Rollup.RollupWatcher

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
    const output = (...extensions: string[]) =>
      readdirSync(outDir)
        .filter((file) => extensions.some((extension) => file.endsWith(extension)))
        .map((file) => readFileSync(join(outDir, file), 'utf8'))
        .join('\n')

    try {
      await nextBuild()
      expect(output('.js', '.mjs')).toContain('"c_blue600"')
      expect(output('.css')).toContain('blue600')

      const rebuilt = nextBuild()
      await new Promise((settle) => setTimeout(settle, 800))
      writeFileSync(dependency, `export const shared = { color: 'red600' }\n`)
      await rebuilt

      expect(output('.js', '.mjs')).toContain('"c_red600"')
      expect(output('.js', '.mjs')).not.toContain('"c_blue600"')
      expect(output('.css')).toContain('red600')
      expect(output('.css')).not.toContain('blue600')
    } finally {
      await watcher.close()
      rmSync(fixtureDir, { force: true, recursive: true })
      rmSync(configPath, { force: true })
    }
  }, 120_000)
})

/**
 * A client and an SSR environment, built against one plugin instance.
 *
 * `buildStart` fires once per environment, and it reset the whole compilation session each
 * time. The second environment therefore discarded what the first established: `cssLoaded`
 * went false, so an SSR bundle — which legitimately never imports the stylesheet, because the
 * client build emits it — failed the "not imported" check outright. The reachability sets that
 * pruning consults were emptied by the same reset.
 *
 * Pruning was the piece that reset left undone, and it is the rest of this block: the
 * stylesheet is finalized by the environment that imports it, which is not the environment
 * that finishes last, so reachability was incomplete at exactly the moment it was used to
 * delete rules.
 *
 * Driven through `createBuilder` rather than a framework, because the framework is incidental:
 * what matters is two environments sharing one instance, which is the shape react-router,
 * Nuxt and SvelteKit all produce.
 */
const envClientEntry = join(cwd, 'src/__env-client.tsx')
const envSsrEntry = join(cwd, 'src/__env-ssr.tsx')
const envSharedModule = join(cwd, 'src/__env-shared.tsx')

/**
 * `builder: {}` is what `vite build --app` sets, and what every framework building more than
 * one environment configures. It is the signal the plugin reads to know the run has more
 * environments coming, so the omitting case is a test of its own below.
 */
const twoEnvironmentBuilder = (announced: boolean) =>
  createBuilder({
    root: cwd,
    logLevel: 'silent',
    css: { postcss: { plugins: [] } },
    plugins: [bamboocss({ cwd, reportSummary: false })],
    build: { write: false, minify: false, rollupOptions: { external: [/^react/] } },
    ...(announced ? { builder: {} } : {}),
    environments: {
      client: { build: { lib: { entry: envClientEntry, formats: ['es'], fileName: 'env-client' } } },
      ssr: { build: { ssr: true, lib: { entry: envSsrEntry, formats: ['es'], fileName: 'env-ssr' } } },
    },
  })

/** Every asset source both environments emitted, in the order given. */
const buildBothEnvironments = async (
  builder: Awaited<ReturnType<typeof createBuilder>>,
  order: string[] = ['client', 'ssr'],
) => {
  const sources: string[] = []
  for (const name of order) {
    const built = await builder.build(builder.environments[name]!)
    for (const bundle of Array.isArray(built) ? built : [built]) {
      for (const output of (bundle as { output?: unknown[] }).output ?? []) {
        const asset = output as { source?: unknown }
        if (typeof asset.source === 'string') sources.push(asset.source)
      }
    }
  }
  return sources.join('\n')
}

type TestWatchEvent = { code: string; error?: Error }
type TestBuildWatcher = {
  close(): Promise<void>
  off(event: 'event', listener: (event: TestWatchEvent) => void): void
  on(event: 'event', listener: (event: TestWatchEvent) => void): void
}
type TestEnvironmentBuilder = {
  build(environment: unknown): Promise<unknown>
  environments: Record<string, unknown>
}

const nextEnvironmentWatchBuild = (watcher: TestBuildWatcher) =>
  new Promise<Error | undefined>((resolve) => {
    const onEvent = (event: TestWatchEvent) => {
      if (event.code !== 'END' && event.code !== 'ERROR') return
      watcher.off('event', onEvent)
      resolve(event.code === 'ERROR' ? event.error : undefined)
    }
    watcher.on('event', onEvent)
  })

/** Wait through a failed task's ERROR and the enclosing watch run's END. */
const nextEnvironmentWatchCycle = (watcher: TestBuildWatcher) =>
  new Promise<Error | undefined>((resolve) => {
    let error: Error | undefined
    const onEvent = (event: TestWatchEvent) => {
      if (event.code === 'ERROR') error = event.error
      if (event.code !== 'END') return
      watcher.off('event', onEvent)
      resolve(error)
    }
    watcher.on('event', onEvent)
  })

const runPartialEnvironmentWatchRebuild = async (
  create: (config: Record<string, unknown>) => Promise<unknown>,
  label: string,
  widths: { cachedSsr: string; freshClient: string; freshSsr: string },
) => {
  const clientTrigger = join(cwd, `src/__partial-client-${label}.txt`)
  const ssrTrigger = join(cwd, `src/__partial-ssr-${label}.txt`)
  const configPath = join(cwd, `__partial-environment-${label}.bamboo.config.ts`)
  const clientOutDir = join(cwd, `__partial-client-${label}-out`)
  const ssrOutDir = join(cwd, `__partial-ssr-${label}-out`)
  const calls = { client: 0, ssr: 0 }

  const environmentSource: VitePlugin = {
    name: `bamboocss:test-partial-environment-source-${label}`,
    enforce: 'pre',
    sharedDuringBuild: true,
    transform(_code, id) {
      if (id.split('?')[0] !== envSharedModule) return

      const environment = this.environment.name as keyof typeof calls
      calls[environment]++
      const trigger = environment === 'client' ? clientTrigger : ssrTrigger
      this.addWatchFile(trigger)

      const version = readFileSync(trigger, 'utf8').trim()
      const width =
        version === 'first' ? widths.cachedSsr : environment === 'client' ? widths.freshClient : widths.freshSsr
      return {
        code:
          `import { css } from '../styled-system/css'\n` + `export const className = css({ width: '[${width}]' })\n`,
        map: null,
      }
    },
  }

  writeFileSync(
    envSharedModule,
    `import { css } from '../styled-system/css'\n` +
      `export const cachedSsr = css({ width: '[${widths.cachedSsr}]' })\n` +
      `export const freshClient = css({ width: '[${widths.freshClient}]' })\n` +
      `export const freshSsr = css({ width: '[${widths.freshSsr}]' })\n`,
  )
  writeFileSync(clientTrigger, 'first\n')
  writeFileSync(ssrTrigger, 'first\n')
  writeFileSync(envClientEntry, `import 'virtual:bamboo.css'\nexport { className } from './__env-shared'\n`)
  writeFileSync(envSsrEntry, `export { className } from './__env-shared'\n`)
  writeIsolatedBambooConfig(configPath, ['./src/__env-shared.tsx', './src/__env-client.tsx', './src/__env-ssr.tsx'])

  const builder = (await create({
    root: cwd,
    logLevel: 'silent',
    css: { postcss: { plugins: [] } },
    plugins: [environmentSource, bamboocss({ cwd, configPath, reportSummary: false })],
    build: {
      watch: {},
      minify: false,
      emptyOutDir: false,
      rollupOptions: { external: [/^react/] },
    },
    builder: {},
    environments: {
      client: {
        build: {
          outDir: clientOutDir,
          lib: { entry: envClientEntry, formats: ['es'], fileName: `partial-client-${label}` },
        },
      },
      ssr: {
        build: {
          ssr: true,
          outDir: ssrOutDir,
          lib: { entry: envSsrEntry, formats: ['es'], fileName: `partial-ssr-${label}` },
        },
      },
    },
  })) as TestEnvironmentBuilder

  let clientWatcher: TestBuildWatcher | undefined
  let ssrWatcher: TestBuildWatcher | undefined
  try {
    // SSR finishes first. Its contribution has to survive a later client-only generation,
    // because these are independent watchers and its emitted JavaScript remains live.
    ssrWatcher = (await builder.build(builder.environments.ssr)) as TestBuildWatcher
    expect(await nextEnvironmentWatchBuild(ssrWatcher)).toBeUndefined()
    clientWatcher = (await builder.build(builder.environments.client)) as TestBuildWatcher
    expect(await nextEnvironmentWatchBuild(clientWatcher)).toBeUndefined()

    expect(calls).toEqual({ client: 1, ssr: 1 })
    const ssrJs = readOutputFiles(ssrOutDir, '.js')
    expect(ssrJs).toContain(`w_[${widths.cachedSsr}]`)

    rmSync(clientOutDir, { force: true, recursive: true })
    const rebuiltClient = nextEnvironmentWatchBuild(clientWatcher)
    await new Promise((settle) => setTimeout(settle, 800))
    writeFileSync(clientTrigger, 'second\n')
    expect(await rebuiltClient).toBeUndefined()
    await new Promise((settle) => setTimeout(settle, 300))

    expect(calls, 'the client-only edit did not start or transform SSR').toEqual({ client: 2, ssr: 1 })
    const rebuiltCss = readOutputFiles(clientOutDir, '.css')
    expect(rebuiltCss).toContain(widths.cachedSsr)
    expect(rebuiltCss).toContain(widths.freshClient)
    expect(rebuiltCss).not.toContain(widths.freshSsr)
    expect(rebuiltCss).toContain(`.${esc(`w_[${widths.cachedSsr}]`)}`)

    // The inverse partial rebuild must retain the client sheet's loss history. That sheet
    // pruned the third rule, and SSR emits no replacement asset, so requiring it fails closed.
    const rebuiltSsr = nextEnvironmentWatchBuild(ssrWatcher)
    await new Promise((settle) => setTimeout(settle, 800))
    writeFileSync(ssrTrigger, 'second\n')
    const ssrError = await rebuiltSsr
    await new Promise((settle) => setTimeout(settle, 300))

    expect(calls, 'the SSR-only edit did not start or transform the client').toEqual({ client: 2, ssr: 2 })
    expect(ssrError?.message).toContain('already pruned out of a stylesheet')
    expect(ssrError?.message).toContain(esc(`w_[${widths.freshSsr}]`))
  } finally {
    await Promise.all([clientWatcher?.close(), ssrWatcher?.close()])
    rmSync(clientTrigger, { force: true })
    rmSync(ssrTrigger, { force: true })
    rmSync(configPath, { force: true })
    rmSync(clientOutDir, { force: true, recursive: true })
    rmSync(ssrOutDir, { force: true, recursive: true })
  }
}

/**
 * Reject one environment after Bamboo generated its candidate bundle, then rebuild only its
 * sibling.
 *
 * `buildEnd` is too early to publish reachability: Rollup and Rolldown keep the previous files
 * when a later `generateBundle` hook throws. The sibling must therefore see the last output which
 * actually reached disk, not the rejected graph Bamboo had prepared in memory.
 */
const runRejectedOutputWatchRebuild = async (
  create: (config: Record<string, unknown>) => Promise<unknown>,
  label: string,
  widths: { old: string; rejected: string; written: string; sibling: string },
) => {
  const clientEntry = join(cwd, `src/__output-transaction-client-${label}.tsx`)
  const siblingEntry = join(cwd, `src/__output-transaction-sibling-${label}.tsx`)
  const clientTrigger = join(cwd, `src/__output-transaction-client-${label}.txt`)
  const siblingTrigger = join(cwd, `src/__output-transaction-sibling-${label}.ts`)
  const configPath = join(cwd, `__output-transaction-${label}.bamboo.config.ts`)
  const clientOutDir = join(cwd, `__output-transaction-client-${label}-out`)
  const siblingOutDir = join(cwd, `__output-transaction-sibling-${label}-out`)
  const calls = { client: 0 }

  const selectedClientSource: VitePlugin = {
    name: `bamboocss:test-output-transaction-source-${label}`,
    enforce: 'pre',
    sharedDuringBuild: true,
    transform(_code, id) {
      if (id.split('?')[0] !== clientEntry) return
      calls.client++
      this.addWatchFile(clientTrigger)
      const version = readFileSync(clientTrigger, 'utf8').trim()
      const width = version === 'second' ? widths.rejected : version === 'third' ? widths.written : widths.old
      return {
        code:
          `import 'virtual:bamboo.css'\n` +
          `import { css } from '../styled-system/css'\n` +
          `export const className = css({ width: '[${width}]' })\n`,
        map: null,
      }
    },
  }

  let rejectClientOutput = false
  let rejectAfterWrite = false
  let rejectBeforeBambooWrite = false
  let rejectOnClose = false
  let mutateClientCss = false
  let configuredOutputCloseCalls = 0
  let rejectedJs = ''
  let rejectedCss = ''
  // A configured output plugin, not another Vite input plugin. Bamboo's private finalizer must
  // be appended after this too; otherwise an in-memory success marker can still run too early.
  const rejectAfterBamboo: VitePlugin = {
    name: `bamboocss:test-reject-output-transaction-${label}`,
    generateBundle: {
      order: 'post',
      handler(_, bundle) {
        if (mutateClientCss) {
          for (const output of Object.values(bundle)) {
            if (output.type !== 'asset' || !output.fileName.endsWith('.css')) continue
            const source = typeof output.source === 'string' ? output.source : Buffer.from(output.source).toString()
            output.source = source.replace('--made-with-bamboo', '--removed-after-bamboo')
          }
        }
        if (!rejectClientOutput) return
        rejectedJs = Object.values(bundle)
          .map((output) => (output.type === 'chunk' ? output.code : ''))
          .join('\n')
        rejectedCss = Object.values(bundle)
          .map((output) => {
            if (output.type !== 'asset' || !output.fileName.endsWith('.css')) return ''
            return typeof output.source === 'string' ? output.source : Buffer.from(output.source).toString()
          })
          .join('\n')
        throw new Error(`test rejected client output (${label})`)
      },
    },
    writeBundle() {
      if (rejectAfterWrite) throw new Error(`test rejected after writing client output (${label})`)
    },
    closeBundle() {
      configuredOutputCloseCalls++
    },
  }
  const rejectCloseAfterBamboo: VitePlugin = {
    name: `bamboocss:test-reject-close-transaction-${label}`,
    enforce: 'post',
    sharedDuringBuild: true,
    closeBundle: {
      order: 'post',
      sequential: true,
      handler() {
        if (rejectOnClose) throw new Error(`test rejected while closing client output (${label})`)
      },
    },
  }
  const rejectWriteBeforeBamboo: VitePlugin = {
    name: `bamboocss:test-reject-write-before-transaction-${label}`,
    enforce: 'pre',
    sharedDuringBuild: true,
    writeBundle: {
      order: 'pre',
      sequential: true,
      handler() {
        if (this.environment.name === 'client' && rejectBeforeBambooWrite) {
          throw new Error(`test rejected before Bamboo's write observer (${label})`)
        }
      },
    },
  }

  writeFileSync(
    clientEntry,
    `import 'virtual:bamboo.css'\n` +
      `import { css } from '../styled-system/css'\n` +
      `export const oldClass = css({ width: '[${widths.old}]' })\n` +
      `export const rejectedClass = css({ width: '[${widths.rejected}]' })\n` +
      `export const writtenClass = css({ width: '[${widths.written}]' })\n`,
  )
  writeFileSync(
    siblingEntry,
    `import 'virtual:bamboo.css'\n` +
      `import { css } from '../styled-system/css'\n` +
      `export { generation } from './__output-transaction-sibling-${label}'\n` +
      `export const className = css({ width: '[${widths.sibling}]' })\n`,
  )
  writeFileSync(clientTrigger, 'first\n')
  writeFileSync(siblingTrigger, `export const generation = 'first'\n`)
  writeIsolatedBambooConfig(configPath, [
    `./src/__output-transaction-client-${label}.tsx`,
    `./src/__output-transaction-sibling-${label}.tsx`,
  ])

  const builder = (await create({
    root: cwd,
    logLevel: 'silent',
    css: { postcss: { plugins: [] } },
    plugins: [rejectWriteBeforeBamboo, selectedClientSource, ...bamboocss({ cwd, configPath, reportSummary: false })],
    build: {
      watch: {},
      minify: false,
      emptyOutDir: false,
      rollupOptions: {
        external: [/^react/, /styled-system/],
        output: { plugins: [rejectAfterBamboo] },
      },
    },
    builder: {},
    environments: {
      client: {
        build: {
          emitAssets: true,
          outDir: clientOutDir,
          lib: { entry: clientEntry, formats: ['es'], fileName: `output-transaction-client-${label}` },
        },
      },
      sibling: {
        build: {
          emitAssets: true,
          outDir: siblingOutDir,
          lib: { entry: siblingEntry, formats: ['es'], fileName: `output-transaction-sibling-${label}` },
        },
      },
    },
  })) as TestEnvironmentBuilder

  let clientWatcher: TestBuildWatcher | undefined
  let siblingWatcher: TestBuildWatcher | undefined
  try {
    clientWatcher = (await builder.build(builder.environments.client)) as TestBuildWatcher
    expect(await nextEnvironmentWatchCycle(clientWatcher)).toBeUndefined()
    siblingWatcher = (await builder.build(builder.environments.sibling)) as TestBuildWatcher
    expect(await nextEnvironmentWatchCycle(siblingWatcher)).toBeUndefined()

    const clientJsFiles = readdirSync(clientOutDir).filter((file) => file.endsWith('.js'))
    expect(clientJsFiles).toHaveLength(1)
    const clientJsPath = join(clientOutDir, clientJsFiles[0]!)
    const initialClientJsBytes = readFileSync(clientJsPath)
    const initialClientJs = initialClientJsBytes.toString()
    const initialClientCss = readOutputFiles(clientOutDir, '.css')
    // Both graphs were transformed from scratch. This is the clean accepted output the later
    // sibling-only rebuild must reproduce after the intervening client candidate is rejected.
    const cleanCss = readOutputFiles(siblingOutDir, '.css')
    expect(initialClientJs).toContain(`w_[${widths.old}]`)
    expect(initialClientCss).toContain(widths.old)
    expect(cleanCss).toContain(widths.old)
    expect(cleanCss).toContain(widths.sibling)
    expect(cleanCss).not.toContain(widths.rejected)

    rejectClientOutput = true
    const rejectedBuild = nextEnvironmentWatchCycle(clientWatcher)
    await new Promise((settle) => setTimeout(settle, 800))
    writeFileSync(clientTrigger, 'second\n')
    const rejectedError = await rejectedBuild
    rejectClientOutput = false

    expect(rejectedError?.message).toContain(`test rejected client output (${label})`)
    expect(rejectedJs).toContain(`w_[${widths.rejected}]`)
    expect(rejectedJs).not.toContain(`w_[${widths.old}]`)
    expect(rejectedCss).toContain(widths.rejected)
    expect(rejectedCss).not.toContain(widths.old)
    expect(
      readFileSync(clientJsPath).equals(initialClientJsBytes),
      'failed output replaced the previously emitted JavaScript bytes',
    ).toBe(true)
    expect(readOutputFiles(clientOutDir, '.css'), 'failed output replaced the previously emitted stylesheet').toBe(
      initialClientCss,
    )

    const clientCallsAfterFailure = calls.client
    rmSync(siblingOutDir, { force: true, recursive: true })
    const siblingBuild = nextEnvironmentWatchCycle(siblingWatcher)
    await new Promise((settle) => setTimeout(settle, 800))
    writeFileSync(siblingTrigger, `export const generation = 'second'\n`)
    expect(await siblingBuild).toBeUndefined()
    expect(calls.client, 'the sibling-only edit unexpectedly rebuilt the rejected client graph').toBe(
      clientCallsAfterFailure,
    )

    const rebuiltCss = readOutputFiles(siblingOutDir, '.css')
    expect(rebuiltCss).toContain(widths.old)
    expect(rebuiltCss).toContain(widths.sibling)
    expect(rebuiltCss).not.toContain(widths.rejected)
    expect(rebuiltCss, 'cached sibling output disagrees with the clean no-cache build').toBe(cleanCss)

    // `writeBundle` is a notification after every output file has been replaced. A peer hook
    // rejecting there makes the watch cycle red but cannot roll those bytes back, so Bamboo must
    // publish the written candidate rather than restoring reachability for files no longer live.
    rejectAfterWrite = true
    const failedAfterWrite = nextEnvironmentWatchCycle(clientWatcher)
    await new Promise((settle) => setTimeout(settle, 800))
    writeFileSync(clientTrigger, 'third\n')
    const writeError = await failedAfterWrite
    rejectAfterWrite = false
    expect(writeError?.message).toContain(`test rejected after writing client output (${label})`)
    expect(readOutputFiles(clientOutDir, '.js')).toContain(`w_[${widths.written}]`)

    const clientCallsAfterWrite = calls.client
    rmSync(siblingOutDir, { force: true, recursive: true })
    const siblingAfterWrite = nextEnvironmentWatchCycle(siblingWatcher)
    await new Promise((settle) => setTimeout(settle, 800))
    writeFileSync(siblingTrigger, `export const generation = 'third'\n`)
    expect(await siblingAfterWrite).toBeUndefined()
    expect(calls.client).toBe(clientCallsAfterWrite)
    const cssAfterWrite = readOutputFiles(siblingOutDir, '.css')
    expect(cssAfterWrite).toContain(widths.written)
    expect(cssAfterWrite).toContain(widths.sibling)
    expect(cssAfterWrite).not.toContain(widths.old)
    expect(cssAfterWrite).not.toContain(widths.rejected)

    // Even a pre/sequential input write hook declared before Bamboo runs after Bamboo's private
    // filesystem observer. Files have already been replaced when writeBundle begins, so the
    // rejected cycle must still publish the class those new bytes name.
    rejectBeforeBambooWrite = true
    const failedBeforeBambooWrite = nextEnvironmentWatchCycle(clientWatcher)
    await new Promise((settle) => setTimeout(settle, 800))
    writeFileSync(clientTrigger, 'first\n')
    const earlyWriteError = await failedBeforeBambooWrite
    rejectBeforeBambooWrite = false
    expect(earlyWriteError?.message).toContain(`test rejected before Bamboo's write observer (${label})`)
    expect(readOutputFiles(clientOutDir, '.js')).toContain(`w_[${widths.old}]`)

    const callsAfterEarlyWrite = calls.client
    rmSync(siblingOutDir, { force: true, recursive: true })
    const siblingAfterEarlyWrite = nextEnvironmentWatchCycle(siblingWatcher)
    await new Promise((settle) => setTimeout(settle, 800))
    writeFileSync(siblingTrigger, `export const generation = 'fourth'\n`)
    expect(await siblingAfterEarlyWrite).toBeUndefined()
    expect(calls.client).toBe(callsAfterEarlyWrite)
    const cssAfterEarlyWrite = readOutputFiles(siblingOutDir, '.css')
    expect(cssAfterEarlyWrite).toContain(widths.old)
    expect(cssAfterEarlyWrite).toContain(widths.sibling)
    expect(cssAfterEarlyWrite).not.toContain(widths.written)

    // `build.write: false` has no writeBundle and Vite passes the same empty closeBundle argument
    // after success and failure. The final configured output plugin is therefore the commit
    // boundary: a later configured generate hook must prevent the in-memory candidate from
    // becoming the sibling's reachability answer.
    await Promise.all([clientWatcher.close(), siblingWatcher.close()])
    clientWatcher = undefined
    siblingWatcher = undefined
    writeFileSync(clientTrigger, 'first\n')
    const inMemoryBuilder = (await create({
      root: cwd,
      logLevel: 'silent',
      css: { postcss: { plugins: [] } },
      plugins: [selectedClientSource, ...bamboocss({ cwd, configPath, reportSummary: false }), rejectCloseAfterBamboo],
      build: {
        write: false,
        minify: false,
        rollupOptions: {
          external: [/^react/, /styled-system/],
          output: { plugins: [rejectAfterBamboo] },
        },
      },
      builder: {},
      environments: {
        client: {
          build: {
            emitAssets: true,
            lib: { entry: clientEntry, formats: ['es'], fileName: `output-transaction-memory-client-${label}` },
          },
        },
        sibling: {
          build: {
            emitAssets: true,
            lib: { entry: siblingEntry, formats: ['es'], fileName: `output-transaction-memory-sibling-${label}` },
          },
        },
      },
    })) as TestEnvironmentBuilder

    await inMemoryBuilder.build(inMemoryBuilder.environments.client)
    // `closeBundle` belongs to the input plugin driver in both Rollup and Rolldown; configured
    // output plugins never receive it. Bamboo's commit hook is therefore an ordered input hook.
    expect(configuredOutputCloseCalls).toBe(0)
    writeFileSync(clientTrigger, 'second\n')
    const buildInMemorySibling = async () => {
      const built = await inMemoryBuilder.build(inMemoryBuilder.environments.sibling)
      return (Array.isArray(built) ? built : [built])
        .flatMap((bundle) => (bundle as { output?: unknown[] }).output ?? [])
        .map((output) => {
          const asset = output as { fileName?: string; source?: unknown }
          return asset.fileName?.endsWith('.css') && typeof asset.source === 'string' ? asset.source : ''
        })
        .join('\n')
    }

    mutateClientCss = true
    await expect(inMemoryBuilder.build(inMemoryBuilder.environments.client)).rejects.toThrow(
      'changed or removed the generated stylesheet',
    )
    mutateClientCss = false
    const afterMutation = await buildInMemorySibling()
    expect(afterMutation).toContain(widths.old)
    expect(afterMutation).not.toContain(widths.rejected)

    rejectOnClose = true
    await expect(inMemoryBuilder.build(inMemoryBuilder.environments.client)).rejects.toThrow(
      `test rejected while closing client output (${label})`,
    )
    rejectOnClose = false
    const afterCloseFailure = await buildInMemorySibling()
    expect(afterCloseFailure).toContain(widths.old)
    expect(afterCloseFailure).not.toContain(widths.rejected)

    rejectClientOutput = true
    await expect(inMemoryBuilder.build(inMemoryBuilder.environments.client)).rejects.toThrow(
      `test rejected client output (${label})`,
    )
    rejectClientOutput = false
    const inMemoryCss = await buildInMemorySibling()
    expect(inMemoryCss).toContain(widths.old)
    expect(inMemoryCss).toContain(widths.sibling)
    expect(inMemoryCss).not.toContain(widths.rejected)
  } finally {
    rejectClientOutput = false
    rejectAfterWrite = false
    rejectBeforeBambooWrite = false
    rejectOnClose = false
    mutateClientCss = false
    await Promise.all([clientWatcher?.close(), siblingWatcher?.close()])
    rmSync(clientEntry, { force: true })
    rmSync(siblingEntry, { force: true })
    rmSync(clientTrigger, { force: true })
    rmSync(siblingTrigger, { force: true })
    rmSync(configPath, { force: true })
    rmSync(clientOutDir, { force: true, recursive: true })
    rmSync(siblingOutDir, { force: true, recursive: true })
  }
}

/**
 * Leave two configured outputs from different generations on disk, then make a sibling emit CSS.
 *
 * Vite writes configured outputs independently. The first can finish before a later output's
 * `generateBundle` hook rejects, so neither restoring the old generation nor publishing only the
 * candidate describes the files users now have. Reachability has to retain both live epochs until
 * a later generation replaces every output.
 */
const runMixedOutputEpochWatchRebuild = async (
  create: (config: Record<string, unknown>) => Promise<unknown>,
  label: string,
  widths: { old: string; candidate: string; replacement: string; sibling: string },
) => {
  const clientEntry = join(cwd, `src/__multi-output-client-${label}.tsx`)
  const siblingEntry = join(cwd, `src/__multi-output-sibling-${label}.tsx`)
  const clientTrigger = join(cwd, `src/__multi-output-client-${label}.txt`)
  const siblingTrigger = join(cwd, `src/__multi-output-sibling-trigger-${label}.ts`)
  const configPath = join(cwd, `__multi-output-${label}.bamboo.config.ts`)
  const firstOutDir = join(cwd, `__multi-output-client-first-${label}-out`)
  const secondOutDir = join(cwd, `__multi-output-client-second-${label}-out`)
  const siblingOutDir = join(cwd, `__multi-output-sibling-${label}-out`)
  const calls = { client: 0 }

  const cssFromBuild = (built: unknown) =>
    (Array.isArray(built) ? built : [built])
      .flatMap((bundle) => (bundle as { output?: unknown[] }).output ?? [])
      .map((output) => {
        const asset = output as { fileName?: string; source?: unknown }
        return asset.fileName?.endsWith('.css') && typeof asset.source === 'string' ? asset.source : ''
      })
      .join('\n')

  const selectedClientSource: VitePlugin = {
    name: `bamboocss:test-multi-output-source-${label}`,
    enforce: 'pre',
    sharedDuringBuild: true,
    transform(_code, id) {
      if (id.split('?')[0] !== clientEntry) return
      calls.client++
      this.addWatchFile(clientTrigger)
      const generation = readFileSync(clientTrigger, 'utf8').trim()
      const width =
        generation === 'first'
          ? widths.old
          : generation === 'replacement-mixed' || generation === 'accepted'
            ? widths.replacement
            : widths.candidate
      return {
        code:
          `import 'virtual:bamboo.css'\n` +
          `import { css } from '../styled-system/css'\n` +
          `export const className = css({ width: '[${width}]' })\n`,
        map: null,
      }
    },
  }

  type FailureMode = 'none' | 'before-write' | 'after-first-write' | 'first-before-second-writes' | 'memory-second'
  let failureMode: FailureMode = 'none'
  let firstOutputWritten = Promise.resolve()
  let markFirstOutputWritten = () => {}
  let secondOutputWritten = Promise.resolve()
  let markSecondOutputWritten = () => {}
  let rejectedSecondJs = ''
  const armFirstOutput = () => {
    firstOutputWritten = new Promise<void>((resolve) => {
      markFirstOutputWritten = resolve
    })
  }
  const armSecondOutput = () => {
    secondOutputWritten = new Promise<void>((resolve) => {
      markSecondOutputWritten = resolve
    })
  }
  const outputPlugin = (output: 1 | 2): VitePlugin => ({
    name: `bamboocss:test-multi-output-${label}-${output}`,
    async generateBundle(_, bundle) {
      if (failureMode === 'before-write') {
        throw new Error(`test rejected every output before write (${label})`)
      }
      if (failureMode === 'first-before-second-writes' && output === 1) {
        throw new Error(`test rejected first output before second wrote (${label})`)
      }
      if (output !== 2) return
      if (failureMode === 'after-first-write' || failureMode === 'memory-second') {
        if (failureMode === 'after-first-write') await firstOutputWritten
        rejectedSecondJs = Object.values(bundle)
          .map((entry) => (entry.type === 'chunk' ? entry.code : ''))
          .join('\n')
        throw new Error(`test rejected second configured output (${label})`)
      }
    },
    writeBundle() {
      if (output === 1) markFirstOutputWritten()
      else markSecondOutputWritten()
    },
  })

  const clientOutputs = () => [
    {
      dir: firstOutDir,
      format: 'es',
      entryFileNames: `multi-output-client-${label}.js`,
      assetFileNames: `multi-output-client-${label}.[ext]`,
      plugins: [outputPlugin(1)],
    },
    {
      dir: secondOutDir,
      format: 'cjs',
      entryFileNames: `multi-output-client-${label}.js`,
      assetFileNames: `multi-output-client-${label}.[ext]`,
      plugins: [outputPlugin(2)],
    },
  ]

  writeFileSync(
    clientEntry,
    `import 'virtual:bamboo.css'\n` +
      `import { css } from '../styled-system/css'\n` +
      `export const oldClass = css({ width: '[${widths.old}]' })\n` +
      `export const candidateClass = css({ width: '[${widths.candidate}]' })\n` +
      `export const replacementClass = css({ width: '[${widths.replacement}]' })\n`,
  )
  writeFileSync(
    siblingEntry,
    `import 'virtual:bamboo.css'\n` +
      `import { css } from '../styled-system/css'\n` +
      `export { generation } from './__multi-output-sibling-trigger-${label}'\n` +
      `export const className = css({ width: '[${widths.sibling}]' })\n`,
  )
  writeFileSync(clientTrigger, 'first\n')
  writeFileSync(siblingTrigger, `export const generation = 'first'\n`)
  writeIsolatedBambooConfig(configPath, [
    `./src/__multi-output-client-${label}.tsx`,
    `./src/__multi-output-sibling-${label}.tsx`,
  ])

  const builder = (await create({
    root: cwd,
    logLevel: 'silent',
    css: { postcss: { plugins: [] } },
    plugins: [selectedClientSource, ...bamboocss({ cwd, configPath, reportSummary: false })],
    build: {
      watch: {},
      minify: false,
      emptyOutDir: false,
      rollupOptions: { external: [/^react/, /styled-system/] },
    },
    builder: {},
    environments: {
      client: {
        build: {
          cssCodeSplit: true,
          emitAssets: true,
          lib: { entry: clientEntry, formats: ['es', 'cjs'], fileName: `multi-output-client-${label}` },
          rollupOptions: { output: clientOutputs() },
        },
      },
      sibling: {
        build: {
          emitAssets: true,
          outDir: siblingOutDir,
          lib: { entry: siblingEntry, formats: ['es'], fileName: `multi-output-sibling-${label}` },
        },
      },
    },
  })) as TestEnvironmentBuilder

  let clientWatcher: TestBuildWatcher | undefined
  let siblingWatcher: TestBuildWatcher | undefined
  let siblingGeneration = 1
  const rebuildSibling = async () => {
    const callsBefore = calls.client
    rmSync(siblingOutDir, { force: true, recursive: true })
    const built = nextEnvironmentWatchCycle(siblingWatcher!)
    await new Promise((settle) => setTimeout(settle, 800))
    writeFileSync(siblingTrigger, `export const generation = '${++siblingGeneration}'\n`)
    expect(await built).toBeUndefined()
    expect(calls.client, `${label}: sibling-only edit rebuilt the client graph`).toBe(callsBefore)
    return readOutputFiles(siblingOutDir, '.css')
  }

  try {
    clientWatcher = (await builder.build(builder.environments.client)) as TestBuildWatcher
    expect(await nextEnvironmentWatchCycle(clientWatcher)).toBeUndefined()
    siblingWatcher = (await builder.build(builder.environments.sibling)) as TestBuildWatcher
    expect(await nextEnvironmentWatchCycle(siblingWatcher)).toBeUndefined()

    const initialFirstJs = readOutputFiles(firstOutDir, '.js')
    const initialSecondJs = readOutputFiles(secondOutDir, '.js')
    expect(initialFirstJs).toContain(`w_[${widths.old}]`)
    expect(initialSecondJs).toContain(`w_[${widths.old}]`)
    expect(initialFirstJs).not.toContain(`w_[${widths.candidate}]`)
    expect(initialSecondJs).not.toContain(`w_[${widths.candidate}]`)

    // A generation rejected before either output writes is atomic: only the old epoch remains.
    failureMode = 'before-write'
    const rejectedBeforeWrite = nextEnvironmentWatchCycle(clientWatcher)
    await new Promise((settle) => setTimeout(settle, 800))
    writeFileSync(clientTrigger, 'before-write\n')
    expect((await rejectedBeforeWrite)?.message).toContain(`test rejected every output before write (${label})`)
    expect(readOutputFiles(firstOutDir, '.js')).toBe(initialFirstJs)
    expect(readOutputFiles(secondOutDir, '.js')).toBe(initialSecondJs)
    const afterPreWriteFailure = await rebuildSibling()
    failureMode = 'none'
    expect(afterPreWriteFailure).toContain(widths.old)
    expect(afterPreWriteFailure).toContain(widths.sibling)
    expect(afterPreWriteFailure).not.toContain(widths.candidate)

    // Output one reaches disk, then output two rejects. Both generations now name classes in
    // live JavaScript and a sibling stylesheet must conservatively back both.
    armFirstOutput()
    failureMode = 'after-first-write'
    const mixedBuild = nextEnvironmentWatchCycle(clientWatcher)
    await new Promise((settle) => setTimeout(settle, 800))
    writeFileSync(clientTrigger, 'mixed\n')
    expect((await mixedBuild)?.message).toContain(`test rejected second configured output (${label})`)
    expect(rejectedSecondJs).toContain(`w_[${widths.candidate}]`)
    expect(readOutputFiles(firstOutDir, '.js')).toContain(`w_[${widths.candidate}]`)
    expect(readOutputFiles(firstOutDir, '.js')).not.toContain(`w_[${widths.old}]`)
    expect(readOutputFiles(secondOutDir, '.js')).toBe(initialSecondJs)

    const mixedCss = await rebuildSibling()
    failureMode = 'none'
    expect(mixedCss).toContain(widths.old)
    expect(mixedCss).toContain(widths.candidate)
    expect(mixedCss).toContain(widths.sibling)

    // A second partial failure replaces the already-written slot. The first candidate no
    // longer exists in either client output and must not accumulate as an immortal epoch.
    armFirstOutput()
    failureMode = 'after-first-write'
    const replacementMixedBuild = nextEnvironmentWatchCycle(clientWatcher)
    await new Promise((settle) => setTimeout(settle, 800))
    writeFileSync(clientTrigger, 'replacement-mixed\n')
    expect((await replacementMixedBuild)?.message).toContain(`test rejected second configured output (${label})`)
    expect(readOutputFiles(firstOutDir, '.js')).toContain(`w_[${widths.replacement}]`)
    expect(readOutputFiles(firstOutDir, '.js')).not.toContain(`w_[${widths.candidate}]`)
    expect(readOutputFiles(secondOutDir, '.js')).toBe(initialSecondJs)
    const replacementMixedCss = await rebuildSibling()
    failureMode = 'none'
    expect(replacementMixedCss).toContain(widths.old)
    expect(replacementMixedCss).toContain(widths.replacement)
    expect(replacementMixedCss).toContain(widths.sibling)
    expect(replacementMixedCss).not.toContain(widths.candidate)

    // Alternate the failed slot: slot zero never reaches disk, while slot one does. Rolldown
    // runs each configured output as its own build task, so a stale "slot zero succeeded" bit
    // from the preceding generation must not combine with this slot-one success. The disk now
    // genuinely contains two candidate epochs and the sibling must retain exactly those two.
    failureMode = 'first-before-second-writes'
    armSecondOutput()
    const alternatingBuild = nextEnvironmentWatchCycle(clientWatcher)
    await new Promise((settle) => setTimeout(settle, 800))
    writeFileSync(clientTrigger, 'alternating\n')
    expect((await alternatingBuild)?.message).toContain(`test rejected first output before second wrote (${label})`)
    // Both hosts report the aggregate error before the still-running second output finishes.
    // Wait for its filesystem boundary so the assertions compare stable live slots to disk.
    await secondOutputWritten
    expect(readOutputFiles(firstOutDir, '.js')).toContain(`w_[${widths.replacement}]`)
    expect(readOutputFiles(secondOutDir, '.js')).toContain(`w_[${widths.candidate}]`)
    const alternatingCss = await rebuildSibling()
    failureMode = 'none'
    expect(alternatingCss).not.toContain(widths.old)
    expect(alternatingCss).toContain(widths.candidate)
    expect(alternatingCss).toContain(widths.replacement)
    expect(alternatingCss).toContain(widths.sibling)

    // A later successful generation replaces both configured outputs, collapsing the live set
    // back to one epoch and reproducing a clean no-cache stylesheet exactly.
    armSecondOutput()
    const acceptedBuild = nextEnvironmentWatchCycle(clientWatcher)
    await new Promise((settle) => setTimeout(settle, 800))
    writeFileSync(clientTrigger, 'accepted\n')
    expect(await acceptedBuild).toBeUndefined()
    await secondOutputWritten
    expect(readOutputFiles(firstOutDir, '.js')).toContain(`w_[${widths.replacement}]`)
    expect(readOutputFiles(secondOutDir, '.js')).toContain(`w_[${widths.replacement}]`)
    const convergedCss = await rebuildSibling()
    expect(convergedCss).not.toContain(widths.old)
    expect(convergedCss).not.toContain(widths.candidate)
    expect(convergedCss).toContain(widths.replacement)
    expect(convergedCss).toContain(widths.sibling)

    // The clean and in-memory controls below own separate plugin instances. Stop the two
    // filesystem watchers before reusing their trigger paths so no queued retry can race those
    // controls or publish after the assertions above.
    await Promise.all([clientWatcher.close(), siblingWatcher.close()])
    clientWatcher = undefined
    siblingWatcher = undefined

    const cleanBuilder = (await create({
      root: cwd,
      logLevel: 'silent',
      css: { postcss: { plugins: [] } },
      plugins: [selectedClientSource, ...bamboocss({ cwd, configPath, reportSummary: false })],
      build: { write: false, minify: false, rollupOptions: { external: [/^react/, /styled-system/] } },
      builder: {},
      environments: {
        client: {
          build: {
            emitAssets: true,
            lib: { entry: clientEntry, formats: ['es'], fileName: `multi-output-clean-client-${label}` },
          },
        },
        sibling: {
          build: {
            emitAssets: true,
            lib: { entry: siblingEntry, formats: ['es'], fileName: `multi-output-clean-sibling-${label}` },
          },
        },
      },
    })) as TestEnvironmentBuilder
    await cleanBuilder.build(cleanBuilder.environments.client)
    const cleanCss = cssFromBuild(await cleanBuilder.build(cleanBuilder.environments.sibling))
    expect(convergedCss.trim(), `${label}: converged watcher CSS differs from a clean build`).toBe(cleanCss.trim())

    // In-memory multi-output builds expose nothing when the aggregate build rejects. A first
    // generated result must not become a live epoch merely because its own output hooks passed.
    writeFileSync(clientTrigger, 'first\n')
    const memoryBuilder = (await create({
      root: cwd,
      logLevel: 'silent',
      css: { postcss: { plugins: [] } },
      plugins: [selectedClientSource, ...bamboocss({ cwd, configPath, reportSummary: false })],
      build: { write: false, minify: false, rollupOptions: { external: [/^react/, /styled-system/] } },
      builder: {},
      environments: {
        client: {
          build: {
            emitAssets: true,
            lib: { entry: clientEntry, formats: ['es'], fileName: `multi-output-memory-client-${label}` },
            rollupOptions: { output: clientOutputs().map(({ dir: _dir, ...output }) => output) },
          },
        },
        sibling: {
          build: {
            emitAssets: true,
            lib: { entry: siblingEntry, formats: ['es'], fileName: `multi-output-memory-sibling-${label}` },
          },
        },
      },
    })) as TestEnvironmentBuilder
    await memoryBuilder.build(memoryBuilder.environments.client)
    writeFileSync(clientTrigger, 'memory-candidate\n')
    failureMode = 'memory-second'
    await expect(memoryBuilder.build(memoryBuilder.environments.client)).rejects.toThrow(
      `test rejected second configured output (${label})`,
    )
    failureMode = 'none'
    const memoryCss = cssFromBuild(await memoryBuilder.build(memoryBuilder.environments.sibling))
    expect(memoryCss).toContain(widths.old)
    expect(memoryCss).toContain(widths.sibling)
    expect(memoryCss).not.toContain(widths.candidate)
  } finally {
    failureMode = 'none'
    markFirstOutputWritten()
    markSecondOutputWritten()
    await Promise.all([clientWatcher?.close(), siblingWatcher?.close()])
    rmSync(clientEntry, { force: true })
    rmSync(siblingEntry, { force: true })
    rmSync(clientTrigger, { force: true })
    rmSync(siblingTrigger, { force: true })
    rmSync(configPath, { force: true })
    rmSync(firstOutDir, { force: true, recursive: true })
    rmSync(secondOutDir, { force: true, recursive: true })
    rmSync(siblingOutDir, { force: true, recursive: true })
  }
}

/**
 * Remove an old atom from physical extraction while one configured JS output still names it.
 *
 * The sibling owns the stylesheet. Its replacement must fail before write while the client has
 * mixed live output slots, then converge once both slots publish the new generation.
 */
const runRemovedLiveRuleWatchRebuild = async (
  create: (config: Record<string, unknown>) => Promise<unknown>,
  label: string,
  widths: { old: string; replacement: string; sibling: string },
  pruneCss = true,
) => {
  const clientEntry = join(cwd, `src/__removed-live-rule-client-${label}.tsx`)
  const clientTrigger = join(cwd, `src/__removed-live-rule-client-trigger-${label}.ts`)
  const siblingEntry = join(cwd, `src/__removed-live-rule-sibling-${label}.tsx`)
  const siblingTrigger = join(cwd, `src/__removed-live-rule-sibling-trigger-${label}.ts`)
  const configPath = join(cwd, `__removed-live-rule-${label}.bamboo.config.ts`)
  const firstOutDir = join(cwd, `__removed-live-rule-first-${label}-out`)
  const secondOutDir = join(cwd, `__removed-live-rule-second-${label}-out`)
  const siblingOutDir = join(cwd, `__removed-live-rule-sibling-${label}-out`)

  const clientSource = (width: string) =>
    `import { css } from '../styled-system/css'\n` +
    `export { generation } from './__removed-live-rule-client-trigger-${label}'\n` +
    `export const className = css({ width: '[${width}]' })\n`
  const siblingSource =
    `import 'virtual:bamboo.css'\n` +
    `import { css } from '../styled-system/css'\n` +
    `export { generation } from './__removed-live-rule-sibling-trigger-${label}'\n` +
    `export const className = css({ width: '[${widths.sibling}]' })\n`
  const cssFromBuild = (built: unknown) =>
    (Array.isArray(built) ? built : [built])
      .flatMap((bundle) => (bundle as { output?: unknown[] }).output ?? [])
      .map((output) => {
        const asset = output as { fileName?: string; source?: unknown }
        return asset.fileName?.endsWith('.css') && typeof asset.source === 'string' ? asset.source : ''
      })
      .join('\n')
  const outputSnapshot = (directory: string) =>
    Object.fromEntries(
      (existsSync(directory) ? readdirSync(directory) : [])
        .sort()
        .map((file) => [file, readFileSync(join(directory, file), 'utf8')]),
    )

  let rejectSecondOutput = false
  let firstOutputWritten = Promise.resolve()
  let markFirstOutputWritten = () => {}
  const armFirstOutput = () => {
    firstOutputWritten = new Promise<void>((resolveFirstOutput) => {
      markFirstOutputWritten = resolveFirstOutput
    })
  }
  let siblingMayBuild = Promise.resolve()
  let releaseSibling = () => {}
  const holdSibling = () => {
    siblingMayBuild = new Promise<void>((resolveSibling) => {
      releaseSibling = resolveSibling
    })
  }

  const outputPlugin = (output: 1 | 2): VitePlugin => ({
    name: `bamboocss:test-removed-live-rule-output-${label}-${output}`,
    async generateBundle() {
      if (output !== 2 || !rejectSecondOutput) return
      await firstOutputWritten
      releaseSibling()
      throw new Error(`test rejected second removed-rule output (${label})`)
    },
    writeBundle() {
      if (output === 1) markFirstOutputWritten()
    },
  })
  const siblingBarrier: VitePlugin = {
    name: `bamboocss:test-removed-live-rule-sibling-barrier-${label}`,
    enforce: 'pre',
    sharedDuringBuild: true,
    async buildStart() {
      if (this.environment.name === 'sibling') await siblingMayBuild
    },
  }
  const clientOutputs = () => [
    {
      dir: firstOutDir,
      format: 'es',
      entryFileNames: `removed-live-rule-client-${label}.js`,
      plugins: [outputPlugin(1)],
    },
    {
      dir: secondOutDir,
      format: 'cjs',
      entryFileNames: `removed-live-rule-client-${label}.js`,
      plugins: [outputPlugin(2)],
    },
  ]

  writeFileSync(clientEntry, clientSource(widths.old))
  writeFileSync(clientTrigger, `export const generation = 'first'\n`)
  writeFileSync(siblingEntry, siblingSource)
  writeFileSync(siblingTrigger, `export const generation = 'first'\n`)
  writeIsolatedBambooConfig(configPath, [
    `./src/__removed-live-rule-sibling-${label}.tsx`,
    `./src/__removed-live-rule-client-${label}.tsx`,
  ])

  const createConfig = (watch: boolean) => ({
    root: cwd,
    logLevel: 'silent',
    css: { postcss: { plugins: [] } },
    plugins: [siblingBarrier, ...bamboocss({ cwd, configPath, pruneCss, reportSummary: false })],
    build: {
      ...(watch ? { watch: {} } : { write: false }),
      minify: false,
      emptyOutDir: false,
      rollupOptions: { external: [/^react/, /styled-system/] },
    },
    builder: {},
    environments: {
      client: {
        build: {
          emitAssets: false,
          lib: { entry: clientEntry, formats: ['es', 'cjs'], fileName: `removed-live-rule-client-${label}` },
          ...(watch ? { rollupOptions: { output: clientOutputs() } } : {}),
        },
      },
      sibling: {
        build: {
          emitAssets: true,
          outDir: siblingOutDir,
          lib: { entry: siblingEntry, formats: ['es'], fileName: `removed-live-rule-sibling-${label}` },
          rollupOptions: { output: { assetFileNames: `removed-live-rule-sibling-${label}.[ext]` } },
        },
      },
    },
  })

  const builder = (await create(createConfig(true))) as TestEnvironmentBuilder
  let clientWatcher: TestBuildWatcher | undefined
  let siblingWatcher: TestBuildWatcher | undefined
  let convergedCss = ''
  try {
    clientWatcher = (await builder.build(builder.environments.client)) as TestBuildWatcher
    expect(await nextEnvironmentWatchCycle(clientWatcher)).toBeUndefined()
    siblingWatcher = (await builder.build(builder.environments.sibling)) as TestBuildWatcher
    expect(await nextEnvironmentWatchCycle(siblingWatcher)).toBeUndefined()

    const initialFirstJs = readOutputFiles(firstOutDir, '.js')
    const initialSecondJs = readOutputFiles(secondOutDir, '.js')
    const initialSiblingOutput = outputSnapshot(siblingOutDir)
    const initialCss = readOutputFiles(siblingOutDir, '.css')
    expect(initialFirstJs).toContain(`w_[${widths.old}]`)
    expect(initialSecondJs).toContain(`w_[${widths.old}]`)
    expect(initialCss).toContain(widths.old)
    expect(initialCss).not.toContain(widths.replacement)

    // The physical source now contains only NEW. Output zero reaches disk before output one
    // rejects, while the sibling stylesheet generation is held until that mixed state exists.
    armFirstOutput()
    holdSibling()
    rejectSecondOutput = true
    const mixedClientBuild = nextEnvironmentWatchCycle(clientWatcher)
    const rejectedSiblingBuild = nextEnvironmentWatchCycle(siblingWatcher)
    await new Promise((settle) => setTimeout(settle, 800))
    writeFileSync(clientEntry, clientSource(widths.replacement))

    expect((await mixedClientBuild)?.message).toContain(`test rejected second removed-rule output (${label})`)
    const siblingError = await rejectedSiblingBuild
    expect(readOutputFiles(firstOutDir, '.js')).toContain(`w_[${widths.replacement}]`)
    expect(readOutputFiles(firstOutDir, '.js')).not.toContain(`w_[${widths.old}]`)
    expect(readOutputFiles(secondOutDir, '.js')).toBe(initialSecondJs)
    expect(siblingError?.message).toContain(esc(`w_[${widths.old}]`))
    expect(siblingError?.message).toContain('sibling')
    expect(siblingError?.message).toContain('source generation')
    expect(outputSnapshot(siblingOutDir), `${label}: rejected sheet replaced the prior output`).toEqual(
      initialSiblingOutput,
    )

    // Once both configured outputs move to NEW, no live JavaScript names OLD and the same
    // physical extraction is safe to publish.
    rejectSecondOutput = false
    releaseSibling()
    const acceptedClientBuild = nextEnvironmentWatchCycle(clientWatcher)
    await new Promise((settle) => setTimeout(settle, 800))
    writeFileSync(clientTrigger, `export const generation = 'second'\n`)
    expect(await acceptedClientBuild).toBeUndefined()
    expect(readOutputFiles(firstOutDir, '.js')).toContain(`w_[${widths.replacement}]`)
    expect(readOutputFiles(secondOutDir, '.js')).toContain(`w_[${widths.replacement}]`)
    expect(readOutputFiles(firstOutDir, '.js')).not.toContain(`w_[${widths.old}]`)
    expect(readOutputFiles(secondOutDir, '.js')).not.toContain(`w_[${widths.old}]`)

    const acceptedSiblingBuild = nextEnvironmentWatchCycle(siblingWatcher)
    await new Promise((settle) => setTimeout(settle, 800))
    writeFileSync(siblingTrigger, `export const generation = 'second'\n`)
    expect(await acceptedSiblingBuild).toBeUndefined()
    convergedCss = readOutputFiles(siblingOutDir, '.css')
    expect(convergedCss).toContain(widths.replacement)
    expect(convergedCss).toContain(widths.sibling)
    expect(convergedCss).not.toContain(widths.old)

    await Promise.all([clientWatcher.close(), siblingWatcher.close()])
    clientWatcher = undefined
    siblingWatcher = undefined

    const cleanBuilder = (await create(createConfig(false))) as TestEnvironmentBuilder
    await cleanBuilder.build(cleanBuilder.environments.client)
    const cleanCss = cssFromBuild(await cleanBuilder.build(cleanBuilder.environments.sibling))
    expect(convergedCss.trim(), `${label}: converged sheet differs from a clean accepted build`).toBe(cleanCss.trim())
  } finally {
    rejectSecondOutput = false
    markFirstOutputWritten()
    releaseSibling()
    await Promise.all([clientWatcher?.close(), siblingWatcher?.close()])
    rmSync(clientEntry, { force: true })
    rmSync(clientTrigger, { force: true })
    rmSync(siblingEntry, { force: true })
    rmSync(siblingTrigger, { force: true })
    rmSync(configPath, { force: true })
    rmSync(firstOutDir, { force: true, recursive: true })
    rmSync(secondOutDir, { force: true, recursive: true })
    rmSync(siblingOutDir, { force: true, recursive: true })
  }
}

/**
 * Rebuild both environment watchers while one generation is deliberately held after
 * `buildStart`.
 *
 * A completed generation leaves one contribution per environment. On the next edit both
 * environments open replacements at once, but the fast one can reach `buildEnd` while the
 * other has not loaded its graph — including the client's virtual stylesheet — yet. Merely
 * starting that delayed generation must not make the fast environment treat the whole run as
 * complete.
 */
const runConcurrentEnvironmentWatchRebuild = async (
  create: (config: Record<string, unknown>) => Promise<unknown>,
  label: string,
  widths: { client: string; ssr: string },
) => {
  const clientEntry = join(cwd, `src/__concurrent-generation-client-${label}.tsx`)
  const ssrEntry = join(cwd, `src/__concurrent-generation-ssr-${label}.tsx`)
  const trigger = join(cwd, `src/__concurrent-generation-trigger-${label}.ts`)
  const configPath = join(cwd, `__concurrent-generation-${label}.bamboo.config.ts`)
  const clientOutDir = join(cwd, `__concurrent-generation-client-${label}-out`)
  const ssrOutDir = join(cwd, `__concurrent-generation-ssr-${label}-out`)
  const buildStarts = { client: 0, ssr: 0 }

  type EnvironmentName = keyof typeof buildStarts
  let delayedEnvironment: EnvironmentName | undefined
  let releaseDelayed = () => {}
  let markDelayedStarted = () => {}
  let delayedStarted = Promise.resolve()

  const armDelay = (environment: EnvironmentName) => {
    delayedEnvironment = environment
    delayedStarted = new Promise<void>((resolve) => {
      markDelayedStarted = resolve
    })
    const wait = new Promise<void>((resolve) => {
      releaseDelayed = resolve
    })
    return wait
  }

  const delayGeneration: VitePlugin = {
    name: `bamboocss:test-delay-concurrent-generation-${label}`,
    sharedDuringBuild: true,
    buildStart: {
      order: 'post',
      async handler() {
        const environment = this.environment.name as EnvironmentName
        buildStarts[environment]++
        if (buildStarts[environment] === 1 || !delayedEnvironment) return
        if (environment !== delayedEnvironment) {
          // Do not let the fast graph finish before the delayed watcher has actually opened its
          // replacement generation. The production race exists only after both buildStart hooks.
          await delayedStarted
          return
        }
        markDelayedStarted()
        await armWait
      },
    },
  }
  let armWait = Promise.resolve()

  writeFileSync(trigger, `export const generation = 'first'\n`)
  writeFileSync(
    clientEntry,
    `import 'virtual:bamboo.css'\n` +
      `import { css } from '../styled-system/css'\n` +
      `export { generation } from './__concurrent-generation-trigger-${label}'\n` +
      `export const className = css({ width: '[${widths.client}]' })\n`,
  )
  writeFileSync(
    ssrEntry,
    `import { css } from '../styled-system/css'\n` +
      `export { generation } from './__concurrent-generation-trigger-${label}'\n` +
      `export const className = css({ width: '[${widths.ssr}]' })\n`,
  )
  writeIsolatedBambooConfig(configPath, [
    `./src/__concurrent-generation-client-${label}.tsx`,
    `./src/__concurrent-generation-ssr-${label}.tsx`,
  ])

  const bambooPlugins = bamboocss({ cwd, configPath, reportSummary: false })
  const builder = (await create({
    root: cwd,
    logLevel: 'silent',
    css: { postcss: { plugins: [] } },
    plugins: [...bambooPlugins, delayGeneration],
    build: {
      watch: {},
      minify: false,
      emptyOutDir: false,
      rollupOptions: { external: [/^react/, /styled-system/] },
    },
    builder: {},
    environments: {
      client: {
        build: {
          outDir: clientOutDir,
          lib: { entry: clientEntry, formats: ['es'], fileName: `concurrent-generation-client-${label}` },
        },
      },
      ssr: {
        build: {
          ssr: true,
          outDir: ssrOutDir,
          lib: { entry: ssrEntry, formats: ['es'], fileName: `concurrent-generation-ssr-${label}` },
        },
      },
    },
  })) as TestEnvironmentBuilder

  let clientWatcher: TestBuildWatcher | undefined
  let ssrWatcher: TestBuildWatcher | undefined
  const rebuildWith = async (environment: EnvironmentName, generation: string) => {
    armWait = armDelay(environment)
    rmSync(clientOutDir, { force: true, recursive: true })
    const clientBuild = nextEnvironmentWatchBuild(clientWatcher!)
    const ssrBuild = nextEnvironmentWatchBuild(ssrWatcher!)
    await new Promise((settle) => setTimeout(settle, 800))
    writeFileSync(trigger, `export const generation = '${generation}'\n`)
    await delayedStarted

    const fastBuild = environment === 'client' ? ssrBuild : clientBuild
    const delayedBuild = environment === 'client' ? clientBuild : ssrBuild
    const fastError = await fastBuild
    releaseDelayed()
    const delayedError = await delayedBuild
    delayedEnvironment = undefined

    expect(fastError, `${label}: the fast environment rejected an incomplete shared generation`).toBeUndefined()
    expect(delayedError, `${label}: the delayed environment did not finish after release`).toBeUndefined()
    const css = existsSync(clientOutDir)
      ? readdirSync(clientOutDir)
          .filter((file) => file.endsWith('.css'))
          .map((file) => readFileSync(join(clientOutDir, file), 'utf8'))
          .join('\n')
      : ''
    expect(css, `${label}: the completed client generation emitted no Bamboo stylesheet`).toContain(
      '--made-with-bamboo',
    )
    expect(css, `${label}: the emitted stylesheet lost the client class`).toContain(widths.client)
    expect(css, `${label}: the emitted stylesheet lost the committed SSR class`).toContain(widths.ssr)
  }

  try {
    ssrWatcher = (await builder.build(builder.environments.ssr)) as TestBuildWatcher
    expect(await nextEnvironmentWatchBuild(ssrWatcher)).toBeUndefined()
    clientWatcher = (await builder.build(builder.environments.client)) as TestBuildWatcher
    expect(await nextEnvironmentWatchBuild(clientWatcher)).toBeUndefined()
    expect(buildStarts).toEqual({ client: 1, ssr: 1 })

    // This is the original failure order: SSR reaches the whole-run guard while the client is
    // between buildStart and loading `virtual:bamboo.css`.
    await rebuildWith('client', 'second')
    // The inverse order proves completion belongs to generations rather than to a preferred
    // environment or fixed client-first schedule.
    await rebuildWith('ssr', 'third')
    // Rolldown may coalesce the two filesystem writes differently and schedule an additional
    // no-op generation. The barriers above prove both named generations participated; an exact
    // cumulative hook count is not portable between its watcher and Rollup's.
    expect(buildStarts.client).toBeGreaterThanOrEqual(3)
    expect(buildStarts.ssr).toBeGreaterThanOrEqual(3)
  } finally {
    releaseDelayed()
    await Promise.all([clientWatcher?.close(), ssrWatcher?.close()])
    rmSync(clientEntry, { force: true })
    rmSync(ssrEntry, { force: true })
    rmSync(trigger, { force: true })
    rmSync(configPath, { force: true })
    rmSync(clientOutDir, { force: true, recursive: true })
    rmSync(ssrOutDir, { force: true, recursive: true })
  }
}

describe.sequential('two build environments, one plugin instance', () => {
  beforeEach(() => {
    // The client also declares a recipe variant nothing selects, so a build can be asked
    // whether pruning ran at all rather than only whether it took too much.
    writeFileSync(
      envClientEntry,
      `import 'virtual:bamboo.css'\n` +
        `import { css, cva } from '../styled-system/css'\n` +
        `const box = cva({ variants: { state: { on: { height: '[31.5px]' }, off: { height: '[31.7px]' } } } })\n` +
        `export const a = css({ width: '[31.1px]' })\n` +
        `export const b = box({ state: 'on' })\n`,
    )
    writeFileSync(
      envSsrEntry,
      `import { css } from '../styled-system/css'\nexport const b = css({ md: { display: 'inline-block' }, height: '[31.3px]' })\n`,
    )
  })

  afterEach(() => {
    rmSync(envClientEntry, { force: true })
    rmSync(envSsrEntry, { force: true })
    // Removed here rather than by the one test that writes it. A fixture left in `src/` is not
    // inert: `include` is `./src/**/*.{tsx,jsx}`, so it becomes a real extraction input for
    // every later test in the run. `afterEach` fires even when a test times out, which a
    // `finally` in the test body does not — the body keeps running past the timeout.
    rmSync(envSharedModule, { force: true })
    vi.restoreAllMocks()
  })

  /**
   * The subject here is the stylesheet's emission, not its pruning, so the ssr entry is
   * rewritten to reach only classes the client reaches too. Left as the shared fixture writes
   * it, this fails on the ssr-only classes instead — a true result about the wrong thing.
   */
  test('an ssr environment does not have to import the stylesheet', async () => {
    writeFileSync(
      envSsrEntry,
      `import { css } from '../styled-system/css'\nexport const b = css({ width: '[31.1px]' })\n`,
    )

    const css = await buildBothEnvironments(await twoEnvironmentBuilder(true))

    expect(css).toContain('--made-with-bamboo')
    expect(css).toContain('31.1px')
  }, 180_000)

  test('concurrent environments wait for one shared artifact prebuild', async () => {
    const configPath = join(cwd, '__concurrent-prebuild.config.ts')
    const outdir = join(cwd, '__concurrent-styled-system')
    const generatedCss = join(outdir, 'css/index.mjs')

    type PrebuildGate = { wait: Promise<void>; done: () => void; starts: number }
    const testGlobal = globalThis as typeof globalThis & {
      __bambooConcurrentPrebuildGate?: PrebuildGate
    }

    let releaseGeneration!: () => void
    const waitForRelease = new Promise<void>((resolve) => {
      releaseGeneration = resolve
    })
    let markGenerated!: () => void
    const generated = new Promise<void>((resolve) => {
      markGenerated = resolve
    })
    testGlobal.__bambooConcurrentPrebuildGate = { wait: waitForRelease, done: markGenerated, starts: 0 }

    writeFileSync(
      configPath,
      `import { defineConfig } from '@bamboocss/dev'

export default defineConfig({
  preflight: false,
  include: ['./src/__env-{client,ssr}.tsx'],
  outdir: '__concurrent-styled-system',
  plugins: [{
    name: 'concurrent-prebuild-gate',
    hooks: {
      'codegen:prepare': async ({ artifacts }) => {
        globalThis.__bambooConcurrentPrebuildGate.starts++
        await globalThis.__bambooConcurrentPrebuildGate.wait
        return artifacts
      },
      'codegen:done': () => globalThis.__bambooConcurrentPrebuildGate.done(),
    },
  }],
})
`,
    )
    writeFileSync(
      envClientEntry,
      `import 'virtual:bamboo.css'\n` +
        `import { cx } from '../__concurrent-styled-system/css'\n` +
        `export const joined = (value) => cx(value, 'client-generated')\n`,
    )
    writeFileSync(
      envSsrEntry,
      `import { cx } from '../__concurrent-styled-system/css'\n` +
        `export const joined = (value) => cx(value, 'ssr-generated')\n`,
    )
    rmSync(outdir, { recursive: true, force: true })

    let releaseBuildStarts!: () => void
    const bothBuildsStarted = new Promise<void>((resolve) => {
      releaseBuildStarts = resolve
    })
    let buildStarts = 0
    let releaseTimer: ReturnType<typeof setTimeout> | undefined
    const synchronizeBuildStarts: Plugin = {
      name: 'synchronize-concurrent-environments',
      sharedDuringBuild: true,
      async buildStart() {
        buildStarts++
        if (buildStarts === 2) {
          releaseBuildStarts()
          // The racing environment reaches the observer below before the next macrotask.
          // A correct single-flight has both environments waiting, so release the generation
          // ourselves once they have each had a chance to join it.
          releaseTimer = setTimeout(releaseGeneration, 0)
        }
        await bothBuildsStarted
      },
    }

    const artifactsReadyAtBuildStart: boolean[] = []
    const observeAfterBambooPrebuild: Plugin = {
      name: 'observe-bamboo-prebuild',
      sharedDuringBuild: true,
      async buildStart() {
        const ready = existsSync(generatedCss)
        artifactsReadyAtBuildStart.push(ready)
        if (!ready) {
          releaseGeneration()
          await generated
        }
      },
    }

    const bambooPlugins = bamboocss({ cwd, configPath, reportSummary: false, pruneCss: false })

    try {
      const builder = await createBuilder({
        root: cwd,
        logLevel: 'silent',
        css: { postcss: { plugins: [] } },
        plugins: [synchronizeBuildStarts, bambooPlugins[0]!, observeAfterBambooPrebuild, bambooPlugins[1]!],
        build: { write: false, minify: false, rollupOptions: { external: [/^react/] } },
        builder: {},
        environments: {
          client: { build: { lib: { entry: envClientEntry, formats: ['es'], fileName: 'env-client' } } },
          ssr: { build: { ssr: true, lib: { entry: envSsrEntry, formats: ['es'], fileName: 'env-ssr' } } },
        },
      })

      const builds = await Promise.all([
        builder.build(builder.environments.client!),
        builder.build(builder.environments.ssr!),
      ])

      expect(artifactsReadyAtBuildStart).toEqual([true, true])
      expect(existsSync(generatedCss)).toBe(true)
      expect(testGlobal.__bambooConcurrentPrebuildGate!.starts).toBe(1)

      const modules = await Promise.all(
        builds.map(async (built) => {
          const bundles = Array.isArray(built) ? built : [built]
          const code = bundles
            .flatMap((bundle) => (bundle as Rollup.RollupOutput).output)
            .map((output) => ('code' in output ? output.code : ''))
            .join('\n')
          return (await import(`data:text/javascript;base64,${Buffer.from(code).toString('base64')}`)) as {
            joined: (value: string) => string
          }
        }),
      )

      expect(modules.map((module) => module.joined('runtime'))).toEqual([
        'runtime client-generated',
        'runtime ssr-generated',
      ])
    } finally {
      if (releaseTimer) clearTimeout(releaseTimer)
      releaseBuildStarts()
      releaseGeneration()
      delete testGlobal.__bambooConcurrentPrebuildGate
      rmSync(configPath, { force: true })
      rmSync(outdir, { recursive: true, force: true })
    }
  }, 180_000)

  test('cached transform facts are owned by their Vite environment', async () => {
    const trigger = join(cwd, 'src/__env-cache-trigger.tsx')
    const clientTrigger = join(cwd, 'src/__env-cache-client-trigger.ts')
    const sharedModule = join(cwd, 'src/__env-cache-shared.tsx')
    const clientEntry = join(cwd, 'src/__env-cache-client-entry.tsx')
    const ssrEntry = join(cwd, 'src/__env-cache-ssr-entry.tsx')
    const configPath = join(cwd, '__env-cache.bamboo.config.ts')
    const clientOutDir = join(cwd, '__env-cache-client-out')
    const ssrOutDir = join(cwd, '__env-cache-ssr-out')
    const widths = { cached: '37.811px', fresh: '37.922px' }
    type EnvironmentCalls = { client: number; ssr: number }

    const environmentSource = (calls: EnvironmentCalls): VitePlugin => ({
      name: 'bamboocss:test-environment-cache-source',
      enforce: 'pre',
      sharedDuringBuild: true,
      transform(_code, id) {
        if (id.split('?')[0] !== sharedModule) return

        const environment = this.environment.name as keyof EnvironmentCalls
        calls[environment]++
        // The trigger is a separate build entry, so both watchers rebuild. Only the client
        // module itself watches it: SSR must reuse this transform and its environment-local metadata.
        if (environment === 'client') this.addWatchFile(trigger)

        const fresh = environment === 'client' && readFileSync(trigger, 'utf8').includes('second')
        const width = fresh ? widths.fresh : widths.cached
        return {
          code:
            `import { css } from '../styled-system/css'\n` + `export const className = css({ width: '[${width}]' })\n`,
          map: null,
        }
      },
    })

    // The SSR build is held behind the client's post-generateBundle pass. Its previous
    // generation remains live while the replacement waits, so the client sheet must retain the
    // cached SSR class; replay then publishes that same contribution for later partial rebuilds.
    let clientBundles = 0
    let ssrStarts = 0
    const waiters = new Map<number, Set<() => void>>()
    const waitForClient = (bundle: number) => {
      if (clientBundles >= bundle) return Promise.resolve()
      return new Promise<void>((resolve) => {
        const pending = waiters.get(bundle) ?? new Set()
        pending.add(resolve)
        waiters.set(bundle, pending)
      })
    }
    const releaseClient = () => {
      clientBundles++
      for (const [bundle, pending] of [...waiters]) {
        if (bundle > clientBundles) continue
        waiters.delete(bundle)
        for (const resolve of pending) resolve()
      }
    }
    const clientBeforeSsr: VitePlugin = {
      name: 'bamboocss:test-client-before-ssr-cache-replay',
      sharedDuringBuild: true,
      async buildStart() {
        if (this.environment.name === 'ssr') await waitForClient(++ssrStarts)
      },
      generateBundle: {
        // Bamboo's CSS hook is also post and precedes this plugin in the array, so the release
        // happens after the client has populated `prunedClasses` for this build.
        order: 'post',
        handler() {
          if (this.environment.name === 'client') releaseClient()
        },
      },
    }

    const writtenCss = () =>
      readdirSync(clientOutDir)
        .filter((file) => file.endsWith('.css'))
        .map((file) => readFileSync(join(clientOutDir, file), 'utf8'))
        .join('\n')
    const nextBuild = (watcher: Rollup.RollupWatcher) =>
      new Promise<Error | undefined>((resolve) => {
        const onEvent = (event: Rollup.RollupWatcherEvent) => {
          if (event.code !== 'END' && event.code !== 'ERROR') return
          watcher.off('event', onEvent)
          resolve(event.code === 'ERROR' ? event.error : undefined)
        }
        watcher.on('event', onEvent)
      })

    mkdirSync(dirname(sharedModule), { recursive: true })
    // Extraction sees the physical source rather than the environment-specific upstream
    // transform, so both possible rules must belong to the configured CSS graph.
    writeFileSync(
      sharedModule,
      `import { css } from '../styled-system/css'\n` +
        `export const cached = css({ width: '[${widths.cached}]' })\n` +
        `export const fresh = css({ width: '[${widths.fresh}]' })\n`,
    )
    writeFileSync(trigger, `export const version = 'first'\n`)
    writeFileSync(clientTrigger, `export const clientVersion = 'first'\n`)
    writeFileSync(
      clientEntry,
      `import 'virtual:bamboo.css'\n` +
        `export { className } from './__env-cache-shared'\n` +
        `export { clientVersion } from './__env-cache-client-trigger'\n`,
    )
    writeFileSync(ssrEntry, `export { className } from './__env-cache-shared'\n`)
    writeIsolatedBambooConfig(configPath, [
      './src/__env-cache-shared.tsx',
      './src/__env-cache-client-entry.tsx',
      './src/__env-cache-ssr-entry.tsx',
    ])

    const calls: EnvironmentCalls = { client: 0, ssr: 0 }
    const bambooPlugins = bamboocss({ cwd, configPath, reportSummary: false })
    const builder = await createVite7Builder({
      root: cwd,
      logLevel: 'silent',
      css: { postcss: { plugins: [] } },
      plugins: [environmentSource(calls), ...bambooPlugins, clientBeforeSsr],
      build: {
        watch: {},
        minify: false,
        emptyOutDir: false,
        rollupOptions: { external: [/^react/] },
      },
      builder: {},
      environments: {
        client: {
          build: {
            outDir: clientOutDir,
            lib: {
              entry: { app: clientEntry, trigger },
              formats: ['es'],
              fileName: (_format, entryName) => `env-cache-client-${entryName}`,
            },
          },
        },
        ssr: {
          build: {
            ssr: true,
            outDir: ssrOutDir,
            lib: {
              entry: { app: ssrEntry, trigger },
              formats: ['es'],
              fileName: (_format, entryName) => `env-cache-ssr-${entryName}`,
            },
          },
        },
      },
    })

    let clientWatcher: Rollup.RollupWatcher | undefined
    let ssrWatcher: Rollup.RollupWatcher | undefined
    let watchedCss = ''
    try {
      clientWatcher = (await builder.build(builder.environments.client!)) as Rollup.RollupWatcher
      const firstClient = nextBuild(clientWatcher)
      ssrWatcher = (await builder.build(builder.environments.ssr!)) as Rollup.RollupWatcher
      const firstSsr = nextBuild(ssrWatcher)

      expect(await Promise.all([firstClient, firstSsr])).toEqual([undefined, undefined])
      expect(calls).toEqual({ client: 1, ssr: 1 })
      expect(writtenCss()).toContain(widths.cached)
      expect(writtenCss()).not.toContain(widths.fresh)

      rmSync(clientOutDir, { force: true, recursive: true })
      const rebuiltClient = nextBuild(clientWatcher)
      const rebuiltSsr = nextBuild(ssrWatcher)
      await new Promise((settle) => setTimeout(settle, 800))
      writeFileSync(trigger, `export const version = 'second'\n`)
      const [clientError, ssrError] = await Promise.all([rebuiltClient, rebuiltSsr])

      expect(calls, 'client retransforms while SSR reuses its environment-local cache').toEqual({ client: 2, ssr: 1 })
      expect(clientError).toBeUndefined()
      expect(writtenCss()).toContain(widths.fresh)
      expect(writtenCss()).toContain(widths.cached)
      expect(ssrError).toBeUndefined()

      // Rebuild only the client once SSR has published its cached generation. If replay were
      // suppressed by the fresh client transform above, this projection would now drop the SSR
      // class even though its cached JavaScript still names it.
      rmSync(clientOutDir, { force: true, recursive: true })
      const clientOnlyBuild = nextBuild(clientWatcher)
      await new Promise((settle) => setTimeout(settle, 800))
      writeFileSync(clientTrigger, `export const clientVersion = 'second'\n`)
      expect(await clientOnlyBuild).toBeUndefined()
      expect(calls).toEqual({ client: 2, ssr: 1 })
      watchedCss = writtenCss()
      expect(watchedCss).toContain(widths.fresh)
      expect(watchedCss).toContain(widths.cached)
    } finally {
      // Unblock a waiting SSR hook before closing if an earlier assertion or build failed.
      for (const pending of waiters.values()) for (const resolve of pending) resolve()
      waiters.clear()
      await Promise.all([clientWatcher?.close(), ssrWatcher?.close()])
      rmSync(trigger, { force: true })
      rmSync(clientTrigger, { force: true })
      rmSync(sharedModule, { force: true })
      rmSync(clientEntry, { force: true })
      rmSync(ssrEntry, { force: true })
      rmSync(configPath, { force: true })
      rmSync(clientOutDir, { force: true, recursive: true })
      rmSync(ssrOutDir, { force: true, recursive: true })
    }

    // A cold build with the SSR graph established first has the same complete reachability
    // answer. Compare against it so the extra retained rule is proven necessary rather than an
    // accidental failure to prune.
    writeFileSync(
      sharedModule,
      `import { css } from '../styled-system/css'\n` +
        `export const cached = css({ width: '[${widths.cached}]' })\n` +
        `export const fresh = css({ width: '[${widths.fresh}]' })\n`,
    )
    writeFileSync(trigger, `export const version = 'second'\n`)
    writeFileSync(clientTrigger, `export const clientVersion = 'second'\n`)
    writeFileSync(
      clientEntry,
      `import 'virtual:bamboo.css'\n` +
        `export { className } from './__env-cache-shared'\n` +
        `export { clientVersion } from './__env-cache-client-trigger'\n`,
    )
    writeFileSync(ssrEntry, `export { className } from './__env-cache-shared'\n`)
    writeIsolatedBambooConfig(configPath, [
      './src/__env-cache-shared.tsx',
      './src/__env-cache-client-entry.tsx',
      './src/__env-cache-ssr-entry.tsx',
    ])
    const cleanCalls: EnvironmentCalls = { client: 0, ssr: 0 }
    try {
      const cleanBuilder = await createVite7Builder({
        root: cwd,
        logLevel: 'silent',
        css: { postcss: { plugins: [] } },
        plugins: [environmentSource(cleanCalls), bamboocss({ cwd, configPath, reportSummary: false })],
        build: { write: false, minify: false, rollupOptions: { external: [/^react/] } },
        builder: {},
        environments: {
          client: {
            build: {
              lib: {
                entry: { app: clientEntry, trigger },
                formats: ['es'],
                fileName: (_format, entryName) => `env-cache-client-clean-${entryName}`,
              },
            },
          },
          ssr: {
            build: {
              ssr: true,
              lib: {
                entry: { app: ssrEntry, trigger },
                formats: ['es'],
                fileName: (_format, entryName) => `env-cache-ssr-clean-${entryName}`,
              },
            },
          },
        },
      })
      await cleanBuilder.build(cleanBuilder.environments.ssr!)
      const cleanBuilt = await cleanBuilder.build(cleanBuilder.environments.client!)
      const cleanCss = (Array.isArray(cleanBuilt) ? cleanBuilt : [cleanBuilt])
        .flatMap((bundle) => (bundle as Rollup.RollupOutput).output)
        .map((output) => (output.type === 'asset' ? String(output.source) : ''))
        .join('\n')
      expect(cleanCss).toContain(widths.fresh)
      expect(cleanCss).toContain(widths.cached)
      expect(watchedCss.trim()).toBe(cleanCss.trim())
      expect(cleanCalls).toEqual({ client: 1, ssr: 1 })
    } finally {
      rmSync(trigger, { force: true })
      rmSync(clientTrigger, { force: true })
      rmSync(sharedModule, { force: true })
      rmSync(clientEntry, { force: true })
      rmSync(ssrEntry, { force: true })
      rmSync(configPath, { force: true })
    }
  }, 180_000)

  test('Vite 7 preserves an untouched SSR contribution across a client-only rebuild', async () => {
    await runPartialEnvironmentWatchRebuild(
      (config) => createVite7Builder(config as Parameters<typeof createVite7Builder>[0]),
      'vite7',
      { cachedSsr: '47.711px', freshClient: '47.722px', freshSsr: '47.733px' },
    )
  }, 180_000)

  test('Vite 8 preserves an untouched SSR contribution across a client-only rebuild', async () => {
    await runPartialEnvironmentWatchRebuild(
      (config) => createBuilder(config as Parameters<typeof createBuilder>[0]),
      'vite8',
      { cachedSsr: '48.811px', freshClient: '48.822px', freshSsr: '48.833px' },
    )
  }, 180_000)

  test('Vite 7 does not publish a generation rejected during output', async () => {
    await runRejectedOutputWatchRebuild(
      (config) => createVite7Builder(config as Parameters<typeof createVite7Builder>[0]),
      'vite7',
      { old: '50.711px', rejected: '50.722px', written: '50.744px', sibling: '50.733px' },
    )
  }, 180_000)

  test('Vite 8 does not publish a generation rejected during output', async () => {
    await runRejectedOutputWatchRebuild(
      (config) => createBuilder(config as Parameters<typeof createBuilder>[0]),
      'vite8',
      { old: '50.811px', rejected: '50.822px', written: '50.844px', sibling: '50.833px' },
    )
  }, 180_000)

  test('Vite 7 retains every live epoch across a partially written multi-output generation', async () => {
    await runMixedOutputEpochWatchRebuild(
      (config) => createVite7Builder(config as Parameters<typeof createVite7Builder>[0]),
      'vite7',
      { old: '61.101px', candidate: '61.202px', replacement: '61.303px', sibling: '61.404px' },
    )
  }, 180_000)

  test('Vite 8 retains every live epoch across a partially written multi-output generation', async () => {
    await runMixedOutputEpochWatchRebuild(
      (config) => createBuilder(config as Parameters<typeof createBuilder>[0]),
      'vite8',
      { old: '62.101px', candidate: '62.202px', replacement: '62.303px', sibling: '62.404px' },
    )
  }, 180_000)

  test('Vite 7 refuses to replace CSS while a live output names a physically removed rule', async () => {
    await runRemovedLiveRuleWatchRebuild(
      (config) => createVite7Builder(config as Parameters<typeof createVite7Builder>[0]),
      'vite7',
      { old: '71.101px', replacement: '71.202px', sibling: '71.303px' },
    )
  }, 180_000)

  test('Vite 8 refuses to replace CSS while a live output names a physically removed rule', async () => {
    await runRemovedLiveRuleWatchRebuild(
      (config) => createBuilder(config as Parameters<typeof createBuilder>[0]),
      'vite8',
      { old: '81.101px', replacement: '81.202px', sibling: '81.303px' },
      false,
    )
  }, 180_000)

  test('Vite 7 defers whole-run guards during concurrent replacement generations', async () => {
    await runConcurrentEnvironmentWatchRebuild(
      (config) => createVite7Builder(config as Parameters<typeof createVite7Builder>[0]),
      'vite7',
      { client: '49.911px', ssr: '49.912px' },
    )
  }, 180_000)

  test('Vite 8 defers whole-run guards during concurrent replacement generations', async () => {
    await runConcurrentEnvironmentWatchRebuild(
      (config) => createBuilder(config as Parameters<typeof createBuilder>[0]),
      'vite8',
      { client: '49.921px', ssr: '49.922px' },
    )
  }, 180_000)

  /**
   * The stylesheet is emitted and pruned by the environment that imports it, and in an SSR app
   * that is the client — which builds *first*, before the server environment has transformed a
   * single module. A class only the server graph reaches is therefore not in the reachability
   * set the prune consults, and its rule goes.
   *
   * Holding pruning back until the whole run had contributed was the old answer, and it meant
   * never pruning at all under react-router, Remix, Nuxt, SvelteKit or Qwik — every one builds
   * the client first. The feature was inert in most production apps, silently, because a build
   * with nothing to prune looks exactly the same.
   *
   * So it prunes, and this is the case where that is wrong. It has to fail: one project lost
   * 39% of its atoms to a silent version of this, presenting as rarely-used classes not
   * applying, `md:{display:inline-block}` among them — a conditional atom is exactly the kind
   * only one of the two graphs tends to reach.
   */
  test('a class only the later environment reaches fails the build', async () => {
    const builder = await twoEnvironmentBuilder(true)

    await expect(buildBothEnvironments(builder)).rejects.toThrow(/already pruned out of a stylesheet/)
  }, 180_000)

  /**
   * `pruneCss: false` is the way out, and it has to actually be one — the escape hatch for
   * this is worthless if the build fails before the user can take it.
   */
  test('pruneCss: false keeps a class only the later environment reaches', async () => {
    const css = await buildBothEnvironments(
      await createBuilder({
        root: cwd,
        logLevel: 'silent',
        css: { postcss: { plugins: [] } },
        plugins: [bamboocss({ cwd, reportSummary: false, pruneCss: false })],
        build: { write: false, minify: false, rollupOptions: { external: [/^react/] } },
        builder: {},
        environments: {
          client: { build: { lib: { entry: envClientEntry, formats: ['es'], fileName: 'env-client' } } },
          ssr: { build: { ssr: true, lib: { entry: envSsrEntry, formats: ['es'], fileName: 'env-ssr' } } },
        },
      }),
    )

    expect(css, 'the client class').toContain('31.1px')
    expect(css, 'the class only the ssr environment reaches').toContain('31.3px')
    expect(css, 'the condition only the ssr environment reaches').toContain('inline-block')
    expect(css, 'nothing is pruned at all').toContain('31.7px')
  }, 180_000)

  /**
   * The same two environments with the server bundle built first.
   *
   * Reachability is complete by the time the client — which is what imports and finalizes the
   * stylesheet — reaches `generateBundle`, so pruning goes ahead and is right. This is the
   * order that keeps both properties at once, and the reason the gate asks "is this the last
   * environment" rather than "is this a multi-environment build".
   */
  test('prunes normally when the environment holding the stylesheet builds last', async () => {
    const css = await buildBothEnvironments(await twoEnvironmentBuilder(true), ['ssr', 'client'])

    expect(css, 'the client class').toContain('31.1px')
    expect(css, 'the class only the ssr environment reaches').toContain('31.3px')
    expect(css, 'the condition only the ssr environment reaches').toContain('inline-block')
    expect(css, 'the variant nothing selects').not.toContain('31.7px')
  }, 180_000)

  /**
   * A run that builds environments itself, without saying how many there are.
   *
   * Same outcome as the announced case above, and deliberately so: pruning no longer waits on
   * the environment count, so announcing it cannot change what ships. This stays a test of its
   * own because the two setups reach the guard by different routes.
   */
  test('fails loudly when the run never announced its environments', async () => {
    const builder = await twoEnvironmentBuilder(false)

    await expect(buildBothEnvironments(builder)).rejects.toThrow(/already pruned out of a stylesheet/)
  }, 180_000)

  /**
   * The coverage summary counts a shared module once, and prints once.
   *
   * Both environments transform the modules they have in common, which in a real app is most of
   * them. Summing as the transforms arrive therefore counted each of those once per
   * environment: this fixture — one shared module and one entry each, three files, one `css()`
   * call — reported "Compiled 2/2 across 2/4 files", and printed a partial line for the client
   * before a second line quietly superseded it. Coverage describes the source, not how many
   * times a bundler handed the same file over.
   */
  test('reports coverage once per run, counting shared modules once', async () => {
    writeFileSync(
      envSharedModule,
      `import { css } from '../styled-system/css'\nexport const s = css({ width: '[41.1px]' })\n`,
    )
    writeFileSync(
      envClientEntry,
      `import 'virtual:bamboo.css'\nimport { s } from './__env-shared'\nexport const a = s\n`,
    )
    writeFileSync(envSsrEntry, `import { s } from './__env-shared'\nexport const b = s\n`)

    const lines: string[] = []
    // Restored by `afterEach`, which runs even if this times out — a `finally` here does not,
    // because the body keeps going past the deadline and would leave `console.log` patched
    // over whatever runs next.
    vi.spyOn(console, 'log').mockImplementation((...args) => void lines.push(args.join(' ')))

    const builder = await createBuilder({
      root: cwd,
      logLevel: 'silent',
      css: { postcss: { plugins: [] } },
      plugins: [bamboocss({ cwd, reportSummary: true })],
      build: { write: false, minify: false, rollupOptions: { external: [/^react/] } },
      builder: {},
      environments: {
        client: { build: { lib: { entry: envClientEntry, formats: ['es'], fileName: 'env-client' } } },
        ssr: { build: { ssr: true, lib: { entry: envSsrEntry, formats: ['es'], fileName: 'env-ssr' } } },
      },
    })
    await buildBothEnvironments(builder)

    // Matched on the summary's shape rather than on the word, which the per-file debug line
    // `Compiled N call(s) in <file>` also carries whenever `BAMBOO_DEBUG` is set.
    const summaries = lines.filter((line) => /Compiled \d+\/\d+/.test(line))
    expect(summaries, 'one summary for the run, not one per environment').toHaveLength(1)
    // Three source modules, one of which folds its single `css()` call. The shared module is
    // transformed by both environments and must still count as one file and one call.
    expect(summaries[0]).toContain('Compiled 1/1 (100%) across 1/3 files')
  }, 180_000)
})

/**
 * `virtual:bamboo.css?url` through a real build.
 *
 * Vite's convention for asking any CSS module for its URL rather than its contents. It did not
 * resolve here at all, so requesting it failed as an unresolvable path.
 *
 * The sheet becomes an asset of its own, which is what `?url` means rather than a shortcoming:
 * a project concatenating Bamboo's CSS into one global stylesheet does not want it. It is for
 * a `<link>` written by hand, a preload hint, or an href handed outside the bundler.
 */
const urlEntry = join(cwd, 'src/__url-entry.tsx')

describe('the stylesheet URL', () => {
  afterEach(() => {
    rmSync(urlEntry, { force: true })
  })

  test('resolves, and points at an asset carrying the stylesheet', async () => {
    writeFileSync(
      urlEntry,
      `import href from 'virtual:bamboo.css?url'\nimport { css } from '../styled-system/css'\nexport const a = css({ width: '[51.1px]' })\nexport const url = href\n`,
    )

    const result = (await build({
      root: cwd,
      logLevel: 'silent',
      css: { postcss: { plugins: [] } },
      plugins: [bamboocss({ cwd, reportSummary: false })],
      build: {
        write: false,
        minify: false,
        lib: { entry: urlEntry, formats: ['es'], fileName: 'url' },
        rollupOptions: { external: [/^react/] },
      },
    })) as Rollup.RollupOutput[]

    const outputs = result[0]!.output
    const js = outputs.map((output) => ('code' in output ? output.code : '')).join('\n')
    const assets = outputs.filter((output) => 'source' in output && typeof output.source === 'string') as unknown as {
      fileName: string
      source: string
    }[]

    const sheet = assets.find((asset) => asset.source.includes('--made-with-bamboo'))
    expect(sheet, 'no emitted asset carries the stylesheet').toBeDefined()
    expect(sheet!.source).toContain('51.1px')

    // The module exports the emitted asset's name, not the virtual id.
    expect(js).not.toContain('virtual:bamboo.css')
    expect(js).toContain(sheet!.fileName.split('/').pop()!)
  }, 120_000)
})

/**
 * An edit reaching a module that compiled somebody else's call.
 *
 * This is the one failure with no build-time equivalent, so it needs a running server. In a
 * build, Rollup discards a module whose `addWatchFile` dependency changed. Vite's dev server
 * *soft*-invalidates a module that statically imports the changed one: it keeps that module's
 * cached transform result and rewrites nothing but the timestamps on its import specifiers.
 * The compiled class string lives in exactly that cached result.
 *
 * Recipes are where users meet it, because a recipe is the case where the class is compiled
 * into somebody else's module — an inline `cva` declaration is erased and each *call site*
 * becomes a literal where it is called. Editing the recipe therefore has to update a module
 * Vite decided not to re-transform, and the browser and the SSR render keep the old class
 * with nothing logged: Vite reports its update, Bamboo reports a fresh extraction, and the
 * stylesheet does gain the new rule. Only a restart applied the edit.
 *
 * The consumer imports a second value from the same module on purpose. A consumer that folds
 * *nothing but* recipe calls has its import erased, and an erased import is not a static one,
 * so Vite hard-invalidates it and the bug hides — which is why a minimal reproduction of it
 * does not reproduce it.
 */
describe('vite plugin, real dev server', () => {
  const recipe = join(cwd, 'src/__hmr-recipe.tsx')
  const consumer = join(cwd, 'src/__hmr-consumer.tsx')

  const writeRecipe = (color: 'red600' | 'blue600') =>
    writeFileSync(
      recipe,
      `import { css, cva } from '../styled-system/css'
       export const navLink = cva({
         base: { display: 'flex' },
         variants: { active: { true: { color: '${color}' }, false: { color: 'gray500' } } },
       })
       export const heading = css({ fontWeight: 'bold' })
      `,
    )

  afterEach(() => {
    rmSync(recipe, { force: true })
    rmSync(consumer, { force: true })
  })

  test('a recipe edit reaches the module that compiled a call to it', async () => {
    writeRecipe('red600')
    writeFileSync(
      consumer,
      `import { heading, navLink } from './__hmr-recipe'
       export const title = heading
       export const link = (active: boolean) => navLink({ active })
      `,
    )

    const server = await createServer({
      root: cwd,
      configFile: false,
      logLevel: 'silent',
      css: { postcss: { plugins: [] } },
      plugins: [bamboocss({ cwd, reportSummary: false })],
      // A port of its own, so a stray dev server on Vite's default cannot make this hang. A
      // conflict here is logged and otherwise harmless: nothing below needs the socket.
      server: { middlewareMode: true, hmr: { port: 24788 } },
    })

    /**
     * Both environments, because the report was against server-rendered markup and the client
     * and SSR module graphs are invalidated separately.
     */
    const environments = ['client', 'ssr'] as const
    const codeOf = async (environment: (typeof environments)[number]) =>
      (await server.environments[environment].transformRequest('/src/__hmr-consumer.tsx'))?.code ?? ''

    try {
      for (const environment of environments) {
        expect(await codeOf(environment), environment).toContain('c_red600')
      }

      writeRecipe('blue600')
      // The watcher's own event, so the whole of Vite's update pipeline runs rather than the
      // one hook this is about. It is dispatched asynchronously and is not awaitable, hence
      // the poll — which cannot mask the defect: a stale read just polls again, and the
      // invalidation this tests is not something a read can consume.
      server.watcher.emit('change', recipe)

      for (const environment of environments) {
        const deadline = Date.now() + 10_000
        let code = ''
        do {
          code = await codeOf(environment)
        } while (!code.includes('c_blue600') && Date.now() < deadline)

        expect(code, `${environment}: the recipe edit never reached the module that calls it`).toContain('c_blue600')
        expect(code, environment).not.toContain('c_red600')
      }
    } finally {
      await server.close()
    }
  }, 120_000)
})

/**
 * A server bundle emits no CSS, and that is not a missing stylesheet.
 *
 * `build.ssrEmitAssets` is off by default, so Vite discards CSS assets from an SSR build — the
 * client build is what carries the sheet. A server bundle that imports `virtual:bamboo.css`
 * from shared code, which a root component or a layout does, therefore *serves* the stylesheet
 * and then emits nothing, and the guard against a vanished stylesheet read that as the failure
 * it exists to catch.
 *
 * It failed a build that was entirely correct. Qwik's `vite build --ssr` is the shape that
 * showed it: every call compiled, the client bundle carrying the stylesheet, and the server
 * bundle refusing to finish. React Router escapes it only because its plugin turns
 * `ssrEmitAssets` on.
 */
describe('an SSR bundle', () => {
  const entry = join(cwd, 'src/__ssr-no-assets.tsx')

  afterEach(() => {
    rmSync(entry, { force: true })
  })

  const buildSsr = (ssrEmitAssets: boolean) => {
    writeFileSync(
      entry,
      `import 'virtual:bamboo.css'\nimport { css } from '../styled-system/css'\nexport const cls = css({ width: '[912.3px]' })\n`,
    )

    return build({
      root: cwd,
      logLevel: 'silent',
      css: { postcss: { plugins: [] } },
      plugins: [bamboocss({ cwd, reportSummary: false })],
      build: {
        write: false,
        minify: false,
        ssr: entry,
        ssrEmitAssets,
        rollupOptions: { external: [/^react/] },
      },
    }) as Promise<Rollup.RollupOutput | Rollup.RollupOutput[]>
  }

  // An SSR build is not `lib` mode, so Vite hands back one result rather than one per format.
  const outputsOf = (result: Rollup.RollupOutput | Rollup.RollupOutput[]) =>
    (Array.isArray(result) ? result : [result]).flatMap((one) => one.output)

  test('compiles without being asked to carry the stylesheet', async () => {
    const outputs = outputsOf(await buildSsr(false))
    const js = outputs.map((output) => ('code' in output ? output.code : '')).join('\n')

    // The classes are real; it is the *asset* that an SSR build does not emit.
    expect(js).toContain('w_[912.3px]')
    expect(
      outputs.filter((output) => output.type === 'asset' && output.fileName.endsWith('.css')),
      'Vite drops CSS assets from an SSR build unless asked',
    ).toHaveLength(0)
  }, 120_000)

  test('still answers for the stylesheet when it does emit assets', async () => {
    const css = outputsOf(await buildSsr(true))
      .map((output) => ('source' in output && typeof output.source === 'string' ? output.source : ''))
      .join('\n')

    expect(css).toContain('--made-with-bamboo')
    expect(css).toContain('912.3px')
  }, 120_000)
})

/**
 * A project with no `styled-system/` on disk, built by the plugin alone.
 *
 * This is what the plugin's `emit` call has always claimed to cover, and it did not: `Builder`
 * read its own "have I emitted" flag before ever setting it, so the first call wrote nothing and
 * the artifacts appeared only after a *later* config change. Nothing noticed, because every real
 * project runs `bamboo codegen` from a `prepare` script or a build step, so the directory was
 * already there — and the cost of that is a whole extra process, ~600 ms of which is module
 * loading to do ~20 ms of work.
 *
 * Reaching `emit` through `load` would not have been enough either. A module's imports are all
 * resolved before any of them is loaded, so `app.tsx` importing both `styled-system/css` and the
 * virtual stylesheet has the first resolved while the directory is still absent — a react-router
 * build failed with "Rolldown failed to resolve import", and `vite dev` served an error overlay.
 * `buildStart` is the first hook Rollup calls, which is why the emit is anchored there.
 *
 * Its own project rather than this sandbox's, because the assertion is about an outdir that does
 * not exist yet and every other suite here reads the one that does.
 */
describe('a project with no generated output yet', () => {
  const projectDir = join(cwd, '__clean-tree-tmp')
  const outdir = join(projectDir, 'styled-system')
  const entry = join(projectDir, 'src/app.tsx')

  beforeEach(() => {
    mkdirSync(join(projectDir, 'src'), { recursive: true })
    writeFileSync(
      join(projectDir, 'bamboo.config.ts'),
      `export default { preflight: false, include: ['./src/**/*.tsx'], outdir: 'styled-system' }\n`,
    )
    writeFileSync(
      entry,
      `import 'virtual:bamboo.css'\n` +
        `import { css } from '../styled-system/css'\n` +
        `export const cls = css({ display: 'flex' })\n`,
    )
  })

  afterEach(() => rmSync(projectDir, { force: true, recursive: true }))

  test('generates it during the build, early enough to import from', async () => {
    expect(readdirSync(projectDir)).not.toContain('styled-system')

    const result = (await build({
      root: projectDir,
      logLevel: 'silent',
      css: { postcss: { plugins: [] } },
      plugins: [bamboocss({ cwd: projectDir, reportSummary: false })],
      build: {
        write: false,
        minify: false,
        lib: { entry, formats: ['es'], fileName: 'clean-tree' },
      },
    })) as Rollup.RollupOutput[]

    // Written by the build itself, from nothing.
    expect(readdirSync(outdir)).toContain('css')

    // And reached: the import resolved, the call folded, and the sheet carries its rule. A
    // build that merely wrote the files late would still fail one of these.
    const outputs = [result].flat().flatMap((bundle) => bundle.output)
    const js = outputs.map((output) => ('code' in output ? output.code : '')).join('\n')
    const css = outputs.map((output) => ('source' in output ? String(output.source) : '')).join('\n')

    expect(js).toContain('d_flex')
    expect(css).toContain('display: flex')
  }, 120_000)
})
