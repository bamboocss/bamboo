import { css, cva, cx } from '../styled-system-grouped/css'
import { stack } from '../styled-system-grouped/patterns'

/**
 * Every route a style takes to a class name under `cssMode: 'grouped'`.
 *
 * The scenario's test asserts that each class the runtime returns for these has a rule
 * behind it. That is the invariant grouped mode lives or dies by: build and runtime derive
 * the class independently, and when they disagree the element renders with no styles and
 * nothing says so.
 */

// A fully static call — the case that must always collapse to exactly one class.
export const Static = () => <div className={css({ color: 'red.300', padding: '4', fontSize: 'xl' })} />

// Conditions have to travel inside the group rather than splitting it.
export const Conditional = () => (
  <div
    className={css({
      color: 'red.300',
      _hover: { color: 'blue.300' },
      md: { padding: '8' },
    })}
  />
)

// A pattern is a `css()` call with its transform already applied.
export const Pattern = () => <div className={stack({ gap: '4' })} />

// Two operands merged into a single call.
export const Merged = () => <div className={css({ color: 'red.300', padding: '4' }, { fontSize: 'xl' })} />

// `css.raw` composition — two operands merged before naming.
const rawBase = css.raw({ color: 'red.300' })
const rawExtra = css.raw({ padding: '4' })
export const Raw = () => <div className={css(rawBase, rawExtra)} />

// A ternary: the build enumerates the branches, so both have to be backed.
export const Ternary = ({ on }: { on: boolean }) => (
  <div className={css({ fontSize: 'xl', color: on ? 'red.300' : 'blue.300' })} />
)

// A value the build cannot resolve. This one is *expected* to miss — the assertion is that
// it degrades to the declarations the build did resolve rather than to nothing.
export const Dynamic = ({ tone }: { tone: string }) => (
  <div className={css({ fontSize: 'xl', padding: '4', color: tone })} />
)

// A cva class joined with a `css()` class — the two are named independently, and both
// have to be backed.
const buttonCva = cva({
  base: { color: 'red.300' },
  variants: { size: { sm: { padding: '2' }, md: { padding: '4' } } },
})
export const WithCva = () => <button className={cx(buttonCva({ size: 'sm' }), css({ fontSize: 'xl' }))} />

// A bare `cva`, which stays atomic under grouped by design.
export const bareCva = cva({
  base: { color: 'red.300' },
  variants: { size: { sm: { padding: '2' } } },
})

// A ternary nested inside a condition block, beside another property. `css()` reconstructs
// the branches, so this has to group — the condition and the property travel together.
export const NestedTernary = ({ on }: { on: boolean }) => (
  <div className={css({ _hover: { color: on ? 'red.300' : 'blue.300' }, fontSize: 'xl' })} />
)

// An array argument. `mergeCss` flattens it, so it is one call and one class.
export const ArrayArg = () => <div className={css([{ color: 'red.300' }, { fontSize: 'xl' }])} />

// --- The shapes that degrade to atomic. Each must keep every declaration it wrote. ---

// A conditional style prop beside a static one. Only `css()` enumerates combinations, so
// the element falls back to atomic names — which have to have rules behind them.
export const ConditionalProp = ({ on }: { on: boolean }) => (
  <div className={css({ color: on ? 'red.300' : 'blue.300', padding: '4' })} />
)

// The same shape in a pattern.
export const ConditionalPattern = ({ on }: { on: boolean }) => (
  <div className={stack({ gap: on ? '2' : '4', padding: '4' })} />
)

// A value the build cannot see, beside one it can. The resolved half must survive.
export const DynamicProp = ({ tone }: { tone: string }) => <div className={css({ color: tone, padding: '4' })} />

// A spread the build cannot enumerate.
export const DynamicSpread = ({ styles }: { styles: Record<string, string> }) => (
  <div className={css({ ...styles, color: 'red.300' })} />
)

// Two operands sharing a key that holds a condition object: a merge the build reads as a
// pair of alternatives, so it degrades rather than guessing.
export const SharedConditionKey = () => (
  <div className={css({ color: { base: 'red.300' } }, { color: { _hover: 'blue.300' } })} />
)
