import { cx, sva } from '../../styled-system/css'
import { custom } from '../../styled-system/recipes'

const _custom = sva({
  slots: ['root', 'label'],
  className: 'x-custom',
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

export const Root = ({ className, ...props }: React.ComponentProps<'div'>) => (
  <div {...props} className={cx(styles.root, 'group', className)} />
)

export const Label = ({ className, ...props }: React.ComponentProps<'label'>) => (
  <label {...props} className={cx(styles.label, 'group__item', className)} />
)
