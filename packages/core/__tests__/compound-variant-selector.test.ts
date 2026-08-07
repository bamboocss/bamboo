import { createRuleProcessor } from '@bamboocss/fixture'
import { describe, expect, test } from 'vitest'

/**
 * A compound variant selects on the variant classes the element already carries, rather
 * than naming a class of its own.
 *
 * It used to be emitted atomically into `utilities`, which put half a recipe in a layer
 * above the other half: a consumer's `css()` could not override the compound half by layer,
 * and the runtime had to compute and join those classes on every call. Selecting on
 * `.btn--size_sm.btn--tone_a` puts the whole recipe in `recipes` and leaves the runtime with
 * nothing to do — the rule matches because both classes are present.
 */
describe('compound variants', () => {
  const processor = () =>
    createRuleProcessor().cva({
      base: { color: 'red' },
      className: 'btn',
      compoundVariants: [
        { css: { fontWeight: 'bold' }, size: 'sm', tone: 'a' },
        { css: { opacity: '0.5' }, size: ['sm', 'md'], tone: 'b' },
      ] as never,
      variants: {
        size: { md: { padding: '4' }, sm: { padding: '2' } },
        tone: { a: { borderColor: 'blue' }, b: { borderColor: 'green' } },
      },
    })

  test('emits a compound selector rather than atomic classes', () => {
    expect(processor().toCss()).toContain('.btn--size_sm.btn--tone_a')
  })

  test('a `OneOrMore` selection becomes a selector list', () => {
    expect(processor().toCss()).toContain('.btn--size_sm.btn--tone_b,.btn--size_md.btn--tone_b')
  })

  test('the whole recipe lands in one layer', () => {
    const css = processor().toCss()
    expect(css).toContain('@layer recipes')
    expect(css).not.toContain('@layer utilities')
  })

  test('contributes no class of its own', () => {
    // The rule matches on classes the element already has. A class here would be one the
    // runtime never returns, and the fold would bake it into a literal.
    expect(processor().getClassNames()).toEqual(['btn--size_md', 'btn--size_sm', 'btn--tone_a', 'btn--tone_b', 'btn'])
  })

  test('outranks the variants it combines, by specificity within the layer', () => {
    const css = processor().toCss()
    // `.a.b` is (0,2,0) against `.a` at (0,1,0), so the compound wins wherever they
    // collide without depending on which was emitted first.
    expect(css.indexOf('.btn--size_sm.btn--tone_a')).toBeGreaterThan(css.indexOf('.btn--size_sm {'))
  })
})

/**
 * A compound's selector is built from class names, so it has to be built the way every
 * other class name is.
 *
 * It was not: the selector string was assembled from raw names while the element carried
 * prefixed or hashed ones, so under either option every compound variant in the project
 * selected nothing. The same defect had already been found and fixed for `@scope` preludes;
 * this is the other place that bypassed `formatSelector`.
 */
describe('the compound selector is built from classes the element carries', () => {
  test.each([
    ['default', {}],
    ['prefix', { prefix: 'bam' }],
    ['hash', { hash: true }],
    ['hash + prefix', { hash: true, prefix: 'bam' }],
    ['separator', { separator: '=' }],
  ])('%s', (_name, config) => {
    const rule = createRuleProcessor(config as never).cva({
      base: { color: 'red' },
      className: 'btn',
      compoundVariants: [{ css: { fontWeight: 'bold' }, size: 'sm', tone: 'a' }] as never,
      variants: { size: { sm: { padding: '2' } }, tone: { a: { borderColor: 'blue' } } },
    })

    const carried = new Set(rule.getClassNames())
    const compound = rule.toCss().match(/^\s*(\.\S+\.\S+) \{/m)?.[1]
    expect(compound).toBeDefined()

    for (const className of compound!.split('.').filter(Boolean)) {
      expect(carried).toContain(className)
    }
  })
})
