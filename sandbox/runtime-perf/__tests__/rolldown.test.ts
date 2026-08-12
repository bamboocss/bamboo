import { rmSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import bamboocss from '@bamboocss/vite'
import { build, type Rollup } from 'vite8'
import { afterEach, describe, expect, test } from 'vitest'

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
const cwd = join(dirname(fileURLToPath(import.meta.url)), '..')
const entry = join(cwd, 'src/__rolldown-test.tsx')

afterEach(() => {
  rmSync(entry, { force: true })
})

/** Each declaration is unique, so an absence names the shape that lost its rule. */
const PROBES: Array<[string, string]> = [
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
      entry,
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

    const result = (await build({
      root: cwd,
      logLevel: 'silent',
      css: { postcss: { plugins: [] } },
      plugins: [bamboocss({ cwd, reportSummary: false })],
      build: {
        write: false,
        minify: false,
        lib: { entry, formats: ['es'], fileName: 'rolldown' },
        rollupOptions: { external: [/^react/] },
      },
    })) as Rollup.RollupOutput[]

    const js = result[0]!.output.map((output) => ('code' in output ? output.code : '')).join('\n')
    const css = result[0]!.output
      .map((output) => ('source' in output && typeof output.source === 'string' ? output.source : ''))
      .join('\n')

    // The failure that motivated this: a green build carrying no stylesheet at all.
    expect(css, 'no emitted asset carries the generated stylesheet').toContain('--made-with-bamboo')

    const missing = PROBES.filter(([, width]) => !css.includes(width)).map(([label, width]) => `${label} (${width})`)
    expect(missing, 'shapes with no rule in the emitted sheet').toEqual([])

    // And nothing compiled into the JS may lack a selector. `.token` rather than `.token {`,
    // so a conditional or nested rule counts.
    const emitted = new Set<string>()
    for (const match of js.matchAll(/"([^"\n]*)"/g)) {
      for (const token of (match[1] ?? '').split(' ')) {
        if (/^_[A-Za-z]+$/.test(token)) emitted.add(token)
      }
    }

    expect(emitted.size).toBeGreaterThan(0)
    expect(
      [...emitted].filter((token) => !css.includes(`.${token}`)),
      'classes emitted into JS with no rule in the sheet',
    ).toEqual([])
  }, 120_000)
})
