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

export const Root = (props: any) => <div {...props} class={cx(styles.root, 'group', props.class)} />
export const Label = (props: any) => <label {...props} class={cx(styles.label, 'group__item', props.class)} />
