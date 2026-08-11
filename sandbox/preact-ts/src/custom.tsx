import type { ComponentProps } from 'preact'
import { cx, sva } from '../styled-system/css'
import { custom } from '../styled-system/recipes'

const _custom = sva({
  slots: ['root', 'label'],
  className: '__custom',
  base: {
    root: {
      color: 'red',
      bg: 'red.300',
    },
    label: {
      fontWeight: 'medium',
    },
  },
  variants: {
    size: {
      sm: {
        root: {
          padding: '10px',
        },
      },
      md: {
        root: {
          padding: '20px',
        },
      },
    },
  },
  defaultVariants: {
    size: 'sm',
  },
})

const styles = custom({ size: 'sm' })

/**
 * The element's own props, with `className` narrowed to a plain string.
 *
 * Preact types it as `Signalish<string | undefined>` — a signal is a legal value there, and
 * it stays reactive because Preact assigns it to the DOM itself. `cx` takes plain values and
 * would stringify the signal object, so a component that merges class names cannot accept
 * one. Narrowing says so at the call site rather than at the DOM.
 */
type Props<E extends 'div' | 'label'> = Omit<ComponentProps<E>, 'className'> & { className?: string }

export const Root = ({ className, ...props }: Props<'div'>) => (
  <div {...props} className={cx(styles.root, 'group', className)} />
)

export const Label = ({ className, ...props }: Props<'label'>) => (
  <label {...props} className={cx(styles.label, 'group__item', className)} />
)
