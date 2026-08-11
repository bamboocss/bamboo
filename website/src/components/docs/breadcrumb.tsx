import { ChevronRightIcon } from '@/icons'
import { css } from '@/styled-system/css'
import { flex } from '@/styled-system/patterns'

interface Props {
  slug: string
}

export const Breadcrumb = ({ slug }: Props) => {
  const parts = slug.split('/')

  const breadcrumbs = parts.map((part, index) => ({
    label: part.replace(/-/g, ' '),
    isLast: index === parts.length - 1,
  }))

  return (
    <div className={flex({ align: 'center', mb: '4', flexWrap: 'wrap', gap: '2' })}>
      {breadcrumbs.map((crumb, index) => (
        <div
          key={`${crumb.label}-${index}`}
          className={flex({
            align: 'center',
            gap: '8px',
            textStyle: 'sm',
            fontWeight: 'semibold',
            textTransform: 'uppercase',
            letterSpacing: 'wide',
          })}
        >
          {crumb.isLast ? (
            <span className={css({ color: 'fg' })}>{crumb.label}</span>
          ) : (
            <span className={css({ color: 'fg.muted' })}>{crumb.label}</span>
          )}
          {!crumb.isLast && <ChevronRightIcon className={css({ w: 3, h: 3 })} />}
        </div>
      ))}
    </div>
  )
}
