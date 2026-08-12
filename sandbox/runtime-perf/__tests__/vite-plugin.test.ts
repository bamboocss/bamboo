import { mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { esc } from '@bamboocss/shared'
import bamboocss from '@bamboocss/vite'
import { build, type Rollup } from 'vite'
import { build as buildVite8 } from 'vite8'
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
