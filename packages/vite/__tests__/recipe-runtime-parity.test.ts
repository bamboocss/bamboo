import { loadConfigAndCreateContext } from '@bamboocss/node'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { beforeAll, describe, expect, test } from 'vitest'
import { createRuntimeCss, createRuntimeRecipe } from '../src/runtime-css'

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
})
