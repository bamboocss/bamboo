import { describe, expect, test } from 'vitest'
import { OutputEngine } from '../src/output-engine'

/**
 * `files` is a flat path -> contents map standing in for the disk. A directory exists when
 * something is under it, which is enough for the two questions the engine asks: is this
 * path there, and is it a directory.
 */
const createEngine = (files: Record<string, string>) => {
  const write = (file: string, code: string) => {
    files[file] = code
  }

  const childrenOf = (dir: string) =>
    Object.keys(files)
      .filter((file) => file.startsWith(dir + '/'))
      .map((file) => file.slice(dir.length + 1).split('/')[0])

  const engine = new OutputEngine({
    paths: { root: ['out'] },
    runtime: {
      fs: {
        ensureDirSync: () => void 0,
        existsSync: (file: string) => file in files || childrenOf(file).length > 0,
        isDirSync: (file: string) => !(file in files) && childrenOf(file).length > 0,
        readDirSync: (dir: string) => Array.from(new Set(childrenOf(dir))),
        readFileSync: (file: string) => files[file],
        rmFileSync: (file: string) => {
          delete files[file]
        },
        writeFile: write,
      },
      path: {
        join: (...parts: string[]) => parts.join('/'),
        dirname: (file: string) => file.split('/').slice(0, -1).join('/'),
        resolve: (...parts: string[]) => parts.join('/'),
      },
    },
  } as any)

  return { engine, files }
}

const pkg = (code: string) => ({ id: 'package.json' as const, files: [{ file: 'package.json', code }] })

const generated = JSON.stringify({ type: 'module', sideEffects: ['*.css'] })

describe('OutputEngine package.json', () => {
  test('writes the file when the output directory has none', async () => {
    const { engine, files } = createEngine({})

    await engine.write(pkg(generated))

    expect(JSON.parse(files['out/package.json'])).toEqual({ type: 'module', sideEffects: ['*.css'] })
  })

  test('keeps what emit-pkg wrote and fills in only the missing keys', async () => {
    const existing = { name: 'styled-system', private: true, exports: { './css': './css/index.mjs' } }
    const { engine, files } = createEngine({ 'out/package.json': JSON.stringify(existing) })

    await engine.write(pkg(generated))

    expect(JSON.parse(files['out/package.json'])).toEqual({ ...existing, type: 'module', sideEffects: ['*.css'] })
  })

  test('does not override a sideEffects the consumer already declared', async () => {
    const existing = { type: 'commonjs', sideEffects: false }
    const { engine, files } = createEngine({ 'out/package.json': JSON.stringify(existing) })

    await engine.write(pkg(generated))

    expect(JSON.parse(files['out/package.json'])).toEqual(existing)
  })

  /**
   * The merge rewrites a file the consumer keeps in source control, so it has to leave it
   * looking the way every other tool would write it. Dropping the trailing newline shows
   * up as a diff on every codegen for anyone running a formatter.
   */
  test('ends the merged file with a newline', async () => {
    const { engine, files } = createEngine({ 'out/package.json': JSON.stringify({ name: 'styled-system' }) })

    await engine.write(pkg(generated))

    expect(files['out/package.json'].endsWith('\n')).toBe(true)
  })

  test('leaves an unparseable file alone rather than discarding it', async () => {
    const { engine, files } = createEngine({ 'out/package.json': '{ not json' })

    await engine.write(pkg(generated))

    expect(files['out/package.json']).toBe('{ not json')
  })
})

/**
 * Codegen was write-only, so an artifact that stopped being generated stayed on disk.
 *
 * Dropping a pattern from the config rewrote `patterns/index.mjs` without it and left
 * `patterns/stack.mjs` beside it. Importing through the barrel then failed loudly, which is
 * fine; a deep import resolved, ran, returned a class name and emitted no css. A stale
 * artifact is worse than a missing one, because it answers.
 */
describe('OutputEngine prune', () => {
  const patterns = (...names: string[]) => ({
    id: 'patterns' as const,
    dir: ['out', 'patterns'],
    files: names.map((name) => ({ file: `${name}.mjs`, code: `export const ${name} = () => {}` })),
  })

  test('removes a file this codegen no longer produces', () => {
    const { engine, files } = createEngine({
      'out/patterns/stack.mjs': 'stale',
      'out/patterns/flex.mjs': 'live',
    })

    const { removed } = engine.prune([patterns('flex')])

    expect(removed).toBe(1)
    expect(files['out/patterns/stack.mjs']).toBeUndefined()
    expect(files['out/patterns/flex.mjs']).toBe('live')
  })

  test('never reads a directory this codegen did not write to', () => {
    const { engine, files } = createEngine({ 'out/recipes/button.mjs': 'untouched' })

    engine.prune([patterns('flex')])

    expect(files['out/recipes/button.mjs']).toBe('untouched')
  })

  test('leaves subdirectories alone', () => {
    // `styles/` is written by `writeSplitCss`, one level below the output root that codegen
    // does own. A sweep that deleted anything it did not recognise would take the whole
    // split stylesheet with it.
    const { engine, files } = createEngine({ 'out/styles/tokens.css': ':root {}', 'out/index.mjs': 'live' })

    engine.prune([{ id: 'css-index' as const, files: [{ file: 'index.mjs', code: 'live' }] }])

    expect(files['out/styles/tokens.css']).toBe(':root {}')
  })

  test('leaves the files codegen does not own', () => {
    // `styles.css` comes from `writeCss` and `package.json` is co-owned, so neither appears
    // in any artifact list and both would otherwise read as stale on every build.
    const { engine, files } = createEngine({
      'out/styles.css': '@layer reset;',
      'out/package.json': '{}',
      'out/index.mjs': 'live',
    })

    const { removed } = engine.prune([{ id: 'css-index' as const, files: [{ file: 'index.mjs', code: 'live' }] }])

    expect(removed).toBe(0)
    expect(files['out/styles.css']).toBe('@layer reset;')
    expect(files['out/package.json']).toBe('{}')
  })

  test('an artifact with no code is not produced, so its file is stale', () => {
    // `write` skips an artifact whose `code` is undefined. Reading it as produced here would
    // leave exactly the file that pass declined to write.
    const { engine, files } = createEngine({ 'out/patterns/stack.mjs': 'stale' })

    engine.prune([
      { id: 'patterns' as const, dir: ['out', 'patterns'], files: [{ file: 'stack.mjs', code: undefined }] },
    ])

    expect(files['out/patterns/stack.mjs']).toBeUndefined()
  })
})
