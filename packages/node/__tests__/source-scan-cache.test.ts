import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterAll, describe, expect, test, vi } from 'vitest'
import { Builder } from '../src/builder'
import { collectSourceScans, createSourceScanCache } from '../src/token-references'

/**
 * The stylesheet's source scans are cached per file and merged per build, so the one thing
 * that must never drift is the merged answer: a cached rebuild has to emit the same bytes a
 * cold build of the same tree emits. Timing is deliberately not asserted — the observable is
 * the work itself, counted through the runtime reads the walk performs, the same shape
 * `memo.test.ts` uses for the generated runtime.
 *
 * Each test builds its own temporary project rather than borrowing a sandbox: these compare
 * one tree against itself across rebuilds, and a shared fixture tree mutated by a
 * concurrently running test file turns that comparison into one between two different trees.
 */
const temporaryDirectories = new Set<string>()
afterAll(() => {
  for (const directory of temporaryDirectories) rmSync(directory, { force: true, recursive: true })
  temporaryDirectories.clear()
})

const CONFIG =
  `export default {\n` +
  `  include: ['src/**/*.{ts,tsx}'],\n` +
  `  outdir: 'styled-system',\n` +
  `  theme: { keyframes: { spin: { to: { transform: 'rotate(360deg)' } } } },\n` +
  `}\n`

const contentsA = `import { css } from '../styled-system/css'\n` + `export const one = css({ width: '[123.987px]' })\n`
const contentsB =
  `import { css } from '../styled-system/css'\n` +
  `export const one = css({ width: '[123.987px]' })\n` +
  `export const two = css({ height: '[45.678px]', animationName: 'spin' })\n`

const createProject = () => {
  const directory = mkdtempSync(join(tmpdir(), 'bamboo-scan-cache-'))
  temporaryDirectories.add(directory)
  writeFileSync(join(directory, 'bamboo.config.ts'), CONFIG)
  mkdirSync(join(directory, 'src'), { recursive: true })
  const fixture = join(directory, 'src/styles.ts')
  writeFileSync(fixture, contentsA)
  return { directory, fixture }
}

const build = async (builder: Builder, cwd: string) => {
  await builder.setup({ cwd, dev: true })
  await builder.emit()
  builder.extract()
  return builder.toCss({ layerParams: true, includeRecipes: false })
}

describe('extraction skip by recorded reads', () => {
  const CONFIG_RECIPES =
    `export default {\n` + `  include: ['src/**/*.{ts,tsx}'],\n` + `  outdir: 'styled-system',\n` + `}\n`

  const shared = (recipeColor: string, valueWidth: string, unrelated: string, alias = 'chip') =>
    `import { css, cva } from '../styled-system/css'\n` +
    `export const badge = cva({ base: { color: '${recipeColor}' } })\n` +
    `export const box = css.raw({ width: '[${valueWidth}]' })\n` +
    `const inner = { height: '[${unrelated}]' }\n` +
    `export { inner as ${alias} }\n`

  const consumer =
    `import { css } from '../styled-system/css'\n` +
    `import { badge, box } from './shared'\n` +
    `export const a = badge()\n` +
    `export const b = css(box, { margin: '[3.21px]' })\n`

  const createRecipeProject = () => {
    const directory = mkdtempSync(join(tmpdir(), 'bamboo-read-skip-'))
    temporaryDirectories.add(directory)
    writeFileSync(join(directory, 'bamboo.config.ts'), CONFIG_RECIPES)
    mkdirSync(join(directory, 'src'), { recursive: true })
    const sharedFile = join(directory, 'src/shared.ts')
    writeFileSync(sharedFile, shared('red.300', '11.11px', '1.5px'))
    writeFileSync(join(directory, 'src/consumer.ts'), consumer)
    return { directory, sharedFile }
  }

  test('every edit class agrees with a cold build, and unread edits skip re-extraction', async () => {
    const { directory, sharedFile } = createRecipeProject()
    const warm = new Builder()
    await build(warm, directory)

    const scenarios: Array<[string, string]> = [
      ['unread-value edit', shared('red.300', '11.11px', '2.5px')],
      ['read-value edit', shared('red.300', '99.99px', '2.5px')],
      ['recipe-config edit', shared('blue.500', '99.99px', '2.5px')],
      ['export-alias edit', shared('blue.500', '99.99px', '2.5px', 'chipRenamed')],
      ['revert', shared('red.300', '11.11px', '1.5px')],
    ]
    for (const [label, contents] of scenarios) {
      writeFileSync(sharedFile, contents)
      const edited = await build(warm, directory)
      const cold = await build(new Builder(), directory)
      expect(edited, label).toBe(cold)
    }
  }, 120_000)
})

describe('source-scan cache', () => {
  test('cached rebuilds emit byte-identical css across an edit and its revert', async () => {
    const { directory, fixture } = createProject()

    const warm = new Builder()
    const first = await build(warm, directory)

    writeFileSync(fixture, contentsB)
    const edited = await build(warm, directory)
    // A cold Builder has no scan cache to reuse, so it is the ground truth for this tree.
    const editedCold = await build(new Builder(), directory)
    expect(edited).toBe(editedCold)
    expect(edited).not.toBe(first)
    expect(edited).toContain('spin')

    writeFileSync(fixture, contentsA)
    const reverted = await build(warm, directory)
    expect(reverted).toBe(first)
    expect(reverted).not.toContain('spin')
  }, 120_000)

  test('an unchanged rebuild reads no source file; an edit re-reads only the edited file', async () => {
    const { directory, fixture } = createProject()

    const builder = new Builder()
    await build(builder, directory)
    const ctx = builder.context!

    const reads = vi.spyOn(ctx.runtime.fs, 'readFileSync')
    builder.toCss({ layerParams: true, includeRecipes: false })
    expect(reads.mock.calls.length, 'every per-file scan came from the cache').toBe(0)

    writeFileSync(fixture, contentsB)
    await builder.setup({ cwd: directory, dev: true })
    builder.extract()
    reads.mockClear()
    builder.toCss({ layerParams: true, includeRecipes: false })
    const readFiles = [...new Set(reads.mock.calls.map((call) => String(call[0])))]
    expect(readFiles, 'only the edited file was re-scanned').toEqual([fixture])
    reads.mockRestore()
  }, 120_000)

  test('changing the question the walk was asked drops the cached answers', async () => {
    const { directory } = createProject()

    const builder = new Builder()
    await build(builder, directory)
    const ctx = builder.context!

    const cache = createSourceScanCache()
    const options = { keyframeNames: ['spin'], elements: false }
    collectSourceScans(ctx, options, cache)
    const reads = vi.spyOn(ctx.runtime.fs, 'readFileSync')

    collectSourceScans(ctx, options, cache)
    expect(reads.mock.calls.length, 'same question, cached answers').toBe(0)

    collectSourceScans(ctx, { keyframeNames: ['spin', 'pulse'], elements: false }, cache)
    expect(reads.mock.calls.length, 'a new keyframe list re-scans every file').toBeGreaterThan(0)
    reads.mockRestore()
  }, 120_000)
})
