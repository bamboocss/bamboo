import { describe, expect, test } from 'vitest'
import { parseAndExtract } from './fixture'

/**
 * A recipe's classes are named from a hash of its config, so a declaration the build cannot
 * see changes the hash — the build emits rules under one name, the browser asks for another,
 * and the element renders with no styles at all.
 *
 * That is worse than the `css()` case this detection was originally written for. Grouping
 * degrades: the runtime falls back to naming each declaration and the build emits atomic
 * rules alongside the group, so what it *did* resolve still applies. A diverged hash has no
 * such fallback, which is why this check is not gated on `cssMode`.
 */
const reasons = (call: string) =>
  parseAndExtract(
    `import { cva, sva } from 'styled-system/css'\nimport { shared } from './shared'\nexport const a = ${call}`,
  ).parserResult.unresolved.map((entry) => `${entry.kind}/${entry.reason}/${entry.prop ?? '-'}`)

describe('a recipe config the build cannot fully read', () => {
  test('a spread inside base is reported, with its path', () => {
    expect(reasons(`cva({ base: { ...shared, color: 'red' } })`)).toEqual(['recipe/unenumerable-keys/base'])
  })

  test('a spread inside a variant is reported, with its path', () => {
    expect(reasons(`cva({ base: { color: 'red' }, variants: { size: { sm: { ...shared } } } })`)).toEqual([
      'recipe/unenumerable-keys/variants.size.sm',
    ])
  })

  test('a spread of the whole config is reported', () => {
    expect(reasons(`cva({ ...shared, base: { color: 'red' } })`)).toEqual(['recipe/unenumerable-keys/-'])
  })

  test('a slot recipe reports the slot it lost', () => {
    expect(reasons(`sva({ slots: ['root'], base: { root: { ...shared, color: 'red' } } })`)).toEqual([
      'recipe/unenumerable-keys/base.root',
    ])
  })

  test('a recipe that names itself is not reported', () => {
    // `getRecipeIdentity` short-circuits on `className` and never hashes the styles, so
    // extraction fidelity stops deciding the name. The loss degrades to the missing
    // declarations alone, which is what the `css()` case has always done.
    expect(reasons(`cva({ className: 'btn', base: { ...shared, color: 'red' } })`)).toEqual([])
  })

  test('a fully static recipe is not reported', () => {
    expect(reasons(`cva({ base: { color: 'red' }, variants: { size: { sm: { padding: '2' } } } })`)).toEqual([])
  })

  test('a resolvable spread is not reported', () => {
    // The keys arrive, so nothing was lost — the check compares what was written against
    // what resolved rather than assuming a spread is fatal.
    expect(reasons(`cva({ base: { ...{ margin: '2' }, color: 'red' } })`)).toEqual([])
  })
})
