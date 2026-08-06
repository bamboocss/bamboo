import rule, { RULE_NAME } from '../src/rules/file-not-included'
import { eslintTester } from '../test-utils'
import multiline from 'multiline-ts'

const validCode = multiline`
// File App.tsx is covered in the include config, so it's okay to import css and styled from bamboo into it.

import { css } from './bamboo/css';
import { css } from './bamboo/css';
`

const invalidCode = multiline`
// File Invalid.tsx is not covered in the include config, so importing css and styled from bamboo into it is not allowed.

import { css } from './bamboo/css';
import { css } from './bamboo/css';
`

eslintTester.run(RULE_NAME, rule, {
  invalid: [
    {
      code: invalidCode,
      errors: [{ messageId: 'include' }],
      filename: 'Invalid.tsx',
    },
  ],
  valid: [
    {
      code: validCode,
      filename: 'App.tsx',
    },
  ],
})
