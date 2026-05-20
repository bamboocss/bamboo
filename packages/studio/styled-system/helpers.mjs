import { C as filterBaseConditions, E as memo, S as toHash, T as compact, _ as mergeProps, a as getPatternStyles, d as createCss, f as createMergeCss, g as walkObject, h as mapObject, i as getSlotRecipes, k as isObject, n as splitProps, o as patternFns, r as getSlotCompoundVariant, t as uniq, u as hypenateProperty, w as isBaseCondition, x as withoutSpace } from "./uniq-DRfJ796t.mjs";
export { compact, createCss, createMergeCss, filterBaseConditions, getPatternStyles, getSlotCompoundVariant, getSlotRecipes, hypenateProperty, isBaseCondition, isObject, mapObject, memo, mergeProps, patternFns, splitProps, toHash, uniq, walkObject, withoutSpace };



//#region src/normalize-html.ts
const htmlProps = [
	"htmlSize",
	"htmlTranslate",
	"htmlWidth",
	"htmlHeight"
];
function convert(key) {
	return htmlProps.includes(key) ? key.replace("html", "").toLowerCase() : key;
}
function normalizeHTMLProps(props) {
	return Object.fromEntries(Object.entries(props).map(([key, value]) => [convert(key), value]));
}
normalizeHTMLProps.keys = htmlProps;
//#endregion
export { normalizeHTMLProps };


export function __spreadValues(a, b) {
  return { ...a, ...b }
}

export function __objRest(source, exclude) {
  return Object.fromEntries(Object.entries(source).filter(([key]) => !exclude.includes(key)))
}