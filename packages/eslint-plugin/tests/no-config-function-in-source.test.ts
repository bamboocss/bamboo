import rule, { RULE_NAME } from '../src/rules/no-config-function-in-source';
import { eslintTester } from '../test-utils';
import multiLine from 'multiline-ts';

eslintTester.run(RULE_NAME, rule, {
  invalid: [
    {
      code: multiLine`
        import {  defineKeyframes } from '@bamboocss/dev';
        import { css } from './bamboo/css';
        
        const keyframes = defineKeyframes({
          fadeIn: {
            '0%': { opacity: '0' },
            '100%': { opacity: '1' },
          },
        });
        
        const styles = css({
          animation: 'fadeIn 1s ease-in-out',
        });
      `,
      errors: [
        {
          messageId: 'configFunction',
          suggestions: [
            {
              messageId: 'delete',
              output: multiLine`
            import {   } from '@bamboocss/dev';
            import { css } from './bamboo/css';
            
            
            
            const styles = css({
              animation: 'fadeIn 1s ease-in-out',
            });
          `,
            },
          ],
        },
      ],
      filename: 'App.tsx',
    },
  ],
  valid: [
    {
      code: multiLine`
        import { defineConfig, defineKeyframes } from '@bamboocss/dev';
        
        const keyframes = defineKeyframes({
          fadeIn: {
            '0%': { opacity: '0' },
            '100%': { opacity: '1' },
          },
        });
        
        export default defineConfig({
          theme: {
            keyframes
          }
        });
      `,
      filename: 'bamboo.config.ts',
    },
  ],
});
