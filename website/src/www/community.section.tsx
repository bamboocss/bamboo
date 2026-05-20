import { ButtonLink } from '@/components/ui/button'
import { Container, Stack, bamboo } from '@/styled-system/jsx'
import { Icon } from '@/theme/icons'
import Image from 'next/image'

export const CommunitySection = () => {
  return (
    <bamboo.section position="relative" bg="bg" overflow="hidden">
      <bamboo.div
        display={{ base: 'none', md: 'block' }}
        position="absolute"
        top="2%"
        right="-16%"
        pointerEvents="none"
      >
        <Image
          width="800"
          height="800"
          alt=""
          src="/community.png"
          style={{ height: '100%', width: '800px' }}
        />
      </bamboo.div>

      <Container pt="32" pb="40">
        <Stack gap="10" align="flex-start" maxWidth="580px">
          <Stack gap="6" bg="bg">
            <bamboo.h3 textStyle="bamboo.h3" fontWeight="bold">
              Join our community
            </bamboo.h3>
            <bamboo.span textStyle="2xl" letterSpacing="tight" fontWeight="medium">
              Get support, get involved and join our community of developers - Hop into our Discord
            </bamboo.span>
          </Stack>

          <ButtonLink href="https://discord.gg/VQrkpsgSx7" size="lg" color="www" variant="funky">
            Join our Discord
            <Icon icon="ExternalLink" />
          </ButtonLink>
        </Stack>
      </Container>
    </bamboo.section>
  )
}
