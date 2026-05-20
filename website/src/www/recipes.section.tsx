import { Code, codeStyle } from '@/components/code-highlight/code'
import { LearnMore } from '@/www/learn-more'
import { css } from '@/styled-system/css'
import { Circle, Container, Flex, Stack, bamboo } from '@/styled-system/jsx'
import { button } from '@/styled-system/recipes'
import { token } from '@/styled-system/tokens'
import { Icon } from '@/theme/icons'
import { outdent } from 'outdent'

const codeSnippet = outdent`
export const badge = cva({
  base: {
    fontWeight: 'medium',
    px: '3',
    rounded: 'md',
  },
  variants: {
    status: {
      default: {
        color: 'white',
        bg: 'gray.500',
      },
      success: {
        color: 'white',
        bg: 'green.500',
      },
      warning: {
        color: 'white',
        bg: 'yellow.500',
      },
    },
  },
  defaultVariants: {
    status: 'default',
  },
})`

export const RecipesSection = () => {
  return (
    <bamboo.section bg="bg.main">
      <Container mb={{ lg: '-10rem' }}>
        <Flex
          direction={{ base: 'column', lg: 'row' }}
          gap="8"
          justify="space-between"
          py="20"
        >
          <Stack position="relative" gap="14" maxW={{ lg: '560px' }} pt="10">
            <Circle
              size="94px"
              className={button({ color: 'white', shape: 'circle' })}
              position="relative"
            >
              <Icon icon="Recipe" />
              <bamboo.div position="absolute" top="-2" right="-5" color="fg">
                <Icon
                  icon="Sparks2"
                  className={css({ w: '22px', h: '22px' })}
                />
              </bamboo.div>
            </Circle>

            <Stack gap="4">
              <bamboo.h3 textStyle="bamboo.h3" fontWeight="bold">
                Recipes and variants just like Stitches
              </bamboo.h3>
              <bamboo.h4
                textStyle="bamboo.h4"
                fontWeight="medium"
                color="fg.muted"
              >
                Bamboo gives you a robust functions to define recipes and even
                “cva” to help you design composable component styles.
              </bamboo.h4>
            </Stack>

            <bamboo.div position={{ lg: 'absolute' }} bottom="40" left="0">
              <LearnMore href="/docs/concepts/recipes" />
            </bamboo.div>
          </Stack>

          <bamboo.div flex="1" maxW={{ lg: '40rem' }} flexShrink="0">
            <Code
              lang="tsx"
              style={{ borderRadius: token('radii.xl') }}
              codeClassName={codeStyle}
            >
              {codeSnippet}
            </Code>
          </bamboo.div>
        </Flex>
      </Container>
    </bamboo.section>
  )
}
