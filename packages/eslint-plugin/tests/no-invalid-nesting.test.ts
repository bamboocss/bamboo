import rule, { RULE_NAME } from '../src/rules/no-invalid-nesting'
import { eslintTester } from '../test-utils'
import multiline from 'multiline-ts'

eslintTester.run(RULE_NAME, rule, {
  invalid: [
    {
      code: multiline`
  import { css } from './bamboo/css';
  
  const styles = css({
    ':hover': { marginLeft: '4px' },
  })`,
      errors: [{ messageId: 'nesting' }],
    },

    {
      code: multiline`
  import { css } from './bamboo/css';
  
  function App() {
    return (
      <div
        className={css({
          '.dark ': { background: 'red.100' },
        })}
      />
    );
  }`,
      errors: [{ messageId: 'nesting' }],
    },

    {
      code: multiline`
  import { Circle } from './bamboo/jsx';
  
  function App() {
    return (
      <Circle
        css={{
          '[data-focus]': { position: 'absolute' },
        }}
      />
    );
  }`,
      errors: [{ messageId: 'nesting' }],
    },
  ],
  valid: [
    {
      code: multiline`
  import { css } from './bamboo/css';
  
  const styles = css({
    '&:hover': { marginLeft: '4px' },
  })`,
    },

    {
      code: multiline`
  import { css } from './bamboo/css';
  
  function App() {
    return (
      <div
        className={css({
          '.dark &': { background: 'red.100' },
        })}
      />
    );
  }`,
    },

    {
      code: multiline`
  import { Circle } from './bamboo/jsx';
  
  function App() {
    return (
      <Circle
        css={{
          '&[data-focus]': { position: 'absolute' },
        }}
      />
    );
  }`,
    },
  ],
})
