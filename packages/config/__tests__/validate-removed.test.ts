import { describe, expect, test } from 'vitest'
import { validateConfig } from '../src/validate-config'

/**
 * Options that were removed have to be *reported*, because nothing else notices them.
 *
 * An unknown config key is otherwise ignored in silence — there is no schema walk, so a config
 * still setting `pruneUnusedTokens: 'strict'` would build clean, prune by the default instead,
 * and stop enforcing the assertion it asked for. That is the failure this exists to prevent, and
 * it is the reason the three flags could be renamed at all.
 */
const messagesFor = (config: object) => Array.from(validateConfig(config as never) ?? [])

describe('removed config options', () => {
  test('names the replacement rather than reporting an unknown key', () => {
    expect(messagesFor({ pruneUnusedTokens: 'strict' })).toEqual([
      expect.stringContaining(`prune: { tokens: 'accounted', unresolvedPath: 'error' }`),
    ])
  })

  /** The value carries over, so the message is the edit rather than a description of one. */
  test.each([
    [{ pruneUnusedTokens: false }, "prune: { tokens: 'off' }"],
    [{ pruneUnusedKeyframes: false }, 'prune: { keyframes: false }'],
    [{ prunePreflight: true }, 'prune: { preflight: true }'],
  ])('%o reports its replacement', (config, expected) => {
    expect(messagesFor(config)).toEqual([expect.stringContaining(expected)])
  })

  test('reports each removed option a config still sets', () => {
    expect(messagesFor({ pruneUnusedTokens: true, prunePreflight: true })).toHaveLength(2)
  })

  test('says nothing about the option that replaced them', () => {
    expect(messagesFor({ prune: { tokens: 'off', unresolvedPath: 'error' } })).toEqual([])
  })

  /** The nested rename, which the top-level scan cannot see. */
  test('reports `prune.unresolved`, which moved and split', () => {
    expect(messagesFor({ prune: { unresolved: 'error' } })).toEqual([
      expect.stringContaining(`prune: { tokens: 'accounted', unresolvedPath: 'error' }`),
    ])
  })

  /** A value change rather than a key removal, so nothing else would notice it either. */
  test('reports the boolean `prune.tokens` took before it became a strategy', () => {
    expect(messagesFor({ prune: { tokens: true } })).toEqual([expect.stringContaining("'reachable'")])
  })

  test("reports `validation: 'none'`, which is now 'off'", () => {
    expect(messagesFor({ validation: 'none' })).toEqual([expect.stringContaining(`validation: 'off'`)])
  })

  /**
   * `validation: 'error'` turns every config finding into a throw, so an upgrade can be made to
   * fail rather than warn.
   */
  test('throws under validation: error', () => {
    expect(() => validateConfig({ pruneUnusedTokens: 'strict', validation: 'error' } as never)).toThrow(
      /prune: \{ tokens: 'accounted', unresolvedPath: 'error' \}/,
    )
  })
})
