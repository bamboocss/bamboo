import rule, { RULE_NAME } from '../src/rules/no-debug'
import rule2, { RULE_NAME as RULE_NAME2 } from '../src/rules/no-dynamic-styling'
import rule3, { RULE_NAME as RULE_NAME3 } from '../src/rules/no-escape-hatch'
import rule6, { RULE_NAME as RULE_NAME6 } from '../src/rules/no-invalid-nesting'
import rule5, { RULE_NAME as RULE_NAME5 } from '../src/rules/no-invalid-token-paths'
import rule4, { RULE_NAME as RULE_NAME4 } from '../src/rules/no-unsafe-token-fn-usage'
import { eslintTester } from '../test-utils'
import { getArbitraryValue } from '@bamboocss/shared'

//* This test is just to ensure that the plugin correctly recognises bamboo in various kinds of code.

const imports = `import { css } from './bamboo/css';
import { styled, Circle } from './bamboo/jsx';\n\n`

// ? For testing correct parsing

const valids = [
  { code: 'const styles = { debug: true }' },
  { code: 'const styles = css({ bg: "red" })' },
  { code: 'const styles = css.raw({ bg: "red" })' },
  { code: 'const randomFunc = f({ debug: true })' },
  { code: '<NonBambooComponent debug={true} />' },
  { code: '<NonBambooComponent debug={true}>content</NonBambooComponent>' },
  {
    code: `const BambooComp = styled(div); function App(){ const a = 1;  return (<BambooComp someProp={{ debug: true }} />)}`,
  },
]

const invalids = [
  {
    code: 'const styles = css({ bg: "red", debug: true })',
  },
  {
    code: 'const styles = css.raw({ bg: "red", debug: true })',
  },
  {
    code: 'const styles = css({ bg: "red", "&:hover": { debug: true } })',
  },
  {
    code: 'const styles = css({ bg: "red", "&:hover": { "&:disabled": { debug: true } } })',
  },
  { code: '<Circle debug />' },
  { code: '<Circle debug={true} />' },
  { code: '<Circle css={{ debug: true }} />' },
  { code: '<Circle css={{ "&:hover": { debug: true } }} />' },
  { code: '<styled.div _hover={{ debug: true }} />' },
  {
    code: `const BambooComp = styled(div); <BambooComp css={{ debug: true }} />`,
  },
  {
    code: `function App() {
  const BambooComp = styled(div);
  return <BambooComp css={{ debug: true }} />;
}`,
  },
]

eslintTester.run(RULE_NAME, rule as any, {
  // @ts-expect-error - we're only testing detection, not the actual fixes
  invalid: invalids.map(({ code }) => ({
    code: imports + code,
    errors: [{ messageId: 'debug', suggestions: 1 }],
  })),
  valid: valids.map(({ code }) => ({
    code: imports + code,
  })),
})

const valids2 = [
  'const styles = css({ bg: "red" })',
  'const styles = css({ bg: `red` })',
  'const styles = css({ bg: 1 })',
  'const styles = css({ debug: true })',
  '<Circle debug={true} />',
  '<Circle color={"red"} />',
  '<Circle color={`red`} />',
  '<Circle _hover={{ bg: "red.100" }} />',
]

const invalids2 = ['const styles = css({ bg: color })', '<Circle debug={bool} />', '<styled.div color={color} />']

eslintTester.run(RULE_NAME2, rule2 as any, {
  invalid: invalids2.map((code) => ({
    code: imports + code,
    errors: [{ messageId: 'dynamic' }],
  })),
  valid: valids2.map((code) => ({
    code: imports + code,
  })),
})

// ? Testing multiline arbitrary expressions

const namedGridLines = `
[
  [full-start]
    minmax(16px, 1fr)
      [breakout-start]
        minmax(0, 16px)
          [content-start]
            minmax(min-content, 1024px)
          [content-end]
        minmax(0, 16px)
      [breakout-end]
    minmax(16px, 1fr)
  [full-end]
]
`

const valids3 = [
  `const layout = css({
      display: "grid",
      gridTemplateColumns: \`${getArbitraryValue(namedGridLines)}\`,
    });
    `,
  `<Circle gridTemplateColumns={\`${getArbitraryValue(namedGridLines)}\`} />`,
]

const invalids3 = [
  {
    code: `const layout = css({
    display: "grid",
    gridTemplateColumns: \`${namedGridLines}\`,
  });
  `,
  },
  {
    code: `<Circle gridTemplateColumns={\`${namedGridLines}\`} />`,
  },
]

