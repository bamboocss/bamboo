import * as React from 'react'
import { layerStyles } from 'virtual:bamboo'
import { bamboo } from '../../styled-system/jsx'
import * as context from '../lib/bamboo-context'
import { EmptyState } from './empty-state'
import { LayerStylesIcon } from './icons'
import { TokenContent } from './token-content'
import { TokenGroup } from './token-group'

export default function LayerStyles() {
  const keys = Object.keys(context.layerStyles)

  return (
    <TokenGroup>
      <TokenContent divideY="1px" divideColor="card">
        {keys && keys?.length !== 0 ? (
          keys.map((name) => (
            <bamboo.div px="1" py="2.5" key={name}>
              <bamboo.div borderColor="card">
                <bamboo.span fontWeight="medium">{name}</bamboo.span>
              </bamboo.div>
              <bamboo.div px="4" py="2" background="card" marginTop="5">
                <bamboo.div flex="auto" my="3" height="20" className={`virtual-layer-style-${name}`} />
                <style
                  dangerouslySetInnerHTML={{
                    __html: `.virtual-layer-style-${name} { ${layerStyles[name]} }`,
                  }}
                />
              </bamboo.div>
            </bamboo.div>
          ))
        ) : (
          <EmptyState title="No Layer Styles" icon={<LayerStylesIcon />}>
            The bamboo config does not contain any layer styles
          </EmptyState>
        )}
      </TokenContent>
    </TokenGroup>
  )
}
