import { defaultKeyframes } from '@/components/token-docs/query'
import { css } from '@/styled-system/css'
import { center, flex, grid } from '@/styled-system/patterns'
import { Token, token } from '@/styled-system/tokens'

export const Keyframes = () => {
  return (
    <div className={grid({ columns: 3, gap: '8', fontSize: 'sm' })}>
      {Object.keys(defaultKeyframes).map((keyframe) => {
        return (
          <div key={keyframe} className={flex({ direction: 'column', gap: '8px' })}>
            <div
              className={center({
                size: '12',
                bg: 'pink.200',
              })}
              style={{ animation: token(`animations.${keyframe}` as Token) }}
            />
            <p className={css({ fontWeight: 'medium' })}>{keyframe}</p>
          </div>
        )
      })}
    </div>
  )
}
