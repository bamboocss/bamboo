import { bamboo } from '@/styled-system/jsx'

export const Badge = bamboo('span', {
  base: {
    fontWeight: 'medium',
    fontSize: '11px',
    px: '1',
    ms: '2',
    rounded: 'sm'
  },
  variants: {
    variant: {
      outline: {
        borderWidth: '1px',
        bg: 'bg',
        color: 'fg'
      },
      solid: {
        bg: 'primary.600',
        color: 'white'
      }
    }
  },
  defaultVariants: {
    variant: 'outline'
  }
})
