import { defaultBorderRadius } from '@/components/token-docs/query'
import { css } from '@/styled-system/css'
import { center, flex, grid } from '@/styled-system/patterns'

export const Radii = () => {
  return (
    <div className={grid({ columns: 3, gap: '8', fontSize: 'sm' })}>
      {defaultBorderRadius.map((token) => (
        <div key={token.name} className={flex({ direction: 'column', gap: '8px' })}>
          <div className={center({ size: '8', bg: 'pink.200' })} style={{ borderRadius: token.value }} />
          <div>
            <p className={css({ fontWeight: 'medium' })}>{token.extensions.prop}</p>
            <p>
              {token.value} ({token.extensions.pixelValue})
            </p>
          </div>
        </div>
      ))}
    </div>
  )
}
