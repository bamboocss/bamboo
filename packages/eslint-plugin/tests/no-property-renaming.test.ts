import rule, { RULE_NAME } from '../src/rules/no-property-renaming';
import { eslintTester } from '../test-utils';
import multiline from 'multiline-ts';

eslintTester.run(RULE_NAME, rule, {
  invalid: [
    {
      code: multiline`
  import { css } from './bamboo/css';
  
  function Text({ variant }){
    return <p className={css({ textStyle: variant })} />;
  }`,
      errors: [{ messageId: 'noRenaming' }],
    },

    {
      code: multiline`
  import { css } from './bamboo/css';
  
  function Text(props){
    return <p className={css({ textStyle: props.variant })} />;
  }`,
      errors: [{ messageId: 'noRenaming' }],
    },

    // TODO detect pattern attributes as bamboo property
    //   {
    //     code: multiline`
    // import { Circle } from './bamboo/jsx';

    // function CustomCircle(props){
    //   const { circleSize = '3' } = props
    //   return (
    //     <Circle
    //       size={circleSize}
    //     />
    //   )
    // }`,
    //   },

    //   {
    //     code: multiline`
    // import { Circle } from './bamboo/jsx';

    // function CustomCircle(props){
    //   return (
    //     <Circle
    //       size={props.circleSize}
    //     />
    //   )
    // }`,
    //   },
  ],
  valid: [
    {
      code: multiline`
  import { css } from './bamboo/css';
  
  function Text({ textStyle }){
    return <p className={css({ textStyle })} />;
  }`,
    },

    {
      code: multiline`
  import { css } from './bamboo/css';
  
  function Text(props){
    return <p className={css({ textStyle: props.textStyle })} />;
  }`,
    },

    {
      code: multiline`
  import { Circle } from './bamboo/jsx';
  
  function CustomCircle(props){
    const { size = '3' } = props
    return (
      <Circle
        size={size}
      />
    )
  }`,
    },

    {
      code: multiline`
  import { Circle } from './bamboo/jsx';
  
  function CustomCircle(props){
    return (
      <Circle
        size={props.size}
      />
    )
  }`,
    },
  ],
});
