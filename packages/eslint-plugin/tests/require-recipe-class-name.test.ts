import rule, { RULE_NAME } from '../src/rules/require-recipe-class-name'
import { eslintTester } from '../test-utils'
import multiline from 'multiline-ts'

/**
 * A recipe with no `className` is named by hashing its config — and the build hashes the
 * config it could *read* while the browser hashes the one it *holds*. Anything the build
 * cannot resolve makes those two objects differ, so the two derive different names and the
 * element renders with no styles at all.
 *
 * Naming the recipe removes the failure rather than avoiding the pattern: the identity
 * short-circuits on the name and never hashes the styles, so extraction fidelity stops
 * deciding what the classes are called.
 *
 * `dynamic-only` narrows it to configs where the failure is actually possible, for projects
 * that do not want the ceremony everywhere.
 */
eslintTester.run(RULE_NAME, rule, {
  invalid: [
    {
      code: multiline`
  import { cva } from './bamboo/css';

  const button = cva({ base: { padding: '4' } })`,
      errors: [{ messageId: 'requireRecipeClassName' }],
    },
    {
      code: multiline`
  import { sva } from './bamboo/css';

  const card = sva({ slots: ['root'], base: { root: { padding: '4' } } })`,
      errors: [{ messageId: 'requireRecipeClassName' }],
    },
    {
      // An empty name falls through to hashing, so it is not a name.
      code: multiline`
  import { cva } from './bamboo/css';

  const button = cva({ className: '', base: { padding: '4' } })`,
      errors: [{ messageId: 'requireRecipeClassName' }],
    },
    {
      // A name the build cannot read is worse than none — it is the thing meant to make
      // the identity independent of what the build resolved.
      code: multiline`
  import { cva } from './bamboo/css';

  const button = cva({ className: getName(), base: { padding: '4' } })`,
      errors: [{ messageId: 'requireRecipeClassName' }],
    },
    {
      // Under `dynamic-only`, a spread is exactly the case that can diverge.
      code: multiline`
  import { cva } from './bamboo/css';

  const button = cva({ base: { ...shared, padding: '4' } })`,
      errors: [{ messageId: 'requireRecipeClassName' }],
      options: [{ mode: 'dynamic-only' }],
    },
    {
      code: multiline`
  import { cva } from './bamboo/css';

  const button = cva(sharedConfig)`,
      errors: [{ messageId: 'requireRecipeClassName' }],
      options: [{ mode: 'dynamic-only' }],
    },
  ],
  valid: [
    {
      code: multiline`
  import { cva } from './bamboo/css';

  const button = cva({ className: 'button', base: { padding: '4' } })`,
    },
    {
      // A cast does not hide the name, the same way it does not hide a loss from the build.
      code: multiline`
  import { cva } from './bamboo/css';

  const button = cva({ className: 'button', base: { padding: '4' } } as const)`,
    },
    {
      // Under `dynamic-only` a fully static config cannot diverge, so it needs no name.
      code: multiline`
  import { cva } from './bamboo/css';

  const button = cva({ base: { padding: '4' }, variants: { size: { sm: { padding: '2' } } } })`,
      options: [{ mode: 'dynamic-only' }],
    },
    {
      code: multiline`
  import { css } from './bamboo/css';

  const styles = css({ ...shared, padding: '4' })`,
    },
  ],
})
