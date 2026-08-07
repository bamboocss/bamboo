import { createContext } from '@bamboocss/fixture'
import { createCss, createMergeCss } from '@bamboocss/shared'
import { describe, expect, test } from 'vitest'
import { parseAndExtract } from './fixture'

/**
 * Under `cssMode: 'grouped'` a class names a whole `css()` call, so the build and the runtime
 * have to agree on which object that call resolves to — down to the merge. Disagreeing is not
 * a near miss: the class the runtime returns has no rule at all, and the element renders
 * unstyled. Every API below reaches `css()` by a different route, and each one of them was
 * wrong at some point.
 *
 * The runtime is rebuilt here from a resolved context rather than imported, the same way
 * `@bamboocss/vite` rebuilds it, so the assertion is against the class a browser would get.
 */
const runtimeCss = (grouped: boolean) => {
  const ctx = createContext()
  const cssContext = {
    grouped,
    conditions: {
      shift: ctx.conditions.shift,
      finalize: ctx.conditions.finalize,
      breakpoints: { keys: ctx.conditions.breakpoints.keys },
    },
    utility: {
      prefix: ctx.utility.prefix,
      hasShorthand: ctx.utility.hasShorthand,
      resolveShorthand: ctx.utility.resolveShorthand.bind(ctx.utility),
      transform: ctx.utility.transform.bind(ctx.utility),
      toHash: ctx.utility.toHash.bind(ctx.utility),
    },
  } as any
  const fn = createCss(cssContext)
  const { mergeCss } = createMergeCss(cssContext)
  return (...styles: any[]) => fn(mergeCss(...styles))
}

const extract = (code: string) => parseAndExtract(code, { cssMode: 'grouped' })

/**
 * The same runtime, built from a context the config actually shaped.
 *
 * `runtimeCss` above pins the fixture's defaults, which is what every case below it wants.
 * The naming options are the ones that have to travel through both sides, so they need a
 * context that carries them — mirroring `generateCssFn`, which passes `hash: true` and
 * `grouped: true` into `createCss` from the resolved config.
 */
const runtimeCssWith = (config: Record<string, unknown>) => {
  const ctx = createContext(config as never)
  const cssContext = {
    grouped: true,
    hash: Boolean(ctx.hash.className),
    conditions: {
      shift: ctx.conditions.shift,
      finalize: ctx.conditions.finalize,
      breakpoints: { keys: ctx.conditions.breakpoints.keys },
    },
    utility: {
      prefix: ctx.utility.prefix,
      hasShorthand: ctx.utility.hasShorthand,
      resolveShorthand: ctx.utility.resolveShorthand.bind(ctx.utility),
      transform: ctx.utility.transform.bind(ctx.utility),
      toHash: ctx.utility.toHash.bind(ctx.utility),
    },
  } as any
  const fn = createCss(cssContext)
  const { mergeCss } = createMergeCss(cssContext)
  return (...styles: any[]) => fn(mergeCss(...styles))
}

/**
 * A grouped class is named on both sides, so every option that feeds the naming has to be
 * varied against every other one. `hash` was not, and the build re-hashed a group id that
 * was already a digest while the runtime hashed it once — so with `hash: true` *every*
 * element in the app carried a class no rule existed for. Nothing failed, because no test
 * combined the two options.
 */
describe('cssMode: grouped — the class survives every naming option', () => {
  const configs = [
    { name: 'plain', config: { cssMode: 'grouped' } },
    { name: 'hash', config: { cssMode: 'grouped', hash: true } },
    { name: 'prefix', config: { cssMode: 'grouped', prefix: 'bam' } },
    { name: 'hash + prefix', config: { cssMode: 'grouped', hash: true, prefix: 'bam' } },
  ]

  test.each(configs)('$name', ({ config }) => {
    const result = parseAndExtract(
      `import { css } from "styled-system/css"\ncss({ color: "red", padding: "2" })`,
      config as never,
    )

    const runtimeClass = runtimeCssWith(config)({ color: 'red', padding: '2' })

    expect(runtimeClass).not.toBe('')
    expect(result.css).toContain(runtimeClass)
  })

  test('a condition-carrying call agrees under hash too', () => {
    const config = { cssMode: 'grouped', hash: true }
    const result = parseAndExtract(
      `import { css } from "styled-system/css"\ncss({ color: "red", _hover: { color: "blue" }, md: { padding: "4" } })`,
      config as never,
    )

    const runtimeClass = runtimeCssWith(config)({ color: 'red', _hover: { color: 'blue' }, md: { padding: '4' } })

    expect(result.css).toContain(runtimeClass)
  })
})

describe('cssMode: grouped — the build emits a rule for the class the runtime returns', () => {
  test('css()', () => {
    const result = extract(`import { css } from "styled-system/css"\ncss({ color: "red", padding: "2" })`)
    expect(result.css).toContain(runtimeCss(true)({ color: 'red', padding: '2' }))
  })

  test('pattern', () => {
    // `stack(...)` is `css(stackStyleFn(styles))` — one grouped call, not one class per
    // property of the transformed object.
    const result = extract(`import { stack } from "styled-system/patterns"\nstack({ gap: "4" })`)
    expect(result.css).toContain(runtimeCss(true)({ display: 'flex', flexDirection: 'column', gap: '4' }))
  })

  /**
   * `cva` is named semantically rather than grouped or atomic, so `cssMode` does not reach
   * it at all — the name comes from the config, and the build knows it without needing a
   * rule per variant combination.
   *
   * This used to be the one primitive that stayed atomic under `grouped`, which is what
   * `__atomicCss` existed for. The classes below are `cva_<hash>` and
   * `cva_<hash>--size_sm`, in `@layer recipes`.
   */
  test('cva is named semantically, so cssMode does not reach it', () => {
    const result = extract(
      `import { cva } from "styled-system/css"\ncva({ base: { color: "red" }, variants: { size: { sm: { padding: "2" } } } })`,
    )

    expect(result.css).toContain('@layer recipes')
    expect(result.css).toMatch(/\.cva_[a-zA-Z]+ \{/)
    expect(result.css).toMatch(/\.cva_[a-zA-Z]+--size_sm \{/)
    // Neither naming scheme `cssMode` selects between appears for it.
    expect(result.css).not.toContain(runtimeCss(false)({ color: 'red' }))
    expect(result.css).not.toContain(runtimeCss(true)({ color: 'red', padding: '2' }))
  })
})

// `mergeCss` normalizes each operand and *then* deep-merges. Any cheaper merge here names a
// different class, and the declarations that lose the collision vanish from the stylesheet
// rather than merely losing the cascade.
