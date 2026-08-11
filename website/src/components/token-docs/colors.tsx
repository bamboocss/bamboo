import { css } from '@/styled-system/css'
import { flex } from '@/styled-system/patterns'
import { ColorGrid } from './color-grid'
import { defaultColors } from './query'

export const Colors = () => {
  return (
    <div className={flex({ direction: 'column', gap: '8' })}>
      {defaultColors.map((color) => (
        <div key={color.key} className={flex({ direction: 'column', gap: '8px' })}>
          <p
            className={css({
              textTransform: 'capitalize',
              fontWeight: 'medium',
            })}
          >
            {color.key}
          </p>
          <ColorGrid tokens={color.values} />
        </div>
      ))}
    </div>
  )
}
