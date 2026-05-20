import type { Token } from '@bamboocss/token-dictionary'
import * as React from 'react'
import { HStack, bamboo, Stack } from '../../styled-system/jsx'
import { TokenContent } from '../components/token-content'
import { TokenGroup } from '../components/token-group'
import { Input, Textarea } from './input'
import { StickyTop } from './sticky-top'
import { EmptyState } from './empty-state'
import { TypographyIcon } from './icons'

interface FontTokensProps {
  text?: string
  largeText?: boolean
  token: string
  fontTokens: Token[]
  css?: any
}

export default function FontTokens(props: FontTokensProps) {
  const { text: textProp = 'Hello World', largeText = false, token, fontTokens } = props

  const [text, setText] = React.useState(textProp)

  const handleChange = (event: React.ChangeEvent<any>) => {
    setText(event.target.value)
  }

  if (fontTokens.length === 0) {
    return (
      <EmptyState title="No Tokens" icon={<TypographyIcon />}>
        The bamboo config does not contain any `{token}` tokens
      </EmptyState>
    )
  }

  return (
    <TokenGroup>
      <StickyTop>
        {largeText ? (
          <Textarea resize="vertical" onChange={handleChange} rows={5} value={text} placeholder="Preview Text" />
        ) : (
          <Input value={text} onChange={handleChange} placeholder="Preview Text" />
        )}
      </StickyTop>

      <TokenContent>
        {fontTokens.map((fontToken) => (
          <React.Fragment key={fontToken.extensions.prop}>
            <Stack gap="3.5">
              <HStack gap="1">
                <bamboo.span fontWeight="medium">{fontToken.extensions.prop}</bamboo.span>
                <bamboo.span opacity="0.4">({fontToken.value})</bamboo.span>
              </HStack>
              <bamboo.span
                fontSize="4xl"
                lineHeight="normal"
                className="render"
                style={{
                  [token]: fontToken.value,
                }}
              >
                {text}
              </bamboo.span>
            </Stack>
          </React.Fragment>
        ))}
      </TokenContent>
    </TokenGroup>
  )
}
