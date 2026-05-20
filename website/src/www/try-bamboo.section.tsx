import { CommandPrompt } from '@/www/command-prompt'
import { css } from '@/styled-system/css'
import { Container, Grid, HStack, Stack, bamboo } from '@/styled-system/jsx'
import Image from 'next/image'
import { ComponentPropsWithoutRef } from 'react'

const installSteps = [
  {
    title: 'Install Bamboo in your project',
    command: 'npm i -D @bamboocss/dev'
  },
  {
    title: 'Run the initialize command',
    command: 'npx bamboo init --postcss'
  },
  {
    title: 'Start using Bamboo in your project',
    command: 'npm run dev'
  }
]

export const TryBambooSection = () => {
  return (
    <bamboo.section bg={{ base: 'black', _dark: 'neutral.700' }}>
      <Container pt="28" pb="24">
        <HStack gap="12">
          <bamboo.div
            flex="1"
            maxW="3xl"
            bg="yellow.300"
            color="black"
            position="relative"
            borderRadius="xl"
          >
            <bamboo.h3 textStyle="bamboo.h2" fontWeight="bold" py="6" px="8">
              Love what you see? <br />
              Try Bamboo in 3 quick steps
            </bamboo.h3>
            <ChatTip
              className={css({
                display: { base: 'none', md: 'block' },
                pos: 'absolute',
                top: '50%',
                left: 'calc(100% - 2px)',
                transform: 'translateY(-50%)',
                color: 'yellow.300'
              })}
            />
          </bamboo.div>

          <Image
            src="/bamboo-hello.svg"
            width={196}
            height={261}
            alt="Yums the bamboo waving"
            className={css({
              display: { base: 'none', md: 'block' },
              w: '56'
            })}
          />
        </HStack>

        <Grid mt="20" gap="10" columns={{ base: 1, md: 3 }}>
          {installSteps.map((step, i) => (
            <Stack color="white" gap={{ base: '2', md: '8' }} key={i}>
              <Stack gap="4" direction={{ base: 'row', md: 'column' }}>
                <bamboo.span
                  key={i}
                  fontSize={{ base: '2rem', md: '6rem' }}
                  fontWeight="bold"
                  letterSpacing="tight"
                  lineHeight="1"
                  color="yellow.300"
                >
                  {i + 1}
                </bamboo.span>
                <bamboo.span fontWeight="semibold" textStyle="bamboo.h4" maxW={{ lg: '240px' }}>
                  {step.title}
                </bamboo.span>
              </Stack>
              <CommandPrompt value={step.command} />
            </Stack>
          ))}
        </Grid>
      </Container>
    </bamboo.section>
  )
}

const ChatTip = (props: ComponentPropsWithoutRef<'svg'>) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    viewBox="772.9 44.1775 49.2 95.92"
    width="24"
    height="44"
    {...props}
  >
    <path
      d="M 773 140 L 821.118 53.3869 C 823.791 48.9638 819.994 43.4556 814.91 44.3801 L 773 52 Z"
      fill="currentColor"
    />
  </svg>
)
