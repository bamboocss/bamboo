import rule, { RULE_NAME } from '../src/rules/prefer-unified-property-style'
import { eslintTester } from '../test-utils'
import multiline from 'multiline-ts'

eslintTester.run(RULE_NAME, rule, {
  invalid: [
    {
      code: multiline`
  import { css } from './bamboo/css';
  
  const styles = css({ margin:"2", marginLeft: "5" })`,
      errors: [{ messageId: 'unify' }],
    },

    {
      code: multiline`
  import { styled } from './bamboo/jsx';
  
  function App(){
    return <styled.div border="solid 1px" borderColor="gray.800" />;
  }`,
      errors: [{ messageId: 'unify' }],
    },
  ],
  valid: [
    {
      code: multiline`
  import { css } from './bamboo/css';
  
  const styles = css({ marginTop: "2", marginRight: "2", marginBottom: "2", marginLeft: "5" })`,
    },

    {
      code: multiline`
  import { styled } from './bamboo/jsx';
  
  function App(){
    return <styled.div borderStyle="solid" borderColor="gray.900" borderWidth="1px" />;
  }`,
    },
  ],
})
