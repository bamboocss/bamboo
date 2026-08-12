import { mkdirSync, rmSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { afterAll, afterEach, describe, expect, test } from 'vitest'
import { bamboocss } from '../src/plugin'
import { createFoldFixture } from './fixture'

/**
 * What happens to a folded literal when the module it was read from changes.
 *
 * The fold reports the modules it resolved through, and the plugin registers them as
 * watch files, so editing one re-transforms its consumers. On its own that achieves
 * nothing: a consumer is transformed *before* the module it imports — that is how a
 * bundler discovers imports — so the re-transform runs while the parser still holds the
 * previous contents, and folds the same stale class again.
 *
 * These need a real config and a real file on disk, because the staleness lives in
 * ts-morph's copy of a module resolved from disk. `sandbox/codegen` has the config.
 *
 * The fixture lives *beside* that project's sources rather than in them. `sandbox/codegen`
 * includes `./src/**` and `./pages/**`, and several other suites build a context from the
 * same cwd — a file written and deleted under `src/` races their glob, which reads each
 * matched path with no guard, and fails an unrelated test with `ENOENT` roughly one run in
 * four. Nothing globs this directory, and the fold does not need it to: the plugin hands
 * the parser a path directly, and the extractor resolves the import from disk.
 */
const cwd = join(dirname(fileURLToPath(import.meta.url)), '../../../sandbox/codegen')
const FIXTURE_DIR = join(cwd, '__fold-watch-tmp')
const DEPENDENCY = join(FIXTURE_DIR, 'dep.ts')
const CONSUMER = join(FIXTURE_DIR, 'consumer.tsx')

const CONSUMER_CODE = `import { css } from 'styled-system/css'
import { shared } from './dep'
export const cls = css(shared)
`

const hookOf = <T>(hook: T | { handler: T } | undefined): T | undefined =>
  typeof hook === 'function' ? hook : (hook as { handler: T } | undefined)?.handler

const driver = () => {
  const plugin = bamboocss({ cwd, reportSummary: false }).find((p) => p.name === 'bamboocss:compiler')!

  const buildStart = hookOf(plugin.buildStart)
  const transform = hookOf(plugin.transform)
  const watchChange = hookOf(plugin.watchChange)

  return {
    plugin,
    start: () => buildStart?.call({} as never, {} as never),
    // `addWatchFile` is stubbed rather than asserted on; what it registers is covered by
    // `fold-cross-file.test.ts`. This is about what the re-transform then produces.
    fold: async () => {
      const result = await transform?.call({ addWatchFile() {} } as never, CONSUMER_CODE, CONSUMER, {} as never)
      return typeof result === 'object' && result !== null ? result.code : null
    },
    change: (event: 'update' | 'delete' | 'create') => watchChange?.call({} as never, DEPENDENCY, { event } as never),
  }
}

const writeDependency = (color: string) => {
  mkdirSync(FIXTURE_DIR, { recursive: true })
  writeFileSync(DEPENDENCY, `export const shared = { color: '${color}' }\n`)
}

// The whole directory, both per test and once at the end, so a test that throws part-way
// through does not leave a file behind for the next one to resolve against.
const cleanUp = () => rmSync(FIXTURE_DIR, { force: true, recursive: true })

afterEach(cleanUp)
afterAll(cleanUp)

describe('watch rebuilds', () => {
  test('an edited dependency is re-read before the consumer folds again', async () => {
    const { start, fold, change } = driver()

    writeDependency('red.300')
    await start()
    expect(await fold()).toContain('"c_red.300"')

    writeDependency('blue.500')
    change('update')
    await start()

    // Without the refresh this is still `c_red.300`: the class is correct for source the
    // user no longer has, and nothing in the build says so.
    expect(await fold()).toContain('"c_blue.500"')
  }, 60_000)

  test('a deleted dependency stops resolving rather than folding its last contents', async () => {
    const { start, fold, change } = driver()

    writeDependency('red.300')
    await start()
    expect(await fold()).toContain('"c_red.300"')

    rmSync(DEPENDENCY, { force: true })
    change('delete')
    await start()

    // The import resolves to nothing now, so there is no static value to fold. `null` is
    // the plugin's "module untouched", which is exactly the required outcome: the call
    // survives. Folding the contents of a file that was removed is the same defect as
    // folding the contents of one that changed.
    expect(await fold()).toBeNull()
  }, 60_000)
})

/**
 * Nodes must not be cached across passes.
 *
 * A module is re-transformed constantly — a watch rebuild, a second environment, a re-request
 * in dev — and `addSourceFile` overwrites, which forgets every node previously taken from that
 * file. An index of nodes memoized against the source text therefore hits on identical text
 * and hands back forgotten nodes, which throw
 * `Attempted to get information from a node that was removed or forgotten` on the next read.
 *
 * Identical text is the dangerous case, not the changed one: a changed file misses the cache
 * and rebuilds, so this only bites when nothing appears to have happened.
 */
describe('re-transforming a module', () => {
  const source = `import { cva } from 'styled-system/css'
const badge = cva({ base: { display: 'flex' } })
const other = cva({ base: { color: 'red.300' } })
export const passed = badge
export const alias = other
`

  test('does not read nodes forgotten by the previous pass', () => {
    const fixture = createFoldFixture()

    // Byte-identical each time, which is what makes a text-keyed cache hit.
    const first = fixture.fold(source, 'app/repeat.tsx', true)
    const second = fixture.fold(source, 'app/repeat.tsx', true)
    const third = fixture.fold(source, 'app/repeat.tsx', true)

    for (const result of [first, second, third]) {
      expect(result.skipped.filter((entry) => entry.reason === 'runtime-binding')).toHaveLength(2)
    }
    expect(second.code).toBe(first.code)
    expect(third.code).toBe(first.code)
  })
})
