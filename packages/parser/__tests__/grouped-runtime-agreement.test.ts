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

  test('jsx pattern', () => {
    const result = extract(`import { Stack } from "styled-system/jsx"\nconst A = () => <Stack gap="4" />`)
    expect(result.css).toContain(runtimeCss(true)({ display: 'flex', flexDirection: 'column', gap: '4' }))
  })

  test('styled jsx, style props only', () => {
    const result = extract(
      `import { styled } from "styled-system/jsx"\nconst A = () => <styled.div color="red" padding="2" />`,
    )
    expect(result.css).toContain(runtimeCss(true)({ color: 'red', padding: '2' }))
  })

  test('styled jsx merges the css prop into the same call', () => {
    // The factory calls `css(propStyles, cssStyles)` once, so hashing the two apart named a
    // class nothing would ever ask for.
    const result = extract(
      `import { styled } from "styled-system/jsx"\nconst A = () => <styled.div color="red" css={{ padding: "2" }} />`,
    )
    expect(result.css).toContain(runtimeCss(true)({ color: 'red' }, { padding: '2' }))
  })

  test('cva stays atomic, because its variant combinations are not knowable at build time', () => {
    const result = extract(
      `import { cva } from "styled-system/css"\ncva({ base: { color: "red" }, variants: { size: { sm: { padding: "2" } } } })`,
    )
    // Grouping would need a rule per combination; the runtime uses `__atomicCss` to match.
    expect(result.css).toContain(runtimeCss(false)({ color: 'red' }))
    expect(result.css).toContain(runtimeCss(false)({ padding: '2' }))
  })

  test('a *Css prop is another slot, so it keeps its own call', () => {
    const result = extract(
      `import { styled } from "styled-system/jsx"\nconst A = () => <styled.div color="red" inputCss={{ padding: "2" }} />`,
    )
    expect(result.css).toContain(runtimeCss(true)({ color: 'red' }))
    expect(result.css).toContain(runtimeCss(true)({ padding: '2' }))
    // ...and is not folded into the element's own group.
    expect(result.css).not.toContain(runtimeCss(true)({ color: 'red', padding: '2' }))
  })
})

// `mergeCss` normalizes each operand and *then* deep-merges. Any cheaper merge here names a
// different class, and the declarations that lose the collision vanish from the stylesheet
// rather than merely losing the cascade.
describe('cssMode: grouped — the css prop merges the way mergeCss does', () => {
  test('a condition object under a shared key keeps every branch', () => {
    const result = extract(
      `import { styled } from "styled-system/jsx"
       const A = () => <styled.div color={{ base: "red", _hover: "blue" }} css={{ color: { _dark: "green" } }} />`,
    )
    expect(result.css).toContain(
      runtimeCss(true)({ color: { base: 'red', _hover: 'blue' } }, { color: { _dark: 'green' } }),
    )
  })

  test('a shorthand collides with its longhand only after normalization', () => {
    const result = extract(
      `import { styled } from "styled-system/jsx"
       const A = () => <styled.div p={{ base: "2", _hover: "3" }} css={{ padding: { _dark: "4" } }} />`,
    )
    expect(result.css).toContain(runtimeCss(true)({ p: { base: '2', _hover: '3' } }, { padding: { _dark: '4' } }))
  })

  test('a responsive array is replaced by a later object, not merged into it', () => {
    const result = extract(
      `import { styled } from "styled-system/jsx"
       const A = () => <styled.div color={["red", "blue"]} css={{ color: { _hover: "green" } }} />`,
    )
    expect(result.css).toContain(runtimeCss(true)({ color: ['red', 'blue'] }, { color: { _hover: 'green' } }))
  })
})
