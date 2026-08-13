import { mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { esc } from '@bamboocss/shared'
import bamboocss from '@bamboocss/vite'
import { build, createServer, type Rollup } from 'vite'
import { build as buildVite8, createBuilder } from 'vite8'
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
describe('vite plugin, real rebuild', () => {
  const fixtureDir = join(cwd, 'src/__watch-tmp')
  const dependency = join(fixtureDir, 'dep.ts')
  const entry = join(fixtureDir, 'entry.tsx')
  const outDir = join(fixtureDir, 'out')

  const writeDependency = (color: string) => writeFileSync(dependency, `export const shared = { color: '${color}' }\n`)

  afterEach(() => rmSync(fixtureDir, { force: true, recursive: true }))

  test('an edited module is re-read before the rebuild folds against it', async () => {
    mkdirSync(fixtureDir, { recursive: true })
    writeDependency('blue600')
    writeFileSync(
      entry,
      `import 'virtual:bamboo.css'\nimport { css } from '../../styled-system/css'\nimport { shared } from './dep'\nexport const cls = css(shared)\n`,
    )

    const watcher = (await build({
      root: cwd,
      logLevel: 'silent',
      css: { postcss: { plugins: [] } },
      plugins: [bamboocss({ cwd, reportSummary: false })],
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

afterEach(() => {
  rmSync(rolldownEntry, { force: true })
})

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

describe('two build environments, one plugin instance', () => {
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

  test('an ssr environment does not have to import the stylesheet', async () => {
    const css = await buildBothEnvironments(await twoEnvironmentBuilder(true))

    expect(css).toContain('--made-with-bamboo')
    expect(css).toContain('31.1px')
  }, 180_000)

  /**
   * The stylesheet is emitted and pruned by the environment that imports it, and in an SSR app
   * that is the client — which builds *first*, before the server environment has transformed a
   * single module. Reachability was therefore incomplete when pruning ran, and every rule for a
   * class only the server graph reaches was deleted from the one copy the pages link.
   *
   * One project lost 39% of its atoms to this. It presented as rarely-used classes silently not
   * applying, `md:{display:inline-block}` among them — a conditional atom is exactly the kind
   * only one of the two graphs tends to reach.
   */
  test('a class only the later environment reaches keeps its rule', async () => {
    const css = await buildBothEnvironments(await twoEnvironmentBuilder(true))

    expect(css, 'the client class').toContain('31.1px')
    expect(css, 'the class only the ssr environment reaches').toContain('31.3px')
    expect(css, 'the condition only the ssr environment reaches').toContain('inline-block')
    // The cost of being correct here, asserted rather than implied: nothing is pruned when
    // the sheet is finalized before the run is, so the unselected variant ships too.
    expect(css, 'pruning is held back entirely, not selectively').toContain('31.7px')
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
   * Nothing can tell that first environment it is not the last, so pruning goes ahead and the
   * class the second one compiles is already gone. Green build, real class names in the markup,
   * unstyled elements — so the second environment fails the build instead of shipping it.
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
