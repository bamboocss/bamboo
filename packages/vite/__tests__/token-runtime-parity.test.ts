import { createContext } from '@bamboocss/fixture'
import { describe, expect, test } from 'vitest'
// Reached by path rather than through the package entry, which does not export it. Source
// rather than `dist`, so this compares the current tree against itself — a stale build would
// otherwise let real drift pass.
import { generateTokenJs } from '../../generator/src/artifacts/js/token'
import { createRuntimeToken, createRuntimeTokenValue } from '../src/runtime-css'

/**
 * The fold's token table against the one codegen writes into the project.
 *
 * `tokenValuesFor` in `runtime-css.ts` is a second, hand-maintained copy of what
 * `generateTokenJs` emits — the fold has to answer a `token()` call exactly as the runtime it
 * is replacing would have, and the two live in different packages with nothing joining them.
 * That is the same drift shape as `recipe-runtime-parity.test.ts`, and it is not hypothetical:
 * the reference half of both copies was taken from `varRef`, which is the *positive*
 * counterpart's variable for a negative token, so `token('spacing.-4')` resolved to a positive
 * length on both sides. Agreeing with each other is not enough — `generate-token-js.test.ts`
 * pins the generated map against the token view, and this pins the fold against that map.
 *
 * Counted over every token rather than sampled, so a new category cannot quietly opt out.
 */
const parseGeneratedMap = (js: string) =>
  JSON.parse(js.match(/const tokens = ([\s\S]*?)\n\nexport function/)![1]!) as Record<
    string,
    { value: unknown; variable: string }
  >

describe('fold token table matches the generated runtime', () => {
  const configs: Array<[string, Parameters<typeof createContext>[0]]> = [
    ['the default theme', undefined],
    [
      'a theme with conditional and negative spacing',
      {
        theme: {
          extend: {
            tokens: { spacing: { gutter: { value: '2rem' } } },
            semanticTokens: {
              spacing: { inset: { value: { base: '{spacing.4}', _dark: '{spacing.8}' } } },
              colors: { primary: { value: { base: '{colors.red.500}', _dark: '{colors.red.400}' } } },
            },
          },
        },
      },
    ],
  ]

  for (const [name, config] of configs) {
    test(`agrees on both halves for ${name}`, () => {
      const ctx = createContext(config)
      const generated = parseGeneratedMap(generateTokenJs(ctx).js)

      const runtimeToken = createRuntimeToken(ctx)
      const runtimeTokenValue = createRuntimeTokenValue(ctx)

      const drift: Array<{ path: string; half: string; generated: unknown; fold: unknown }> = []

      for (const [path, entry] of Object.entries(generated)) {
        const folded = runtimeToken(path)
        if (folded !== entry.variable) {
          drift.push({ path, half: 'variable', generated: entry.variable, fold: folded })
        }

        // The value side declines a non-string rather than inlining it, since a number folded
        // as `123` is not the number the runtime returns. That is a deliberate decline, not
        // drift, so only string values are compared.
        const foldedValue = runtimeTokenValue(path)
        if (typeof entry.value === 'string' && foldedValue !== entry.value) {
          drift.push({ path, half: 'value', generated: entry.value, fold: foldedValue })
        }
      }

      expect(drift).toEqual([])
    })
  }

  /** The shape that broke both copies at once, named so a failure explains itself. */
  test('a negative token keeps its sign on both sides', () => {
    const ctx = createContext()

    expect(createRuntimeToken(ctx)('spacing.-4')).toBe('calc(var(--spacing-4) * -1)')
    expect(createRuntimeTokenValue(ctx)('spacing.-4')).toBe('calc(var(--spacing-4) * -1)')
  })
})
