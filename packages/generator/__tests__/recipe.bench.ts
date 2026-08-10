import { compact, createCssUncached, getRecipeClassNames, memo, toHash, withoutSpace } from '@bamboocss/shared'
import { bench, describe } from 'vitest'

/**
 * Benchmarks the runtime shape `generateCreateRecipe` emits, so the numbers track what ships in
 * `styled-system/recipes/create-recipe.mjs` — the approach `cva.bench.ts` and `css-fn.bench.ts`
 * take.
 *
 * Nothing covered the *config* recipe path at all. `cva.bench.ts` covers the inline one, which
 * resolves its classes through a lookup; a config recipe rebuilds them through `createCss` on
 * every call, which is what this exists to measure.
 *
 * `recipeFn` is benched unmemoized as well as through `memo`, because the two answer different
 * questions: the memoized number is what a re-render of an unchanged element costs, and the raw
 * one is what the first call for each variant combination costs. A design system pays the second
 * once per combination and the first on every render.
 */
const separator = '_'

const config = {
  className: 'button',
  variants: {
    visual: { solid: { bg: 'blue.500' }, outline: { borderWidth: '1px' } },
    size: { sm: { padding: '2' }, md: { padding: '4' }, lg: { padding: '6' } },
    tone: { neutral: { color: 'gray.900' }, danger: { color: 'red.600' } },
  },
  defaultVariants: { size: 'md' },
}

const variantMap = Object.fromEntries(Object.entries(config.variants).map(([k, v]) => [k, Object.keys(v)]))

/** What the generated module builds once per recipe. */
const format = (className: string) => className

const variantValues = Object.fromEntries(
  Object.entries(variantMap).map(([variant, values]) => [variant, Object.fromEntries(values.map((v) => [v, true]))]),
)

const isScalarSelection = (declared: Record<string, unknown>) => {
  for (const key in declared) {
    if (typeof declared[key] === 'object') return false
  }
  return true
}

/**
 * A faithful copy of the emitted `createRecipe`, minus the parts a bench cannot exercise.
 *
 * `fastPath` is what the previous shape did *not* have, kept as a switch so the before and after
 * are measured in one run on one machine rather than across two.
 */
const createRecipe = (name: string, defaultVariants: Record<string, unknown>, fastPath = true) => {
  const getVariantProps = (variants: Record<string, unknown>) => ({
    [name]: '__ignore__',
    ...defaultVariants,
    ...compact(variants),
  })

  const recipeFn = (variants: Record<string, unknown>) => {
    const declaredProps = getVariantProps(variants)

    if (fastPath && isScalarSelection(declaredProps)) {
      return getRecipeClassNames(name, variantValues, declaredProps, separator, format)
    }

    const transform = (prop: string, value: any) => {
      if (value === '__ignore__') return { className: name }
      return { className: `${name}--${prop}${separator}${withoutSpace(value)}` }
    }

    const recipeCss = createCssUncached({
      hash: false,
      conditions: { shift: (v: string[]) => v, finalize: (v: string[]) => v, breakpoints: { keys: ['sm', 'md'] } },
      utility: { prefix: '', toHash: (path: string[], h: (s: string) => string) => h(path.join(':')), transform },
    } as never)

    const declared = declaredProps
    const recipeStyles = Object.fromEntries(
      Object.entries(declared).filter(([prop, value]) => {
        if (prop === name) return true
        if (value === null || typeof value === 'object') return true
        return Object.hasOwn(variantMap, prop) && variantMap[prop]!.includes(String(value))
      }),
    )

    return recipeCss(recipeStyles)
  }

  return { recipeFn, getVariantProps }
}

const { recipeFn } = createRecipe(config.className, config.defaultVariants)
const { recipeFn: previousFn } = createRecipe(config.className, config.defaultVariants, false)
const memoized = memo(recipeFn)

const scalar = { visual: 'solid', size: 'lg', tone: 'danger' }
const conditional = { visual: { base: 'solid', _hover: 'outline' }, size: 'lg' }

describe('config recipe', () => {
  /**
   * The shape every scalar call takes today, and the one a lookup can answer. Unmemoized, so
   * this is the per-combination cost rather than the cache's.
   */
  bench('scalar variants — lookup (current)', () => {
    recipeFn(scalar)
  })

  /** The same call through the shape that shipped before, for the size of the gap. */
  bench('scalar variants — createCss (previous)', () => {
    previousFn(scalar)
  })

  /** A value the lookup cannot answer, so this is the floor for the fallback — and unchanged. */
  bench('conditional variant — createCss', () => {
    recipeFn(conditional)
  })

  /** What a re-render of an unchanged element costs: the memo key, then a hit. */
  bench('scalar variants — memoized', () => {
    memoized(scalar)
  })

  /**
   * The control. `toHash` is on no path this change touches, so if it moves between two runs
   * the machine did and the comparison is void.
   */
  bench('control — toHash', () => {
    toHash('button--visual_solid')
  })
})
