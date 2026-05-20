import { createElement, forwardRef } from 'react'

import { splitProps } from '../helpers.mjs'
import { getContainerStyle } from '../patterns/container.mjs'
import { bamboo } from './factory.mjs'

export const Container = /* @__PURE__ */ forwardRef(function Container(props, ref) {
  const [patternProps, restProps] = splitProps(props, [])

  const styleProps = getContainerStyle(patternProps)
  const mergedProps = { ref, ...styleProps, ...restProps }

  return createElement(bamboo.div, mergedProps)
})
