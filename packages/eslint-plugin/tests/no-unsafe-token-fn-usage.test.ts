import rule, { RULE_NAME } from '../src/rules/no-unsafe-token-fn-usage'
import { eslintTester } from '../test-utils'
import multiline from 'multiline-ts'

eslintTester.run(RULE_NAME, rule, {
  invalid: [
    {
      code: multiline`
  import { token } from './bamboo/tokens';
  import { css } from './bamboo/css';
  
  const styles = css({ bg: token('colors.red.300') })`,
      errors: [
        {
          messageId: 'noUnsafeTokenFnUsage',
          suggestions: [
            {
              messageId: 'replace',
              output: multiline`
  import { token } from './bamboo/tokens';
  import { css } from './bamboo/css';
  
  const styles = css({ bg: 'red.300' })`,
            },
          ],
        },
      ],
    },

    {
      code: multiline`
    import { token } from './bamboo/tokens';
    import { css } from './bamboo/css';
  
    function App(){
      return <div className={css({ bg: 'token(colors.red.300)' })} />;
    }`,
      errors: [
        {
          messageId: 'noUnsafeTokenFnUsage',
          suggestions: [
            {
              messageId: 'replace',
              output: multiline`
    import { token } from './bamboo/tokens';
    import { css } from './bamboo/css';
  
    function App(){
      return <div className={css({ bg: 'red.300' })} />;
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
      return <div className={css({ margin: '[token(sizes.4)]' })} />;
    }`,
      errors: [
        {
          messageId: 'noUnsafeTokenFnUsage',
          suggestions: [
            {
              messageId: 'replace',
              output: multiline`
    import { css } from './bamboo/css';
  
    function App(){
      return <div className={css({ margin: '4' })} />;
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
  
  const styles = css({ bg: 'token(colors.red.300) 50%' })`,
    },

    {
      code: multiline`
  import { css } from './bamboo/css';
  import { token } from './bamboo/tokens';
  
  function App(){
    return <div style={{ color: token('colors.red.50') }} />;
  }`,
    },

    {
      code: multiline`
  import { css } from './bamboo/css';
  
  function App(){
    return <div className={css({ _hover: {  border: 'solid 1px token(colors.blue.400)' } })} />;
  }`,
    },
  ],
})
