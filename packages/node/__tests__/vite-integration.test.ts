import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { logger } from '@bamboocss/logger'
import { afterEach, describe, expect, test, vi } from 'vitest'
import { setupPostcss } from '../src/setup-config'
import { findViteConfig, hasUncompilableSources } from '../src/vite-integration'

/**
 * Which projects are told that `@bamboocss/vite` is the integration they want.
 *
 * The advice is right for a Vite project whose components the compiler can transform, and
 * wrong — destructively so — for a Svelte or Vue one, where the compiler would leave every
 * component alone and reachability pruning would then remove the rules only those components
 * reach. So the exception matters more than the advice does.
 *
 * `bamboo init` reaches this before any Bamboo config exists, which is why the dependency list
 * is a signal at all; the PostCSS plugin reaches it with a resolved `include`, which is the
 * better one. Both are covered here because `init` only ever has the first.
 */
const projects: string[] = []

const project = (contents: Record<string, string>) => {
  const dir = mkdtempSync(join(tmpdir(), 'bamboo-vite-integration-'))
  projects.push(dir)
  for (const [name, content] of Object.entries(contents)) {
    mkdirSync(join(dir, name, '..'), { recursive: true })
    writeFileSync(join(dir, name), content)
  }
  return dir
}

afterEach(() => {
  for (const dir of projects.splice(0)) rmSync(dir, { force: true, recursive: true })
})

describe('finding a Vite config', () => {
  test('any extension Vite itself accepts', () => {
    expect(findViteConfig(project({ 'vite.config.mts': '' }))).toMatch(/vite\.config\.mts$/)
    expect(findViteConfig(project({}))).toBeUndefined()
    // Not a Vite config. A project with only this builds with something else and runs Vitest.
    expect(findViteConfig(project({ 'vitest.config.ts': '' }))).toBeUndefined()
  })
})

describe('sources the compiler cannot reach', () => {
  test('named by the resolved include globs', () => {
    const cwd = project({ 'package.json': '{}' })

    expect(hasUncompilableSources({ cwd, include: ['./src/**/*.{js,svelte,ts}'] })).toBe(true)
    expect(hasUncompilableSources({ cwd, include: ['./src/**/*.{ts,tsx,mdx}'] })).toBe(true)
    expect(hasUncompilableSources({ cwd, include: ['./src/**/*.{js,jsx,ts,tsx}'] })).toBe(false)
  })

  test('or by the dependency list, which is all `bamboo init` has', () => {
    const svelte = project({ 'package.json': JSON.stringify({ devDependencies: { svelte: '^5' } }) })
    const react = project({ 'package.json': JSON.stringify({ dependencies: { react: '^19' } }) })

    expect(hasUncompilableSources({ cwd: svelte })).toBe(true)
    expect(hasUncompilableSources({ cwd: react })).toBe(false)
  })

  test('and a project with neither is not a reason to throw', () => {
    expect(hasUncompilableSources({ cwd: project({}) })).toBe(false)
    expect(hasUncompilableSources({ cwd: project({ 'package.json': 'not json' }) })).toBe(false)
  })
})

describe('bamboo init --postcss', () => {
  const warningsFrom = async (cwd: string) => {
    const warn = vi.spyOn(logger, 'warn').mockImplementation(() => {})
    try {
      await setupPostcss(cwd)
      return warn.mock.calls.filter(([, message]) => String(message).includes('vite.config'))
    } finally {
      warn.mockRestore()
    }
  }

  test('says which integration a Vite project wants, before writing the config anyway', async () => {
    const cwd = project({ 'vite.config.ts': '', 'package.json': JSON.stringify({ dependencies: { react: '^19' } }) })

    expect(await warningsFrom(cwd)).toHaveLength(1)
    // Written regardless: this is advice, not a refusal, and `--postcss` was asked for.
    expect(findViteConfig(cwd)).toBeDefined()
  })

  test('says nothing to a project with no Vite config', async () => {
    expect(await warningsFrom(project({ 'package.json': '{}' }))).toHaveLength(0)
  })

  test('says nothing to a Svelte project, where PostCSS is the right integration', async () => {
    const cwd = project({ 'vite.config.ts': '', 'package.json': JSON.stringify({ devDependencies: { svelte: '^5' } }) })

    expect(await warningsFrom(cwd)).toHaveLength(0)
  })
})
