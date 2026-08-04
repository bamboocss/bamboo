import { getPatternStyles, patternFns, memo } from '../helpers.mjs';
import { css } from '../css/index.mjs';

const boxConfig = {
transform(props) {
	return props;
}}

export const getBoxStyle = (styles = {}) => {
  const _styles = getPatternStyles(boxConfig, styles)
  return boxConfig.transform(_styles, patternFns)
}

export const box = /* @__PURE__ */ memo((styles) => css(getBoxStyle(styles)))
box.raw = getBoxStyle