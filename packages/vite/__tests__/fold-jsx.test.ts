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

describe('the factory has to be bamboo', () => {
  test('a local object named styled is not folded', () => {
    const { fold } = createFoldFixture()
    const code = `const styled = { div: (p) => null }\nexport const A = () => <styled.div color="red.300" />\n`

    // Same hazard as a local function named `css`: the element only looks like bamboo's.
    expect(fold(code).folded).toHaveLength(0)
    expect(fold(code).code).toBe(code)
  })

  /**
   * The import being present is what makes these different from the case above, and it
   * is the realistic arrangement: a module that uses the factory throughout and takes a
   * `styled` prop, or names a local, in one component. The parser matches a factory by
   * name and does not ask which binding is in scope, so the fold has to.
   *
   * Getting this wrong is worse here than at a call site. There the damage is a wrong
   * string; here the user's own component is deleted from the markup and replaced by a
   * bare intrinsic tag.
   */
  const shadowed: Array<{ name: string; body: string }> = [
    { name: 'a destructured parameter', body: `export const A = ({ styled }) => <styled.div color="red.300" />` },
    { name: 'a plain parameter', body: `export function A(styled) { return <styled.div color="red.300" /> }` },
    {
      name: 'a block-scoped const',
      body: `export function A() {\n  const styled = { div: (p) => null }\n  return <styled.div color="red.300" />\n}`,
    },
    {
      name: 'a destructured local',
      body: `export function A(p) {\n  const { styled } = p\n  return <styled.div color="red.300" />\n}`,
    },
  ]

  test.each(shadowed)('$name shadowing the factory is not folded', ({ body }) => {
    const result = expectUnchanged(body)

    expect(result.skipped.map((s) => s.reason)).toContain('not-imported')
  })

  test('an unshadowed element in the same module still folds', () => {
    const { fold } = createFoldFixture()

    // The guard must reject the shadowed element without disabling the surface.
    const result = fold(
      jsx(
        `export const A = ({ styled }) => <styled.div color="red.300" />\nexport const B = () => <styled.div p="4" />`,
      ),
    )

    expect(result.folded).toHaveLength(1)
    expect(result.code).toContain(`export const A = ({ styled }) => <styled.div color="red.300" />`)
    expect(result.code).toContain(`export const B = () => <div className={"p_4"} />`)
  })
})

describe('prop value shapes', () => {
  test('a boolean shorthand prop folds to its true value', () => {
    const { fold, runtimeCss } = createFoldFixture()
    const result = fold(jsx(`export const A = () => <styled.div truncate />`))

    expect(result.folded[0]!.className).toBe(runtimeCss({ truncate: true }))
  })

  test('a numeric prop folds', () => {
    const { fold, runtimeCss } = createFoldFixture()
    const result = fold(jsx(`export const A = () => <styled.div zIndex={10} />`))

    expect(result.folded[0]!.className).toBe(runtimeCss({ zIndex: 10 }))
  })
})

/**
 * Corruption risks drawn from upstream's jsx suite. Resolving the closing tag through
 * the AST rather than by matching text makes most of these safe by construction — but
 * "safe by construction" is worth an assertion, since the construction can change.
 */
describe('does not corrupt output', () => {
  test('nested elements of the same name pair their own closing tags', () => {
    const { fold } = createFoldFixture()
    const result = fold(
      jsx(`export const A = () => <styled.div color="red.300"><styled.div padding="4">hi</styled.div></styled.div>`),
    )

    expect(result.folded).toHaveLength(2)
    expect(result.code).toContain('<div className={"c_red.300"}><div className={"p_4"}>hi</div></div>')
  })

  test('a closing tag written inside a string child is not treated as markup', () => {
    const { fold } = createFoldFixture()
    const result = fold(jsx(`export const A = () => <styled.div color="red.300">{"</styled.div>"}</styled.div>`))

    expect(result.code).toContain('{"</styled.div>"}')
    expect(result.code).toContain('<div className={"c_red.300"}>')
  })

  test('a css() call among the children still folds', () => {
    const { fold } = createFoldFixture()
    const result = fold(
      `import { css } from 'styled-system/css'
import { styled } from 'styled-system/jsx'
export const A = () => <styled.div color="red.300"><span className={css({ padding: '4' })} /></styled.div>
`,
    )

    expect(result.folded).toHaveLength(2)
    expect(result.code).toContain('<div className={"c_red.300"}>')
    expect(result.code).toContain('className={"p_4"}')
  })

  test('a brace inside an attribute string value survives', () => {
    const { fold } = createFoldFixture()
    const result = fold(jsx(`export const A = () => <styled.div color="red.300" data-x="{a}" />`))

    expect(result.code).toContain('data-x="{a}"')
  })

  test('a class name containing a quote is emitted as a valid expression', () => {
    const { fold } = createFoldFixture()
    const result = fold(jsx(`export const A = () => <styled.div color='[var(--x, "red")]' />`))

    // The attribute form cannot carry an unescaped quote, so the class goes in an
    // expression container with the quote escaped.
    expect(result.folded).toHaveLength(1)
    expect(result.code).toContain('className={"c_[var(--x,_\\"red\\")]"}')
  })
})

