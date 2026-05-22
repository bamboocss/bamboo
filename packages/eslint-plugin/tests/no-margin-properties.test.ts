import rule, { RULE_NAME } from '../src/rules/no-margin-properties';
import { eslintTester } from '../test-utils';
import multiline from 'multiline-ts';

eslintTester.run(RULE_NAME, rule, {
  invalid: [
    {
      code: multiline`
  import { css } from './bamboo/css';
  
  const styles = css({ marginLeft: '4' })`,
      errors: [{ messageId: 'noMargin' }],
    },

    {
      code: multiline`
  import { css } from './bamboo/css';
  
  function App(){
    return <div className={css({ margin: '3' })} />;
  }`,
      errors: [{ messageId: 'noMargin' }],
    },

    {
      code: multiline`
  import { Circle } from './bamboo/jsx';
  
  function App(){
    return <Circle marginX="2" />;
  }`,
      errors: [{ messageId: 'noMargin' }],
    },
  ],
  valid: [
    {
      code: multiline`
  import { css } from './bamboo/css';
  
  const styles = css({ display: 'flex', gap: '4' })`,
    },

    {
      code: multiline`
  import { grid } from './bamboo/css';
  
  function App(){
    return <div className={grid({ gap: '3' })} />;
  }`,
    },

    {
      code: multiline`
  import { Flex } from './bamboo/jsx';
  
  function App(){
    return <Flex gap="2" />;
  }`,
    },
  ],
});
