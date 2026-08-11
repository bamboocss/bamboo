import { css } from '@/styled-system/css'
import { flex } from '@/styled-system/patterns'
import { defaultSpacings } from './query'

export const Spacings = () => {
  return (
    <div>
      <div
        className={flex({
          align: 'center',
          gap: '8px',
          bg: { base: 'neutral.100', _dark: 'neutral.900' },
          fontSize: 'sm',
          fontWeight: 'medium',
          py: '1',
          px: '3',
          borderBottomWidth: '1px',
        })}
      >
        <p className={css({ width: '100px' })}>Name</p>
        <p className={css({ width: '100px' })}>Value</p>
        <p className={css({ width: '100px' })}>Pixel</p>
      </div>

      <div className={flex({ direction: 'column', gap: '8px', px: '3', pt: '2' })}>
        {defaultSpacings.map((token) => (
          <div key={token.name} className={flex({ align: 'center', gap: '8px', py: '1', fontSize: 'sm' })}>
            <p className={css({ width: '100px', fontWeight: 'medium' })}>{token.extensions.prop}</p>
            <p className={css({ width: '100px' })}>{token.value}</p>
            <p className={css({ width: '100px' })}>{token.extensions.pixelValue}</p>
            <div className={css({ flex: '1' })}>
              <div className={css({ bg: 'pink.200', height: '4' })} style={{ width: token.extensions.varRef }} />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
