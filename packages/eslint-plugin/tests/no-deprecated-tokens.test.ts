import rule, { RULE_NAME } from '../src/rules/no-deprecated-tokens';
import { eslintTester } from '../test-utils';
import multiline from 'multiline-ts';

eslintTester.run(RULE_NAME, rule, {
  invalid: [
    {
      code: multiline`
  import { css } from './bamboo/css';
  
  // Assumes that the token is deprecated
  const styles = css({ color: 'red.400' })`,
      errors: [{ messageId: 'noDeprecatedTokens' }],
    },
  ],
  valid: [
    {
      code: multiline`
  import { css } from './bamboo/css';
  
  const styles = css({ color: 'red.100' })`,
    },
  ],
});
