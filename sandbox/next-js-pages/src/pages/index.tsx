import { useRef } from 'react'
import { css } from '../../styled-system/css'
import { flex } from '../../styled-system/patterns'
import * as Custom from '../components/custom'

export default function Home() {
  const ref = useRef<HTMLDivElement | null>(null)
  return (
    <div className={flex({ direction: 'column', gap: '8px', fontSize: '2xl', fontWeight: 'bold', padding: '4' })}>
      <Custom.Root ref={ref} className={css({ color: 'pink' })}>
        <Custom.Label>Hello</Custom.Label>
      </Custom.Root>
    </div>
  )
}
