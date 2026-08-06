import { createGeneratorContext } from '@bamboocss/fixture'
import { describe, expect, test } from 'vitest'
import { generateCvaFn } from '../src/artifacts/js/cva'

describe('generate cva', () => {
  // `cva` variants are extracted atomically whatever `cssMode` says, since the combinations a
  // caller selects are not knowable at build time. Reaching for the shared `css` would return
  // a grouped class no rule was emitted for, and the element would render unstyled.
  test('names classes through the atomic seam, not the shared css', () => {
    const { js } = generateCvaFn(createGeneratorContext() as any)
    expect(js).toContain('__atomicCss(resolve(props))')
    // Lowercase `css` never occurs in `__atomicCss`, so this catches a revert to the shared one.
    expect(js).not.toMatch(/\bcss\(resolve\(props\)\)/)
  })
})
