import { dirname, join } from 'node:path'
import { gzipSync } from 'node:zlib'
import { fileURLToPath } from 'node:url'
import bamboocss from '@bamboocss/vite'
import { build, type Rollup } from 'vite'
import { describe, expect, test } from 'vitest'

/**
 * What the transform is worth in bytes, which is the axis nothing else here measures.
 *
 * Every other number in this repo is CPU — render speed, per-call cost, per-module
 * transform cost. Bundle size is what a styling library is usually compared on, and it
 * was invisible: the two parity builds differ by 613 bytes of 427KB, which is React
 * dominating a measurement nobody was reading.
 *
 * So React is external here and the generated runtime is not, which makes the number
 * sensitive to the ~96KB the fold could in principle remove rather than burying it under
 * a dependency the fold cannot touch.
 *
 * ## What this found, and why it is not asserted as a saving
 *
 * Folding makes the bundle smaller raw and *larger* gzipped. It replaces repeated
 * `css({ … })` calls — near-identical structure that gzip collapses to almost nothing —
 * with class literals that are all distinct and compress badly. On this fixture that is
 * about -0.8% raw and +1.0% gzipped.
 *
 * That is a real trade rather than a defect: the same change buys 3.1x on render. But it
 * means "the fold makes your bundle smaller" is not a claim this repo can make today, and
 * a test asserting a saving would have encoded an assumption nobody had measured.
 * Reported, with a loose bound to catch an actual blowup.
 */
const here = dirname(fileURLToPath(import.meta.url))
const cwd = join(here, '..')

const bundle = async (transform: boolean) => {
  const result = (await build({
    root: cwd,
    logLevel: 'silent',
    plugins: [bamboocss({ cwd, transform })],
    build: {
      write: false,
      minify: true,
      lib: { entry: join(here, '../src/parity/tree.tsx'), formats: ['es'], fileName: 'tree' },
      // React only. `styled-system` stays in, since it is what the fold could remove.
      rollupOptions: { external: [/^react/, /^react-dom/] },
    },
  })) as Rollup.RollupOutput[]

  const code = result[0]!.output.map((chunk) => ('code' in chunk ? chunk.code : '')).join('\n')
  return { code, raw: Buffer.byteLength(code), gzip: gzipSync(code).length }
}

describe('bundle size', () => {
  test('the fold moves bytes only marginally, in either direction', async () => {
    const [source, folded] = await Promise.all([bundle(false), bundle(true)])

    const pct = (before: number, after: number) => (((after - before) / before) * 100).toFixed(1)
    console.log(
      `\n  source ${source.raw}B raw / ${source.gzip}B gzip` +
        `\n  folded ${folded.raw}B raw / ${folded.gzip}B gzip` +
        `\n  delta  ${pct(source.raw, folded.raw)}% raw / ${pct(source.gzip, folded.gzip)}% gzip\n`,
    )

    // Deliberately loose. The point is to make the number visible and to catch a real
    // blowup — an accidentally duplicated runtime, a fold emitting a literal per render —
    // not to pin a figure that moves with every dependency bump.
    expect(Math.abs(folded.gzip - source.gzip) / source.gzip).toBeLessThan(0.05)
    expect(Math.abs(folded.raw - source.raw) / source.raw).toBeLessThan(0.05)
  }, 120_000)

  test('the runtime is still pinned by what does not fold', async () => {
    const folded = await bundle(true)

    // The ceiling on the test above, and the reason the delta is marginal either way.
    // This fixture keeps deliberately unfoldable elements, and one is enough to pin the
    // utility table, `createCss` and the tokens. Lowering a dynamic value to `cssLeaf`
    // does not change that: it lives in the css module and falls back to `css()`, so it
    // holds the same graph the call it replaced did.
    //
    // Flip this when a fully-folded module can drop the import — that is the point at
    // which the fold starts moving bytes rather than only CPU.
    expect(folded.code).toContain('aspectRatio:asp')
  }, 120_000)
})
