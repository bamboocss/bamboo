import { getPatternStyles, patternFns, memo } from '../helpers.mjs';
import { css } from '../css/index.mjs';

const stackConfig = {
transform(props) {
	const { align, justify, direction, gap, ...rest } = props;
	return {
		display: "flex",
		flexDirection: direction,
		alignItems: align,
		justifyContent: justify,
		gap,
		...rest
	};
},
defaultValues:{direction:'column',gap:'8px'}}

export const getStackStyle = (styles = {}) => {
  const _styles = getPatternStyles(stackConfig, styles)
  return stackConfig.transform(_styles, patternFns)
}

export const stack = /* @__PURE__ */ memo((styles) => css(getStackStyle(styles)))
stack.raw = getStackStyle