import { fixtureDefaults } from '@bamboocss/fixture'
import type { WatcherEventType } from '@bamboocss/types'
import { mkdirSync, mkdtempSync, readFileSync, rmSync, unlinkSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { afterEach, describe, expect, test, vi } from 'vitest'
import { BambooContext } from '../../node/src/create-context'

const mocked = vi.hoisted(() => ({ loadConfigAndCreateContext: vi.fn() }))

vi.mock('@bamboocss/node', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@bamboocss/node')>()),
  loadConfigAndCreateContext: mocked.loadConfigAndCreateContext,
}))

import { main } from '../src/cli-main'

const temporaryDirectories = new Set<string>()
const originalArgv = process.argv

afterEach(() => {
  process.argv = originalArgv
  vi.restoreAllMocks()
  mocked.loadConfigAndCreateContext.mockReset()
  for (const directory of temporaryDirectories) rmSync(directory, { force: true, recursive: true })
  temporaryDirectories.clear()
})

describe('cssgen --watch unlink', () => {
  test('regenerates the output without the deleted file selector', async () => {
    const directory = mkdtempSync(path.join(tmpdir(), 'bamboo-cssgen-watch-unlink-'))
    temporaryDirectories.add(directory)
    const source = path.join(directory, 'src/deleted.tsx')
    const outfile = path.join(directory, 'styles.css')
    mkdirSync(path.dirname(source), { recursive: true })
    writeFileSync(
      source,
      `import { css } from 'styled-system/css'; export const className = css({ opacity: '0.1234567' })`,
    )

    const ctx = new BambooContext({
      ...fixtureDefaults,
      config: {
        ...fixtureDefaults.config,
        cwd: directory,
        include: ['src/**/*.{ts,tsx}'],
        outdir: 'styled-system',
      },
    })
    let onFile!: (event: WatcherEventType, file: string) => void | Promise<void>
    ctx.watchConfig = vi.fn()
    ctx.watchFiles = vi.fn((callback) => {
      onFile = callback
    })
    mocked.loadConfigAndCreateContext.mockResolvedValue(ctx)
    process.argv = ['node', 'bamboo', 'cssgen', '--watch', '--cwd', directory, '--outfile', outfile]

    await main()

    const initial = readFileSync(outfile, 'utf8')
    const selector = initial.match(/([^{}]+)\{[^{}]*opacity:\s*0\.1234567[^{}]*\}/)?.[1].trim()
    expect(selector).toMatch(/^\./)

    unlinkSync(source)
    await onFile('unlink', 'src/deleted.tsx')

    const regenerated = readFileSync(outfile, 'utf8')
    expect(regenerated).not.toContain(selector!)
    expect(regenerated).not.toContain('0.1234567')
  })
})
