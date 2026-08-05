import rule, { RULE_NAME } from '../src/rules/no-escape-hatch'
import { eslintTester } from '../test-utils'
import multiline from 'multiline-ts'

eslintTester.run(RULE_NAME, rule, {
  invalid: [
    {
      // The value as a whole is not an escape hatch, but a candidate inside it is. No
      // suggestion: stripping the outer characters would leave `allback(...` behind.
      code: multiline`
  import { css } from './bamboo/css';
  
  const styles = css({ width: 'fallback([stretch], 100%)' })`,
      errors: [{ messageId: 'escapeHatch' }],
    },

    {
      code: multiline`
  import { css } from './bamboo/css';
  
  const styles = css({ marginLeft: '[4px]' })`,
      errors: [
        {
          messageId: 'escapeHatch',
          suggestions: [
            {
              messageId: 'remove',
              output: multiline`
  import { css } from './bamboo/css';
  
  const styles = css({ marginLeft: '4px' })`,
            },
          ],
        },
      ],
    },

    {
      code: multiline`
  import { css } from './bamboo/css';
  
  function App(){
    return <div className={css({ background: '[#111]' })} />;
  }`,
      errors: [
        {
          messageId: 'escapeHatch',
          suggestions: [
            {
              messageId: 'remove',
              output: multiline`
  import { css } from './bamboo/css';
  
  function App(){
    return <div className={css({ background: '#111' })} />;
  }`,
            },
          ],
        },
      ],
    },

    {
      code: multiline`
  import { Circle } from './bamboo/jsx';
  
  function App(){
    return <Circle _hover={{ position: '[absolute]' }} />;
  }`,
      errors: [
        {
          messageId: 'escapeHatch',
          suggestions: [
            {
              messageId: 'remove',
              output: multiline`
  import { Circle } from './bamboo/jsx';
  
  function App(){
    return <Circle _hover={{ position: 'absolute' }} />;
  }`,
            },
          ],
        },
      ],
    },
  ],
  valid: [
    {
      // A fallback whose candidates are all plain values is fine.
      code: multiline`
  import { css } from './bamboo/css';
  
  const styles = css({ height: 'fallback(100dvh, 100vh)' })`,
    },

    {
      code: multiline`
  import { css } from './bamboo/css';
  
  const styles = css({ marginLeft: '4' })`,
    },

    {
      code: multiline`
  import { css } from './bamboo/css';
  
  function App(){
    return <div className={css({ background: 'red.100' })} />;
  }`,
    },

    {
      code: multiline`
  import { Circle } from './bamboo/jsx';
  
  function App(){
    return <Circle _hover={{ position: 'absolute' }} />;
  }`,
    },
  ],
})
