import { HStack, bamboo } from '@/styled-system/jsx'

export const CommandPrompt = (props: { value: string }) => {
  const { value } = props
  return (
    <HStack textStyle="xl" letterSpacing="tight" fontWeight="medium" fontFamily="mono">
      <bamboo.code opacity="0.3">$</bamboo.code>
      <span>{value}</span>
    </HStack>
  )
}
