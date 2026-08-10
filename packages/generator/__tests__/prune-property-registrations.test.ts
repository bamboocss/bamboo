import { createGeneratorContext } from '@bamboocss/fixture'
import { describe, expect, test } from 'vitest'

/**
 * `@property` registrations are pruned on their own switch, not as a side effect of
 * `prune.tokens`.
 *
 * They used to be dropped by the token pass whatever it was set to — so an option documented
 * as keeping every token declaration quietly removed something else, and there was no setting
 * at all that kept them. The two answer to different evidence: a token can be reached by a
 * name no build-time pass sees (`token()` with a path assembled at runtime), and a
 * registration has no such surface, so "does the finished stylesheet mention it" is the whole
 * question for one and not the other.
 *
 * Counted rather than eyeballed, so the assertion says how much was dropped.
 */
const registrations = (config?: object) => {
  const ctx = createGeneratorContext(config as never)
  const sheet = ctx.createSheet()

  ctx.appendLayerParams(sheet)
  ctx.appendBaselineCss(sheet)
  ctx.pruneTokens(sheet)

  return (ctx.getCss(sheet).match(/@property\s/g) ?? []).length
}

describe('prune.propertyRegistrations', () => {
  /** The preset registers what its utilities compose — filters, gradients, transforms. */
  test('the fixture preset registers some to begin with', () => {
    expect(registrations({ prune: { propertyRegistrations: false } })).toBeGreaterThan(0)
  })

  test('drops the unreachable ones by default', () => {
    const kept = registrations({ prune: { propertyRegistrations: false } })

    expect(registrations()).toBeLessThan(kept)
  })

  test('keeps them when asked, which nothing could do before', () => {
    expect(registrations({ prune: { propertyRegistrations: false } })).toBeGreaterThan(registrations())
  })

  /**
   * The pairing that was wrong. `tokens: 'off'` says keep every token declaration; it used to
   * drop the registrations anyway, and now says nothing about them either way.
   */
  test('is independent of prune.tokens', () => {
    const tokensOff = registrations({ prune: { tokens: 'off' } })
    const tokensOffKeepRegistrations = registrations({ prune: { tokens: 'off', propertyRegistrations: false } })

    expect(tokensOff).toBeLessThan(tokensOffKeepRegistrations)
    expect(tokensOff).toBe(registrations({ prune: { tokens: 'reachable' } }))
  })
})
