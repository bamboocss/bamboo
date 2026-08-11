import { createContext } from '@bamboocss/fixture'
import { compact, createCss, createMergeCss } from '@bamboocss/shared'
import { describe, expect, test } from 'vitest'
import { generateCvaFn } from '../src/artifacts/js/cva'

/**
 * How much merging `cva`'s `resolve` does.
 *
 * Counted rather than timed, for the reason the repo counts elsewhere: a wall-clock
 * threshold fails on a busy machine rather than on a regression, while "how many times was
 * `mergeCss` called" is exact and runs in CI.
 *
 * What it protects: `resolve` used to end in `mergeCss(variantCss, compoundVariantCss)`
 * unconditionally. `mergeCss` is memoized on its arguments, so that call hashes the whole
 * accumulated style object before discovering the second operand is empty — which it is
 * for every recipe that declares no compound variants, and most declare none.
 */
const context = () => {
  const ctx = createContext()
  return {
    hash: Boolean(ctx.hash.className),
    utility: {
      prefix: ctx.utility.prefix,
      hasShorthand: ctx.utility.hasShorthand,
      resolveShorthand: ctx.utility.resolveShorthand.bind(ctx.utility),
      transform: ctx.utility.transform.bind(ctx.utility),
      toHash: ctx.utility.toHash.bind(ctx.utility),
    },
    conditions: {
      shift: ctx.conditions.shift,
      finalize: ctx.conditions.finalize,
      breakpoints: { keys: ctx.conditions.breakpoints.keys },
    },
  }
}

/**
 * `resolve` as the artifact emits it, with a counting `mergeCss`.
 *
 * Mirroring the emitted shape is the same approach `cva.bench.ts` takes, and carries the
 * same drift risk — so the last test in this file pins the emitted source against it.
 */
const buildResolve = (config: {
  base: Record<string, unknown>
  variants: Record<string, Record<string, unknown>>
  defaultVariants: Record<string, unknown>
  compoundVariants: Array<Record<string, unknown>>
}) => {
  const { mergeCss } = createMergeCss(context() as never)

  let merges = 0
  const countingMerge = (...styles: any[]) => {
    merges++
    return mergeCss(...styles)
  }

  const { base, variants, defaultVariants, compoundVariants } = config
  const getVariantProps = (v: Record<string, unknown>) => ({ ...defaultVariants, ...compact(v) })

  const getCompoundVariantCss = (list: Array<Record<string, any>>, variantMap: Record<string, unknown>) => {
    let result = {}
    for (const compoundVariant of list) {
      const isMatching = Object.entries(compoundVariant).every(([key, value]) => {
        if (key === 'css') return true
        const values = Array.isArray(value) ? value : [value]
        return values.some((entry) => variantMap[key] === entry)
      })
      if (isMatching) result = countingMerge(result, compoundVariant.css)
    }
    return result
  }

  const resolve = (props: Record<string, unknown> = {}) => {
    const computedVariants = getVariantProps(props)
    let variantCss: any = { ...base }
    for (const [key, value] of Object.entries(computedVariants)) {
      if (variants[key]?.[value as string]) {
        variantCss = countingMerge(variantCss, variants[key][value as string])
      }
    }
    if (compoundVariants.length === 0) return variantCss

    const compoundVariantCss = getCompoundVariantCss(compoundVariants, computedVariants)
    return countingMerge(variantCss, compoundVariantCss)
  }

  return { resolve, merges: () => merges }
}

const VARIANTS = {
  size: { sm: { padding: '4px' }, md: { padding: '8px' }, lg: { padding: '12px' } },
  tone: { primary: { backgroundColor: 'blue.600' }, danger: { backgroundColor: 'red.500' } },
}

describe('cva resolve, work done', () => {
  test('a compound-free recipe merges once per active variant and no more', () => {
    const { resolve, merges } = buildResolve({
      base: { display: 'inline-flex' },
      variants: VARIANTS,
      defaultVariants: { size: 'md', tone: 'primary' },
      compoundVariants: [],
    })

    resolve({ size: 'lg', tone: 'danger' })

    // Two active variants, two merges. The third — against an empty compound result — is
    // the one this recipe has no reason to pay for.
    expect(merges()).toBe(2)
  })

  test('a recipe with no variants selected does not merge at all', () => {
    const { resolve, merges } = buildResolve({
      base: { display: 'inline-flex' },
      variants: VARIANTS,
      defaultVariants: {},
      compoundVariants: [],
    })

    expect(resolve({})).toEqual({ display: 'inline-flex' })
    expect(merges()).toBe(0)
  })

  test('a recipe with compound variants still merges them in', () => {
    const { resolve, merges } = buildResolve({
      base: { display: 'inline-flex' },
      variants: VARIANTS,
      defaultVariants: { size: 'md', tone: 'primary' },
      compoundVariants: [{ size: 'lg', tone: 'danger', css: { letterSpacing: '0.02em' } }],
    })

    const result = resolve({ size: 'lg', tone: 'danger' })

    // Two variants, one matching compound, one final merge. The short-circuit must not
    // reach a recipe that has compound variants to apply.
    expect(merges()).toBe(4)
    expect(result).toMatchObject({ letterSpacing: '0.02em' })
  })

  test.each([
    ['a base and active variants', { display: 'inline-flex' }, { size: 'lg', tone: 'danger' }],
    ['a base and no active variants', { display: 'inline-flex' }, {}],
    ['an undefined key beside a defined one', { display: 'inline-flex', color: undefined }, {}],
    ['a responsive value', { padding: { base: '1', sm: '2' } }, { size: 'lg' }],
    ['a nested condition', { _hover: { color: 'red.300' } }, { tone: 'danger' }],
  ])('the short-circuit returns exactly what the merge did, for %s', (_name, base, props) => {
    const { resolve } = buildResolve({
      base,
      variants: VARIANTS,
      defaultVariants: {},
      compoundVariants: [],
    })

    // What the unconditional trailing `mergeCss(variantCss, {})` produced.
    const { mergeCss } = createMergeCss(context() as never)

    // `toStrictEqual`, not `toEqual`: the difference this has to be able to see is a key
    // whose value is `undefined`, and `toEqual` ignores exactly those.
    expect(resolve(props)).toStrictEqual(mergeCss(resolve(props), {}))
  })

  test('a base with nothing defined in it is the one shape that differs', () => {
    const { resolve } = buildResolve({
      base: { color: undefined },
      variants: VARIANTS,
      defaultVariants: {},
      compoundVariants: [],
    })

    const { mergeCss } = createMergeCss(context() as never)
    const css = createCss(context() as never)

    // `compactStyles` drops a style object with no defined value at all, so the old
    // trailing merge turned this into `{}`. Nothing downstream can tell: both produce no
    // class. The difference is only visible to a caller spreading `raw()` over another
    // object, where an `undefined` key now shadows what it lands on — and reaching that
    // needs a recipe whose base defines nothing and whose variants are all inactive.
    expect(resolve({})).toStrictEqual({ color: undefined })
    expect(mergeCss(resolve({}), {})).toStrictEqual({})

    expect(css(resolve({}))).toBe(css(mergeCss(resolve({}), {})))
  })

  test('the emitted runtime is the shape mirrored above', () => {
    const js = generateCvaFn(createContext()).js

    // The mirror is only worth counting against while it matches what ships.
    expect(js).toContain('if (compoundVariants.length === 0) return variantCss')
    expect(js).toContain('const compoundVariantCss = getCompoundVariantCss(compoundVariants, computedVariants)')
    expect(js).toContain('return mergeCss(variantCss, compoundVariantCss)')
  })
})
