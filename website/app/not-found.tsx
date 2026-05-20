import { css } from '@/styled-system/css'
import { Box, Container, VStack, bamboo } from '@/styled-system/jsx'
import Image from 'next/image'
import Link from 'next/link'

export default function Page() {
  return (
    <bamboo.div bg="yellow.300" height="dvh">
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
                textDecoration: 'underline'
              })}
              href="/docs"
            >
              Back to docs
            </Link>
          </bamboo.p>
          <Box mt="16">
            <Image src="/bamboo-yoga.svg" alt="" width="300" height="500" />
          </Box>
        </VStack>
      </Container>
    </bamboo.div>
  )
}
