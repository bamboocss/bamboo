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
    expect(compiled.code).not.toContain('red600')
    expect(compiled.raw).toBeLessThan(runtime.raw)
    expect(compiled.gzip).toBeLessThan(runtime.gzip)
  }, 120_000)
})
