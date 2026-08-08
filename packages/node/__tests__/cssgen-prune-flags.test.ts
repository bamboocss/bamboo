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
    appendCssOfType: (type: string) => calls.push(`append:${type}`),
    prunePreflight: () => calls.push('preflight'),
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

  test('prunePreflight is a third independent switch', async () => {
    expect(await run({ prunePreflight: true })).toEqual(['tokens', 'preflight', 'keyframes'])
    expect(await run({ prunePreflight: true, pruneUnusedTokens: false, pruneUnusedKeyframes: false })).toEqual([
      'properties',
      'preflight',
    ])
  })
})

/**
 * `cssgen --type <name>` writes one artifact rather than the whole sheet, so it takes a branch
 * of its own -- and that branch used to prune nothing at all, which made the `reset.css` from
 * `cssgen preflight` disagree with the one a full run produced for the same project.
 *
 * Only the preflight pass belongs here. The token and keyframe passes decide reachability by
 * reading the finished stylesheet, and on a sheet holding a single artifact everything reads
 * as unreachable; this one reads your source instead, so a partial sheet costs it nothing.
 */
describe('cssgen --type', () => {
  test('prunes the reset it emits', async () => {
    expect(await run({ prunePreflight: true }, { type: 'preflight' })).toEqual(['append:preflight', 'preflight'])
  })

  test('leaves it alone when the flag is off', async () => {
    expect(await run({}, { type: 'preflight' })).toEqual(['append:preflight'])
  })

  test.each(['tokens', 'keyframes', 'static', 'global'] as const)(
    'never prunes for --type %s, which would see a partial sheet',
    async (type) => {
      expect(await run({ prunePreflight: true, pruneUnusedTokens: true }, { type })).toEqual([`append:${type}`])
    },
  )
})
