import { describe, expect, test } from 'vitest'
import { createFoldFixture, selectorsFor } from './fixture'

describe('config slot recipes', () => {
  test('compiles a statically selected slot to declaration atoms', () => {
    const fixture = createFoldFixture()
    const result = fixture.fold(
      `import { checkbox } from '../styled-system/recipes'\nexport const root = checkbox({ size: 'sm' }).root`,
    )

    const call = result.folded.find((entry) => entry.kind === 'class')
    expect(call?.className).toBe(fixture.runtimeCss({ display: 'flex', alignItems: 'center', gap: '2' }))
    expect(call?.className).not.toContain('checkbox')

    const css = fixture.getStyleSetCss()
    for (const selector of selectorsFor(call!.className)) expect(css).toContain(selector)
  })

  test('compiles a runtime selection without retaining a slot runtime', () => {
    const code = `import { checkbox } from '../styled-system/recipes'\ndeclare const size: 'sm' | 'md'\nexport const root = checkbox({ size }).root`
    const result = createFoldFixture().fold(code)
    expect(result.code).not.toContain('checkbox({ size })')
    expect(result.code).not.toContain('checkbox__root')
    expect(result.folded).toContainEqual(expect.objectContaining({ kind: 'class' }))
    expect(result.skipped).toHaveLength(0)
  })

  test('compiles the whole slot object with one atom string per slot', () => {
    const result = createFoldFixture().fold(
      `import { checkbox } from '../styled-system/recipes'\nexport const slots = checkbox({ size: 'sm' })`,
    )
    expect(result.folded).toContainEqual(expect.objectContaining({ kind: 'slots' }))
    expect(result.code).toContain('"root"')
    expect(result.code).toContain('"control"')
    expect(result.code).toContain('"label"')
    expect(result.skipped).toHaveLength(0)
  })

  test('does not widen arbitrary member access ranges', () => {
    const css = createFoldFixture().fold(
      `import { css } from '../styled-system/css'\nexport const value = css({ color: 'red' }).trim()`,
    )
    expect(css.code).toContain('"c_red".trim()')

    const recipe = createFoldFixture().fold(
      `import { buttonStyle } from '../styled-system/recipes'\nexport const value = buttonStyle({ size: 'sm' }).length`,
    )
    expect(recipe.code).toContain('.length')
    expect(recipe.code).not.toContain('buttonStyle--')
  })

  test('leaves recipe object members such as raw untouched', () => {
    const result = createFoldFixture().fold(
      `import { checkbox } from '../styled-system/recipes'\nexport const raw = checkbox({ size: 'sm' }).raw`,
    )
    expect(result.code).toContain('.raw')
  })
})
