import type { MetaFunction } from '@remix-run/node'
import { css, cva, cx } from '../../styled-system/css'

export const meta: MetaFunction = () => {
  return [{ title: 'New Remix App' }, { name: 'description', content: 'Welcome to Remix!' }]
}

const notice = cva({
  base: {
    bg: 'red',
    color: 'white',
    padding: '2',
    borderRadius: 'md',
  },
})

export default function Index() {
  return (
    <div className={css({ paddingY: '40px' })}>
      <div className={cx(notice(), css({ bg: 'pink', color: 'green' }))}>Welcome</div>
      <h1 className={css({ fontFamily: 'Dosis', fontWeight: 'medium' })}>Welcome home</h1>
    </div>
  )
}
