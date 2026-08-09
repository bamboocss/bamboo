import { loadConfigAndCreateContext } from '@bamboocss/node'
import { getRecipeIdentity } from '@bamboocss/shared'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { Project, SyntaxKind } from 'ts-morph'
import { beforeAll, describe, expect, test } from 'vitest'
import { isInertExpression } from '../src/fold'
import { lowerRecipeCall, type RecipeConfig } from '../src/fold-recipe'

/**
 * A config recipe lowered for a selection the build cannot resolve, against the recipe the
 * codegen actually emitted.
 *
 * Config recipes reach the runtime through `createRecipe`, not `cva` — a different generated
 * function — so agreeing with `cva` proves nothing here. What has to hold is that the classes
 * this emits are the ones `buttonStyle(props)` returns in the browser, for every selection.
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

const lowerFor = (recipe: string) => {
  const config = ctx.recipes.getConfig(recipe) as RecipeConfig & { className: string }
  const project = new Project({ useInMemoryFileSystem: true })
  const file = project.createSourceFile('t.ts', `${recipe}(props)`)
  const call = file.getDescendantsOfKind(SyntaxKind.CallExpression)[0]!

  return lowerRecipeCall(call, { config, name: config.className, box: undefined }, ctx, isInertExpression)
}

/** Selections restricted to what `splitVariantProps` can produce: declared variants only. */
const declaredOnly = (recipe: string, props: Record<string, unknown>) => {
  const config = ctx.recipes.getConfig(recipe) as RecipeConfig
  const keys = Object.keys(config.variants ?? {})
  return Object.fromEntries(Object.entries(props).filter(([key]) => keys.includes(key)))
}

describe('a config recipe lowered against an opaque selection', () => {
  test.each([
    [
      'button',
      [{}, { size: 'sm' }, { size: 'md' }, { variant: 'solid' }, { size: 'sm', variant: 'solid' }, { size: 'nope' }],
    ],
    [
      'buttonWithCompoundVariants',
      [
        {},
        { size: 'sm' },
        { size: 'md' },
        { visual: 'solid' },
        { size: 'sm', visual: 'solid' },
        { size: 'md', visual: 'outline' },
      ],
    ],
  ] as const)('%s matches the generated recipe', (recipe, selections) => {
    const lowered = lowerFor(recipe)

    expect(lowered.kind).toBe('expression')
    if (lowered.kind !== 'expression') return

    const evaluate = new Function('cvaPick', 'props', `return ${lowered.expression}`) as (
      p: unknown,
      props: Record<string, unknown>,
    ) => string

    for (const raw of selections) {
      // `splitVariantProps` is what feeds this shape, and it filters to declared variants —
      // which matters, because the generated recipe names a class for an undeclared key while
      // a config-derived lowering cannot enumerate one.
      const props = declaredOnly(recipe, raw)
      expect(evaluate(cvaPick, props), `${recipe} ${JSON.stringify(props)}`).toBe(recipes[recipe]!(props))
    }
  })

  /**
   * The gate, through the real fold. Only a selection that provably holds declared variants
   * only may lower — because the generated recipe names a class for any key it is handed and
   * a config-derived lowering cannot enumerate one it does not know about.
   */
  /**
   * These drive the real fold, whose fixture has its own recipes — `buttonStyle` here, not the
   * `sandbox/codegen` ones the parity cases above compare against.
   */
  describe('what the fold admits', () => {
    const wrapper = `
      import { cx } from 'styled-system/css'
      import { buttonStyle } from 'styled-system/recipes'
      export const B = (props) => {
        const [variantProps, rest] = buttonStyle.splitVariantProps(props)
        return <button className={cx(buttonStyle(variantProps), rest.className)} />
      }
    `

    test('the wrapper shape lowers, and splitVariantProps goes with it', async () => {
      const { createFoldFixture } = await import('./fixture')
      const result = createFoldFixture().fold(wrapper)

      expect(result.folded).toHaveLength(1)
      expect(result.code).toContain('cvaPick(variantProps.')
      expect(result.code).toContain('splitProps(props, [')
    })

    test('an arbitrary object does not lower', async () => {
      const { createFoldFixture } = await import('./fixture')
      const code = `
        import { buttonStyle } from 'styled-system/recipes'
        export const B = (opts) => buttonStyle(opts)
      `

      expect(createFoldFixture().fold(code).folded).toHaveLength(0)
    })

    test('a selection split from a different recipe does not lower', async () => {
      const { createFoldFixture } = await import('./fixture')
      const code = `
        import { buttonStyle, checkbox } from 'styled-system/recipes'
        export const B = (props) => {
          const [variantProps] = checkbox.splitVariantProps(props)
          return buttonStyle(variantProps)
        }
      `

      expect(createFoldFixture().fold(code).folded).toHaveLength(0)
    })
  })

  /** A slot recipe resolves to one class per slot; there is no string to substitute. */
  test('a slot recipe does not lower', () => {
    const config = ctx.recipes.getConfig('slotButton') as RecipeConfig & { className: string }
    const project = new Project({ useInMemoryFileSystem: true })
    const file = project.createSourceFile('t.ts', `slotButton(props)`)
    const call = file.getDescendantsOfKind(SyntaxKind.CallExpression)[0]!

    const lowered = lowerRecipeCall(
      call,
      { config, name: config.className ?? getRecipeIdentity(config), box: undefined },
      ctx,
      isInertExpression,
    )

    expect(lowered.kind).toBe('decline')
  })
})
