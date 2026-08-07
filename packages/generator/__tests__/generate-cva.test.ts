import { createGeneratorContext } from '@bamboocss/fixture'
import { describe, expect, test } from 'vitest'
import { generateCvaFn } from '../src/artifacts/js/cva'

describe('generate cva', () => {
  /**
   * `cva` names its classes the way a config recipe does — `name--variant_value`, from the
   * config — rather than by property. That is what puts it in the `recipes` layer, so a
   * consumer's `css()` beats it by cascade rather than by stylesheet order.
   *
   * It used to call `__atomicCss(resolve(props))`: resolve the whole style object, then
   * name a class per property. Reaching for the shared `css` instead would have returned a
   * grouped class no rule was emitted for, which is why the atomic seam existed at all.
   * Semantic naming removes the question.
   */
  test('names classes semantically, without resolving styles', () => {
    const { js } = generateCvaFn(createGeneratorContext() as any)

    expect(js).toContain('getRecipeClassNames(name, variants, getVariantProps(props)')
    expect(js).not.toContain('__atomicCss')

    // `resolve` still exists, for `raw()` — which returns styles rather than classes — so
    // the check is that `cvaFn` is not what calls it. Asserted against the function body
    // rather than the whole artifact, which discusses the old shape in a comment.
    const start = js.indexOf('function cvaFn')
    expect(start).toBeGreaterThan(-1)
    const body = js.slice(start, start + 200)
    expect(body).toContain('getRecipeClassNames')
    expect(body).not.toContain('resolve(props)')
  })

  test('derives the name from the config, not from a build-time rewrite', () => {
    // The runtime and the build each derive this independently, so it has to come from
    // something both of them see. See `getRecipeIdentity`.
    const { js } = generateCvaFn(createGeneratorContext() as any)
    expect(js).toContain('const name = getRecipeIdentity(config)')
  })

  test('applies the same prefix and hashing the stylesheet does', () => {
    const hashed = generateCvaFn(createGeneratorContext({ hash: true, prefix: 'bam' }) as any).js
    // `checkNamingAgreement` compares the two derivations; this is the half that lives here.
    expect(hashed).toContain('formatRecipeClass')
    expect(hashed).toContain('"bam"')
    expect(hashed).toContain('toHash')

    const plain = generateCvaFn(createGeneratorContext() as any).js
    // No prefix and no hash means the formatter is the identity, costing nothing.
    expect(plain).toContain('const withPrefix = (className) => className')
  })
})
