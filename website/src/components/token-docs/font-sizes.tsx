import { defaultFontSizes } from '@/components/token-docs/query'
import { css } from '@/styled-system/css'
import { flex } from '@/styled-system/patterns'

export const FontSizes = () => {
  return (
    <div className={flex({ direction: 'column', gap: '4', fontSize: 'sm' })}>
      {defaultFontSizes.map((token) => (
        <div key={token.name} className={flex({ align: 'center', gap: '8px' })}>
          <p className={css({ width: '4rem', fontWeight: 'medium' })}>{token.extensions.prop}</p>
          <p className={css({ width: '6rem', opacity: '0.6' })}>{token.value}</p>
          <div style={{ fontSize: token.value }}>Ag</div>
        </div>
      ))}
    </div>
  )
}
