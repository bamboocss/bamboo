import { createContext } from '@bamboocss/fixture'
import type { Config } from '@bamboocss/types'
import { describe, expect, test } from 'vitest'
import { checkNamingAgreement } from '../src/naming-agreement'

/**
 * The stylesheet and the runtime each derive a class name, and they only meet in the DOM.
 * `checkNamingAgreement` is what stops a disagreement reaching a browser, so it has to be
 * wrong in neither direction: a false positive fails every build, and a false negative is
 * the silent blank page it exists to prevent.
 */
const check = (config: Config) => checkNamingAgreement(createContext(config) as never)

describe('checkNamingAgreement', () => {
  // Every combination of the options that feed a class name. `grouped` x `hash` is the one
  // that was broken, and it was broken because nothing enumerated the pair.
  const configs: Array<[string, Config]> = [
    ['atomic', {}],
    ['atomic + hash', { hash: true }],
    ['atomic + prefix', { prefix: 'bam' }],
    ['atomic + hash + prefix', { hash: true, prefix: 'bam' }],
    ['grouped', { cssMode: 'grouped' }],
    ['grouped + hash', { cssMode: 'grouped', hash: true }],
    ['grouped + prefix', { cssMode: 'grouped', prefix: 'bam' }],
    ['grouped + hash + prefix', { cssMode: 'grouped', hash: true, prefix: 'bam' }],
    ['separator', { separator: '-' }],
    ['grouped + separator', { cssMode: 'grouped', separator: '-' }],
  ]

  test.each(configs)('agrees: %s', (_name, config) => {
    expect(check(config)).toBeUndefined()
  })

  // A disagreement is only ever two sides configured differently, so that is what is
  // simulated: an encoder and decoder built without a prefix, asked about a utility that
  // has one. Reverting the real defect is not expressible from a test, but this exercises
  // the same shape — the stylesheet naming one class and the runtime asking for another.
  test('catches a build and runtime that were configured differently', () => {
    const plain = createContext({ cssMode: 'grouped' })
    const prefixed = createContext({ cssMode: 'grouped', prefix: 'bam' })

    // Spelled out rather than spread: `Context` exposes `config` through a getter, and a
    // spread would drop it.
    const result = checkNamingAgreement({
      config: plain.config,
      conditions: plain.conditions,
      hash: plain.hash,
      encoder: plain.encoder,
      decoder: plain.decoder,
      // The one difference — the runtime resolves through a prefixed utility while the
      // stylesheet was encoded without one.
      utility: prefixed.utility,
    } as never)

    expect(result).toBeDefined()
    expect(result!.mode).toBe('grouped')
    expect(result!.runtime.every((name) => name.startsWith('bam-'))).toBe(true)
    expect(result!.build.some((name) => name.startsWith('bam-'))).toBe(false)
  })

  test('the canary never reaches the caller stylesheet', () => {
    const ctx = createContext({ cssMode: 'grouped' })
    checkNamingAgreement(ctx as never)

    // `check` runs on clones, so the context's own encoder is still untouched.
    expect(ctx.encoder.isEmpty()).toBe(true)
    expect(ctx.decoder.isEmpty()).toBe(true)
  })
})
