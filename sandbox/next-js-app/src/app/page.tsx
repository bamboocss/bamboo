import { css } from '../../styled-system/css'

const one = css({
  display: 'flex',
  width: '300px',
  border: '1px solid black',
  justifyContent: 'center',
  '--test': '4px',
})

const two = css({
  display: 'flex',
  width: '300px',
  border: '1px solid black',
  justifyContent: 'flex-start',
  marginTop: 'var(--test)',
  '--test': '4px',
})

export default function Home() {
  return (
    <div>
      <div className={one}>one</div>
      <div className={two}>two</div>
    </div>
  )
}
