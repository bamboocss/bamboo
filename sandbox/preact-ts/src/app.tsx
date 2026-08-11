import { css, cva } from 'styled-system/css'
import { flex } from 'styled-system/patterns'
import { btn } from 'styled-system/recipes'
import { token } from 'styled-system/tokens'

const notice = cva({
  base: {
    bg: 'red',
    color: 'white',
    padding: '2',
    borderRadius: 'md',
    outline: `2px solid ${token('colors.colorPalette.500')}`,
    fontWeight: 'bold',
  },
  variants: {
    size: {
      lg: {
        fontSize: token('fontSizes.3xl'),
        '&:hover': {
          fontSize: token('fontSizes.4xl'),
        },
      },
    },
  },
})

export const App = () => {
  return (
    <div className={css({ p: '4', spaceY: '4', colorPalette: 'blue', bg: token('colors.colorPalette.500') })}>
      <div className={notice()}>Styled</div>
      <div className={css({ bg: 'pink', color: 'green' })}>Unstyled + css</div>
      <div className={notice({ size: 'lg' })}>Styled + variants (font-size: 3xl)</div>
      <div className={flex({ direction: 'column', gap: '8px' })}>
        <a className={css({ mb: '3', paddingEnd: '2' })}>Click me</a>
      </div>
      <div className={css({ color: 'yellow' })}></div>
      <div className={btn()}>aaaa Click me</div>
    </div>
  )
}
