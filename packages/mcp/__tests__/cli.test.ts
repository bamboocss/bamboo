import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, test } from 'vitest'
import { parseArgs } from '../src/cli'

/**
 * The arguments this has to read are the ones `bamboo init-mcp` writes into a client config,
 * plus whatever someone types when running the server by hand. It is hand-rolled rather than
 * another argument parser because the point of shipping this package separately is that
 * installing it pulls in as little as possible.
 */
describe('parseArgs', () => {
  test('no arguments is no options', () => {
    expect(parseArgs([])).toEqual({})
  })

  test('reads the flags the generated config can carry', () => {
    expect(parseArgs(['--cwd', '/app'])).toEqual({ cwd: '/app' })
    expect(parseArgs(['--config', './bamboo.config.ts'])).toEqual({ config: './bamboo.config.ts' })
    expect(parseArgs(['-c', './bamboo.config.ts'])).toEqual({ config: './bamboo.config.ts' })
  })

  test('reads the equals form too', () => {
    expect(parseArgs(['--cwd=/app', '--config=./b.ts'])).toEqual({ cwd: '/app', config: './b.ts' })
  })

  test('takes both at once, in either order', () => {
    expect(parseArgs(['--config', './b.ts', '--cwd', '/app'])).toEqual({ config: './b.ts', cwd: '/app' })
    expect(parseArgs(['--cwd', '/app', '-c', './b.ts'])).toEqual({ cwd: '/app', config: './b.ts' })
  })

  test('a path that looks like a flag is still a value', () => {
    // `--config --cwd` means a file named `--cwd`, not a missing value followed by a flag.
    expect(parseArgs(['--config', '--cwd'])).toEqual({ config: '--cwd' })
  })

  test('-h and --help', () => {
    expect(parseArgs(['-h'])).toEqual({ help: true })
    expect(parseArgs(['--help'])).toEqual({ help: true })
  })

  test('an unknown flag throws rather than being ignored', () => {
    // Silently ignoring it would start a server against the wrong project.
    expect(() => parseArgs(['--bogus'])).toThrow('Unknown option: --bogus')
    expect(() => parseArgs(['/some/path'])).toThrow('Unknown option: /some/path')
  })

  test('a flag with no value throws rather than falling back to the default', () => {
    // The same hazard as an unknown flag: silently dropping it would load whatever config
    // happens to be in the working directory instead of the one that was named.
    expect(() => parseArgs(['--config'])).toThrow('Missing value for --config')
    expect(() => parseArgs(['-c'])).toThrow('Missing value for -c')
    expect(() => parseArgs(['--cwd'])).toThrow('Missing value for --cwd')
    expect(() => parseArgs(['--config='])).toThrow('Missing value for --config')
    expect(() => parseArgs(['--cwd='])).toThrow('Missing value for --cwd')
    expect(() => parseArgs(['--config', ''])).toThrow('Missing value for --config')
  })
})

describe('package entry points', () => {
  const root = dirname(fileURLToPath(import.meta.url))
  const pkg = JSON.parse(readFileSync(join(root, '../package.json'), 'utf8'))

  test('the bin is declared and shipped', () => {
    // A packaging change breaks exactly this, and nothing else here would notice.
    expect(pkg.bin).toEqual({ 'bamboo-mcp': 'bin.js' })
    expect(pkg.files).toContain('bin.js')
    expect(pkg.files).toContain('dist')
  })

  test('the bin requires a path the build emits, and calls what it exports', () => {
    const bin = readFileSync(join(root, '../bin.js'), 'utf8')

    expect(bin.startsWith('#!/usr/bin/env node')).toBe(true)
    expect(bin).toContain('./dist/cli.cjs')
    expect(bin).toContain('runMcpCli()')
    // Without this a failed startup exits 0 having written nothing to either stream.
    expect(bin).toContain('.catch(')

    // `require` in the bin only works while the package stays CommonJS.
    expect(pkg.type).toBeUndefined()

    // `dist/cli.cjs` is what `bin.js` reaches for, so the build has to emit that entry.
    expect(pkg.scripts.build).toContain('src/cli.ts')
  })
})
