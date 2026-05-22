import rule, { RULE_NAME } from '../src/rules/no-important'
import { eslintTester } from '../test-utils'
import multiline from 'multiline-ts'

eslintTester.run(RULE_NAME, rule, {
  invalid: [
    {
      code: multiline`
  import { css } from './bamboo/css';
  
  const styles = css({ marginLeft: '4px!' })`,
      errors: [
        {
          messageId: 'important',
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
    return <div className={css({ background: '#111 !important' })} />;
  }`,
      errors: [
        {
          messageId: 'important',
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
    return <Circle _hover={{ position: '[absolute!]' }} />;
  }`,
      errors: [
        {
          messageId: 'important',
          suggestions: [
            {
              messageId: 'remove',
              output: multiline`
  import { Circle } from './bamboo/jsx';
  
  function App(){
    return <Circle _hover={{ position: '[absolute]' }} />;
  }`,
            },
          ],
        },
      ],
    },
  ],
  valid: [
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
