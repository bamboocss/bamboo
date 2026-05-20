import * as React from 'react'
import { bamboo, Stack } from '../../styled-system/jsx'

interface EmptyStateProps {
  title: string
  children: React.ReactNode
  icon: React.ReactElement
}

export function EmptyState(props: EmptyStateProps) {
  const { title, children, icon } = props
  return (
    <Stack align="center" gap="5" justify="center" height="full" minHeight="40vh">
      <bamboo.span fontSize="5xl">{icon}</bamboo.span>
      <Stack opacity="0.8" align="center">
        <bamboo.span fontWeight="semibold">{title}</bamboo.span>
        <div>{children}</div>
      </Stack>
    </Stack>
  )
}
