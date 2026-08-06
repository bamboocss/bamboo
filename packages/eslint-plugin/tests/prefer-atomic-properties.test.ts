import rule, { RULE_NAME } from '../src/rules/prefer-atomic-properties'
import { eslintTester } from '../test-utils'
import multiline from 'multiline-ts'

eslintTester.run(RULE_NAME, rule, {
  invalid: [
    {
      code: multiline`
  import { css } from './bamboo/css';
  
  const styles = css({ gap: '4' })`,
      errors: [{ messageId: 'atomic' }],
    },

    {
      code: multiline`
  import { css } from './bamboo/css';
  
  function App(){
    return <div className={css({ background: 'red.100' })} />;
  }`,
      errors: [{ messageId: 'atomic' }],
    },

    {
      code: multiline`
  import { styled } from './bamboo/jsx';
  
  function App(){
    return <styled.div _hover={{  borderTop: 'solid 1px blue' }} />;
  }`,
      errors: [{ messageId: 'atomic' }],
    },
  ],
  valid: [
    {
      code: multiline`
  import { css } from './bamboo/css';
  
  const styles = css({ rowGap: '4', columnGap: '4' })`,
    },

    {
      code: multiline`
  import { css } from './bamboo/css';
  
  function App(){
    return <div className={css({ backgroundColor: 'red.100' })} />;
  }`,
    },

    {
      code: multiline`
  import { styled } from './bamboo/jsx';
  
  function App(){
    return <styled.div _hover={{  borderTopStyle: 'solid', borderTopWidth: '1px', borderTopColor: 'blue' }} />;
  }`,
    },
  ],
})
