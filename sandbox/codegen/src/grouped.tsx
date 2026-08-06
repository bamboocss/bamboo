import { css, cva } from '../styled-system-grouped/css'
import { stack } from '../styled-system-grouped/patterns'
import { styled } from '../styled-system-grouped/jsx'

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

// The JSX factory merges style props and the `css` prop into a single call.
export const Factory = () => <styled.div color="red.300" padding="4" css={{ fontSize: 'xl' }} />

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

// `styled(Component, cvaConfig)` — the shape whose style props used to be dropped.
const Button = styled('button', {
  base: { color: 'red.300' },
  variants: { size: { sm: { padding: '2' }, md: { padding: '4' } } },
})
export const WithCva = () => <Button size="sm" fontSize="xl" />

// A bare `cva`, which stays atomic under grouped by design.
export const bareCva = cva({
  base: { color: 'red.300' },
  variants: { size: { sm: { padding: '2' } } },
})
