import postcss, { type Container } from 'postcss'
import { bench, describe } from 'vitest'
import { pruneKeyframes } from '../src/prune-keyframes'
import { pruneTokenVars } from '../src/prune-tokens'

/**
 * The two prune passes, which had no benchmark at all.
 *
 * Both walk every declaration in the finished stylesheet once per build, and both are
 * reachability closures rather than filters — so their cost tracks the token count and the
 * `var()` chain depth, not the rule count the `static-css-*` benches measure. A regression
 * here would land in the same place `optimizeCss` did: after the sheet is built, where
 * nothing else is watching.
 *
 * The shape matters. A preset declares one custom property per token and an app references a
 * small fraction of them, so the interesting number is the *unreferenced* majority — every
 * one of those is a queue miss the closure pays for and then discards.
 */

const build = (css: string) => postcss.parse(css) as unknown as Container

/** One token declaration per name, a tenth of them chained through another `var()`. */
const tokenLayer = (count: number) => {
  const decls: string[] = []

  for (let index = 0; index < count; index++) {
    decls.push(
      index % 10 === 0
        ? `--t${index}:var(--t${(index + 1) % count})`
        : `--t${index}:rgb(${index % 255} 0 ${index % 128})`,
    )
  }

  return `:root{${decls.join(';')}}`
}

/** Utilities referencing a tenth of the tokens, which is roughly what an app uses. */
const utilities = (count: number) => {
  const rules: string[] = []

  for (let index = 0; index < count; index += 10) {
    rules.push(`.u${index}{color:var(--t${index});border-color:var(--t${index})}`)
  }

  return `@layer utilities{${rules.join('')}}`
}

const keyframeLayer = (count: number) => {
  const rules: string[] = []

  for (let index = 0; index < count; index++) {
    rules.push(`@keyframes k${index}{from{opacity:0}to{opacity:1}}`)
    rules.push(`:root{--animations-a${index}:k${index} 1s linear infinite}`)
  }

  return rules.join('')
}

const TOKENS = 2000
const KEYFRAMES = 200

const tokenNames = new Set(Array.from({ length: TOKENS }, (_, index) => `--t${index}`))
const keyframeNames = new Set(Array.from({ length: KEYFRAMES }, (_, index) => `k${index}`))
const animationVars = new Set(Array.from({ length: KEYFRAMES }, (_, index) => `--animations-a${index}`))

const options = { iterations: 20, warmupIterations: 5, time: 1000 }

describe('pruneTokenVars', () => {
  bench(
    'token layer, a tenth referenced',
    () => {
      const target = build(tokenLayer(TOKENS))
      pruneTokenVars({
        scan: [target, build(utilities(TOKENS))],
        target,
        tokenVars: new Set(tokenNames),
      })
    },
    options,
  )

  /**
   * The control. `postcss.parse` of the same source with no closure over it, so the parse
   * cost the two share is visible on its own — if this moves between two readings the
   * machine did, and the comparison is void however clean the rest looks.
   */
  bench(
    'parse only',
    () => {
      build(tokenLayer(TOKENS))
      build(utilities(TOKENS))
    },
    options,
  )
})

describe('pruneKeyframes', () => {
  const scanFor = () => [build(keyframeLayer(KEYFRAMES)), build(utilities(TOKENS))]

  bench(
    'nothing external is reachable',
    () => {
      const target = build(keyframeLayer(KEYFRAMES))
      pruneKeyframes({ scan: [target, ...scanFor()], target, keyframeNames: new Set(keyframeNames) })
    },
    options,
  )

  /**
   * The same walk seeded with the token pass's answer, which is what every real caller now
   * passes. Seeding is one `visitVar` per surviving property and the closure below it is
   * shared, so this should sit alongside the reading above rather than above it.
   */
  bench(
    'seeded with surviving token vars',
    () => {
      const target = build(keyframeLayer(KEYFRAMES))
      pruneKeyframes({
        scan: [target, ...scanFor()],
        target,
        keyframeNames: new Set(keyframeNames),
        reachableVars: new Set(animationVars),
      })
    },
    options,
  )

  bench(
    'every declaration surviving',
    () => {
      const target = build(keyframeLayer(KEYFRAMES))
      pruneKeyframes({
        scan: [target, ...scanFor()],
        target,
        keyframeNames: new Set(keyframeNames),
        reachableVars: 'all',
      })
    },
    options,
  )
})
