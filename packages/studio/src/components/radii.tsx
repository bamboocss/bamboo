import * as React from 'react'
import { toPx } from '@bamboocss/shared'
import { Grid, bamboo, Stack } from '../../styled-system/jsx'
import { getSortedSizes } from '../lib/sizes-sort'
import { TokenGroup } from './token-group'
import { EmptyState } from './empty-state'
import { SizesIcon } from './icons'
import type { useThemeTokens } from '../lib/use-theme-tokens'

type Token = ReturnType<typeof useThemeTokens>[number]

interface RadiiProps {
  radii: Token[]
}

export function Radii({ radii }: RadiiProps) {
  if (radii.length === 0) {
    return (
      <EmptyState title="No Tokens" icon={<SizesIcon />}>
        The bamboo config does not contain any `radii` tokens
      </EmptyState>
    )
  }

  return (
    <TokenGroup>
      <Grid display="grid" minChildWidth="10rem" gap="10">
        {getSortedSizes(radii)
          .sort((a, b) => parseFloat(toPx(a.value)!) - parseFloat(toPx(b.value)!))
          .map((size, index) => (
            <Stack direction="column" key={index}>
              <bamboo.div
                width="80px"
                height="80px"
                background="rgba(255, 192, 203, 0.5)"
                style={{ borderRadius: size.value }}
              />
              <Stack gap="1">
                <b>{size.extensions.prop}</b>
                <bamboo.span opacity="0.7">{size.value}</bamboo.span>
              </Stack>
            </Stack>
          ))}
      </Grid>
    </TokenGroup>
  )
}
