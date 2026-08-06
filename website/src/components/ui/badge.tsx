import { cva, cx, type RecipeVariantProps } from '@/styled-system/css'

const badgeRecipe = cva({
  base: {
    fontWeight: 'medium',
    fontSize: '11px',
    px: '1',
    ms: '2',
    rounded: 'sm',
  },
  variants: {
    variant: {
      outline: {
        borderWidth: '1px',
        bg: 'bg',
        color: 'fg',
      },
      solid: {
        bg: 'primary.600',
        color: 'white',
      },
    },
  },
  defaultVariants: {
    variant: 'outline',
  },
})

type BadgeProps = RecipeVariantProps<typeof badgeRecipe> & React.ComponentProps<'span'>

export const Badge = (props: BadgeProps) => {
  const [variantProps, rest] = badgeRecipe.splitVariantProps(props)
  return <span {...rest} className={cx(badgeRecipe(variantProps), props.className)} />
}
