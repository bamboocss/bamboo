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
    // A responsive array, since a scalar lowers to the leaf helper. Both of the shapes
    // here decline for their own reason rather than for want of a `cx` binding, which the
    // `styled`-only prelude would otherwise supply for free — an assertion that passes
    // because the helper is missing proves nothing about the rule it is named for.
    {
      name: 'a dynamic style prop with nothing to hoist',
      body: `export const A = ({ t }) => <styled.div color={[t, t]} />`,
    },
    { name: 'an unstyled prop', body: `export const A = () => <styled.div unstyled color="red.300" />` },
    { name: 'a css prop', body: `export const A = () => <styled.div css={{ color: 'red.300' }} />` },
    {
      name: 'a dynamic className written before a call',
      body: `export const A = ({ c, f }) => <styled.div color="red.300" className={c} id={f()} />`,
    },
    { name: 'an htmlSize prop', body: `export const A = () => <styled.input color="red.300" htmlSize={4} />` },
    { name: 'an htmlWidth prop', body: `export const A = () => <styled.img color="red.300" htmlWidth={4} />` },
    { name: 'a capitalised component', body: `export const A = () => <styled.Thing color="red.300" />` },
    { name: 'no style props at all', body: `export const A = () => <styled.div id="x" />` },
  ]

  test.each(cases)('$name', ({ body }) => {
    expectUnchanged(body)
  })

  // `ref`, `key` and `children` were declined alongside `unstyled` and `css`, but unlike
  // those two they change nothing about styling. The factory takes `ref` through
  // `forwardRef` and passes it to `createElement`, so an intrinsic tag receives the same
  // prop; `key` never reaches the component; and `children ?? combinedProps.children`
  // matches `createElement`'s own rule that the third argument beats `props.children`.
  test.each([
    [
      'a ref',
      `export const A = ({ r }) => <styled.div ref={r} color="red.300" />`,
      '<div ref={r} className={"c_red.300"} />',
    ],
    [
      'a key',
      `export const A = ({ k }) => <styled.div key={k} color="red.300" />`,
      '<div key={k} className={"c_red.300"} />',
    ],
    [
      'a children prop',
      `export const A = () => <styled.div color="red.300" children="hi" />`,
      '<div children="hi" className={"c_red.300"} />',
    ],
  ])('%s no longer blocks the fold', (_name, body, expected) => {
    const { fold } = createFoldFixture()
    const result = fold(jsx(body))

    expect(result.folded).toHaveLength(1)
    expect(result.code).toContain(expected)
  })

  test('a children prop declines when the target is a component', () => {
    const { fold } = createFoldFixture()
    // `children ?? combinedProps.children` collapses `null` to `undefined`, so a
    // component's destructuring default fires where the folded `children={null}` would
    // not. An intrinsic tag has no defaults, so only an `as` can expose it.
    for (const body of [
      `export const A = ({ c, Comp }) => <styled.div as={Comp} color="red.300" children={c} />`,
      `export const A = ({ c, Comp }) => <styled.div color="red.300" children={c} as={Comp} />`,
    ]) {
      const code = jsx(body)
      expect(fold(code).folded, body).toHaveLength(0)
      expect(fold(code).code, body).toBe(code)
    }
  })

  test.each([
    ['vue', 0],
    ['solid', 0],
    ['qwik', 0],
    ['preact', 0],
    ['react', 1],
  ])('a ref folds under %s: %i', (framework, folded) => {
    // React only, and measured rather than inferred: Preact was allowed here on the
    // strength of `forwardRef` appearing in its factory, and under this repo's compat
    // setup an unfolded ref binds the component instance while a folded one binds the
    // node. In Vue the same divergence holds for the plain reason.
    const { fold } = createFoldFixture({ jsxFramework: framework } as never)
    const result = fold(jsx(`export const A = ({ r }) => <styled.div color="red.300" ref={r} />`))

    expect(result.folded).toHaveLength(folded)
  })

  test.each([['vue'], ['solid'], ['qwik'], ['preact'], ['react']])(
    'an element with no ref folds under %s, so the gate is what the zeros measure',
    (framework) => {
      const { fold } = createFoldFixture({ jsxFramework: framework } as never)
      const result = fold(jsx(`export const A = () => <styled.div color="red.300" />`))

      expect(result.folded).toHaveLength(1)
    },
  )

  // The runtime hands `jsxElement` to `createElement` as a string, so it always names an
  // intrinsic element there. Written back as JSX, `Section` is a variable reference and
  // `foo.bar` a member expression — `<Section />` folds to `createElement(undefined)` and
  // throws. The `div` row is the control: without it, an `extend` that clobbered the
  // pattern would make the zeros pass for the wrong reason.
  test.each([
    ['div', 1],
    ['linearGradient', 1],
    ['my-element', 1],
    ['Section', 0],
    ['foo.bar', 0],
  ])('a pattern whose jsxElement is %s folds: %i', (jsxElement, folded) => {
    const { fold } = createFoldFixture({ patterns: { extend: { stack: { jsxElement } } } } as never)
    const code = pat(`export const A = () => <Stack gap="4" />`)

    expect(fold(code).folded).toHaveLength(folded)
    if (!folded) expect(fold(code).code).toBe(code)
  })

  test('a ref survives an as that names a component', () => {
    const { fold } = createFoldFixture()
    // `createElement(Element, { …, ref })` is what the factory already does, so handing
    // the same prop to whatever `as` names is the identical call.
    const result = fold(jsx(`export const A = ({ r, Link }) => <styled.div as={Link} ref={r} color="red.300" />`))

    expect(result.code).toContain('<Link ref={r} className={"c_red.300"} />')
  })

  test('unstyled and a css prop still block it', () => {
    // These two do change the styling: `unstyled` skips the recipe, `css` merges above
    // the style props.
    expectUnchanged(`export const A = () => <styled.div color="red.300" unstyled />`)
    expectUnchanged(`export const A = () => <styled.div color="red.300" css={{ margin: '2' }} />`)
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

  /**
   * A dot is the casing hazard spelled differently, and lowercasing does not save it:
   * `<foo.bar>` is a JSX member expression, so it compiles to a property read off a
   * variable in scope, where the factory would have created an intrinsic element named
   * literally `foo.bar`. Nothing about the value looks wrong, which is why it needs a
   * test rather than a glance.
   */
  test('a dotted string bails, since JSX would read it as a member expression', () => {
    expectUnchanged(`export const A = () => <styled.div as="foo.bar" color="red.300" />`)
  })

  test('an underscored name still folds, since it is an ordinary identifier', () => {
    const { fold } = createFoldFixture()
    const result = fold(jsx(`export const A = () => <styled.div as="my_widget" color="red.300" />`))

    expect(result.code).toContain('<my_widget className={"c_red.300"} />')
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

  test('a pattern element keeps a ref too', () => {
    const { fold } = createFoldFixture()
    const result = fold(pat(`export const A = ({ r }) => <Stack gap="4" ref={r} />`))

    expect(result.folded).toHaveLength(1)
    expect(result.code).toContain('<div ref={r} className={"d_flex flex-d_column gap_4"} />')
  })

  test.each([
    ['a spread', `export const A = ({ rest }) => <Stack gap="4" {...rest} />`],
    ['a dynamic pattern prop', `export const A = ({ g }) => <Stack gap={g} />`],
    ['a dynamic style prop', `export const A = ({ t }) => <Stack gap="4" color={t} />`],
    ['a css prop', `export const A = () => <Stack gap="4" css={{ color: 'red.300' }} />`],
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

const both = (body: string) =>
  `import { css } from 'styled-system/css'\nimport { styled } from 'styled-system/jsx'\n${body}\n`

describe('partially folding an element', () => {
  test('static style props become a literal, dynamic ones are lowered', () => {
    const { fold } = createFoldFixture()
    const result = fold(both(`export const A = ({ tone }) => <styled.div color="red.300" backgroundColor={tone} />`))

    expect(result.folded).toHaveLength(1)
    expect(result.code).toContain('<div className={cx("c_red.300", cssLeaf("bg-c_", "backgroundColor", tone))} />')
    expect(result.code).not.toContain('styled.div')
  })

  test('a dynamic prop that cannot be lowered keeps its css() call', () => {
    const { fold } = createFoldFixture()
    // A responsive array is one class per breakpoint, which no single prefix describes.
    const result = fold(both(`export const A = ({ p }) => <styled.div color="red.300" padding={['1', p]} />`))

    expect(result.code).toContain(`<div className={cx("c_red.300", css({ padding: ['1', p] }))} />`)
  })

  test('the helpers are added to the existing css import', () => {
    const { fold } = createFoldFixture()
    const result = fold(both(`export const A = ({ tone }) => <styled.div color="red.300" backgroundColor={tone} />`))

    expect(result.code).toContain(`import { css, cx, cssLeaf } from 'styled-system/css'`)
  })

  test('a lowered prop and a residual one keep the order they were written in', () => {
    const { fold } = createFoldFixture()

    const leafFirst = fold(
      both(`export const A = ({ a, p }) => <styled.div color="red.300" bg={a} padding={['1', p]} />`),
    )
    expect(leafFirst.code).toContain(`cx("c_red.300", cssLeaf("bg_", "bg", a), css({ padding: ['1', p] }))`)

    const residueFirst = fold(
      both(`export const B = ({ a, p }) => <styled.div color="red.300" padding={['1', p]} bg={a} />`),
      'app/src/b.tsx',
    )
    expect(residueFirst.code).toContain(`cx("c_red.300", css({ padding: ['1', p] }), cssLeaf("bg_", "bg", a))`)
  })

  test('interleaving sends every lowered prop back to the call', () => {
    const { fold } = createFoldFixture()
    const result = fold(
      both(`export const A = ({ a, p, m }) => <styled.div color="red.300" bg={a} padding={['1', p]} margin={m} />`),
    )

    // Splitting the residue around the lowered props would turn one last-wins merge into
    // two independent ones, so the lowering is declined rather than reordered.
    expect(result.code).toContain(`cx("c_red.300", css({ bg: a, padding: ['1', p], margin: m }))`)
    expect(result.code).not.toContain('cssLeaf')
  })

  test('two props claiming one property are not lowered apart', () => {
    const { fold } = createFoldFixture()
    const result = fold(both(`export const A = ({ a, b }) => <styled.div color="red.300" mx={a} marginInline={b} />`))

    // Last-wins inside one `css()` object; lowering either would emit both classes.
    expect(result.code).toContain('css({ mx: a, marginInline: b })')
    expect(result.code).not.toContain('cssLeaf')
  })

  test('non-style props still pass through', () => {
    const { fold } = createFoldFixture()
    const result = fold(
      both(
        `export const A = ({ tone, fn }) => <styled.div color="red.300" backgroundColor={tone} id="x" onClick={fn} />`,
      ),
    )

    expect(result.code).toContain('id="x"')
    expect(result.code).toContain('onClick={fn}')
  })

  // A dynamic className used to bail. It folds now, because the split already emits a
  // `cx` and the factory's own `cx(styles, props.className)` puts it in the same place.
  test('a dynamic className becomes the last cx argument', () => {
    const { fold } = createFoldFixture()
    const result = fold(both(`export const A = ({ cn }) => <styled.div color="red.300" className={cn} />`))

    expect(result.folded).toHaveLength(1)
    expect(result.code).toContain('<div className={cx("c_red.300", cn)} />')
  })

  test('a dynamic className goes after the lowered props, not where it was written', () => {
    const { fold } = createFoldFixture()
    const result = fold(both(`export const A = ({ cn, t }) => <styled.div color="red.300" bg={t} className={cn} />`))

    // The factory appends it after the styles, so a class it carries wins over them.
    expect(result.code).toContain('cx("c_red.300", cssLeaf("bg_", "bg", t), cn)')
  })

  // It has to be emitted last for the cascade and first for evaluation order, and both
  // are arbitrary expressions — so the two cannot be satisfied at once. Anything written
  // after it counts, whichever half of the element it belongs to: a style prop that stays
  // an expression, and a passthrough prop, which keeps its own place among the attributes.
  test.each([
    ['before a dynamic prop', `<styled.div className={cn} color="red.300" bg={t()} />`],
    ['between two dynamic props', `<styled.div bg={t()} className={cn} color={t()} />`],
    ['before a residual css() call', `<styled.div bg={t()} className={cn} padding={['1', t()]} />`],
    ['before a passthrough call', `<styled.div color="red.300" className={cn} id={t()} />`],
    // Legal, holds arbitrary expressions, and is not a `JsxExpression` — so a rule that
    // listed the kinds carrying code rather than asking what an initializer *is* let it
    // through.
    ['before a jsx-element initializer', `<styled.div color="red.300" className={cn} title=<Tag x={t()} /> />`],
    ['before a jsx fragment initializer', `<styled.div color="red.300" className={cn} title=<>{t()}</> />`],
    ['before a template with a call', `<styled.div color="red.300" className={cn} id={\`a\${t()}\`} />`],
    ['before a property access, which may be a getter', `<styled.div color="red.300" className={cn} id={t.x} />`],
  ])('a dynamic className written %s declines', (_label, element) => {
    const { fold } = createFoldFixture()
    const code = both(`export const A = ({ cn, t }) => ${element}`)

    expect(fold(code).folded).toHaveLength(0)
    expect(fold(code).code).toBe(code)
  })

  // Reordering only matters when something can observe it. Reading a literal or a binding
  // runs nothing, and a static style prop is resolved away rather than emitted at all — so
  // these fold despite sitting after the className.
  test.each([
    ['an identifier passthrough', `<styled.div color="red.300" className={cn} onClick={h} />`],
    ['a numeric style prop', `<styled.div color="red.300" className={cn} zIndex={10} />`],
    ['an object of literals', `<styled.div color="red.300" className={cn} _hover={{ color: 'blue.500' }} />`],
    ['a boolean shorthand', `<styled.div color="red.300" className={cn} hidden />`],
    ['a literal passthrough', `<styled.div color="red.300" className={cn} id="x" />`],
  ])('a dynamic className written before %s still folds', (_label, element) => {
    const { fold } = createFoldFixture()
    const result = fold(both(`export const A = ({ cn, h }) => ${element}`))

    expect(result.folded).toHaveLength(1)
    expect(result.code).toContain('cn)')
  })

  // The question is not whether an expression runs code but whether swapping two of them
  // is observable, and `A;B` becoming `B;A` shows as soon as `A` writes what `B` reads. So
  // a survivor that only reads is safe only while the className cannot write.
  test.each([
    ['a read style prop', `<styled.span className={bump()} bg={tone} />`],
    ['a read passthrough', `<styled.div color="red.300" className={bump()} data-mark={tone} />`],
    ['a read as', `<styled.div color="red.300" className={bump()} as={Tone} />`],
  ])('a className that may write declines before %s', (_label, element) => {
    const { fold } = createFoldFixture()
    const code = both(`export const A = ({ bump, tone, Tone }) => ${element}`)

    expect(fold(code).folded).toHaveLength(0)
    expect(fold(code).code).toBe(code)
  })

  test.each([
    ['a literal passthrough', `<styled.div color="red.300" className={bump()} id="x" />`],
    ['a numeric style prop', `<styled.div color="red.300" className={bump()} zIndex={10} />`],
  ])('a className that may write still folds before %s', (_label, element) => {
    const { fold } = createFoldFixture()
    // A constant neither reads nor writes, so it commutes with anything.
    const result = fold(both(`export const A = ({ bump }) => ${element}`))

    expect(result.folded).toHaveLength(1)
  })

  test('two static classNames still fold, last winning', () => {
    const { fold } = createFoldFixture()
    // Both slots are the same kind, so the later simply overwrites — which is what the
    // runtime does with a duplicate attribute too.
    const result = fold(both(`export const A = () => <styled.div color="red.300" className="a" className="b" />`))

    expect(result.code).toContain('<div className={"c_red.300 b"} />')
  })

  test('a className written twice declines', () => {
    const { fold } = createFoldFixture()
    // JSX keeps the last and evaluates both. Emitting one of each slot applies a class the
    // runtime dropped; picking one loses the other's side effect.
    const code = both(`export const A = ({ cn }) => <styled.div color="red.300" className="x" className={cn} />`)

    expect(fold(code).folded).toHaveLength(0)
    expect(fold(code).code).toBe(code)
  })

  test('a static passthrough after the className is fine', () => {
    const { fold } = createFoldFixture()
    const result = fold(both(`export const A = ({ cn }) => <styled.div color="red.300" className={cn} id="x" />`))

    // A literal attribute is not an expression, so nothing can be observed running early.
    expect(result.code).toContain('<div id="x" className={cx("c_red.300", cn)} />')
  })

  test('written first is fine when nothing else is an expression', () => {
    const { fold } = createFoldFixture()
    const result = fold(both(`export const A = ({ cn }) => <styled.div className={cn} color="red.300" />`))

    // Only `cn` is evaluated, so where it sat cannot be observed.
    expect(result.code).toContain('<div className={cx("c_red.300", cn)} />')
  })

  test("an element whose only class is the caller's still sheds its factory", () => {
    const { fold } = createFoldFixture()
    const result = fold(both(`export const A = ({ cn }) => <styled.div className={cn} />`))

    expect(result.code).toContain('<div className={cx(cn)} />')
    expect(result.code).not.toContain('styled.div')
  })

  test('a static className is folded into the literal half', () => {
    const { fold } = createFoldFixture()
    const result = fold(
      both(`export const A = ({ tone }) => <styled.div color="red.300" className="mine" backgroundColor={tone} />`),
    )

    expect(result.code).toContain('cx("c_red.300 mine", cssLeaf("bg-c_", "backgroundColor", tone))')
  })

  test('children and the closing tag survive', () => {
    const { fold } = createFoldFixture()
    const result = fold(both(`export const A = ({ tone }) => <styled.span color="red.300" bg={tone}>hi</styled.span>`))

    expect(result.code).toContain('>hi</span>')
  })

  test('a static as prop still names the tag', () => {
    const { fold } = createFoldFixture()
    const result = fold(
      both(`export const A = ({ tone }) => <styled.div as="section" color="red.300" backgroundColor={tone} />`),
    )

    expect(result.code).toContain('<section className={cx(')
  })

  test('the split half is backed by emitted css', () => {
    const { fold, getCss } = createFoldFixture()
    const result = fold(both(`export const A = ({ tone }) => <styled.div color="red.300" padding="4" bg={tone} />`))

    const css = getCss()
    for (const selector of selectorsFor(result.folded[0]!.className)) expect(css).toContain(selector)
  })
})

describe('elements that must not split', () => {
  test('a shorthand colliding with a dynamic longhand', () => {
    const { fold } = createFoldFixture()
    const code = both(`export const A = ({ m }) => <styled.div mx="4" marginInline={m} />`)

    // Both resolve to one property; the factory keeps the last, a split emits both.
    expect(fold(code).folded).toHaveLength(0)
    expect(fold(code).code).toBe(code)
  })

  test('a file with no css import', () => {
    const { fold } = createFoldFixture()
    const code = `import { styled } from 'styled-system/jsx'\nexport const A = ({ tone }) => <styled.div color="red.300" backgroundColor={tone} />\n`

    // The dynamic half needs a `css()` call, and writing a new import would mean guessing
    // a module specifier.
    expect(fold(code).folded).toHaveLength(0)
    expect(fold(code).code).toBe(code)
  })

  test('a spread', () => {
    const { fold } = createFoldFixture()
    const code = both(`export const A = ({ tone, rest }) => <styled.div color="red.300" bg={tone} {...rest} />`)

    expect(fold(code).folded).toHaveLength(0)
  })

  test('a style prop with an empty expression container', () => {
    const { fold } = createFoldFixture()
    const code = both(`export const A = () => <styled.div color="red.300" truncate={} />`)

    // `not.toThrow()` was true of every input in this file and asserted nothing.
    expect(fold(code).folded).toHaveLength(0)
  })

  test('a css prop alongside a dynamic style prop', () => {
    const { fold } = createFoldFixture()
    const code = both(`export const A = ({ tone }) => <styled.div css={{ margin: '2' }} bg={tone} />`)

    expect(fold(code).folded).toHaveLength(0)
  })

  test('a shadowed css binding', () => {
    const { fold } = createFoldFixture()
    const code = both(`export const A = ({ tone, css }) => <styled.div color="red.300" bg={tone} />`)

    expect(fold(code).folded).toHaveLength(0)
  })

  test('an element whose static half resolves to no class, and nothing lowers', () => {
    const { fold } = createFoldFixture()
    // A responsive array cannot lower, so there is neither a class to hoist nor a prop to
    // lower — the split would emit the same `css()` call wrapped in a `cx()`.
    const code = both(`export const A = ({ p }) => <styled.div padding={['1', p]} />`)

    expect(fold(code).folded).toHaveLength(0)
    expect(fold(code).code).toBe(code)
  })

  test('an element with no static half still folds when a prop lowers', () => {
    const { fold } = createFoldFixture()
    const result = fold(both(`export const A = ({ tone }) => <styled.div backgroundColor={tone} />`))

    // Nothing to hoist, but the factory layer goes with the lowered prop — which is the
    // case where the factory was pure overhead, since no static class amortised it.
    expect(result.folded).toHaveLength(1)
    expect(result.code).toContain('<div className={cx(cssLeaf("bg-c_", "backgroundColor", tone))} />')
    expect(result.code).not.toContain('styled.div')
  })
})

/**
 * Every shape here was reported by an independent review. Each folded away a style the
 * factory would have applied, and each was invisible to the class-name assertions above:
 * the element still carried *a* class, just not all of them.
 *
 * The common cause: the extractor keeps an `unresolvable` leaf inside the box while
 * `unbox` drops it from the data, so the parent key survives as an empty object and reads
 * as static unless the box itself is consulted.
 */
describe('regressions the first jsx split had', () => {
  const cases: Array<{ name: string; props: string; runtime: string }> = [
    {
      name: 'a dynamic value in a condition block',
      props: `_hover={{ color: t }}`,
      runtime: 'css({ _hover: { color: t }',
    },
    {
      name: 'a dynamic value in a responsive object',
      props: `fontSize={{ base: 'sm', md: t }}`,
      runtime: "css({ fontSize: { base: 'sm', md: t }",
    },
    {
      name: 'a dynamic element in a responsive array',
      props: `padding={['1', t]}`,
      runtime: "css({ padding: ['1', t]",
    },
    {
      name: 'a partly dynamic condition block',
      props: `_hover={{ margin: '2', color: t }}`,
      runtime: "css({ _hover: { margin: '2', color: t }",
    },
    { name: 'a dynamic value under a breakpoint key', props: `md={{ color: t }}`, runtime: 'css({ md: { color: t }' },
    {
      name: 'a dynamic value two conditions deep',
      props: `_hover={{ _dark: { color: t } }}`,
      runtime: 'css({ _hover: { _dark: { color: t } }',
    },
    {
      name: 'a spread inside a prop value',
      props: `_hover={{ ...rest }}`,
      runtime: 'css({ _hover: { ...rest }',
    },
    {
      name: 'a spread beside a static value inside a prop',
      props: `_hover={{ margin: '2', ...rest }}`,
      runtime: "css({ _hover: { margin: '2', ...rest }",
    },
  ]

  test.each(cases)('$name moves to the runtime half rather than being folded away', ({ props, runtime }) => {
    const { fold } = createFoldFixture()
    const code = both(`export const A = ({ t, o, rest }) => <styled.div color="red.300" ${props} bg={o} />`)

    const result = fold(code)

    // Naming the expected runtime half, because a looser assertion cannot fail: an
    // earlier version checked the output contained `t`, which matches the `t` in
    // `styled-system/jsx` and so passed against output with the whole block dropped.
    expect(result.folded).toHaveLength(1)
    expect(result.code).toContain(runtime)
    expect(result.folded[0]!.className).toBe('c_red.300')
  })

  test.each(cases)('$name is not absorbed into the static half', ({ props }) => {
    const { fold } = createFoldFixture()
    const result = fold(both(`export const A = ({ t, o, rest }) => <styled.div color="red.300" ${props} bg={o} />`))

    // The static class must be exactly the one static prop. Anything more means part of
    // the dynamic value was resolved and baked in.
    expect(result.folded[0]!.className.split(' ')).toEqual(['c_red.300'])
  })

  test('the whole-element path does not collapse a ternary to one branch', () => {
    const { fold } = createFoldFixture()
    const code = both(`export const A = ({ f }) => <styled.div color={f ? 'red.300' : 'blue.500'} />`)

    // Pre-existing: with no `data.length` guard the element folded to `"c_red.300"`.
    expect(fold(code).folded).toHaveLength(0)
    expect(fold(code).code).toBe(code)
  })

  test('the whole-element path keeps a dynamic condition block', () => {
    const { fold } = createFoldFixture()
    const code = `import { styled } from 'styled-system/jsx'\nexport const A = ({ t }) => <styled.div color="red.300" _hover={{ color: t }} />\n`

    // Pre-existing, and with no css import there is no split to fall back on.
    expect(fold(code).folded).toHaveLength(0)
    expect(fold(code).code).toBe(code)
  })
})
