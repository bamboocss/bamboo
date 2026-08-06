import { useRef } from 'react'
import { css } from '../../styled-system/css'
import { stack } from '../../styled-system/patterns'
import * as Custom from '../components/custom'

export default function Home() {
  const ref = useRef<HTMLDivElement | null>(null)
  return (
    <div className={stack({ fontSize: '2xl', fontWeight: 'bold', padding: '4' })}>
      <Custom.Root ref={ref} className={css({ color: 'pink' })}>
        <Custom.Label>Hello</Custom.Label>
      </Custom.Root>
    </div>
  )
}
