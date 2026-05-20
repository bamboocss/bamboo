import { Box, Container, bamboo } from '@/styled-system/jsx'
import { DesktopNavBar } from './navbar.desktop'
import { MobileNavBar } from './navbar.mobile'

export const Navbar = () => {
  return (
    <bamboo.div position="absolute" top="6" width="full" zIndex="10">
      <Container>
        <Box display={{ base: 'none', md: 'block' }}>
          <DesktopNavBar />
        </Box>
        <Box display={{ md: 'none' }}>
          <MobileNavBar />
        </Box>
      </Container>
    </bamboo.div>
  )
}
