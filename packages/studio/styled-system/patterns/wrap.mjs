import { getPatternStyles, patternFns, memo } from '../helpers.mjs'
import { css } from '../css/index.mjs'

const wrapConfig = {
  transform(props) {
    const { columnGap, rowGap, gap = columnGap || rowGap ? void 0 : '8px', align, justify, ...rest } = props
    return {
      display: 'flex',
      flexWrap: 'wrap',
      alignItems: align,
      justifyContent: justify,
      gap,
      columnGap,
      rowGap,
      ...rest,
    }
  },
}

export const getWrapStyle = (styles = {}) => {
  const _styles = getPatternStyles(wrapConfig, styles)
  return wrapConfig.transform(_styles, patternFns)
}

export const wrap = /* @__PURE__ */ memo((styles) => css(getWrapStyle(styles)))
wrap.raw = getWrapStyle
