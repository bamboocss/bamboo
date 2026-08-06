import { createContext } from '@bamboocss/fixture'
import { createCss, createMergeCss } from '@bamboocss/shared'
import { describe, expect, test } from 'vitest'
import { parseAndExtract } from './fixture'

/**
 * `styled(Component, cvaConfig)` merges the cva's styles with the element's style props
 * into one `css()` call. The build sees only the props — it cannot see through the
 * component to the cva — so the group it encodes is a strict subset of the one the runtime
 * asks for, and never matches it.
 *
 * That used to drop the style props entirely: the fallback named them atomically and no
 * atomic rule existed. The props are now encoded atomically as well, so the element keeps
 * them.
 */
const runtime = (grouped: boolean) => {
  const ctx = createContext({ cssMode: 'grouped' } as never)
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
  } as never
  const fn = createCss(cssContext)
  const { mergeCss } = createMergeCss(cssContext)
  return (...styles: never[]) => fn(mergeCss(...styles))
}

const hasRule = (css: string, className: string) => css.includes('.' + className.replace(/([.:!])/g, '\\$1'))

describe('cssMode: grouped — styled(Component, cvaConfig) keeps its style props', () => {
  const source = `
    import { styled } from "styled-system/jsx"
    const Button = styled('button', { base: { color: 'red' }, variants: { size: { sm: { padding: '2px' } } } })
    export const A = () => <Button size="sm" fontSize="30px" />
  `

  test('every declaration the element carries has a rule behind it', () => {
    const result = parseAndExtract(source, { cssMode: 'grouped' } as never)

    // What `cvaClass()` names: the cva's styles merged with the style props. The build
    // cannot emit this group, so the runtime falls back to atomic names.
    const atomic = runtime(false)({ color: 'red', padding: '2px' } as never, { fontSize: '30px' } as never)

    for (const className of atomic.split(' ')) {
      expect(hasRule(result.css, className), `${className} has no rule`).toBe(true)
    }
    // The style prop is the one that used to go missing.
    expect(result.css).toContain('font-size')
  })

  test('a plain factory element still groups, with no atomic duplication', () => {
    const result = parseAndExtract(
      `import { styled } from "styled-system/jsx"\nexport const A = () => <styled.div color="red" fontSize="30px" />`,
      { cssMode: 'grouped' } as never,
    )

    // `styled.div` carries no cva, so the runtime groups exactly what was encoded and the
    // atomic copies would be dead weight.
    expect(result.encoder.grouped.size).toBe(1)
    expect(result.encoder.atomic.size).toBe(0)
    expect(result.css).toContain(runtime(true)({ color: 'red', fontSize: '30px' } as never))
  })
})
