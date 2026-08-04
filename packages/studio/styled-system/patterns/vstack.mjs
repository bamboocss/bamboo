import { getPatternStyles, patternFns, memo } from '../helpers.mjs';
import { css } from '../css/index.mjs';

const vstackConfig = {
transform(props) {
	const { justify, gap, ...rest } = props;
	return {
		display: "flex",
		alignItems: "center",
		justifyContent: justify,
		gap,
		flexDirection: "column",
		...rest
	};
},
defaultValues:{gap:'8px'}}

export const getVstackStyle = (styles = {}) => {
  const _styles = getPatternStyles(vstackConfig, styles)
  return vstackConfig.transform(_styles, patternFns)
}

export const vstack = /* @__PURE__ */ memo((styles) => css(getVstackStyle(styles)))
vstack.raw = getVstackStyle