import { describe, expect, test } from 'vitest'
import { OutputEngine } from '../src/output-engine'

const createEngine = (files: Record<string, string>) => {
  const write = (file: string, code: string) => {
    files[file] = code
  }

  const engine = new OutputEngine({
    paths: { root: ['out'] },
    runtime: {
      fs: {
        ensureDirSync: () => void 0,
        existsSync: (file: string) => file in files,
        readFileSync: (file: string) => files[file],
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
