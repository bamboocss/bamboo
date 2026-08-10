import { createRuleProcessor } from './fixture'
import { describe, expect, test } from 'vitest'

/**
 * A config recipe called with a variant the build cannot read.
 *
 * The encoder used to hash only `{...defaultVariants, ...selection}`, so
 * `buttonStyle({ size })` with a dynamic `size` emitted the default's rule and nothing else.
 * At runtime `size="sm"` then put `buttonStyle--size_sm` on the element with no rule behind it
 * — silently unstyled, with no diagnostic anywhere.
 *
 * The premise was written down and wrong: `hashInlineRecipe`'s comment says a config recipe
 * "can emit only what is used because its call sites name their variants statically". They do
 * not have to.
 *
 * The inline path already emitted every declared value for exactly this reason. This does the
 * same, but only for the axes a call site actually left dynamic — a project whose recipe calls
 * are all static emits what it always did.
 */
describe('a config recipe with a dynamic variant', () => {
  test('emits a rule for every value that axis can take', () => {
    const css =
      createRuleProcessor()
        .recipe('buttonStyle', {}, new Set(['size']))
        ?.toCss() ?? ''

    expect(css).toContain('buttonStyle--size_sm')
    expect(css).toContain('buttonStyle--size_md')
  })

  test('a static call still emits only the value it selected', () => {
    const css = createRuleProcessor().recipe('buttonStyle', { size: 'sm' })?.toCss() ?? ''

    expect(css).toContain('buttonStyle--size_sm')
    expect(css).not.toContain('buttonStyle--size_md')
  })

  /** An axis that is not declared must not enumerate anything, nor throw. */
  test('ignores an unresolved key that names no variant', () => {
    const css =
      createRuleProcessor()
        .recipe('buttonStyle', {}, new Set(['nope', 'toString']))
        ?.toCss() ?? ''

    expect(css).not.toContain('nope')
    expect(css).toContain('buttonStyle')
  })
})
