import { css } from '@/styled-system/css'
import { Circle, Container, Flex, Stack, bamboo } from '@/styled-system/jsx'
import { button } from '@/styled-system/recipes'
import { token } from '@/styled-system/tokens'
import { Icon } from '@/theme/icons'
import { outdent } from 'outdent'
import { Code, codeStyle } from '@/components/code-highlight/code'
import { LearnMore } from '@/www/learn-more'

const codeSnippet = outdent`
@layer reset, base, tokens, recipes, utilities;

@layer utilities {
  .d_flex {
    display: flex;
  }
  
  .flex_row {
    flex-direction: row;
  }

  .mt_2 {
    margin-top: var(--space-2);
  }
  
  .fs_sm {
    font-size: var(--fontSizes-sm);
  }
  
  .color_gray.600 {
    color: var(--color-gray-600);
  }
}`

export const ModernCssSection = () => {
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
              <Icon icon="Css3" />
              <bamboo.div position="absolute" top="-2" right="-5" color="fg">
                <Icon
                  icon="Sparks2"
                  className={css({ w: '22px', h: '22px' })}
                />
              </bamboo.div>
            </Circle>

            <Stack gap="4">
              <bamboo.h3 textStyle="bamboo.h3" fontWeight="bold">
                Generates Modern CSS code at build time
              </bamboo.h3>
              <bamboo.h4
                textStyle="bamboo.h4"
                fontWeight="medium"
                color="fg.muted"
              >
                Bamboo uses modern features like cascade layers, :where selectors
                and css variables to give you best-in-class css output.
              </bamboo.h4>
            </Stack>

            <LearnMore href="/docs/concepts/cascade-layers" />
          </Stack>

          <bamboo.div flex="1" maxW={{ lg: '40rem' }} flexShrink="0">
            <Code
              lang="css"
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
