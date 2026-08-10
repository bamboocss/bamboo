import rule, { RULE_NAME } from '../src/rules/no-invalid-token-paths'
import { eslintTester } from '../test-utils'
import multiline from 'multiline-ts'

const validLiteral = 'const className = css`\n  font-size: token(fontSizes.md);\n`'
const invalidLiteral = 'const className = css`\n  font-size: token(fontSizes.emd);\n`'

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
    return <div className={css({ marginX: 'token(sizes.4000) 20px' })} />;
  }`,
      errors: [{ messageId: 'noInvalidTokenPaths' }],
    },

    {
      code: multiline`
  import { css } from './bamboo/css';
  
  function App(){
    // \`1\` does not exist in borderWidths, and \`grays\` is not a valid color token. Assuming we're using the default bamboo presets
    return <div className={css({ _hover: {  border: 'solid token(borderWidths.1) token(colors.grays.100)' } })} />;
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

    /**
     * The retired curly spelling is no longer a token reference, so a path that would be invalid
     * inside `token(…)` is not reported here — there is nothing to validate.
     *
     * Pinned because the lint plugin carries its own copy of the reference syntax, in
     * `utils/helpers.ts` and in `no-unsafe-token-fn-usage`. Restoring the curly branch in both
     * left the entire suite green, so a half-removal that kept `{…}` alive in four rules could
     * have shipped unnoticed — which is exactly the two-ways-to-say-one-thing this removed.
     */
    {
      code: multiline`
  import { css } from './bamboo/css';

  const styles = css({ marginX: '{sizes.4000} 20px' })`,
    },

    {
      code: multiline`
  import { css } from './bamboo/css';
  
  function App(){
    return <div className={css({ marginX: 'token(sizes.4) 20px' })} />;
  }`,
    },

    {
      code: multiline`
  import { css } from './bamboo/css';
  
  function App(){
    return <div className={css({ _hover: {  border: 'solid 1px token(colors.gray.100, #F3F4F6)' } })} />;
  }`,
    },

    {
      code: multiline`
  import { css } from './bamboo/css';
  
  ${validLiteral}`,
    },
  ],
})
