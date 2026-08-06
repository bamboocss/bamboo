import { cva, cx, type RecipeVariantProps } from '../styled-system/css'

const card = cva({
  base: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    _hover: {
      color: 'red.200',
    },
  },
  variants: {
    size: {
      xs: {
        width: '5',
        height: '6',
      },
      sm: {
        width: '12',
        height: '12',
        _hover: {
          bg: 'red.50',
        },
      },
    },
    open: {
      true: {
        animationName: 'red',
      },
    },
    shape: {
      square: {
        borderRadius: '8px',
      },
      circle: {
        borderRadius: '999px',
      },
    },
  },
  compoundVariants: [
    {
      shape: 'square',
      size: ['xs', 'sm'],
      css: { color: 'yellow.300', backgroundColor: 'blue' },
    },
    {
      open: true,
      shape: ['square', 'circle'],
      css: { color: 'blue.300', backgroundColor: 'yellow' },
    },
  ],
})

type CardProps = RecipeVariantProps<typeof card> & React.ComponentProps<'section'>

export const Card = (props: CardProps) => {
  const [variantProps, rest] = card.splitVariantProps(props)
  return <section {...rest} className={cx(card(variantProps), props.className)} />
}
