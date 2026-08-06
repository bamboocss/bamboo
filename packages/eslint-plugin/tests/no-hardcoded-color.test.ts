import rule, { RULE_NAME } from '../src/rules/no-hardcoded-color'
import { eslintTester } from '../test-utils'
import multiline from 'multiline-ts'

eslintTester.run(RULE_NAME, rule, {
  invalid: [
    {
      code: multiline`
  import { css } from './bamboo/css';
  
  const styles = css({ color: '#FEE2E2' })`,
      errors: [{ messageId: 'invalidColor' }],
    },

    {
      code: multiline`
  import { css } from './bamboo/css';
  
  const styles = css({ color: 'red.100/30' })`,
      errors: [{ messageId: 'invalidColor' }],
      options: [{ noOpacity: true, whitelist: [] }],
    },

    {
      code: multiline`
  import { css } from './bamboo/css';
  
  function App(){
    return <div className={css({ background: 'rgb(134, 239, 172)' })} />;
  }`,
      errors: [{ messageId: 'invalidColor' }],
    },

    {
      code: multiline`
  import { css } from './bamboo/css';
  
  function App(){
    return <div className={css({ _hover: {  borderColor: 'hsl(220deg, 14%, 96%)' } })} />;
  }`,
      errors: [{ messageId: 'invalidColor' }],
    },
  ],
  valid: [
    {
      code: multiline`
  import { css } from './bamboo/css';
  
  const styles = css({ color: 'red.100' })`,
    },

    {
      code: multiline`
  import { css } from './bamboo/css';
  
  const styles = css({ color: 'red.100/30' })`,
    },

    {
      code: multiline`
  import { css } from './bamboo/css';
  
  function App(){
    return <div className={css({ background: 'green.300' })} />;
  }`,
    },

    {
      code: multiline`
  import { css } from './bamboo/css';
  
  function App(){
    return <div className={css({ _hover: {  borderColor: 'gray.100' } })} />;
  }`,
    },
  ],
})
