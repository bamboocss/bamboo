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

  test('static composition shares recipe and utility atoms through a real build', async () => {
    const entry = join(cwd, 'src/__static-composition-test.tsx')
    writeFileSync(
      entry,
      `
        import 'virtual:bamboo.css'
        import { css, cva, cx } from '../styled-system/css'
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
      `,
    )

    try {
      const result = (await build({
        root: cwd,
        logLevel: 'silent',
        // The sandbox's PostCSS config targets its browser entry URL; this library-mode
        // fixture exercises Vite's CSS asset graph directly and needs no additional plugins.
        css: { postcss: { plugins: [] } },
        plugins: [bamboocss({ cwd, staticComposition: true, reportSummary: false })],
        build: {
          write: false,
          minify: false,
          lib: { entry, formats: ['es'], fileName: 'static-composition' },
          rollupOptions: { external: [/^react/] },
        },
      })) as Rollup.RollupOutput[]

      const js = result[0]!.output.map((output) => ('code' in output ? output.code : '')).join('\n')
      const css = result[0]!.output
        .map((output) => ('source' in output && typeof output.source === 'string' ? output.source : ''))
        .join('\n')

      expect(js).toMatch(/"_[A-Za-z]+ _[A-Za-z]+ _[A-Za-z]+"/)
      expect(js).not.toContain('w_[123.4567px]')
      expect(js).not.toContain('c_blue600')
      expect(js).not.toContain('h_[234.5678px]')
      expect(js).not.toContain('red600')
      expect(js).not.toContain('createCss')
      expect(js).toContain('cvaMap')
      expect(js).not.toContain('567.891px')
      expect(js).not.toContain('678.912px')
      expect(css).toMatch(/\._[A-Za-z]+\s*\{/)
      expect(css).not.toContain('.w_\\[123')
      expect(css.match(/width:\s*123\.4567px/g)).toHaveLength(1)
      expect(css).toMatch(/height:\s*234\.5678px/)
      expect(css).not.toContain('345.6789px')
      expect(css).toMatch(/min-width:\s*456\.789px/)
      expect(css).toMatch(/max-width:\s*567\.891px/)
      expect(css).toMatch(/max-width:\s*678\.912px/)
      expect(css).toMatch(/opacity:\s*0\.75/)
      expect(css).not.toMatch(/@layer recipes\{/)

      // Execute the emitted decision table, then verify every runtime class has a retained
      // selector. This catches drift between the generated helper, the fold's table format,
      // reachability pruning, and final compact-name rewriting in one assertion chain.
      const built = (await import(`data:text/javascript;base64,${Buffer.from(js).toString('base64')}`)) as {
        dynamicClassName: (tone: unknown) => string
      }
      const defaultClass = built.dynamicClassName(undefined)
      const compactClass = built.dynamicClassName('compact')
      const expandedClass = built.dynamicClassName('expanded')
      const missingClass = built.dynamicClassName('unknown')
      expect(defaultClass).toBe(compactClass)
      expect(expandedClass).not.toBe(compactClass)
      expect(built.dynamicClassName(null)).toBe(missingClass)
      for (const className of [defaultClass, expandedClass, missingClass]) {
        for (const token of className.split(' ')) expect(css).toContain(`.${token} {`)
      }
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
          plugins: [bamboocss({ cwd, staticComposition: true, reportSummary: false })],
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
          plugins: [bamboocss({ cwd, staticComposition: true, reportSummary: false })],
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
        plugins: [bamboocss({ cwd, staticComposition: true, reportSummary: false })],
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
        plugins: [bamboocss({ cwd, staticComposition: true, reportSummary: false })],
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
        plugins: [bamboocss({ cwd, staticComposition: true, reportSummary: false })],
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
