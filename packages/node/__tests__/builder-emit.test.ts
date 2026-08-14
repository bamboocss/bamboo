import { describe, expect, test } from 'vitest'
import { Builder } from '../src/builder'

/**
 * What `emit` writes, and when.
 *
 * It is the only thing that puts `styled-system/` on disk for an integration — the PostCSS
 * plugin and the Vite plugin both call it — and for the first call it wrote nothing at all. The
 * guard read `hasEmitted` before the same method had ever set it, so a run started by the flag
 * being false fell straight through, and artifacts appeared only on a *later* call that also
 * carried a config change. A clone with no generated output got none from `vite dev` or
 * `vite build`; every project has had to run the CLI first.
 *
 * The narrowing the guard was reaching for is real and still here: a watch rebuild re-emits only
 * what a config change affected, and one that changed no config writes nothing.
 *
 * A stub context rather than a real one — `codegen` is covered on its own, and what is asserted
 * here is which artifacts `emit` hands it.
 */
const stubBuilder = () => {
  const written: string[] = []
  const builder = new Builder()

  builder.context = {
    config: {},
    // Labelled by what was asked for, so a filtered emit is distinguishable from a full one.
    getArtifacts: (ids?: string[]) => [{ files: [{ file: `${(ids ?? ['all']).join('+')}.mjs`, code: 'x' }] }],
    output: {
      empty: () => {},
      prune: () => ({ removed: 0 }),
      write: (artifact: { files: { file: string }[] }) => {
        for (const { file } of artifact.files) written.push(file)
        return Promise.resolve([])
      },
    },
    hooks: {},
    initMessage: () => '',
    messages: { artifactsGenerated: () => '' },
  } as any

  /** `affecteds` is private, and is set by `setup` from a real config diff. */
  const configChanged = (artifacts: string[] | undefined) => {
    ;(builder as unknown as { affecteds: unknown }).affecteds = artifacts && {
      artifacts: new Set(artifacts),
      hasConfigChanged: true,
    }
  }

  return { builder, configChanged, written }
}

describe('builder.emit', () => {
  test('writes every artifact the first time, which is the only time a clone has none', async () => {
    const { builder, written } = stubBuilder()

    await builder.emit()

    expect(written, 'the whole generated system, not a subset').toEqual(['all.mjs'])
  })

  test('writes nothing again when no config changed', async () => {
    const { builder, written } = stubBuilder()

    await builder.emit()
    written.length = 0
    await builder.emit()

    // Every dev-server regeneration reaches this; rewriting the system each time would be a
    // file event per artifact, which is what the original guard was protecting against.
    expect(written).toEqual([])
  })

  test('writes only the artifacts a later config change affected', async () => {
    const { builder, configChanged, written } = stubBuilder()

    await builder.emit()
    written.length = 0

    configChanged(['css', 'tokens'])
    await builder.emit()

    expect(written).toEqual(['css+tokens.mjs'])
  })
})
