import type { Config } from '@bamboocss/types'
import { describe, expect, test } from 'vitest'
import { cssgen } from '../src/cssgen'

/**
 * `pruneUnusedTokens` and `pruneUnusedKeyframes` are independent switches.
 *
 * Both prune passes gather their reference set by reading every source file, so both sit
 * behind a flag. Sharing one gate is the easy mistake, and it fails silently in the
 * direction users notice least: setting `pruneUnusedKeyframes: true` produces no error,
 * no warning, and no pruning. The generator-level tests cannot catch it — they call
 * `ctx.pruneKeyframes` directly, below this wiring.
 */
const createContext = (config: Config) => {
  const calls: string[] = []

  const ctx = {
    config: { cwd: '/app', ...config },
    createSheet: () => ({}),
    parseFiles: () => ({ files: [], results: [] }),
    messages: { buildComplete: () => '', cssArtifactComplete: () => '' },
    appendLayerParams: () => {},
    appendBaselineCss: () => {},
    appendParserCss: () => {},
    pruneTokens: () => calls.push('tokens'),
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
  test('neither flag prunes nothing', async () => {
    expect(await run({})).toEqual([])
  })

  test('pruneUnusedKeyframes alone still prunes keyframes', async () => {
    expect(await run({ pruneUnusedKeyframes: true })).toEqual(['keyframes'])
  })

  test('pruneUnusedTokens alone does not prune keyframes', async () => {
    expect(await run({ pruneUnusedTokens: true })).toEqual(['tokens'])
  })

  test('both flags run both passes', async () => {
    expect(await run({ pruneUnusedTokens: true, pruneUnusedKeyframes: true })).toEqual(['tokens', 'keyframes'])
  })

  test('minimal skips both, since it omits the token layer entirely', async () => {
    expect(await run({ pruneUnusedTokens: true, pruneUnusedKeyframes: true }, { minimal: true })).toEqual([])
  })
})
