import { rmSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { gzipSync } from 'node:zlib'
import { fileURLToPath } from 'node:url'
import bamboocss from '@bamboocss/vite'
import { build, type Rollup } from 'vite'
import { afterAll, beforeAll, describe, expect, test } from 'vitest'

/**
 * Counterfactual byte comparison for the mandatory compiler.
 *
 * The runtime build is not a supported Bamboo mode; it deliberately bundles the generated
 * authoring runtime without the Vite plugin so this test can quantify what compilation
 * removes. Both entries otherwise contain the same style and recipe calls.
 */
const here = dirname(fileURLToPath(import.meta.url))
const cwd = join(here, '..')
const runtimeEntry = join(cwd, 'src/__bundle-runtime.tsx')
const compiledEntry = join(cwd, 'src/__bundle-compiled.tsx')

const source = `
import { css, cva, cx } from '../styled-system/css'

const badge = cva({
  base: { display: 'inline-flex', alignItems: 'center', color: 'red600' },
  variants: {
    tone: {
      quiet: { color: 'gray700', backgroundColor: 'gray100' },
      loud: { color: 'white', backgroundColor: 'red600' },
    },
    size: {
      sm: { padding: 'xs', fontSize: 'body' },
      lg: { padding: 'md', fontSize: 'h4' },
    },
  },
  defaultVariants: { tone: 'quiet', size: 'sm' },
  compoundVariants: [{ tone: 'loud', size: 'lg', css: { fontWeight: 'bold' } }],
})

export const fixed = cx(
  badge({ tone: 'loud', size: 'lg' }),
  css({ color: 'blue600', width: '[321.987px]' }),
)
export const selected = (tone, size) => badge({ tone, size })
export const withExternal = (tone, className) => cx(badge({ tone }), className)
export const repeated = [
  css({ display: 'flex', alignItems: 'center', gap: 'xs' }),
  css({ display: 'flex', alignItems: 'center', gap: 'sm' }),
  css({ display: 'flex', alignItems: 'center', gap: 'md' }),
  css({ color: 'red600', fontWeight: 'bold' }),
  css({ color: 'red600', fontWeight: 'bold', padding: 'xs' }),
  css({ color: 'red600', fontWeight: 'bold', padding: 'md' }),
]
`

beforeAll(() => {
  writeFileSync(runtimeEntry, source)
  writeFileSync(compiledEntry, `import 'virtual:bamboo.css'\n${source}`)
})

afterAll(() => {
  rmSync(runtimeEntry, { force: true })
  rmSync(compiledEntry, { force: true })
})

const bundle = async (compiled: boolean) => {
  const result = (await build({
    root: cwd,
    logLevel: 'silent',
    css: { postcss: { plugins: [] } },
    plugins: compiled ? [bamboocss({ cwd, reportSummary: false })] : [],
    build: {
      write: false,
      minify: true,
      lib: {
        entry: compiled ? compiledEntry : runtimeEntry,
        formats: ['es'],
        fileName: compiled ? 'compiled' : 'runtime',
      },
    },
  })) as Rollup.RollupOutput[]

  const code = result[0]!.output.map((output) => ('code' in output ? output.code : '')).join('\n')
  return { code, raw: Buffer.byteLength(code), gzip: gzipSync(code).length }
}

describe('mandatory compiler bundle size', () => {
  test('drops the generated style and recipe engines', async () => {
    const [runtime, compiled] = await Promise.all([bundle(false), bundle(true)])
    const saving = (before: number, after: number) => (((before - after) / before) * 100).toFixed(1)

    console.log(
      `\n  runtime  ${runtime.raw}B raw / ${runtime.gzip}B gzip` +
        `\n  compiled ${compiled.raw}B raw / ${compiled.gzip}B gzip` +
        `\n  saving   ${saving(runtime.raw, compiled.raw)}% raw / ${saving(runtime.gzip, compiled.gzip)}% gzip\n`,
    )

    expect(runtime.code).toContain('red600')
    // The engine leaves; the atom names stay, since compaction is core `hash`'s job now.
    expect(compiled.code).not.toContain('createCss')
    expect(compiled.raw).toBeLessThan(runtime.raw)
    expect(compiled.gzip).toBeLessThan(runtime.gzip)
  }, 120_000)
})

/**
 * The size of the emitted stylesheet, and the property that keeps it small.
 *
 * Nothing measured CSS output. Every change to atomisation, pruning or naming moves it, and
 * the only way anyone noticed was by grepping a shipped bundle — which is how a bug that
 * deleted every `::before` rule reached production.
 *
 * Two assertions, doing different jobs. The duplication counts are the stable one: global atom
 * sharing means a declaration authored five ways still has exactly one rule, and that holds
 * regardless of formatting, minifier or token values. The byte ceiling is the tracked one; it
 * is deliberately loose, because its job is to catch a step change rather than to police
 * ordinary drift, and it prints the real figure so raising it is a one-line decision rather
 * than an investigation.
 *
 * Asserted rather than benchmarked on purpose: bytes are deterministic, so this belongs in CI,
 * where a wall-clock measurement would only be flaky. Same reasoning as `memo.test.ts`
 * counting serialization calls instead of timing them.
 */
const cssEntry = join(cwd, 'src/__css-size.tsx')

/**
 * Bytes the fixture's stylesheet must stay under.
 *
 * Roughly double what it currently emits (695B raw / 409B gzip). Loose on purpose: the job is
 * to catch a step change — atom sharing breaking, a layer emitted twice, pruning stopping —
 * not to police ordinary drift, and a tight bound would fail on every legitimate token edit.
 * Raise it deliberately, with the number the failure prints and a reason.
 */
const CSS_CEILING = { raw: 1_400, gzip: 800 }

describe('emitted stylesheet size', () => {
  test('shares declarations globally and stays within budget', async () => {
    // The same declarations authored five ways: a bare call, a recipe base, a recipe variant,
    // a second recipe, and a conditional. Global atom sharing means one rule each.
    writeFileSync(
      cssEntry,
      `
      import 'virtual:bamboo.css'
      import { css, cva } from '../styled-system/css'

      export const a = css({ display: 'flex', color: 'red600' })
      const row = cva({
        base: { display: 'flex', color: 'red600' },
        variants: { tone: { loud: { display: 'flex', color: 'red600' } } },
      })
      const stack = cva({ base: { display: 'flex' } })
      export const b = row({ tone: 'loud' })
      export const c = stack()
      export const d = css({ _hover: { display: 'flex' } })
      `,
    )

    try {
      const result = (await build({
        root: cwd,
        logLevel: 'silent',
        css: { postcss: { plugins: [] } },
        plugins: [bamboocss({ cwd, reportSummary: false })],
        build: {
          write: false,
          minify: true,
          lib: { entry: cssEntry, formats: ['es'], fileName: 'css-size' },
          rollupOptions: { external: [/^react/] },
        },
      })) as Rollup.RollupOutput[]

      const css = result[0]!.output
        .map((output) => ('source' in output && typeof output.source === 'string' ? output.source : ''))
        .join('\n')

      expect(css, 'no emitted asset carries the stylesheet').toContain('--made-with-bamboo')

      const occurrences = (needle: string) => css.split(needle).length - 1
      console.log(
        `\n  stylesheet ${Buffer.byteLength(css)}B raw / ${gzipSync(css).length}B gzip` +
          `\n  display:flex x${occurrences('display:flex')}` +
          ` | color declarations x${occurrences('color:var(--colors-red600)')}\n`,
      )

      // Authored five times across two recipes and a bare call; the unconditional form is one
      // rule. The conditional one is a different declaration — same property, different
      // condition — so it is legitimately its own.
      expect(occurrences('display:flex'), 'display:flex is duplicated').toBe(2)
      expect(occurrences('color:var(--colors-red600)'), 'the colour is duplicated').toBe(1)

      expect(Buffer.byteLength(css), 'stylesheet grew past its ceiling').toBeLessThan(CSS_CEILING.raw)
      expect(gzipSync(css).length, 'stylesheet grew past its gzip ceiling').toBeLessThan(CSS_CEILING.gzip)
    } finally {
      rmSync(cssEntry, { force: true })
    }
  }, 120_000)
})
