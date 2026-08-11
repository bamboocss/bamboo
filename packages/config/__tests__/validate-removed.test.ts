import { describe, expect, test } from 'vitest'
import { validateConfig } from '../src/validate-config'

/**
 * Options that were removed have to *fail the build*, because nothing else notices them.
 *
 * An unknown config key is otherwise ignored in silence — there is no schema walk, so a config
 * still setting `pruneUnusedTokens: 'strict'` would build clean, prune by the default instead,
 * and stop enforcing the assertion it asked for. That is the failure this exists to prevent, and
 * it is the reason the three flags could be renamed at all.
 *
 * These removals ship in minor versions, which is what settles the severity: a warning is the
 * thing an automated dependency upgrade merges without a person reading it.
 */
const errorFor = (config: object) => {
  try {
    validateConfig(config as never)
  } catch (error) {
    return (error as Error).message
  }
  return undefined
}

/** Findings, one per line, so a count is a count of options rather than of characters. */
const linesFor = (config: object) => (errorFor(config) ?? '').split('\n').filter((line) => line.startsWith('- '))

describe('removed config options', () => {
  test('names the replacement rather than reporting an unknown key', () => {
    expect(errorFor({ pruneUnusedTokens: 'strict' })).toContain(
      `prune: { tokens: 'accounted', unresolvedPath: 'error' }`,
    )
  })

  /**
   * `hooks` is the one whose merged form used to live on the resolved config, which is what
   * this reads. Reporting it at all depends on resolution keeping the merged hooks off the
   * config object — otherwise every build would trip this.
   */
  test('a config still setting hooks is told to write a plugin', () => {
    expect(errorFor({ hooks: {} })).toContain(`plugins: [{ name: 'my-app', hooks: { ... } }]`)
  })

  test('a config using plugins is not reported', () => {
    expect(errorFor({ plugins: [{ name: 'x', hooks: {} }] })).toBeUndefined()
  })

  /** The value carries over, so the message is the edit rather than a description of one. */
  test.each([
    [{ pruneUnusedTokens: false }, "prune: { tokens: 'off' }"],
    [{ pruneUnusedKeyframes: false }, 'prune: { keyframes: false }'],
    [{ prunePreflight: true }, 'preflight: { prune: true }'],
  ])('%o reports its replacement', (config, expected) => {
    expect(errorFor(config)).toContain(expected)
  })

  test('reports each removed option a config still sets', () => {
    expect(linesFor({ pruneUnusedTokens: true, prunePreflight: true })).toHaveLength(2)
  })

  test('says nothing about the option that replaced them', () => {
    expect(errorFor({ prune: { tokens: 'off', unresolvedPath: 'error' } })).toBeUndefined()
  })

  /** The nested rename, which the top-level scan cannot see. */
  test('reports `prune.unresolved`, which moved and split', () => {
    expect(errorFor({ prune: { unresolved: 'error' } })).toContain(
      `prune: { tokens: 'accounted', unresolvedPath: 'error' }`,
    )
  })

  /**
   * `prune.preflight` is the one a config is most likely to still be carrying, and the one
   * whose silence would be least visible: the reset keeps being emitted either way, just
   * unpruned, so nothing about the output says the setting stopped being read.
   */
  test('reports `prune.preflight`, which moved onto `preflight`', () => {
    expect(errorFor({ prune: { preflight: true } })).toContain('preflight: { prune: true }')
  })

  test('says nothing about the option that replaced it', () => {
    expect(errorFor({ preflight: { scope: '.app', prune: true } })).toBeUndefined()
  })

  /** A value change rather than a key removal, so nothing else would notice it either. */
  test('reports the boolean `prune.tokens` took before it became a strategy', () => {
    expect(errorFor({ prune: { tokens: true } })).toContain("'reachable'")
  })

  test("reports `validation: 'none'`, which is now 'off'", () => {
    expect(errorFor({ validation: 'none' })).toContain(`validation: 'off'`)
  })

  /**
   * The severity is not `validation`'s to set, in either direction.
   *
   * `off` is an opt-out of opinions about a config that still builds. A removed key is not one:
   * it is proof the config predates the version reading it, and switching the check off means
   * the build reverts to the default and says nothing — the upgrade the check exists to prevent.
   */
  test.each(['off', 'warn', 'error'] as const)('throws under validation: %s', (validation) => {
    expect(() => validateConfig({ pruneUnusedTokens: 'strict', validation } as never)).toThrow(
      /prune: \{ tokens: 'accounted', unresolvedPath: 'error' \}/,
    )
  })

  /**
   * Reported ahead of every other finding, rather than alongside them.
   *
   * A config that predates the version is the reason the rest disagrees, so the ordinary
   * findings are downstream noise until it is fixed — and under `validation: 'warn'` they would
   * be the only thing printed while the removed key threw nothing at all.
   */
  test('throws before the ordinary findings are collected', () => {
    const message = errorFor({
      prunePreflight: true,
      theme: { breakpoints: { sm: '640px', md: '48em' } },
    })

    expect(message).toContain('preflight: { prune: true }')
    expect(message).not.toContain('breakpoints')
  })
})