describe('the as prop', () => {
  test('a string literal names the folded tag', () => {
    const { fold } = createFoldFixture()
    const result = fold(jsx(`export const A = () => <styled.div as="section" color="red.300" />`))

    expect(result.folded).toHaveLength(1)
    expect(result.code).toContain('<section className={"c_red.300"} />')
  })

  test('the closing tag follows the as prop, not the factory tag', () => {
    const { fold } = createFoldFixture()
    const result = fold(jsx(`export const A = () => <styled.div as="section" color="red.300">hi</styled.div>`))

    expect(result.code).toContain('<section className={"c_red.300"}>hi</section>')
    expect(result.code).not.toContain('</div>')
  })

  test('an identifier names a component tag', () => {
    const { fold } = createFoldFixture()
    const result = fold(
      `import { styled } from 'styled-system/jsx'\nimport { Link } from './link'\nexport const A = () => <styled.div as={Link} color="red.300">hi</styled.div>\n`,
    )

    // `splitProps` keys off the factory's config rather than off what `as` points at,
    // so the class and the forwarded props are the same whatever the tag becomes.
    expect(result.code).toContain('<Link className={"c_red.300"}>hi</Link>')
  })

  test('a dynamic as expression bails', () => {
    expectUnchanged(`export const A = ({ El }) => <styled.div as={El.thing} color="red.300" />`)
  })

  test('a computed as expression bails', () => {
    expectUnchanged(`export const A = ({ on }) => <styled.div as={on ? "a" : "b"} color="red.300" />`)
  })

  test('an as prop with no value bails', () => {
    expectUnchanged(`export const A = () => <styled.div as color="red.300" />`)
  })

  test('a non-identifier string is rejected', () => {
    expectUnchanged(`export const A = () => <styled.div as="not a tag" color="red.300" />`)
  })

  /**
   * JSX and `createElement` disagree about casing, so the two forms only fold when their
   * casing already agrees. The mismatched pair render something else entirely.
   */
  test('a lowercase identifier bails, since JSX would read it as an intrinsic', () => {
    const { fold } = createFoldFixture()
    const code = `import { styled } from 'styled-system/jsx'\nconst thing = () => null\nexport const A = () => <styled.div as={thing} color="red.300" />\n`

    // Folding to `<thing>` would render a DOM element named `thing`, not the component.
    expect(fold(code).folded).toHaveLength(0)
    expect(fold(code).code).toBe(code)
  })

  test('a capitalised string bails, since JSX would read it as a variable', () => {
    // `createElement("Section")` is an intrinsic; `<Section>` is a reference.
    expectUnchanged(`export const A = () => <styled.div as="Section" color="red.300" />`)
  })

  test('a custom element name still folds', () => {
    const { fold } = createFoldFixture()
    const result = fold(jsx(`export const A = () => <styled.div as="my-widget" color="red.300" />`))

    expect(result.code).toContain('<my-widget className={"c_red.300"} />')
  })
})

const pat = (body: string) => `import { Box, Stack, HStack, Circle } from 'styled-system/jsx'\n${body}\n`

