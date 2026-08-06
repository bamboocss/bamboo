import { flex, hstack } from '@/styled-system/patterns'
import { PropsWithChildren } from 'react'
import { Logo } from './Logo'
import { css } from '@/styled-system/css'
import pkgJson from '@bamboocss/dev/package.json'
import { ColorModeSwitch } from '@/src/components/ColorModeSwitch'

export const Toolbar = (props: PropsWithChildren) => (
  <div className={flex({ px: '6', minH: '16', borderBottomWidth: '1px', align: 'center', justify: 'space-between' })}>
    <div className={hstack({ gap: '4' })}>
      <a href="/">
        <Logo />
      </a>
      <span
        className={css({
          textStyle: 'sm',
        })}
      >
        v{pkgJson.version}
      </span>
    </div>
    <div
      className={hstack({
        '& > *:not(:last-child):not(:first-child)': {
          hideBelow: 'md',
        },
      })}
    >
      {props.children}
      <ColorModeSwitch />
    </div>
  </div>
)
