import { describe, expect, test } from 'vitest'
import { createFoldFixture, selectorsFor } from './fixture'

/**
 * `css` under `syntax: 'template-literal'`.
 *
 * A tagged template is not a call, so it never reached `findCallExpression` and every one
 * of them was declined as `no-call-expression` — including the ones that resolve to a
 * plain class string, which is most of them in a project using this syntax.
 *
 * The risk that shapes the whole feature: in this mode the parser records *every* styling
 * tag as type `css`, `styled.button` and `styled('span')` included. Those define
 * components. Folding one to a string would replace a component with text, so what the
 * tag actually is has to be established rather than assumed.
 */
const templateLiteral = { syntax: 'template-literal' as const, jsxFramework: 'react' as const }

describe('fold: css tagged templates', () => {
  test('a static template folds to its class string', () => {
    const { fold, getCss } = createFoldFixture(templateLiteral)

    const result = fold(`
      import { css } from 'styled-system/css'
      export const cls = css\`
        color: red.300;
        padding: 4px;
      \`
    `)

    expect(result.folded).toHaveLength(1)

    const className = result.folded[0]!.className
    expect(className).toBe('color_red.300 padding_4px')
    expect(result.code).toContain(JSON.stringify(className))

    // The classes it folded to are the ones the build emitted rules for.
    const css = getCss()
    for (const selector of selectorsFor(className)) expect(css).toContain(selector)
  })

  test('an aliased import folds', () => {
    const { fold } = createFoldFixture(templateLiteral)

    const result = fold(`
      import { css as xcss } from 'styled-system/css'
      export const cls = xcss\`color: blue.500;\`
    `)

    expect(result.folded[0]!.className).toBe('color_blue.500')
  })

  test('folding is idempotent', () => {
    const { fold } = createFoldFixture(templateLiteral)

    const once = fold(`
      import { css } from 'styled-system/css'
      export const cls = css\`color: red.300;\`
    `)
    const twice = createFoldFixture(templateLiteral).fold(once.code)

    expect(twice.code).toBe(once.code)
  })
})

describe('fold: tagged templates that are not a class', () => {
  const cases: Array<{ name: string; reason: string; code: string }> = [
    {
      // The case the tag check exists for. This defines a component; the fold has no
      // business turning it into a string.
      name: 'a styled factory member',
      reason: 'unsupported-kind',
      code: `
        import { styled } from 'styled-system/jsx'
        export const Button = styled.button\`color: green.300;\`
      `,
    },
    {
      name: 'a styled factory call',
      reason: 'unsupported-kind',
      code: `
        import { styled } from 'styled-system/jsx'
        export const Span = styled('span')\`color: gray.100;\`
      `,
    },
    {
      // The parser reads the template *text*; an interpolation is a value that text
      // cannot carry, so nothing accounts for it.
      name: 'an interpolated template',
      reason: 'dynamic',
      code: `
        import { css } from 'styled-system/css'
        export const make = (tone) => css\`color: \${tone};\`
      `,
    },
    {
      name: 'a local binding shadowing the import',
      reason: 'not-imported',
      code: `
        import { css } from 'styled-system/css'
        export const make = (css) => css\`color: red.300;\`
      `,
    },
    {
      name: 'a same-named tag from somewhere else',
      reason: 'not-imported',
      code: `
        import { css } from '@emotion/css'
        export const cls = css\`color: red.300;\`
      `,
    },
  ]

  for (const { name, reason, code } of cases) {
    test(name, () => {
      const { fold } = createFoldFixture(templateLiteral)
      const result = fold(code)

      expect(result.code, name).toBe(code)
      expect(result.folded, name).toHaveLength(0)
      expect(
        result.skipped.map((entry) => entry.reason),
        name,
      ).toContain(reason)
    })
  }
})

describe('fold: tagged templates outside template-literal syntax', () => {
  test('the default syntax leaves them alone', () => {
    const { fold } = createFoldFixture()

    const code = `
      import { css } from 'styled-system/css'
      export const cls = css\`color: red.300;\`
    `

    // The parser only reads tagged templates under `syntax: 'template-literal'`, so
    // outside it there is no extraction behind this and nothing to fold against. A class
    // folded here would have no rule.
    const result = fold(code)

    expect(result.folded).toHaveLength(0)
    expect(result.code).toBe(code)
  })
})
