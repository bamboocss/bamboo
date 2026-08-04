import { loadConfigAndCreateContext } from '@bamboocss/node'
import { createMergeCss } from '@bamboocss/shared'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { beforeAll, describe, expect, test } from 'vitest'
import { createCssContext, createRuntimeCss, createRuntimeRecipe, getCompoundVariantCss } from '../src/runtime-css'

/**
 * `createRuntimeRecipe` reproduces the generated `createRecipe`, and mirrors
 * `getCompoundVariantCss` rather than importing it — the generated `cva` artifact builds
 * that one inline. A second implementation drifts, so this compares against the recipe
 * functions a real codegen produced instead of against itself.
 *
 * `sandbox/codegen` is used because its config has a recipe with compound variants,
 * which is the part most likely to diverge.
 */
const here = dirname(fileURLToPath(import.meta.url))
const cwd = join(here, '../../../sandbox/codegen')

let resolve: ReturnType<typeof createRuntimeRecipe>
let generated: Record<string, (variants: Record<string, unknown>) => string>

beforeAll(async () => {
  const ctx = await loadConfigAndCreateContext({ cwd })
  resolve = createRuntimeRecipe(ctx, createRuntimeCss(ctx))

  const recipes = await import(join(cwd, 'styled-system/recipes/index.mjs'))
  generated = recipes as never
})

const cases: Array<{ recipe: string; variants: Record<string, unknown> }> = [
  { recipe: 'button', variants: {} },
  { recipe: 'button', variants: { size: 'sm' } },
  { recipe: 'button', variants: { size: 'md' } },
  { recipe: 'button', variants: { variant: 'solid' } },
  { recipe: 'button', variants: { size: 'sm', variant: 'solid' } },
  { recipe: 'buttonWithCompoundVariants', variants: {} },
  { recipe: 'buttonWithCompoundVariants', variants: { size: 'sm' } },
  { recipe: 'buttonWithCompoundVariants', variants: { size: 'md' } },
  { recipe: 'buttonWithCompoundVariants', variants: { visual: 'solid' } },
  { recipe: 'buttonWithCompoundVariants', variants: { size: 'sm', visual: 'solid' } },
  { recipe: 'buttonWithCompoundVariants', variants: { size: 'md', visual: 'outline' } },
]

describe('recipe runtime parity', () => {
  test('the generated recipes were loaded', () => {
    // Guards against every case below passing because both sides returned undefined.
    expect(typeof generated.button).toBe('function')
  })

  test.each(cases)('$recipe $variants', ({ recipe, variants }) => {
    const fromGenerated = generated[recipe]?.(variants)
    expect(typeof fromGenerated).toBe('string')

    expect(resolve(recipe, variants)).toBe(fromGenerated)
  })

  test('an unknown recipe resolves to nothing rather than a wrong class', () => {
    expect(resolve('notARecipe', {})).toBeUndefined()
  })

  /**
   * `assertCompoundVariant` makes this combination throw rather than return a class, so
   * there is no string to fold to. Declining leaves the crash where the user put it;
   * returning a class would have the build quietly repair a bug that still exists in dev.
   *
   * Asserted as parity — that the generated function really does throw — rather than as a
   * policy this file invented.
   */
  test('a conditional variant on a recipe with compound variants throws, and so does not fold', () => {
    const variants = { size: { base: 'sm', md: 'md' } }

    expect(() => generated.buttonWithCompoundVariants!(variants)).toThrow()
    expect(resolve('buttonWithCompoundVariants', variants)).toBeUndefined()
  })

  test('a conditional variant on a recipe without compound variants is unaffected', () => {
    const variants = { size: { base: 'sm', md: 'md' } }

    // No compound variants means no assert, so the runtime returns a class and the fold
    // has to match it rather than decline.
    expect(resolve('button', variants)).toBe(generated.button!(variants))
  })

  /**
   * The recipes above cannot exercise the merge: their compound variants all carry flat
   * `css` and no selection matches two of them at once, so replace and merge agree.
   *
   * `getCompoundVariantCss` is compared to the generated one directly instead, over
   * shapes chosen to tell them apart — the same oracle, applied where the recipes cannot
   * reach.
   */
  describe('getCompoundVariantCss', () => {
    const shapes: Array<{ name: string; compoundVariants: any[]; variantMap: Record<string, unknown> }> = [
      {
        name: 'two matches sharing a nested condition',
        compoundVariants: [
          { visual: 'solid', css: { _hover: { color: 'blue' } } },
          { size: 'md', css: { _hover: { background: 'red' } } },
        ],
        variantMap: { visual: 'solid', size: 'md' },
      },
      {
        name: 'two matches sharing a flat property',
        compoundVariants: [
          { visual: 'solid', css: { color: 'blue' } },
          { size: 'md', css: { color: 'red' } },
        ],
        variantMap: { visual: 'solid', size: 'md' },
      },
      {
        name: 'three matches nesting two deep',
        compoundVariants: [
          { a: '1', css: { _hover: { _dark: { color: 'blue' } } } },
          { b: '2', css: { _hover: { _dark: { background: 'red' } } } },
          { c: '3', css: { _hover: { padding: '4' } } },
        ],
        variantMap: { a: '1', b: '2', c: '3' },
      },
      {
        name: 'an array-valued match alongside a scalar one',
        compoundVariants: [
          { size: ['sm', 'lg'], css: { _hover: { color: 'blue' } } },
          { visual: 'outline', css: { _hover: { borderColor: 'red' } } },
        ],
        variantMap: { size: 'lg', visual: 'outline' },
      },
      {
        name: 'no match at all',
        compoundVariants: [{ visual: 'solid', css: { color: 'blue' } }],
        variantMap: { visual: 'outline' },
      },
    ]

    test.each(shapes)('$name', async ({ compoundVariants, variantMap }) => {
      const cva = await import(join(cwd, 'styled-system/css/cva.mjs'))
      const ctx = await loadConfigAndCreateContext({ cwd })
      const { mergeCss } = createMergeCss(createCssContext(ctx))

      expect(getCompoundVariantCss(compoundVariants, variantMap, mergeCss)).toEqual(
        cva.getCompoundVariantCss(compoundVariants, variantMap),
      )
    })
  })
})
