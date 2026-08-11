import { css } from '@/styled-system/css'
import { defaultShadows } from './query'
import { flex } from '@/styled-system/patterns'

export const Shadows = () => {
  return (
    <div className={flex({ direction: 'column', gap: '8' })}>
      {defaultShadows.map((token, index) => {
        return (
          <div className={flex({ align: 'center', gap: '4' })} key={index}>
            <div className={css({ width: '20' })}>{token.extensions.prop}</div>
            <div className={css({ width: '32' })}>
              <div
                className={css({
                  width: '20',
                  height: '10',
                  borderWidth: '1px',
                  rounded: 'sm',
                })}
                style={{ boxShadow: token.value }}
              />
            </div>
            <div className={css({ opacity: '0.6', fontSize: 'sm' })}>
              {(token.value as string).split(',').map((v, i) => (
                <p key={i}>{v}</p>
              ))}
            </div>
          </div>
        )
      })}
    </div>
  )
}