eslintTester.run(RULE_NAME3, rule3 as any, {
  // @ts-expect-error - we're only testing detection, not the actual fixes
  invalid: invalids3.map(({ code }) => ({
    code: imports + code,
    errors: [{ messageId: 'escapeHatch', suggestions: 1 }],
  })),
  valid: valids3.map((code) => ({
    code: imports + code,
  })),
})

// ? Testing aliased imports

const imports4 = `import { css } from './bamboo/css';
import { token as tk } from './bamboo/tokens'
import { Circle } from './bamboo/jsx';\n\n`

const valids4 = [
  'const styles = css({ bg: "token(colors.red.300) 50%" })',
  'const styles = css({ border: "solid 1px {colors.red.300}" })',
]

const invalids4 = [
  {
    code: 'const styles = css({ bg: tk("colors.red.300") })',
  },
  {
    code: 'const styles = css({ bg: tk(`colors.red.300`) })',
  },

  { code: '<Circle bg={tk("colors.red.300")} />' },
]

eslintTester.run(RULE_NAME4, rule4 as any, {
  // @ts-expect-error - we're only testing detection, not the actual fixes
  invalid: invalids4.map(({ code }) => ({
    code: imports4 + code,
    errors: [{ messageId: 'noUnsafeTokenFnUsage', suggestions: 1 }],
  })),
  valid: valids4.map((code) => ({
    code: imports4 + code,
  })),
})

// ? Testing token paths in template literals syntax

const imports5 = `import { css } from './bamboo/css';
import { Circle, styled } from './bamboo/jsx';\n\n`

const valids5 = [
  'const className = css`\n  font-size: {fontSizes.md};`',
  'const className = styled.h1`\n  font-size: {fontSizes.md};`',
  'const className = styled(Circle)`\n  font-size: {fontSizes.md};`',
  `const className = css\`\n  
    @media (min-width: token(breakpoints.lg)) {
      grid-template-columns: auto 450px;
    }
  \``,
]

const invalids5 = [
  { code: 'const className = css`\n  font-size: {fontSizes.emd};`' },
  { code: 'const Heading = styled.h1`\n  font-size: {fontSizes.emd};`' },
  { code: 'const Comp = styled(Circle)`\n  font-size: {fontSizes.emd};`' },
  {
    code: 'const Comp = styled(Circle)`\n  margin: {sizess.4} {sizes.f4};`',
    errors: 2,
  },
]

eslintTester.run(RULE_NAME5, rule5 as any, {
  invalid: invalids5.map(({ code, errors = 1 }) => ({
    code: imports5 + code,
    errors: new Array(errors).fill({ messageId: 'noInvalidTokenPaths' }),
  })),
  valid: valids5.map((code) => ({
    code: imports5 + code,
  })),
})

// ? Testing nesting in sva and cva

const imports6 = `import { cva, sva } from './bamboo/css';`

const valids6 = [
  `const heading = cva({
  base: {
    color: 'red.400',
  },
  variants: {
    size: {
      'large-bold': {
        color: 'red.800',
      },
    },
  },
})`,
  `const heading2 = sva({
  slots: ['sm-ca'],
  base: {
    'sm-ca': {
      color: 'red.600',
    },
  },
  variants: {
    size: {
      'va-riant': {
        'sm-ca': {
          color: 'red.600',
        },
      },
    },
  },
})`,
]

const invalids6 = [
  {
    code: `const heading = cva({
  base: {
    '> div': {
      color: 'red.500',
    },
  },
  variants: {
    size: {
      'large-bold': {
        '> div': {
          color: 'red.500',
        },
      },
    },
  },
})`,
  },
  {
    code: `const heading2 = sva({
  slots: ['sm-ca'],
  base: {
    'sm-ca': {
      '> div': {
        color: 'red.600',
      },
    },
  },
  variants: {
    size: {
      'va-riant': {
        'sm-ca': {
          '> div': {
            color: 'red.600',
          },
        },
      },
    },
  },
})`,
  },
]

eslintTester.run(RULE_NAME6, rule6 as any, {
  invalid: invalids6.map(({ code }) => ({
    code: imports6 + code,
    errors: [{ messageId: 'nesting' }, { messageId: 'nesting' }],
  })),
  valid: valids6.map((code) => ({
    code: imports6 + code,
  })),
})
