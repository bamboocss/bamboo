import rule, { RULE_NAME } from '../src/rules/no-invalid-token-paths'
import { eslintTester } from '../test-utils'
import multiline from 'multiline-ts'

const validLiteral = 'const className = css`\n  font-size: {fontSizes.md};\n`'
const invalidLiteral = 'const className = css`\n  font-size: {fontSizes.emd};\n`'

eslintTester.run(RULE_NAME, rule, {
  invalid: [
    {
      code: multiline`
  import { css } from './bamboo/css';
  
  // colorszz is not a valid token type
  const styles = css({ bg: 'token(colorszz.red.300) 50%' })`,
      errors: [{ messageId: 'noInvalidTokenPaths' }],
    },

    {
      code: multiline`
  import { css } from './bamboo/css';
  
  function App(){
    // \`4000\` is not a valid size token. Assuming we're using the default bamboo presets
    return <div className={css({ marginX: '{sizes.4000} 20px' })} />;
  }`,
      errors: [{ messageId: 'noInvalidTokenPaths' }],
    },

    {
      code: multiline`
  import { styled } from './bamboo/jsx';
  
  function App(){
    // \`1\` does not exist in borderWidths, and \`grays\` is not a valid color token. Assuming we're using the default bamboo presets
    return <styled.div _hover={{  border: 'solid {borderWidths.1} token(colors.grays.100, #F3F4F6)' }} />;
  }`,
      errors: [{ messageId: 'noInvalidTokenPaths' }, { messageId: 'noInvalidTokenPaths' }],
    },

    {
      code: multiline`
  import { css } from './bamboo/css';
  
  ${invalidLiteral}`,
      errors: [{ messageId: 'noInvalidTokenPaths' }],
    },
  ],
  valid: [
    {
      code: multiline`
  import { css } from './bamboo/css';
  
  const styles = css({ bg: 'token(colors.red.300) 50%' })`,
    },

    {
      code: multiline`
  import { css } from './bamboo/css';
  
  function App(){
    return <div className={css({ marginX: '{sizes.4} 20px' })} />;
  }`,
    },

    {
      code: multiline`
  import { styled } from './bamboo/jsx';
  
  function App(){
    return <styled.div _hover={{  border: 'solid 1px token(colors.gray.100, #F3F4F6)' }} />;
  }`,
    },

    {
      code: multiline`
  import { css } from './bamboo/css';
  
  ${validLiteral}`,
    },
  ],
})
