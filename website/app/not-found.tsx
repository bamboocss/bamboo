import { css } from '@/styled-system/css'
import { container, vstack } from '@/styled-system/patterns'
import Link from 'next/link'

export default function Page() {
  // The background is yellow in both themes, so the text colour has to be pinned to match
  // rather than following the theme's foreground.
  return (
    <div className={css({ bg: 'yellow.300', color: 'black', height: 'dvh' })}>
      <div className={container({ py: '20', textAlign: 'center' })}>
        <div className={vstack()}>
          <h1 className={css({ textStyle: 'bamboo.h1', fontWeight: 'bold' })}>404</h1>
          <h2 className={css({ textStyle: 'bamboo.h2', fontWeight: 'medium' })}>Page Not Found</h2>
          <p className={css({ textStyle: 'bamboo.h4' })}>
            Sorry, that page does not exist.{' '}
            <Link
              className={css({
                fontWeight: 'medium',
                textDecoration: 'underline',
              })}
              href="/docs"
            >
              Back to docs
            </Link>
          </p>
        </div>
      </div>
    </div>
  )
}
