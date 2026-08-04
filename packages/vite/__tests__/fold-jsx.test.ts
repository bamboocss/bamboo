import { describe, expect, test } from 'vitest'
import { foldSource } from '../src/fold'
import { createFoldFixture, selectorsFor } from './fixture'

/**
 * Collapsing a `styled.*` element to its intrinsic tag.
 *
 * The factory is where most style resolution happens at runtime — it runs `splitProps`,
 * `css()` and `cx` per element per render, inside a `forwardRef`. It is also the easiest
 * place to be quietly wrong, because a bad fold changes rendered markup rather than
 * throwing. So the declining cases come first and outnumber the folding ones.
 */
const jsx = (body: string) => `import { styled } from 'styled-system/jsx'\n${body}\n`

const expectUnchanged = (body: string) => {
  const { fold } = createFoldFixture()
  const code = jsx(body)
  const result = fold(code)

  expect(result.folded).toHaveLength(0)
  expect(result.code).toBe(code)
  return result
}

describe('folds', () => {
  test('a self-closing element with only style props', () => {
    const { fold } = createFoldFixture()
    const result = fold(jsx(`export const A = () => <styled.div color="red.300" padding="4" />`))

    expect(result.folded).toHaveLength(1)
    expect(result.code).toContain('<div className={"c_red.300 p_4"} />')
    expect(result.code).not.toContain('styled.div')
  })

  test('an element with children, rewriting the closing tag too', () => {
    const { fold } = createFoldFixture()
    const result = fold(jsx(`export const A = () => <styled.span color="red.300">hi</styled.span>`))

    expect(result.code).toContain('<span className={"c_red.300"}>hi</span>')
  })

  test('non-style props pass through untouched', () => {
    const { fold } = createFoldFixture()
    const result = fold(jsx(`export const A = () => <styled.div color="red.300" onClick={fn} id="x">hi</styled.div>`))

    expect(result.folded).toHaveLength(1)
    // `defaultShouldForwardProp` sends anything that is not a css property to the DOM.
    expect(result.code).toContain('onClick={fn}')
    expect(result.code).toContain('id="x"')
    expect(result.code).toContain('className={"c_red.300"}')
  })

  test('a static className is appended, as cx would append it', () => {
    const { fold } = createFoldFixture()
    const result = fold(jsx(`export const A = () => <styled.div color="red.300" className="mine" />`))

    expect(result.folded[0]!.className).toBe('c_red.300 mine')
  })

  test('conditions and responsive values fold', () => {
    const { fold, runtimeCss } = createFoldFixture()
    const result = fold(jsx(`export const A = () => <styled.div color="red.300" _hover={{ color: 'blue.500' }} />`))

    expect(result.folded[0]!.className).toBe(runtimeCss({ color: 'red.300', _hover: { color: 'blue.500' } }))
  })

  test('the folded class is backed by emitted CSS', () => {
    const { fold, getCss } = createFoldFixture()
    const result = fold(jsx(`export const A = () => <styled.div color="red.300" padding="4" />`))

    const css = getCss()
    for (const selector of selectorsFor(result.folded[0]!.className)) expect(css).toContain(selector)
  })

  test('nested elements both fold', () => {
    const { fold } = createFoldFixture()
    const result = fold(
      jsx(`export const A = () => <styled.div color="red.300"><styled.span padding="4">hi</styled.span></styled.div>`),
    )

    // Both fold. The outer only rewrites its own two tags, so the inner element is not
    // inside anything that was overwritten.
    expect(result.folded).toHaveLength(2)
    expect(result.code).not.toContain('styled.')
    expect(result.code).toContain('<div className={"c_red.300"}><span className={"p_4"}>hi</span></div>')
  })
})

describe('declines', () => {
  const cases: Array<{ name: string; body: string }> = [
    { name: 'a spread', body: `export const A = ({ rest }) => <styled.div color="red.300" {...rest} />` },
    { name: 'a dynamic style prop', body: `export const A = ({ t }) => <styled.div color={t} />` },
    { name: 'an as prop', body: `export const A = () => <styled.div as="section" color="red.300" />` },
    { name: 'an unstyled prop', body: `export const A = () => <styled.div unstyled color="red.300" />` },
    { name: 'a css prop', body: `export const A = () => <styled.div css={{ color: 'red.300' }} />` },
    { name: 'a ref', body: `export const A = ({ r }) => <styled.div ref={r} color="red.300" />` },
    { name: 'a children prop', body: `export const A = () => <styled.div color="red.300" children="hi" />` },
    { name: 'a dynamic className', body: `export const A = ({ c }) => <styled.div color="red.300" className={c} />` },
    { name: 'an htmlSize prop', body: `export const A = () => <styled.input color="red.300" htmlSize={4} />` },
    { name: 'an htmlWidth prop', body: `export const A = () => <styled.img color="red.300" htmlWidth={4} />` },
    { name: 'a capitalised component', body: `export const A = () => <styled.Thing color="red.300" />` },
    { name: 'no style props at all', body: `export const A = () => <styled.div id="x" />` },
  ]

  test.each(cases)('$name', ({ body }) => {
    expectUnchanged(body)
  })

  test('a factory call rather than a member access', () => {
    const { fold } = createFoldFixture()
    const code = `import { styled } from 'styled-system/jsx'\nconst B = styled('div', { base: { color: 'red.300' } })\n`

    // `styled(...)` binds a component elsewhere; there is no element here to collapse.
    expect(fold(code).code).toBe(code)
  })

  test('a pattern component is left to the runtime', () => {
    const { fold } = createFoldFixture()
    const code = `import { Stack } from 'styled-system/jsx'\nexport const A = () => <Stack gap="4">hi</Stack>\n`

    expect(fold(code).folded).toHaveLength(0)
    expect(fold(code).code).toBe(code)
  })

  test('the jsx option turns it off', () => {
    const { ctx } = createFoldFixture()
    const code = jsx(`export const A = () => <styled.div color="red.300" />`)

    ctx.project.addSourceFile('app/off.tsx', code)
    const parserResult = ctx.project.parseSourceFile('app/off.tsx')!

    const result = foldSource({ ctx, code, parserResult, filePath: 'app/off.tsx', jsx: false })

    expect(result.folded).toHaveLength(0)
    expect(result.code).toBe(code)
  })
})

describe('mixed with call sites', () => {
  test('a css() call and an element in one module both fold', () => {
    const { fold } = createFoldFixture()
    const result = fold(
      `import { css } from 'styled-system/css'
import { styled } from 'styled-system/jsx'
export const cls = css({ display: 'flex' })
export const A = () => <styled.div color="red.300" />
`,
    )

    expect(result.folded).toHaveLength(2)
    expect(result.code).toContain('export const cls = "d_flex"')
    expect(result.code).toContain('<div className={"c_red.300"} />')
  })

  test('a declining element does not stop a call site folding', () => {
    const { fold } = createFoldFixture()
    const result = fold(
      `import { css } from 'styled-system/css'
import { styled } from 'styled-system/jsx'
export const cls = css({ display: 'flex' })
export const A = ({ rest }) => <styled.div color="red.300" {...rest} />
`,
    )

    expect(result.folded).toHaveLength(1)
    expect(result.code).toContain('export const cls = "d_flex"')
    expect(result.code).toContain('{...rest}')
  })
})
