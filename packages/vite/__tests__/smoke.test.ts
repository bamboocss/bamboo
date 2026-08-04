import { describe, expect, test } from 'vitest'
import { createFoldFixture } from './fixture'

describe('fold smoke', () => {
  test('folds a simple css() call', () => {
    const { fold } = createFoldFixture()

    const result = fold(`
      import { css } from 'styled-system/css'
      export const cls = css({ color: 'red.300' })
    `)

    expect(result.folded).toHaveLength(1)
    expect(result.code).toContain('export const cls = "c_red.300"')
  })
})
