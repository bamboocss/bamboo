import rule, { RULE_NAME } from '../src/rules/no-descendant-selectors'
import { eslintTester } from '../test-utils'
import multiline from 'multiline-ts'

/**
 * The rule is about one thing: a nested selector whose subject is not `&`.
 *
 * `.prose p` is (0,1,1) and the `css()` a consumer put on that paragraph is (0,1,0), and both
 * are in the `utilities` layer, where layers decide nothing and specificity decides everything.
 * So the paragraph carries the class it was given and renders with the other value — no error,
 * no warning, and nothing in the authoring experience to suggest one `css()` can outrank
 * another.
 *
 * What must *not* fire is the shape that reads the same and behaves differently: `'.dark &'`
 * and `'.group:hover &'` contain a combinator and still style `&` itself. Conditions compile to
 * exactly that, so reporting them would make the rule unusable.
 */
eslintTester.run(RULE_NAME, rule, {
  invalid: [
    {
      code: multiline`
  import { css } from './bamboo/css';

  const styles = css({
    '& p': { fontSize: '14.5px' },
  })`,
      errors: [{ messageId: 'descendantSelector' }],
    },

    {
      code: multiline`
  import { css } from './bamboo/css';

  const styles = css({
    '& > .card': { padding: '4' },
  })`,
      errors: [{ messageId: 'descendantSelector' }],
    },

    {
      code: multiline`
  import { css } from './bamboo/css';

  const styles = css({
    '& :is(p, li) a': { textDecorationLine: 'underline' },
  })`,
      errors: [{ messageId: 'descendantSelector' }],
    },

    {
      code: multiline`
  import { css } from './bamboo/css';

  function App() {
    return <div className={css({ '&:hover p, & + span': { color: 'red.300' } })} />;
  }`,
      // One report for the selector, not one per part of the list.
      errors: [{ messageId: 'descendantSelector' }],
    },

    {
      code: multiline`
  import { cva } from './bamboo/css';

  const prose = cva({
    base: { '& a': { color: 'blue.500' } },
  })`,
      errors: [{ messageId: 'descendantSelector' }],
    },

    {
      // A variant's style object is a style object. The declaration around it changes nothing
      // about what the selector does.
      code: multiline`
  import { cva } from './bamboo/css';

  const prose = cva({
    variants: { tone: { loud: { '& a': { color: 'red.500' } } } },
  })`,
      errors: [{ messageId: 'descendantSelector' }],
    },

    {
      code: multiline`
  import { css } from './bamboo/css';

  const styles = css({ [\`& [data-part="item"]\`]: { color: 'red.300' } })`,
      errors: [{ messageId: 'descendantSelector' }],
    },
  ],
  valid: [
    {
      code: multiline`
  import { css } from './bamboo/css';

  const styles = css({ '&:hover': { color: 'red.300' } })`,
    },
    {
      // The subject is `&`: this styles the element itself, under an ancestor.
      code: multiline`
  import { css } from './bamboo/css';

  const styles = css({ '.dark &': { color: 'white' }, '.group:hover &': { opacity: 1 } })`,
    },
    {
      // A quoted space and an escaped one are both part of a compound, not combinators.
      code: multiline`
  import { css } from './bamboo/css';

  const styles = css({ '&[data-label="a b"]': { color: 'red.300' }, '&.a\\\\ b': { color: 'red.300' } })`,
    },
    {
      // The parenthesised `>` belongs to `:has()`, and the subject is still `&`.
      code: multiline`
  import { css } from './bamboo/css';

  const styles = css({ '&:has(> p)': { color: 'red.300' } })`,
    },
    {
      // Conditions and at-rules are keys this rule must never look past.
      code: multiline`
  import { css } from './bamboo/css';

  const styles = css({ _hover: { color: 'red.300' }, md: { color: 'blue.500' }, '@media (min-width: 0)': { color: 'green.500' } })`,
    },
    {
      code: multiline`
  import { cva } from './bamboo/css';

  const badge = cva({ variants: { tone: { loud: { color: 'red.300' } } } })`,
    },
    {
      // Not a Bamboo style object.
      code: multiline`
  const config = { '& p': { fontSize: '14.5px' } }`,
    },
  ],
})
