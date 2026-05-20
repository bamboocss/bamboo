import { ComponentPropsWithoutRef } from 'react'
import {
  Container,
  HStack,
  Square,
  Stack,
  VStack,
  bamboo
} from '@/styled-system/jsx'
import { Icon, IconType } from '@/theme/icons'

export const WorksEverywhereSection = () => {
  return (
    <section>
      <Container pt="32" pb="48">
        <VStack gap="20">
          <bamboo.h2 textStyle="bamboo.h2" fontWeight="bold" textAlign="center">
            Works Everywhere. <br />
            Including Server Components.
          </bamboo.h2>

          <Stack
            gap="12"
            direction={{ base: 'column', lg: 'row' }}
            align="center"
          >
            <HStack gap="12">
              <ProjectLogo icon="RemixLogo" title="Remix" />
              <ProjectLogo icon="ViteLogo" title="Vite" />
              <ProjectLogo icon="NextJsLogo" title="NextJs" height="46.5" />
            </HStack>

            <Square
              position="relative"
              top={{ lg: '-3' }}
              size="120px"
              layerStyle="offShadow"
              bg="yellow.300"
              color="black"
              rounded="lg"
            >
              <Icon icon="LogoLetter" width="71" height="69" />
            </Square>

            <HStack gap="12">
              <ProjectLogo icon="PostCSSLogo" title="PostCSS" height="45" />
              <ProjectLogo icon="AstroLogo" title="Astro" />
              <ProjectLogo icon="StorybookLogo" title="Storybook" height="39" />
            </HStack>
          </Stack>

          <VStack maxW="560px" mx="auto">
            <bamboo.span
              textStyle="2xl"
              fontWeight="medium"
              letterSpacing="tight"
              textAlign="center"
            >
              Bamboo works out of box with your favorite JS framework. Use it
              with Vite, Remix,{' '}
              <bamboo.mark
                bg="yellow.300"
                rounded="lg"
                px="2"
                py="1"
                boxDecorationBreak="clone"
              >
                Next.js (including app dir)
              </bamboo.mark>
            </bamboo.span>
          </VStack>
        </VStack>
      </Container>
    </section>
  )
}

const ProjectLogo = ({
  title,
  ...iconProps
}: { icon: IconType; title: string } & ComponentPropsWithoutRef<
  typeof Icon
>) => (
  <VStack>
    <Square
      size="20"
      rounded="lg"
      layerStyle="offShadow"
      _dark={{ boxShadowColor: 'yellow.300' }}
    >
      <Icon {...iconProps} />
    </Square>
    <bamboo.span textStyle="xl" letterSpacing="tight" fontWeight="bold">
      {title}
    </bamboo.span>
  </VStack>
)
