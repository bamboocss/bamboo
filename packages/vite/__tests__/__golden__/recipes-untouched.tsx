import { css, cva, sva } from 'styled-system/css'

export const button = cva({
  base: { display: 'inline-flex' },
  variants: { size: { sm: { padding: '2' }, md: { padding: '4' } } },
})

export const parts = sva({
  slots: ['root', 'label'],
  base: { root: { display: 'flex' }, label: { color: 'red.300' } },
})

export const plain = "m_0_auto"
