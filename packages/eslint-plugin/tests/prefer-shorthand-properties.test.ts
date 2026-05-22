import rule, { RULE_NAME } from '../src/rules/prefer-shorthand-properties'
import { eslintTester } from '../test-utils'
import multiline from 'multiline-ts'

eslintTester.run(RULE_NAME, rule, {
  invalid: [
    {
      code: multiline`
  import { css } from './bamboo/css';
  
  const styles = css({ marginLeft: '4' })`,
      errors: [
        {
          messageId: 'shorthand',
          suggestions: [
            {
              messageId: 'replace',
              output: multiline`
  import { css } from './bamboo/css';
  
  const styles = css({ ml: '4' })`,
            },
          ],
        },
      ],
    },

    {
      code: multiline`
  import { css } from './bamboo/css';
  
  function App(){
    return <div className={css({ background: 'red.100' })} />;
  }`,
      errors: [
        {
          messageId: 'shorthand',
          suggestions: [
            {
              messageId: 'replace',
              output: multiline`
  import { css } from './bamboo/css';
  
  function App(){
    return <div className={css({ bg: 'red.100' })} />;
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
    return <Circle _hover={{  position: 'absolute' }} />;
  }`,
      errors: [
        {
          messageId: 'shorthand',
          suggestions: [
            {
              messageId: 'replace',
              output: multiline`
  import { Circle } from './bamboo/jsx';
  
  function App(){
    return <Circle _hover={{  pos: 'absolute' }} />;
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
  
  const styles = css({ ml: '4' })`,
    },

    {
      code: multiline`
  import { css } from './bamboo/css';
  
  function App(){
    return <div className={css({ bg: 'red.100' })} />;
  }`,
    },

    {
      code: multiline`
  import { Circle } from './bamboo/jsx';
  
  function App(){
    return <Circle _hover={{  pos: 'absolute' }} />;
  }`,
    },
  ],
})
