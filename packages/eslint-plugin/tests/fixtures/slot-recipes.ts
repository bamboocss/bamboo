import type { SlotRecipeConfig } from '@bamboocss/types'

export const slotRecipes: Record<string, SlotRecipeConfig> = {
  badge: {
    base: {
      title: { bg: 'red.300', rounded: 'sm' },
    },
    className: 'badge',
    compoundVariants: [
      {
        css: {
          title: { color: 'ButtonHighlight' },
        },
        raised: true,
        size: 'sm',
      },
    ],
    slots: ['title', 'body'],
    variants: {
      raised: {
        true: {
          title: { shadow: 'md' },
        },
      },
      size: {
        sm: {
          body: { color: 'red' },
          title: { px: '4' },
        },
      },
    },
  },
  checkbox: {
    base: {
      control: { borderRadius: 'sm', borderWidth: '1px' },
      label: { marginStart: '2' },
      root: { alignItems: 'center', display: 'flex', gap: '2' },
    },
    className: 'checkbox',
    defaultVariants: {
      size: 'sm',
    },
    slots: ['root', 'control', 'label'],
    variants: {
      size: {
        lg: {
          control: { height: '12', width: '12' },
          label: { fontSize: 'lg' },
        },
        md: {
          control: { height: '10', width: '10' },
          label: { fontSize: 'md' },
        },
        sm: {
          control: { height: '8', textStyle: 'headline.h1', width: '8' },
          label: { fontSize: 'sm' },
        },
      },
    },
  },
}
