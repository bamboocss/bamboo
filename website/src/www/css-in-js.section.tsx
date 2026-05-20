import { css } from '@/styled-system/css'
import { HStack, Stack, VStack, bamboo } from '@/styled-system/jsx'
import { Icon, IconType } from '@/theme/icons'
import { outdent } from 'outdent'
import { Code } from '@/components/code-highlight/code'
import { tabs } from '@/components/code-highlight/tabs.extension'

const codeSnippets = [
  {
    code: outdent`
    import { css } from "./styled-system/css";
    import { circle, stack } from "./styled-system/patterns";

    function App() {
      return (
        <div className={stack({ direction: "row", p: "4" })}>
          <div className={circle({ size: "5rem", overflow: "hidden" })}>
            <img src="https://via.placeholder.com/150" alt="avatar" />
          </div>
          <div className={css({ mt: "4", fontSize: "xl", fontWeight: "semibold" })}>
            John Doe
          </div>
          <div className={css({ mt: "2", fontSize: "sm", color: "gray.600" })}>
            john@doe.com
          </div>
        </div>
      );
    }
`,
    title: 'style-functions.tsx',
    lang: 'tsx',
  },
  {
    code: outdent`
    import { Box, Stack, Circle } from './styled-system/jsx'

    function App() {
      return (
        <Stack direction="row" p="4" rounded="md" shadow="lg" bg="white">
          <Circle size="5rem" overflow="hidden">
            <img src="https://via.placeholder.com/150" alt="avatar" />
          </Circle>
          <Box mt="4" fontSize="xl" fontWeight="semibold">
            John Doe
          </Box>
          <Box mt="2" fontSize="sm" color="gray.600">
            john@doe.com
          </Box>
        </Stack>
      )
    }
    `,
    title: 'style-props.tsx',
    lang: 'tsx',
  },
  {
    code: outdent`
    import { styled } from './styled-system/jsx'
    import { cva } from './styled-system/css'

    export const badge = cva({
      base: {
        fontWeight: 'medium',
        borderRadius: 'md',
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
        },
      }
    })

    export const Badge = styled('span', badge)

    `,
    title: 'style-recipes.ts',
    lang: 'ts',
  },
]

const features: Array<{ title: string; description: string; icon: IconType }> = [
  {
    title: 'Zero runtime',
    description: 'Generates static CSS at build-time',
    icon: 'FastForwardArrow',
  },
  {
    title: 'Type safe',
    description: 'TypeScript support out of the box',
    icon: 'TypescriptLogo',
  },
  {
    title: 'Amazing DX',
    description: 'Low learning curve, great developer experience',
    icon: 'Sparks',
  },
]

export const CssInJSSection = () => {
  return (
    <bamboo.section bg="black" pt="10rem" pb="12rem" color="white" mt="2px">
      <bamboo.div maxW="8xl" mx="auto" px={{ base: '4', md: '6', lg: '8' }}>
        <VStack gap="16">
          <bamboo.h2 textStyle="bamboo.h2" fontWeight="semibold" textAlign={{ base: 'center', lg: 'left' }}>
            Styling library <bamboo.span color="yellow.300">you’ll enjoy</bamboo.span> using 🎋
          </bamboo.h2>

          <bamboo.div width="full" maxW="4xl" mx="auto">
            <Code lang="tsx" extensions={[tabs]} subProps={codeSnippets} />
          </bamboo.div>

          <VStack maxW={{ base: '2xl', lg: '5xl' }} mx="auto" gap="16">
            <bamboo.span textStyle="bamboo.h3" textAlign="center" fontWeight="semibold">
              CSS-in-JS with build time generated styles, RSC compatible, multi-variant support.
            </bamboo.span>

            <Stack
              direction={{ base: 'column', lg: 'row' }}
              align={{ base: 'center', lg: 'flex-start' }}
              justify="space-between"
              w="100%"
              gap="8"
            >
              {features.map(({ title, description, icon }) => (
                <Stack
                  maxW={{ lg: '20ch' }}
                  align={{ base: 'center', lg: 'flex-start' }}
                  textStyle="xl"
                  width="full"
                  key={title}
                >
                  <HStack>
                    <Icon icon={icon} className={css({ color: 'yellow.300' })} />
                    <bamboo.span fontWeight="semibold">{title}</bamboo.span>
                  </HStack>
                  <bamboo.span color="gray.200" maxW={{ lg: '256px' }}>
                    {description}
                  </bamboo.span>
                </Stack>
              ))}
            </Stack>
          </VStack>
        </VStack>
      </bamboo.div>
    </bamboo.section>
  )
}
