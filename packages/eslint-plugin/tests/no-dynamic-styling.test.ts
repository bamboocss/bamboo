import rule, { RULE_NAME } from '../src/rules/no-dynamic-styling'
import { eslintTester } from '../test-utils'
import multiline from 'multiline-ts'

eslintTester.run(RULE_NAME, rule, {
  invalid: [
    {
      code: multiline`
  import { css } from './bamboo/css';
  
  const color = 'red.100';
  const styles = css({ bg: color })`,
      errors: [{ messageId: 'dynamic' }],
    },

    {
      code: multiline`
  import { css } from './bamboo/css';
  
  const size = '8';
  const styles = css({ padding: ['4', size] })`,
      errors: [{ messageId: 'dynamic' }],
    },

    {
      code: multiline`
  import { stack } from './bamboo/patterns';
  
  const align = 'center';
  const styles = stack({ align: align })`,
      errors: [{ messageId: 'dynamic' }],
    },

    {
      code: multiline`
  import { css } from './bamboo/css';
  
  function App(){
    const bool = true;
    return <div className={css({ debug: bool })} />;
  }`,
      errors: [{ messageId: 'dynamic' }],
    },

    {
      code: multiline`
  import { css } from './bamboo/css';
  
  function App(){
    const color = 'red.100';
    return <div className={css({ color: color })} />;
  }`,
      errors: [{ messageId: 'dynamic' }],
    },

    {
      code: multiline`
  import { css } from './bamboo/css';
  
  const property = 'background';
  const styles = css({ [property]: 'red.100' })`,
      errors: [{ messageId: 'dynamicProperty' }],
    },

    {
      code: multiline`
  import { cva,sva } from './bamboo/css';
  
  function App(){
    const computedValue = "value"
    const heading = cva({
      variants: {
        [computedValue]: {
          color: "red.100",
        }
      }
    });
  }`,
      errors: [{ messageId: 'dynamicRecipeVariant' }],
    },
  ],
  valid: [
    {
      code: multiline`
  import { css } from './bamboo/css';
  
  const styles = css({ bg: 'gray.900' })`,
    },

    {
      code: multiline`
  import { css } from './bamboo/css';
  
  const styles = css({ padding: ['4', '8'] })`,
    },

    {
      code: multiline`
  import { css } from './bamboo/css';
  
  function App(){
    return <div className={css({ debug: true })} />;
  }`,
    },

    {
      code: multiline`
  import { css } from './bamboo/css';
  
  function App(){
    return <div className={css({ color: 'red.100' })} />;
  }`,
    },
    {
      code: multiline`
  const foo = 'foo'
  const nonStyles = {bar: [foo]}
  `,
    },
  ],
})
