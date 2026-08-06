import { css } from '@/styled-system/css'
import { bamboo } from '@/styled-system/jsx'
import { container, vstack } from '@/styled-system/patterns'
import Link from 'next/link'

export default function Page() {
  // The background is yellow in both themes, so the text colour has to be pinned to match
  // rather than following the theme's foreground.
  return (
    <bamboo.div bg="yellow.300" color="black" height="dvh">
      <div className={container({ py: '20', textAlign: 'center' })}>
        <div className={vstack()}>
          <bamboo.h1 textStyle="bamboo.h1" fontWeight="bold">
            404
          </bamboo.h1>
          <bamboo.h2 textStyle="bamboo.h2" fontWeight="medium">
            Page Not Found
          </bamboo.h2>
          <bamboo.p textStyle="bamboo.h4">
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
          </bamboo.p>
        </div>
      </div>
    </bamboo.div>
  )
}
