import rule, { RULE_NAME } from '../src/rules/no-debug'
import { eslintTester } from '../test-utils'
import multiline from 'multiline-ts'

eslintTester.run(RULE_NAME, rule, {
  invalid: [
    {
      code: multiline`
  import { css } from './bamboo/css';
  
  const styles = css({ marginLeft: '4', debug: true })`,
      errors: [
        {
          messageId: 'debug',
          suggestions: [
            {
              messageId: 'property',
              output: multiline`
  import { css } from './bamboo/css';
  
  const styles = css({ marginLeft: '4', })`,
            },
          ],
        },
      ],
    },

    {
      code: multiline`
  import { css } from './bamboo/css';
  
  function App(){
    return <div className={css({ background: 'red.100', debug: true })} />;
  }`,
      errors: [
        {
          messageId: 'debug',
          suggestions: [
            {
              messageId: 'property',
              output: multiline`
  import { css } from './bamboo/css';
  
  function App(){
    return <div className={css({ background: 'red.100', })} />;
  }`,
            },
          ],
        },
      ],
    },

    {
      code: multiline`
  import { styled } from './bamboo/jsx';
  
  function App(){
    return <styled.div _hover={{ position: 'absolute' }} debug />;
  }`,
      errors: [
        {
          messageId: 'debug',
          suggestions: [
            {
              messageId: 'prop',
              output: multiline`
  import { styled } from './bamboo/jsx';
  
  function App(){
    return <styled.div _hover={{ position: 'absolute' }}  />;
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
  import { styled } from './bamboo/jsx';
  
  function App(){
    return <styled.div _hover={{ position: 'absolute' }} />;
  }`,
    },
  ],
})
