import { textStyles } from 'virtual:bamboo'
import { bamboo } from '../../styled-system/jsx'
import * as context from '../lib/bamboo-context'
import { EmptyState } from './empty-state'
import { TextStylesIcon } from './icons'
import { TokenContent } from './token-content'
import { TokenGroup } from './token-group'

export default function TextStyles() {
  const keys = Object.keys(context.textStyles)

  return (
    <TokenGroup>
      <TokenContent>
        {keys?.length !== 0 ? (
          keys.map((name) => (
            <bamboo.div px="1" py="2.5" key={name}>
              <bamboo.div borderColor="card">
                <bamboo.span fontWeight="medium">{name}</bamboo.span>
              </bamboo.div>
              <bamboo.div flex="auto" my="3" className={`virtual-text-style-${name}`} truncate>
                Bamboo textStyles are time saving
              </bamboo.div>
              <style
                dangerouslySetInnerHTML={{
                  __html: `.virtual-text-style-${name} { ${textStyles[name]} }`,
                }}
              />
            </bamboo.div>
          ))
        ) : (
          <EmptyState title="No Text Styles" icon={<TextStylesIcon />}>
            The config does not contain any Text Styles
          </EmptyState>
        )}
      </TokenContent>
    </TokenGroup>
  )
}
