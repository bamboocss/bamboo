import type { Config } from '@bamboocss/types'
import { describe, expect, test } from 'vitest'
import { cssgen } from '../src/cssgen'
import { pruneTokensForBuild } from '../src/token-references'

/**
 * `prune.tokens` and `prune.keyframes` are independent switches.
 *
 * Both prune passes gather their reference set by reading every source file, so both sit
 * behind a flag. Sharing one gate is the easy mistake, and it fails silently in the
 * direction users notice least: setting `prune: { keyframes: false }` produces no error,
 * no warning, and keyframes vanish anyway. The generator-level tests cannot catch it —
 * they call `ctx.pruneKeyframes` directly, below this wiring.
 *
 * This context is hand-built rather than a real one, so it does not pick up the defaults
 * `Context` applies. It merges `prune` per key exactly as `defaults` in
 * `packages/core/src/context.ts` does, so a case states only the flag it is about — and so
 * that a nested object spread over a default cannot quietly drop its siblings here while the
 * real build merges them.
 */
const createContext = (config: Config) => {
  const calls: string[] = []

  const ctx = {
    config: { cwd: '/app', ...config, prune: { tokens: true, keyframes: true, ...config.prune } },
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
    expect(await run({ prune: { tokens: false, keyframes: false } })).toEqual(['properties'])
  })

  test('pruneUnusedKeyframes alone still prunes keyframes', async () => {
    expect(await run({ prune: { tokens: false, keyframes: true } })).toEqual(['properties', 'keyframes'])
  })

  test('pruneUnusedTokens alone does not prune keyframes', async () => {
    expect(await run({ prune: { tokens: true, keyframes: false } })).toEqual(['tokens'])
  })

  test('minimal skips both, since it omits the token layer entirely', async () => {
    expect(await run({ prune: { tokens: true, keyframes: true } }, { minimal: true })).toEqual([])
  })

  test('prunePreflight is a third independent switch', async () => {
    expect(await run({ prune: { preflight: true } })).toEqual(['tokens', 'preflight', 'keyframes'])
    expect(await run({ prune: { preflight: true, tokens: false, keyframes: false } })).toEqual([
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
    expect(await run({ prune: { preflight: true } }, { type: 'preflight' })).toEqual(['append:preflight', 'preflight'])
  })

  test('leaves it alone when the flag is off', async () => {
    expect(await run({}, { type: 'preflight' })).toEqual(['append:preflight'])
  })

  test.each(['tokens', 'keyframes', 'static', 'global'] as const)(
    'never prunes for --type %s, which would see a partial sheet',
    async (type) => {
      expect(await run({ prune: { preflight: true, tokens: true } }, { type })).toEqual([`append:${type}`])
    },
  )
})

/**
 * The `false` branch, checked directly rather than through one entrypoint.
 *
 * `pruneTokensForBuild` exists because this conditional was written out three times — in
 * `cssgen`, `builder` and twice in `generate` — and one copy lost its `else`. A watch rebuild
 * with `prune: { tokens: false }` then skipped `pruneTokens` altogether and kept `@property`
 * registrations that a full build of the same source strips, so the stylesheet you developed
 * against differed from the one you shipped. Two of the copies carried a comment pointing at
 * the third for the reasoning, which is what made the gap read as deliberate.
 *
 * The flag cases above go through `cssgen`; these go straight at the shared helper, since the
 * watch path that actually broke is inside a `chokidar` callback and is not reachable from a
 * test without standing up a watcher.
 */
describe('pruneTokensForBuild', () => {
  const run = (config: Config) => {
    const { ctx, calls } = createContext(config)
    pruneTokensForBuild(ctx, {} as never, [])
    return calls
  }

  test('prunes tokens when the flag is on', () => {
    expect(run({ prune: { tokens: true } })).toEqual(['tokens'])
  })

  test('still prunes the @property registrations when the flag is off', () => {
    expect(run({ prune: { tokens: false } })).toEqual(['properties'])
  })
})