describe('pattern elements', () => {
  test('a pattern element collapses to the tag it renders', () => {
    const { fold, ctx, runtimeCss } = createFoldFixture()
    const result = fold(pat(`export const A = () => <Stack gap="4">hi</Stack>`))

    expect(result.folded).toHaveLength(1)
    // Same call the encoder makes, so the class is backed by an emitted rule.
    expect(result.folded[0]!.className).toBe(runtimeCss(ctx.patterns.transform('stack', { gap: '4' })))
    expect(result.code).toContain('>hi</div>')
  })

  test('the folded class is backed by emitted CSS', () => {
    const { fold, getCss } = createFoldFixture()
    const result = fold(pat(`export const A = () => <Stack gap="4" align="center" />`))

    const css = getCss()
    for (const selector of selectorsFor(result.folded[0]!.className)) expect(css).toContain(selector)
  })

  test('style props alongside pattern props are consumed', () => {
    const { fold, ctx, runtimeCss } = createFoldFixture()
    const result = fold(pat(`export const A = () => <Stack gap="4" color="red.300" />`))

    expect(result.folded[0]!.className).toBe(
      runtimeCss(ctx.patterns.transform('stack', { gap: '4', color: 'red.300' })),
    )
  })

  test('non-style props pass through', () => {
    const { fold } = createFoldFixture()
    const result = fold(pat(`export const A = () => <Box padding="4" id="x" onClick={fn} />`))

    expect(result.code).toContain('id="x"')
    expect(result.code).toContain('onClick={fn}')
  })

  test('a static as prop names the tag', () => {
    const { fold } = createFoldFixture()
    const result = fold(pat(`export const A = () => <Stack gap="4" as="section">hi</Stack>`))

    expect(result.code).toContain('<section className={')
    expect(result.code).toContain('</section>')
  })

  test('a static className is appended', () => {
    const { fold } = createFoldFixture()
    const result = fold(pat(`export const A = () => <Box padding="4" className="mine" />`))

    expect(result.folded[0]!.className.endsWith(' mine')).toBe(true)
  })

  test.each([
    ['a spread', `export const A = ({ rest }) => <Stack gap="4" {...rest} />`],
    ['a dynamic pattern prop', `export const A = ({ g }) => <Stack gap={g} />`],
    ['a dynamic style prop', `export const A = ({ t }) => <Stack gap="4" color={t} />`],
    ['a css prop', `export const A = () => <Stack gap="4" css={{ color: 'red.300' }} />`],
    ['a ref', `export const A = ({ r }) => <Stack gap="4" ref={r} />`],
  ])('declines %s', (_name, body) => {
    const { fold } = createFoldFixture()
    const code = pat(body)

    expect(fold(code).folded).toHaveLength(0)
    expect(fold(code).code).toBe(code)
  })

  test('declines when jsxStyleProps is not all', () => {
    // Under `minimal`/`none` the pattern styles reach the factory through the css prop,
    // which reverses which side wins for a prop set in both places.
    const { fold } = createFoldFixture({ jsxStyleProps: 'minimal' })
    const code = pat(`export const A = () => <Stack gap="4" />`)

    expect(fold(code).folded).toHaveLength(0)
  })
})

describe('the component has to come from bamboo', () => {
  /**
   * The parser matches an element by its tag name, whatever module it came from. That is
   * harmless for extraction and destructive here: replacing a third-party component with
   * a bamboo div deletes it.
   */
  test('a pattern-named component from a library is not folded', () => {
    const { fold } = createFoldFixture()
    const code = `import { Stack } from '@mui/material'\nexport const A = () => <Stack gap="4">hi</Stack>\n`

    const result = fold(code)
    expect(result.folded).toHaveLength(0)
    expect(result.code).toBe(code)
    expect(result.skipped.map((s) => s.reason)).toContain('not-imported')
  })

  test('a factory-named import from a library is not folded', () => {
    const { fold } = createFoldFixture()
    const code = `import { styled } from '@emotion/styled'\nexport const A = () => <styled.div color="red.300" />\n`

    expect(fold(code).folded).toHaveLength(0)
    expect(fold(code).code).toBe(code)
  })

  test('a locally defined pattern-named component is not folded', () => {
    const { fold } = createFoldFixture()
    const code = `const Stack = (p) => null\nexport const A = () => <Stack gap="4">hi</Stack>\n`

    expect(fold(code).folded).toHaveLength(0)
  })

  test('the real import still folds', () => {
    const { fold } = createFoldFixture()
    const result = fold(`import { Stack } from 'styled-system/jsx'\nexport const A = () => <Stack gap="4">hi</Stack>\n`)

    expect(result.folded).toHaveLength(1)
  })
})
