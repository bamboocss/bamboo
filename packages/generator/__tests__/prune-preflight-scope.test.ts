import { createGeneratorContext } from '@bamboocss/fixture'
import { describe, expect, test } from 'vitest'

/**
 * `prunePreflight` against the reset the generator actually emits, rather than against a
 * hand-written stylesheet.
 *
 * The unit tests in `core` feed it selector strings, so all of them keep passing if
 * `generateResetCss` changes what it writes — which is how the scoped case came to be broken
 * in the first place. `preflight: { scope }` puts the scope on every selector, and nothing
 * that carries a scope names an element until the scope comes off, so the pass matched
 * nothing and removed nothing while reporting success.
 *
 * The assertion is parity on rules: a scope changes which selectors the reset is written
 * with, never which elements it is about, so every shape has to remove the same rules the
 * unscoped reset removes. That covers the shapes nobody thought to enumerate — a trimmed
 * scope, a selector list, an id, an attribute — without a case per shape.
 *
 * Parts are counted per scope alternative rather than per rule, because a scope that is a
 * list is distributed across the selector: `.a, .b` writes `.a table, .b table`, which really
 * is two parts to remove rather than one. Stating the multiplier keeps that visible instead
 * of letting a list quietly assert half as much.
 */
const prune = (preflight: unknown) => {
  const ctx: any = createGeneratorContext({ preflight, prunePreflight: true } as any)
  const sheet = ctx.createSheet()

  ctx.appendCssOfType('preflight', sheet)

  return ctx.prunePreflight(sheet, new Set(['div', 'span', 'table']))
}

describe('prunePreflight against the emitted reset', () => {
  const baseline = prune(true)

  test('removes something to begin with, or the parity below proves nothing', () => {
    expect(baseline.removedRules).toBeGreaterThan(0)
    expect(baseline.removedParts).toBeGreaterThan(0)
  })

  test.each([
    ['class scope', { scope: '.app' }, 1],
    ['class scope, element level', { scope: '.app', level: 'element' }, 1],
    ['id scope', { scope: '#app' }, 1],
    ['id scope, element level', { scope: '#app', level: 'element' }, 1],
    ['attribute scope', { scope: '[data-app]' }, 1],
    ['compound scope', { scope: '.a.b' }, 1],
    // The config carries the string verbatim, so both of these reached `unscope` as written.
    ['scope with stray whitespace', { scope: ' .app ' }, 1],
    ['scope that is a selector list', { scope: '.a, .b' }, 2],
  ])('%s removes exactly what the unscoped reset removes', (_label, preflight, alternatives) => {
    const scoped = prune(preflight)

    expect(scoped.removedRules).toBe(baseline.removedRules)
    expect(scoped.removedParts).toBe(baseline.removedParts * alternatives)
  })
})
