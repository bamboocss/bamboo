import { getPatternStyles, patternFns, memo } from '../helpers.mjs';
import { css } from '../css/index.mjs';

const cqConfig = {
transform(props) {
	const { name, type, ...rest } = props;
	return {
		containerType: type,
		containerName: name,
		...rest
	};
},
defaultValues:{type:'inline-size'}}

export const getCqStyle = (styles = {}) => {
  const _styles = getPatternStyles(cqConfig, styles)
  return cqConfig.transform(_styles, patternFns)
}

export const cq = /* @__PURE__ */ memo((styles) => css(getCqStyle(styles)))
cq.raw = getCqStyle