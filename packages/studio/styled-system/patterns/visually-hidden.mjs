import { getPatternStyles, patternFns, memo } from '../helpers.mjs'
import { css } from '../css/index.mjs'

const visuallyHiddenConfig = {
  transform(props) {
    return {
      srOnly: true,
      ...props,
    }
  },
}

export const getVisuallyHiddenStyle = (styles = {}) => {
  const _styles = getPatternStyles(visuallyHiddenConfig, styles)
  return visuallyHiddenConfig.transform(_styles, patternFns)
}

export const visuallyHidden = /* @__PURE__ */ memo((styles) => css(getVisuallyHiddenStyle(styles)))
visuallyHidden.raw = getVisuallyHiddenStyle
