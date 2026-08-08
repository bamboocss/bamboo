import type { Config } from '@bamboocss/types'
import { describe, expect, test } from 'vitest'
import { cssgen } from '../src/cssgen'

/**
 * `pruneUnusedTokens` and `pruneUnusedKeyframes` are independent switches.
 *
 * Both prune passes gather their reference set by reading every source file, so both sit
 * behind a flag. Sharing one gate is the easy mistake, and it fails silently in the
 * direction users notice least: setting `pruneUnusedKeyframes: false` produces no error,
 * no warning, and keyframes vanish anyway. The generator-level tests cannot catch it —
 * they call `ctx.pruneKeyframes` directly, below this wiring.
 *
 * This context is hand-built rather than a real one, so it does not pick up the defaults
 * `Context` applies. Each case states both flags for that reason; `defaults` in
 * `packages/core/src/context.ts` is what makes them `true` in a real build.
 */
const createContext = (config: Config) => {
  const calls: string[] = []

  const ctx = {
    config: { cwd: '/app', pruneUnusedTokens: true, pruneUnusedKeyframes: true, ...config },
    createSheet: () => ({}),
    parseFiles: () => ({ files: [], results: [] }),
    messages: { buildComplete: () => '', cssArtifactComplete: () => '' },
    appendLayerParams: () => {},
    appendBaselineCss: () => {},
    appendParserCss: () => {},
    // Called either way — with a reference set for the full pass, without one when only the
    // `@property` registrations are being dropped.
    pruneTokens: (_sheet: unknown, keep?: unknown) => calls.push(keep ? 'tokens' : 'properties'),
    pruneKeyframes: () => calls.push('keyframes'),
    getFiles: () => [],
    project: { getSourceFile: () => undefined },
    runtime: {
      fs: { readFileSync: () => '', writeFile: async () => {} },
      path: { abs: (c: string, f: string) => `${c}/${f}`, resolve: (f: string) => f },
    },
    getCss: () => '',
    writeCss: async () => {},
  } as any

  return { ctx, calls }
}

const run = async (config: Config, options: Record<string, unknown> = {}) => {
  const { ctx, calls } = createContext(config)
  await cssgen(ctx, { cwd: '/app', ...options })
  return calls
}

describe('cssgen prune flags', () => {
  test('both passes run by default', async () => {
    expect(await run({})).toEqual(['tokens', 'keyframes'])
  })

  test('disabling both still drops the @property registrations', async () => {
    expect(await run({ pruneUnusedTokens: false, pruneUnusedKeyframes: false })).toEqual(['properties'])
  })

  test('pruneUnusedKeyframes alone still prunes keyframes', async () => {
    expect(await run({ pruneUnusedTokens: false, pruneUnusedKeyframes: true })).toEqual(['properties', 'keyframes'])
  })

  test('pruneUnusedTokens alone does not prune keyframes', async () => {
    expect(await run({ pruneUnusedTokens: true, pruneUnusedKeyframes: false })).toEqual(['tokens'])
  })

  test('minimal skips both, since it omits the token layer entirely', async () => {
    expect(await run({ pruneUnusedTokens: true, pruneUnusedKeyframes: true }, { minimal: true })).toEqual([])
  })
})
