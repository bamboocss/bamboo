import rule, { RULE_NAME } from '../src/rules/prefer-longhand-properties'
import { eslintTester } from '../test-utils'
import multiline from 'multiline-ts'

eslintTester.run(RULE_NAME, rule, {
  invalid: [
    {
      code: multiline`
  import { css } from './bamboo/css';
  
  const styles = css({ ml: '4' })`,
      errors: [
        {
          messageId: 'longhand',
          suggestions: [
            {
              messageId: 'replace',
              output: multiline`
  import { css } from './bamboo/css';
  
  const styles = css({ marginLeft: '4' })`,
            },
          ],
        },
      ],
    },

    {
      code: multiline`
  import { css } from './bamboo/css';
  
  function App(){
    return <div className={css({ bg: 'red.100' })} />;
  }`,
      errors: [
        {
          messageId: 'longhand',
          suggestions: [
            {
              messageId: 'replace',
              output: multiline`
  import { css } from './bamboo/css';
  
  function App(){
    return <div className={css({ background: 'red.100' })} />;
  }`,
            },
          ],
        },
      ],
    },

    {
      code: multiline`
  import { css } from './bamboo/css';
  
  function App(){
    return <div className={css({ _hover: {  pos: 'absolute' } })} />;
  }`,
      errors: [
        {
          messageId: 'longhand',
          suggestions: [
            {
              messageId: 'replace',
              output: multiline`
  import { css } from './bamboo/css';
  
  function App(){
    return <div className={css({ _hover: {  position: 'absolute' } })} />;
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
  import { css } from './bamboo/css';
  
  function App(){
    return <div className={css({ _hover: {  position: 'absolute' } })} />;
  }`,
    },
  ],
})
