import { css } from '@/styled-system/css'
import { Container, VStack, bamboo } from '@/styled-system/jsx'
import Link from 'next/link'

export default function Page() {
  // The background is yellow in both themes, so the text colour has to be pinned to match
  // rather than following the theme's foreground.
  return (
    <bamboo.div bg="yellow.300" color="black" height="dvh">
      <Container py="20" textAlign="center">
        <VStack>
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
        </VStack>
      </Container>
    </bamboo.div>
  )
}
