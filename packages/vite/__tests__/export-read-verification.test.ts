import { mkdirSync, rmSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { afterAll, afterEach, describe, expect, test } from 'vitest'
import { bamboocss, normalizeFsPath } from '../src/plugin'

/**
 * Dependent verification by recorded reads.
 *
 * A fold records every cross-file value it read together with a digest of what it read.
 * `hotUpdate` then decides "did this consumer's compiled bytes move" by re-digesting the
 * edited file's read values instead of re-folding the consumer. These pin the contract from
 * the outside: an edit that moves nothing a consumer read must invalidate nothing, an edit
 * that moves a read value must invalidate the consumer and re-fold to the new bytes, and a
 * removed export must read as changed rather than as unverifiable-silence.
 */
const cwd = join(dirname(fileURLToPath(import.meta.url)), '../../../sandbox/codegen')
const FIXTURE_DIR = join(cwd, '__export-read-verify-tmp')
const DEPENDENCY = join(FIXTURE_DIR, 'dep.ts')
const CONSUMER = join(FIXTURE_DIR, 'consumer.tsx')

const CONSUMER_CODE = `import { css } from 'styled-system/css'
import { shared } from './dep'
export const cls = css(shared)
`

const depCode = (sharedColor: string, unrelatedColor: string) =>
  `export const shared = { color: '${sharedColor}' }\n` + `export const unrelated = { color: '${unrelatedColor}' }\n`

const hookOf = <T>(hook: T | { handler: T } | undefined): T | undefined =>
  typeof hook === 'function' ? hook : (hook as { handler: T } | undefined)?.handler

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

  return {
    start: () => buildStart?.call({} as never, {} as never),
    fold: async (code = CONSUMER_CODE) => {
      const result = await transform?.call({ addWatchFile() {} } as never, code, CONSUMER, {} as never)
      return typeof result === 'object' && result !== null ? result.code : null
    },
    change: () => watchChange?.call({} as never, DEPENDENCY, { event: 'update' } as never),
    hot: (graph: ReturnType<typeof stubGraph>['graph']) =>
      hotUpdate?.call(
        { environment: { config: { consumer: 'client' }, moduleGraph: graph } } as never,
        { file: DEPENDENCY, modules: [] } as never,
      ),
  }
}

const write = (sharedColor: string, unrelatedColor: string) => {
  mkdirSync(FIXTURE_DIR, { recursive: true })
  writeFileSync(DEPENDENCY, depCode(sharedColor, unrelatedColor))
  writeFileSync(CONSUMER, CONSUMER_CODE)
}

const cleanUp = () => rmSync(FIXTURE_DIR, { force: true, recursive: true })
afterEach(cleanUp)
afterAll(cleanUp)

describe('export-read verification', () => {
  test('an edit to an export the consumer never read invalidates nothing', async () => {
    const { start, fold, change, hot } = driver()

    write('red.300', 'green.500')
    await start()
    expect(await fold()).toContain('"c_red.300"')

    writeFileSync(DEPENDENCY, depCode('red.300', 'pink.100'))
    change()
    const { graph, invalidated } = stubGraph({ [CONSUMER]: [{ id: CONSUMER }] })
    expect(hot(graph)).toBeUndefined()
    expect(invalidated, 'the read values did not move, so the consumer must be left alone').toEqual([])
  }, 60_000)

  test('an edit to a read value invalidates the consumer and re-folds to the new bytes', async () => {
    const { start, fold, change, hot } = driver()

    write('red.300', 'green.500')
    await start()
    expect(await fold()).toContain('"c_red.300"')

    writeFileSync(DEPENDENCY, depCode('blue.500', 'green.500'))
    change()
    const { graph, invalidated } = stubGraph({ [CONSUMER]: [{ id: CONSUMER }] })
    hot(graph)
    expect(invalidated, 'the read value moved, so the stale literal must go').toEqual([CONSUMER])
    expect(await fold()).toContain('"c_blue.500"')
  }, 60_000)

  test('a removed export reads as changed, never as silence', async () => {
    const { start, fold, change, hot } = driver()

    write('red.300', 'green.500')
    await start()
    expect(await fold()).toContain('"c_red.300"')

    writeFileSync(DEPENDENCY, `export const unrelated = { color: 'green.500' }\n`)
    change()
    const { graph, invalidated } = stubGraph({ [CONSUMER]: [{ id: CONSUMER }] })
    hot(graph)
    expect(invalidated, 'losing the export is a change to everything that read it').toEqual([CONSUMER])
  }, 60_000)
})
