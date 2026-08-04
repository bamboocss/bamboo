import { getPatternStyles, patternFns, memo } from '../helpers.mjs';
import { css } from '../css/index.mjs';

const containerConfig = {
transform(props) {
	return {
		position: "relative",
		maxWidth: "8xl",
		mx: "auto",
		px: {
			base: "4",
			md: "6",
			lg: "8"
		},
		...props
	};
}}

export const getContainerStyle = (styles = {}) => {
  const _styles = getPatternStyles(containerConfig, styles)
  return containerConfig.transform(_styles, patternFns)
}

export const container = /* @__PURE__ */ memo((styles) => css(getContainerStyle(styles)))
container.raw = getContainerStyle