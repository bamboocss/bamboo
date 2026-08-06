import { describe, expect, test } from 'vitest'
import { createFoldFixture, selectorsFor } from './fixture'

/**
 * Under `cssMode: 'grouped'` a class names a whole `css()` call, so splitting one call
 * across several class names is only sound when a single piece carries the whole object.
 * A split hashes a fragment on each side, and where the build emitted no rule for that
 * fragment the element renders with no styles at all.
 */
const foldGrouped = (code: string) => {
  const { fold, getCss } = createFoldFixture({ cssMode: 'grouped' })
  const result = fold(code)
  const css = getCss()
  // `classNames` carries both arms of every ternary, which the replacement text alone
  // would not, and `selectorsFor` is the fixture's forward transform into selector form.
  const missing = result.folded
    .filter((call) => call.kind === 'class')
    .flatMap((call) => call.classNames)
    .flatMap(selectorsFor)
    .filter((selector) => !css.includes(selector))
  return { code: result.code, missing }
}

describe('folding a css() call under cssMode: grouped', () => {
  test('a fully static call folds, and its class has a rule', () => {
    const { code, missing } = foldGrouped(
      `import { css } from "styled-system/css"\nexport const a = css({ margin: '2', color: 'red.300' })`,
    )
    expect(code).not.toContain('css({')
    expect(missing).toEqual([])
  })

  test('branches alone fold, because each one is a complete object', () => {
    const { missing } = foldGrouped(
      `import { css } from "styled-system/css"\nexport const a = (c) => css({ color: c ? 'red.300' : 'green.300' })`,
    )
    expect(missing).toEqual([])
  })

  test('a branch beside another property is left on its runtime call', () => {
    // Folded, this produced three class names and the build emitted a rule for none.
    const { code, missing } = foldGrouped(
      `import { css } from "styled-system/css"\nexport const a = (c) => css({ margin: '2', color: c ? 'red.300' : 'green.300' })`,
    )
    expect(code).toContain('css({')
    expect(missing).toEqual([])
  })

  test('two branches are left alone, because the build emits their product', () => {
    // Each ternary alone is two whole objects, but together the build emits the four
    // combinations. Folding them per property writes four fragments that match none of it.
    const { code, missing } = foldGrouped(
      `import { css } from "styled-system/css"
       export const a = (c, d) => css({ color: c ? 'red.300' : 'green.300', padding: d ? '2' : '4' })`,
    )
    expect(code).toContain('css({')
    expect(missing).toEqual([])
  })

  test('a dynamic value beside a static one keeps the call whole', () => {
    const { code, missing } = foldGrouped(
      `import { css } from "styled-system/css"\nexport const a = (tone) => css({ margin: '2', color: tone })`,
    )
    // The hoisted half does have a rule in this shape — the build recorded exactly it — so
    // the split is declined for uniformity with the shapes below rather than for a missing
    // rule. `toContain('css({')` alone would pass unfixed; the absence of `cx` is the tell.
    expect(code).not.toContain('cx(')
    expect(code).toContain(`css({ margin: '2', color: tone })`)
    expect(missing).toEqual([])
  })

  test('a dynamic leaf inside a condition block leaves the hoisted half without a rule', () => {
    // Here the static half really is a fragment: the build hashes `margin` together with
    // the resolved part of `_hover`, so the hoisted `margin`-only group exists nowhere.
    const { code, missing } = foldGrouped(
      `import { css } from "styled-system/css"
       export const a = (tone) => css({ margin: '2', _hover: { color: 'red.300', background: tone } })`,
    )
    expect(code).toContain('css({')
    expect(missing).toEqual([])
  })
})

describe('cssMode: atomic is unaffected', () => {
  const foldAtomic = (code: string) => createFoldFixture().fold(code).code

  test('a branch beside another property still splits', () => {
    const code = foldAtomic(
      `import { css } from "styled-system/css"\nexport const a = (c) => css({ margin: '2', color: c ? 'red.300' : 'green.300' })`,
    )
    expect(code).toContain('m_2')
  })
})
