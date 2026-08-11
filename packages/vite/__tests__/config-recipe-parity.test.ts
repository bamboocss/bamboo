import { loadConfigAndCreateContext } from '@bamboocss/node'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { Project, SyntaxKind } from 'ts-morph'
import { beforeAll, describe, expect, test } from 'vitest'
import { isInertExpression } from '../src/fold'
import { lowerRecipeCall, type RecipeConfig } from '../src/fold-recipe'
import { createFoldFixture } from './fixture'

/**
 * Why a config recipe's calls are not lowered the way an inline recipe's are.
 *
 * The two runtimes resolve a selection differently. `cva` reads a variant value as a key
 * through `getRecipeClassNames`, so a conditional value finds no entry and names no class —
 * which is exactly what `cvaPick` does, and why lowering an inline recipe is sound. A config
 * recipe routes its selection through `createCss`, which *expands* a conditional into one
 * class per condition.
 *
 * For a **dynamic** axis the build cannot know which kind of value arrives, so a scalar lookup
 * would silently drop every class a responsive variant produces. That shipped once; these pin
 * both the divergence and the decision that follows from it.
 */
const here = dirname(fileURLToPath(import.meta.url))
const cwd = join(here, '../../../sandbox/codegen')

let ctx: Awaited<ReturnType<typeof loadConfigAndCreateContext>>
let cvaPick: (value: unknown, table: Record<string, string>, fallback?: string) => string
let recipes: Record<string, (props?: Record<string, unknown>) => string>

beforeAll(async () => {
  ctx = await loadConfigAndCreateContext({ cwd })
  cvaPick = ((await import(join(cwd, 'styled-system/css/index.mjs'))) as never as { cvaPick: typeof cvaPick }).cvaPick
  recipes = (await import(join(cwd, 'styled-system/recipes/index.mjs'))) as never
}, 60_000)

const loweredFor = (recipe: string) => {
  const config = ctx.recipes.getConfig(recipe) as RecipeConfig & { className: string }
  const project = new Project({ useInMemoryFileSystem: true })
  const file = project.createSourceFile('t.ts', `${recipe}(props)`)
  const call = file.getDescendantsOfKind(SyntaxKind.CallExpression)[0]!

  return lowerRecipeCall(call, { config, name: config.className, box: undefined }, ctx, isInertExpression)
}

describe('a config recipe resolves conditionals a scalar lookup cannot', () => {
  test('a scalar selection would agree', () => {
    const lowered = loweredFor('button')
    expect(lowered.kind).toBe('expression')
    if (lowered.kind !== 'expression') return

    const evaluate = new Function('cvaPick', 'props', `return ${lowered.expression}`) as (
      p: unknown,
      props: Record<string, unknown>,
    ) => string

    for (const props of [{}, { visual: 'solid' }, { visual: 'outline' }, { visual: 'bogus' }]) {
      expect(evaluate(cvaPick, props), JSON.stringify(props)).toBe(recipes.button!(props))
    }
  })

  /**
   * The reason the fold leaves config recipes alone. A responsive variant is documented and
   * type-permitted, and the runtime expands it into a class per condition; a table lookup
   * finds no entry for the object and yields nothing at all.
   */
  test.each([
    { label: 'a conditional value', props: { visual: { base: 'solid', md: 'outline' } } as Record<string, unknown> },
    {
      label: 'a nested conditional value',
      props: { visual: { base: 'solid', _hover: 'outline' } } as Record<string, unknown>,
    },
  ])('$label diverges from a scalar lookup', ({ props }) => {
    const lowered = loweredFor('button')
    if (lowered.kind !== 'expression') throw new Error('expected an expression')

    const evaluate = new Function('cvaPick', 'props', `return ${lowered.expression}`) as (
      p: unknown,
      props: Record<string, unknown>,
    ) => string

    expect(evaluate(cvaPick, props)).not.toBe(recipes.button!(props))
  })
})

describe('what the fold does with config recipes', () => {
  test('a wrapper forwarding runtime props does not lower', () => {
    const code = `
      import { cx } from 'styled-system/css'
      import { buttonStyle } from 'styled-system/recipes'
      export const B = (props) => {
        const [variantProps, rest] = buttonStyle.splitVariantProps(props)
        return <button className={cx(buttonStyle(variantProps), rest.className)} />
      }
    `

    expect(createFoldFixture().fold(code).folded).toHaveLength(0)
  })

  /** Unaffected: a selection the build resolved is a scalar, and folds through the recipe path. */
  test('a statically resolvable call still folds', () => {
    const result = createFoldFixture().fold(`
      import { buttonStyle } from 'styled-system/recipes'
      export const cls = buttonStyle({ size: 'sm' })
    `)

    expect(result.folded).toHaveLength(1)
    expect(result.folded[0]!.className).toContain('--size_sm')
  })

  /** Inline recipes are sound for the reason above, and keep lowering. */
  test('an inline recipe wrapper still lowers', () => {
    const result = createFoldFixture().fold(`
      import { cva, cx } from 'styled-system/css'
      const badge = cva({ base: {}, variants: { tone: { a: {}, b: {} } } })
      export const B = (props) => {
        const [variantProps, rest] = badge.splitVariantProps(props)
        return <span className={cx(badge(variantProps), rest.className)} />
      }
    `)

    expect(result.folded).toHaveLength(1)
    expect(result.code).toContain('cvaPick(variantProps.tone,')
  })
})
