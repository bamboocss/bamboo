import { cva, cx, type RecipeVariantProps } from 'styled-system/css'

export const badge = cva({
  base: {
    fontWeight: 'medium',
    letterSpacing: 'wide',
    flexGrow: '0',
    px: '3',
    alignSelf: 'flex-start',
    borderRadius: 'md',
  },
  variants: {
    status: {
      default: {
        color: 'white',
        bg: 'gray.500',
      },
      success: {
        color: 'white',
        bg: 'green.500',
      },
      warning: {
        color: 'white',
        bg: 'yellow.500',
      },
    },
  },
  defaultVariants: {
    status: 'default',
  },
})

type BadgeProps = RecipeVariantProps<typeof badge> & React.ComponentProps<'span'>

export const Badge = (props: BadgeProps) => {
  const [variantProps, rest] = badge.splitVariantProps(props)
  return <span {...rest} className={cx(badge(variantProps), props.className)} />
}
