import { createGeneratorContext } from '@bamboocss/fixture'
import { bench, describe } from 'vitest'
import { generateCx } from '../src/artifacts/js/cx'

/**
 * Benchmarks the `cx` that `generateCx` emits, against the plain concatenator it replaced.
 *
 * `cx` ships to the browser and runs on every render of every styled component, so the
 * merge has to be paid for out of a very small budget. Both variants are built and measured
 * in the same process, which is the only way to get a usable A/B here: the wall-clock ratio
 * between two separate runs on a loaded machine swings further than the effect being
 * measured.
 *
 * Reported, not asserted — see `packages/generator/__tests__/generate-cx.test.ts` for the
 * behaviour, which is locked down by assertion rather than by timing.
 */
type Cx = (...args: unknown[]) => string

const compile = (js: string): Cx => new Function(js.replace(/export\s*\{\s*cx\s*\}/, 'return cx'))() as Cx

const merging = compile(generateCx(createGeneratorContext() as any).js)
const concatenating = compile(generateCx(createGeneratorContext({ hash: true }) as any).js)

// What the JSX factory actually passes: the classes a recipe produced, plus whatever the
// caller put on `className`.
const recipeClasses = 'd_flex ai_center jc_space-between px_4 py_2 rounded_md fw_semibold fs_sm c_white bg_blue.500'
const override = 'px_8 bg_red.500'
const userClasses = 'my-button analytics-target'

describe('cx', () => {
  // The shape generated code actually emits: every call site passes at least two arguments,
  // so `cx(classes, undefined)` is the real "no className was passed" path, not `cx(classes)`.
  bench('no className passed', () => {
    merging(recipeClasses, undefined)
  })

  bench('no className passed — concatenating', () => {
    concatenating(recipeClasses, undefined)
  })

  bench('recipe classes + an override', () => {
    merging(recipeClasses, override)
  })

  bench('recipe classes + an override — concatenating', () => {
    concatenating(recipeClasses, override)
  })

  bench('recipe classes + non-bamboo classes', () => {
    merging(recipeClasses, userClasses)
  })

  bench('recipe classes + non-bamboo classes — concatenating', () => {
    concatenating(recipeClasses, userClasses)
  })
})
