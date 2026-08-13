import rule, { RULE_NAME } from '../src/rules/no-unlayered-override'
import { eslintTester } from '../test-utils'
import multiline from 'multiline-ts'

/**
 * `cx` joins class names in every build; it does not resolve conflicts between them. So a
 * component that styles itself with `css()` and joins a `className` it was handed has both
 * classes in the `utilities` layer, and which one applies is decided by stylesheet order
 * rather than by the caller.
 *
 * The fix is a difference in *origin*: the component takes a style object and merges it before
 * any class name exists, which resolves per property in every build — or, on the extraction
 * path, a recipe lands in `recipes` and loses to the consumer's `css()` by layer. `cva` counts
 * either way there, inline or declared in `theme.recipes`, since its classes are named
 * semantically and emitted into that layer.
 *
 * Recipe calls are not reported, and that is a decision about false positives rather than a
 * claim that they are always safe: the Vite compiler emits no `recipes` layer at all — it
 * resolves selections into the same `utilities` atoms `css()` uses — so under it a recipe joined
 * with an opaque class is the same collision. The rule cannot see which build it is linting
 * for, and reporting the fix it recommends to everyone else is the worse of the two errors.
 */
eslintTester.run(RULE_NAME, rule, {
  invalid: [
    {
      code: multiline`
  import { css, cx } from './bamboo/css';

  const Card = (props) => <div className={cx(css({ padding: '4' }), props.className)} />`,
      errors: [{ messageId: 'unlayeredOverride' }],
    },
    {
      // Order does not matter — neither can win by layer whichever way round they go.
      code: multiline`
  import { css, cx } from './bamboo/css';

  const Card = ({ className }) => <div className={cx(className, css({ padding: '4' }))} />`,
      errors: [{ messageId: 'unlayeredOverride' }],
    },
  ],
  valid: [
    {
      // A config recipe is in the `recipes` layer on the extraction path, so the consumer's
      // css() wins by layer there — and see the note above for why it is unreported regardless.
      code: multiline`
  import { cx } from './bamboo/css';
  import { button } from './bamboo/recipes';

  const Button = (props) => <button className={cx(button(), props.className)} />`,
    },
    {
      // So is an inline cva. Its classes are named from its config — `btn--size_sm` — and
      // emitted into that same layer, exactly as a declared recipe's are.
      code: multiline`
  import { cva, cx } from './bamboo/css';

  const button = cva({ base: { padding: '4' } });
  const Button = (props) => <button className={cx(button(), props.className)} />`,
    },
    {
      // And an inline sva, per slot.
      code: multiline`
  import { cx, sva } from './bamboo/css';

  const card = sva({ slots: ['root'], base: { root: { padding: '4' } } });
  const Card = (props) => <div className={cx(card().root, props.className)} />`,
    },
    {
      // Merging style objects resolves per property, before any class name exists.
      code: multiline`
  import { css } from './bamboo/css';

  const Card = (props) => <div className={css({ padding: '4' }, props.css)} />`,
    },
    {
      // Two calls this file owns. Both visible, so nothing is being joined blind.
      code: multiline`
  import { css, cx } from './bamboo/css';

  const styles = cx(css({ padding: '4' }), css({ color: 'red.300' }))`,
    },
    {
      // A static marker class carries no styles to conflict with.
      code: multiline`
  import { css, cx } from './bamboo/css';

  const styles = cx(css({ padding: '4' }), 'group')`,
    },
    {
      code: multiline`
  import { cx } from './bamboo/css';

  const styles = cx(a, b)`,
    },
  ],
})
