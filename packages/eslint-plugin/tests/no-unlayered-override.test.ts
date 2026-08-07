import rule, { RULE_NAME } from '../src/rules/no-unlayered-override'
import { eslintTester } from '../test-utils'
import multiline from 'multiline-ts'

/**
 * `cx` joins class names in every build; it does not resolve conflicts between them. So a
 * component that styles itself with `css()` and joins a `className` it was handed has both
 * classes in the `utilities` layer, and which one applies is decided by stylesheet order
 * rather than by the caller.
 *
 * The fix is a difference in *origin*: a config recipe lands in `recipes` and loses to the
 * consumer's `css()` by layer, or the component takes a style object and merges it before
 * any class name exists. An inline `cva()` is not a fix — it is atomic, exactly like
 * `css()`, and lands in the same layer.
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
      // An inline cva is atomic too, so it has the same problem.
      code: multiline`
  import { cva, cx } from './bamboo/css';

  const button = cva({ base: { padding: '4' } });
  const Button = (props) => <button className={cx(button(), props.className)} />`,
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
      // A config recipe is in the `recipes` layer, so the consumer's css() wins by layer.
      code: multiline`
  import { cx } from './bamboo/css';
  import { button } from './bamboo/recipes';

  const Button = (props) => <button className={cx(button(), props.className)} />`,
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
