import { css, cx } from '@/styled-system/css'
import { flex, grid } from '@/styled-system/patterns'
import { LuChevronRight } from 'react-icons/lu'
import { Anchor } from '../components/ui/anchor'

const Arrow = () => (
  <span
    className={css({
      transition: 'opacity',
      opacity: { base: '0', _groupHover: '1' },
    })}
  >
    <LuChevronRight />
  </span>
)

type Props = {
  children?: React.ReactNode
  title: string
  description?: string
  icon: React.ReactNode
  image?: boolean
  arrow?: boolean
  href: string
}

export const Card = (props: Props) => {
  const { children, title, description, icon, image, arrow, href } = props
  const animatedArrow = arrow ? <Arrow /> : null

  return (
    <div className={css({ borderWidth: '1px', px: '6', py: '4', rounded: 'lg' })}>
      <Anchor className="group" href={href}>
        {image || children}
        {icon}
        <span>
          <div className={flex({ direction: 'column', gap: '1' })}>
            <span className={css({ mixin: 'lg', fontWeight: 'semibold' })}>
              <span className={flex({ align: 'center', gap: '8px' })}>
                {title}
                {animatedArrow}
              </span>
            </span>
            {description && (
              <span className={css({ color: { base: 'neutral.700', _dark: 'neutral.400' } })}>{description}</span>
            )}
          </div>
        </span>
      </Anchor>
    </div>
  )
}

export const Cards = (props: React.ComponentProps<'div'>) => {
  const { className, ...rest } = props
  return <div className={cx(grid({ columns: { base: 1, sm: 2 }, mt: '10', gap: '6' }), className)} {...rest} />
}
