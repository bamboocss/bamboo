import { mkdirSync, rmSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { afterAll, afterEach, describe, expect, test } from 'vitest'
import { bamboocss, normalizeFsPath } from '../src/plugin'
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

/**
 * The two members of Vite's module graph that `hotUpdate` reaches, and nothing else.
 *
 * Keyed the way the plugin spells a path rather than the way `join` does, so the lookup is
 * the plugin's and not this file's. They differ on Windows, where a test keyed on `join`
 * output would fail for a reason that has nothing to do with what it asserts.
 */
const stubGraph = (files: Record<string, { id: string }[]>) => {
  const invalidated: string[] = []
  const byPath = new Map(Object.entries(files).map(([file, modules]) => [normalizeFsPath(file), modules]))
  return {
    invalidated,
    graph: {
      getModulesByFile: (file: string) => {
        const modules = byPath.get(file)
        return modules && new Set(modules)
      },
      invalidateModule: (module: { id: string }) => invalidated.push(module.id),
    },
  }
}

const driver = () => {
  const plugin = bamboocss({ cwd, reportSummary: false }).find((p) => p.name === 'bamboocss:compiler')!

  const buildStart = hookOf(plugin.buildStart)
  const transform = hookOf(plugin.transform)
  const watchChange = hookOf(plugin.watchChange)
  const hotUpdate = hookOf(plugin.hotUpdate)

  // `addWatchFile` is stubbed rather than asserted on; what it registers is covered by
  // `fold-cross-file.test.ts`. This is about what the re-transform then produces.
  const foldFile = async (file: string, code: string) => {
    const result = await transform?.call({ addWatchFile() {} } as never, code, file, {} as never)
    return typeof result === 'object' && result !== null ? result.code : null
  }

  return {
    plugin,
    start: () => buildStart?.call({} as never, {} as never),
    fold: (code = CONSUMER_CODE) => foldFile(CONSUMER, code),
    /** The same, for a fixture with more than one consumer of the same dependency. */
    foldFile,
    change: (event: 'update' | 'delete' | 'create') => watchChange?.call({} as never, DEPENDENCY, { event } as never),
    /** Vite 6 and up: one graph per environment, reached through the plugin context. */
    hot: (file: string, graph: ReturnType<typeof stubGraph>['graph'], modules: { id: string }[] = []) =>
      hotUpdate?.call({ environment: { moduleGraph: graph } } as never, { file, modules } as never),
    /** Vite 5: one graph, on the server, and no `hotUpdate` hook to prefer over this one. */
    legacyHot: (file: string, server: object) =>
      hookOf(plugin.handleHotUpdate)?.call({} as never, { file, modules: [], server } as never),
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
 * What the dev server is told to re-transform when a folded-from module changes.
 *
 * `addWatchFile` is enough for a build, where Rollup discards a module whose watched file
 * changed. Vite's dev server *soft*-invalidates a module that statically imports the changed
 * one — it keeps the cached transform result and rewrites only import timestamps — and the
 * compiled class string lives in exactly that cached result. So the edit never lands, in
 * silence, until the server restarts.
 *
 * A stub graph rather than a real server, which `sandbox/runtime-perf` covers end to end.
 * What is asserted here is the bookkeeping: which files are named, and that an edge is
 * dropped when the fold that created it goes away.
 */
describe('dev invalidation of modules that folded across files', () => {
  test('invalidates the consumer, and stops once it no longer folds from the file', async () => {
    const { start, fold, hot } = driver()

    writeDependency('red.300')
    await start()
    expect(await fold()).toContain('"c_red.300"')

    // Alongside the module Vite matched for the edit itself, which this must not disturb.
    const changed = { id: DEPENDENCY }
    const first = stubGraph({ [CONSUMER]: [{ id: CONSUMER }] })
    expect(hot(DEPENDENCY, first.graph, [changed])).toBeUndefined()
    expect(first.invalidated, 'the stale compiled result has to go').toEqual([CONSUMER])

    // The same module, no longer reading anything out of the dependency.
    expect(
      await fold(`import { css } from 'styled-system/css'\nexport const cls = css({ color: 'red.300' })\n`),
    ).toContain('"c_red.300"')

    const second = stubGraph({ [CONSUMER]: [{ id: CONSUMER }] })
    expect(hot(DEPENDENCY, second.graph), 'no fold reads that file any more').toBeUndefined()
    expect(second.invalidated).toEqual([])
  }, 60_000)

  /**
   * Returning the consumers as well is not free, and it is not additive the way it looks.
   *
   * `addWatchFile` already makes each of them a direct importer of the dependency, so Vite
   * walks to all of them from the changed module and sends the same update. A framework plugin
   * reading `hotUpdate`'s result then re-drives HMR *per entry* — react-router calls
   * `reloadModule` once per module, in both its client and its ssr pass — so each extra name is
   * another full round trip. One `css()` edit shared by two routes went over the socket eight
   * times, refetching both route modules five times each, for 554 kB of a one-line change.
   *
   * When Vite matched nothing there is no such pass to duplicate, and this is the only thing
   * that will announce the change at all. The test below covers the other way that walk can fail
   * to arrive.
   */
  test('stays quiet when Vite matched a module whose own pass will reach the consumer', async () => {
    const { start, fold, hot } = driver()

    writeDependency('red.300')
    await start()
    await fold()

    const matched = stubGraph({ [CONSUMER]: [{ id: CONSUMER }] })
    expect(hot(DEPENDENCY, matched.graph, [{ id: DEPENDENCY }])).toBeUndefined()
    expect(matched.invalidated, 'invalidation is not what is being skipped').toEqual([CONSUMER])

    const unmatched = stubGraph({ [CONSUMER]: [{ id: CONSUMER }] })
    expect(hot(DEPENDENCY, unmatched.graph, [])).toEqual([{ id: CONSUMER }])
    expect(unmatched.invalidated).toEqual([CONSUMER])
  }, 60_000)

  /**
   * The case the rule above misses, and the one users actually meet.
   *
   * `propagateUpdate` stops at the first self-accepting module and never walks its importers, and
   * React Fast Refresh makes every file exporting a component self-accepting. So editing a
   * component that a sibling folded a class out of invalidates the sibling here and then tells
   * nobody: the browser keeps the module it already has, still carrying the class compiled from
   * the previous contents, until a full reload. It reads as "the edit did not apply", with the
   * dev server and Bamboo both logging as though it had.
   *
   * This is also why the fan-out looks cheap in a React app. It is deferred, not avoided — the
   * consumers really are re-transformed, just on whatever request comes next.
   */
  test('names the consumer when the changed module accepts itself, so nothing else will', async () => {
    const { start, fold, hot } = driver()

    writeDependency('red.300')
    await start()
    await fold()

    const component = { id: DEPENDENCY, isSelfAccepting: true }
    const { graph, invalidated } = stubGraph({ [CONSUMER]: [{ id: CONSUMER }] })

    expect(hot(DEPENDENCY, graph, [component])).toEqual([component, { id: CONSUMER }])
    expect(invalidated, 'the stale compiled result still has to go').toEqual([CONSUMER])
  }, 60_000)

  test('says nothing about a file no fold read', async () => {
    const { start, fold, hot } = driver()

    writeDependency('red.300')
    await start()
    await fold()

    const unrelated = join(FIXTURE_DIR, 'elsewhere.ts')
    const { graph, invalidated } = stubGraph({ [CONSUMER]: [{ id: CONSUMER }] })
    expect(hot(unrelated, graph)).toBeUndefined()
    expect(invalidated).toEqual([])
  }, 60_000)

  /**
   * The Vite 5 path, which nothing in this repo runs — the workspace is on 7 and 8 — and
   * which the peer range (`vite: ">=5"`) still promises. Left uncovered, a project on 5 keeps
   * the staleness this whole change is about, and every green test here says otherwise.
   *
   * The guard is what decides: on Vite 6 and up the hook is not called at all when a plugin
   * also has `hotUpdate`, and if some future version did call it, its `server.moduleGraph` is
   * a compatibility view over the per-environment graphs rather than the one graph Vite 5 has.
   */
  test('the Vite 5 hook names the same consumer, and defers on a newer server', async () => {
    const { start, fold, legacyHot } = driver()

    writeDependency('red.300')
    await start()
    await fold()

    const five = stubGraph({ [CONSUMER]: [{ id: CONSUMER }] })
    expect(legacyHot(DEPENDENCY, { moduleGraph: five.graph })).toEqual([{ id: CONSUMER }])
    expect(five.invalidated).toEqual([CONSUMER])

    const six = stubGraph({ [CONSUMER]: [{ id: CONSUMER }] })
    expect(legacyHot(DEPENDENCY, { environments: {}, moduleGraph: six.graph })).toBeUndefined()
    expect(six.invalidated).toEqual([])
  }, 60_000)
})

/**
 * What a consumer is told when the edit cannot reach it.
 *
 * The invalidation above is correct and has to stay: a class is compiled into the module that
 * *calls* a recipe or shares a style object, so a consumer's compiled string really can go stale
 * when the module it read from changes. But "can" is not "did". Editing one export of a shared
 * module moves the consumers that read *that* export; the ones reading something else from the
 * same file recompile to the bytes they already have, and both the announcement and the
 * invalidation for those are pure cost — a round trip for a module the browser holds verbatim,
 * and a full re-transform in place of the cached result Vite would otherwise have re-served.
 *
 * These fixtures write the consumers to disk, which the ones above deliberately do not. That is
 * load-bearing rather than incidental: the only way to know what a re-fold produces is to re-fold
 * it, so the check reads the consumer's current source and compares its input against what the
 * last transform was handed. A module it cannot read that way — a stub, a virtual module, one
 * built by another plugin's `load` — falls through to "changed", which is what every test above
 * exercises.
 */
describe('a dependent the edit does not actually change', () => {
  const OTHER_CONSUMER = join(FIXTURE_DIR, 'other-consumer.tsx')

  const consumerOf = (binding: string) =>
    `import { css } from 'styled-system/css'\nimport { ${binding} } from './dep'\nexport const cls = css(${binding})\n`

  const writePair = (alpha: string, beta: string) => {
    mkdirSync(FIXTURE_DIR, { recursive: true })
    writeFileSync(DEPENDENCY, `export const alpha = { color: '${alpha}' }\nexport const beta = { color: '${beta}' }\n`)
    writeFileSync(CONSUMER, consumerOf('alpha'))
    writeFileSync(OTHER_CONSUMER, consumerOf('beta'))
  }

  test('is not announced, and the one that changed still is', async () => {
    const { start, foldFile, change, hot } = driver()

    writePair('red.300', 'blue.500')
    await start()
    expect(await foldFile(CONSUMER, consumerOf('alpha'))).toContain('"c_red.300"')
    expect(await foldFile(OTHER_CONSUMER, consumerOf('beta'))).toContain('"c_blue.500"')

    // One export moves. `beta` is untouched, so the module reading it folds to the same bytes.
    writePair('red.400', 'blue.500')
    change('update')

    const first = stubGraph({ [CONSUMER]: [{ id: CONSUMER }], [OTHER_CONSUMER]: [{ id: OTHER_CONSUMER }] })
    expect(hot(DEPENDENCY, first.graph, [])).toEqual([{ id: CONSUMER }])
    expect(first.invalidated, 'identical bytes have nothing stale to drop').toEqual([CONSUMER])

    // What the browser does next with the module that was announced.
    expect(await foldFile(CONSUMER, consumerOf('alpha'))).toContain('"c_red.400"')

    // The other half of the same claim: suppression is per edit, not a state a module gets stuck
    // in. Move `beta` this time and the two swap places.
    writePair('red.400', 'blue.600')
    change('update')

    const second = stubGraph({ [CONSUMER]: [{ id: CONSUMER }], [OTHER_CONSUMER]: [{ id: OTHER_CONSUMER }] })
    expect(hot(DEPENDENCY, second.graph, [])).toEqual([{ id: OTHER_CONSUMER }])
    expect(second.invalidated).toEqual([OTHER_CONSUMER])
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
