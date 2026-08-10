import { createGeneratorContext } from '@bamboocss/fixture'
import type { Config } from '@bamboocss/types'
import { describe, expect, test } from 'vitest'

/**
 * Both pruning passes decide what is reachable by scanning the emitted stylesheet, so a
 * rule they cannot see makes whatever it references look unused. `viewTransition()` emits
 * into the utilities layer for exactly this reason — a keyframe or token that only a
 * transition names has to survive, and the failure mode is a transition that animates
 * against a `@keyframes` that is no longer there.
 */
const KEYFRAMES = {
  'fade-in': { from: { opacity: '0' }, to: { opacity: '1' } },
  spin: { to: { transform: 'rotate(360deg)' } },
}

const buildCss = (options: Record<string, any>, userConfig?: Config) => {
  const ctx = createGeneratorContext({
    theme: { extend: { keyframes: KEYFRAMES } },
    ...userConfig,
  })

  ctx.encoder.processViewTransition(options)

  const sheet = ctx.createSheet()
  ctx.appendLayerParams(sheet)
  ctx.appendBaselineCss(sheet)
  ctx.appendParserCss(sheet)
  // `tokensReachableFromJs: false`, because the question here is whether a transition rule
  // roots the token it names. With it true `token()` could hand back any token's reference,
  // every declaration is kept, and the walk under test never gets to decide anything.
  ctx.pruneTokens(sheet, undefined, false)
  ctx.pruneKeyframes(sheet)

  return ctx.getCss(sheet)
}

const declaresKeyframe = (css: string, name: string) => new RegExp(`@keyframes\\s+${name}\\b`).test(css)
const declaresToken = (css: string, name: string) => new RegExp(`\\${name}\\s*:`).test(css)

describe('view transition pruning', () => {
  test('keeps a keyframe only a transition names', () => {
    const css = buildCss({ old: { animationName: 'fade-in' } }, { prune: { keyframes: true } })

    expect(declaresKeyframe(css, 'fade-in')).toBe(true)
    // The control: the other keyframe is genuinely unreachable and still goes.
    expect(declaresKeyframe(css, 'spin')).toBe(false)
  })

  test('keeps a keyframe named through the animation shorthand', () => {
    const css = buildCss({ group: { animation: 'fade-in 1s ease-out' } }, { prune: { keyframes: true } })

    expect(declaresKeyframe(css, 'fade-in')).toBe(true)
  })

  test('keeps a token only a transition references', () => {
    const css = buildCss({ group: { bg: 'red.300' } }, { prune: { tokens: 'reachable' } })

    expect(declaresToken(css, '--colors-red-300')).toBe(true)
    expect(declaresToken(css, '--colors-pink-500')).toBe(false)
  })

  test('keeps a token referenced from inside a condition', () => {
    const css = buildCss({ group: { _motionReduce: { bg: 'red.300' } } }, { prune: { tokens: 'reachable' } })

    expect(declaresToken(css, '--colors-red-300')).toBe(true)
  })
})

/**
 * Build info is how one project ships styles another consumes without re-scanning the
 * source. A bag survives that round trip as its finalized class plus its slot bodies —
 * there are no per-declaration hashes to rebuild it from, so if this drops the CSS is
 * simply gone on the consuming side.
 */
describe('view transition build info', () => {
  const emit = (ctx: ReturnType<typeof createGeneratorContext>) => {
    const sheet = ctx.createSheet()
    ctx.appendLayerParams(sheet)
    ctx.appendParserCss(sheet)
    return ctx.getCss(sheet)
  }

  test('survives a toJSON/fromJSON round trip', () => {
    const producer = createGeneratorContext()
    producer.encoder.processViewTransition({ old: { animationName: 'fade-in' } })

    const consumer = createGeneratorContext()
    consumer.encoder.fromJSON(producer.encoder.toJSON())

    expect(emit(consumer)).toBe(emit(producer))
    expect(emit(consumer)).toContain('::view-transition-old(')
  })

  test('carries the producing config prefix, not the consuming one', () => {
    const producer = createGeneratorContext({ prefix: 'ship' })
    producer.encoder.processViewTransition({ old: { animationName: 'fade-in' } })

    const consumer = createGeneratorContext({ prefix: 'app' })
    consumer.encoder.fromJSON(producer.encoder.toJSON())

    // The class is stored finalized, so the consumer emits rules matching the class the
    // producing library's own runtime hands its callers.
    const css = emit(consumer)
    expect(css).toContain('.ship-vt_')
    expect(css).not.toContain('.app-vt_')
  })

  test('omits the key entirely when there are none', () => {
    const ctx = createGeneratorContext()
    expect(ctx.encoder.toJSON().styles).not.toHaveProperty('viewTransitions')
  })
})
