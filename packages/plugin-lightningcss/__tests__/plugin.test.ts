import { describe, expect, test } from 'vitest'
import { pluginLightningcss } from '../src'

/**
 * The optimizer's only integration coverage used to be a `bamboo cssgen --lightningcss` case
 * in the CLI's test, reached through a `lightningcss: true` config flag. Removing the flag —
 * it did nothing `plugins` could not, and forced a native binary into every install — took
 * that coverage with it, so the plugin gets its own.
 *
 * Asserted through the `css:optimize` hook rather than through a build, because the hook is
 * the whole contract: the plugin exists to answer it, and returning `void` is what hands the
 * css back to the default PostCSS optimizer.
 */
describe('pluginLightningcss', () => {
  const optimize = (css: string, args: { minify?: boolean; browserslist?: string[] } = {}) => {
    const hook = pluginLightningcss().hooks?.['css:optimize']
    if (!hook) throw new Error('plugin declares no `css:optimize` hook')

    return hook({ css, ...args })
  }

  test('is named so `plugins` can be read for it', () => {
    expect(pluginLightningcss().name).toBe('@bamboocss/plugin-lightningcss')
  })

  test('answers `css:optimize` rather than falling through to postcss', () => {
    const result = optimize('.a { color: red }')

    expect(typeof result).toBe('string')
    expect(result).toContain('color')
  })

  test('minifies when asked', () => {
    const pretty = optimize('.a {\n  color: red;\n}')
    const minified = optimize('.a {\n  color: red;\n}', { minify: true })

    expect(minified!.length).toBeLessThan(pretty!.length)
    expect(minified).not.toContain('\n')
  })

  test('lowers against the browserslist targets it is given', () => {
    // `oklab()` is the shape lightningcss is here for: modern authoring, lowered for a
    // target that predates it. A current-browser query has nothing to do.
    const css = '.a { color: oklab(59.69% 0.1007 0.1191) }'

    expect(optimize(css, { browserslist: ['chrome 90'] })).not.toBe(optimize(css, { browserslist: ['chrome 130'] }))
  })
})
