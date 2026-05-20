import * as React from 'react'
import { toPx } from '@bamboocss/shared'
import { Fragment } from 'react'
import { Grid, bamboo } from '../../styled-system/jsx'
import { getSortedSizes } from '../lib/sizes-sort'
import { TokenGroup } from './token-group'
import type { Token } from '@bamboocss/token-dictionary'
import { EmptyState } from './empty-state'
import { SizesIcon } from './icons'

export interface SizesProps {
  sizes: Token[]
  name: string
}

const contentRegex = /^(min|max|fit)-content$/
const unitRegex = /(ch|%)$/

export default function Sizes(props: SizesProps) {
  const { sizes, name } = props

  const sortedSizes = getSortedSizes(sizes).filter(
    (token) =>
      // remove negative values
      !token.extensions.isNegative &&
      // remove auto breakpoints
      !token.name.includes('breakpoint-') &&
      // remove fit-content, min-content, max-content, ch, %
      !contentRegex.test(token.value) &&
      !unitRegex.test(token.value),
  )

  if (sortedSizes.length === 0) {
    return (
      <EmptyState title="No Tokens" icon={<SizesIcon />}>
        The bamboo config does not contain any `{name}`` tokens
      </EmptyState>
    )
  }

  return (
    <TokenGroup>
      <Grid display="grid" columnGap="10" rowGap="2.5" columns={5}>
        <bamboo.span fontWeight="semibold">Name</bamboo.span>
        <bamboo.span fontWeight="semibold">Size</bamboo.span>
        <bamboo.span fontWeight="semibold" gridColumn="span 3 / span 3">
          Pixels
        </bamboo.span>
        <bamboo.hr gridColumn="span 5 / span 5" />
        {sortedSizes
          .sort((a, b) => a.extensions.prop - b.extensions.prop)
          .map((size, index) => (
            <Fragment key={index}>
              <b>{size.extensions.prop}</b>
              <span>{size.value}</span>
              <span>{toPx(size.value as string)}</span>
              <bamboo.span
                height="5"
                background="rgba(255, 192, 203, 0.5)"
                gridColumn="span 2 / span 2"
                style={{ width: size.value }}
              />
            </Fragment>
          ))}
      </Grid>
    </TokenGroup>
  )
}
