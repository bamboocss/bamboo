import { fixtureDefaults } from '@bamboocss/fixture'
import type { WatcherEventType } from '@bamboocss/types'
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { afterEach, describe, expect, test, vi } from 'vitest'
import { BambooContext } from '../src/create-context'

const mocked = vi.hoisted(() => ({
  codegen: vi.fn(),
  loadConfigAndCreateContext: vi.fn(),
}))

vi.mock('../src/codegen', () => ({ codegen: mocked.codegen }))
vi.mock('../src/config', () => ({ loadConfigAndCreateContext: mocked.loadConfigAndCreateContext }))

import { generate } from '../src/generate'

const temporaryDirectories = new Set<string>()

afterEach(() => {
  vi.restoreAllMocks()
  mocked.codegen.mockReset()
  mocked.loadConfigAndCreateContext.mockReset()
  for (const directory of temporaryDirectories) rmSync(directory, { force: true, recursive: true })
  temporaryDirectories.clear()
})

const createFiles = (files: Record<string, string>) => {
  const directory = mkdtempSync(path.join(tmpdir(), 'bamboo-generate-watch-add-'))
  temporaryDirectories.add(directory)

  for (const [file, content] of Object.entries(files)) {
    const absolute = path.join(directory, file)
    mkdirSync(path.dirname(absolute), { recursive: true })
    writeFileSync(absolute, content)
  }

  return directory
}

describe('generate watch add invalidation', () => {
  test('rebuilds every transitive dependent of an importer waiting on a higher-priority extension', async () => {
    const directory = createFiles({
      'src/target.tsx': `export const base = { color: 'blue' }`,
      'src/bridge.ts': `import { base } from './target'; export const bridged = base`,
      'src/app.tsx': `
        import { css } from 'styled-system/css'
        import { bridged } from './bridge'
        export const className = css(bridged)
      `,
      'src/unrelated.ts': `export const unrelated = true`,
    })
    const reparsed: string[] = []
    const ctx = new BambooContext({
      ...fixtureDefaults,
      config: {
        ...fixtureDefaults.config,
        cwd: directory,
        include: ['src/**/*.{ts,tsx}'],
        outdir: 'styled-system',
        watch: true,
      },
      hooks: {
        'parser:after': ({ filePath }) => {
          reparsed.push(filePath)
        },
      },
    })
    let onFile!: (event: WatcherEventType, file: string) => void | Promise<void>
    ctx.watchConfig = vi.fn()
    ctx.watchFiles = vi.fn((callback) => {
      onFile = callback
    })
    mocked.loadConfigAndCreateContext.mockResolvedValue(ctx)

    await generate(ctx.config)

    const outfile = path.join(directory, 'styled-system/styles.css')
    expect(readFileSync(outfile, 'utf8')).toMatch(/color:\s*blue/)

    reparsed.length = 0
    writeFileSync(path.join(directory, 'src/target.ts'), `export const base = { color: 'red' }`)
    await onFile('add', 'src/target.ts')

    const relative = reparsed.map((file) => path.relative(directory, file)).sort()
    expect(relative).toEqual(['src/app.tsx', 'src/bridge.ts', 'src/target.ts'])
    expect(relative).not.toContain('src/unrelated.ts')

    const css = readFileSync(outfile, 'utf8')
    expect(css).toMatch(/color:\s*red/)
    expect(css).not.toMatch(/color:\s*blue/)
  })
})
