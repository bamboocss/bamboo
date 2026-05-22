//#region src/assert.ts
function isObject(value) {
	return typeof value === "object" && value != null && !Array.isArray(value);
}
const isObjectOrArray = (obj) => typeof obj === "object" && obj !== null;
//#endregion
//#region src/compact.ts
function compact(value) {
	return Object.fromEntries(Object.entries(value ?? {}).filter(([_, value]) => value !== void 0));
}
//#endregion
//#region src/condition.ts
const isBaseCondition = (v) => v === "base";
function filterBaseConditions(c) {
	return c.slice().filter((v) => !isBaseCondition(v));
}
//#endregion
//#region src/hash.ts
function toChar(code) {
	return String.fromCharCode(code + (code > 25 ? 39 : 97));
}
function toName(code) {
	let name = "";
	let x;
	for (x = Math.abs(code); x > 52; x = x / 52 | 0) name = toChar(x % 52) + name;
	return toChar(x % 52) + name;
}
function toPhash(h, x) {
	let i = x.length;
	while (i) h = h * 33 ^ x.charCodeAt(--i);
	return h;
}
function toHash(value) {
	return toName(toPhash(5381, value) >>> 0);
}
//#endregion
//#region src/important.ts
const importantRegex = /\s*!(important)?/i;
function isImportant(value) {
	return typeof value === "string" ? importantRegex.test(value) : false;
}
function withoutImportant(value) {
	return typeof value === "string" ? value.replace(importantRegex, "").trim() : value;
}
function withoutSpace(str) {
	return typeof str === "string" ? str.replaceAll(" ", "_") : str;
}
//#endregion
//#region src/memo.ts
const memo = (fn) => {
	const cache = /* @__PURE__ */ new Map();
	const get = (...args) => {
		const key = JSON.stringify(args);
		if (cache.has(key)) return cache.get(key);
		const result = fn(...args);
		cache.set(key, result);
		return result;
	};
	return get;
};
//#endregion
//#region src/merge-props.ts
const MERGE_OMIT = new Set([
	"__proto__",
	"constructor",
	"prototype"
]);
function mergeProps(...sources) {
	return sources.reduce((prev, obj) => {
		if (!obj) return prev;
		Object.keys(obj).forEach((key) => {
			if (MERGE_OMIT.has(key)) return;
			const prevValue = prev[key];
			const value = obj[key];
			if (isObject(prevValue) && isObject(value)) prev[key] = mergeProps(prevValue, value);
			else prev[key] = value;
		});
		return prev;
	}, {});
}
//#endregion
//#region src/walk-object.ts
const isNotNullish = (element) => element != null;
function walkObject(target, predicate, options = {}) {
	const { stop, getKey } = options;
	function inner(value, path = []) {
		if (isObjectOrArray(value)) {
			const result = {};
			for (const [prop, child] of Object.entries(value)) {
				const key = getKey?.(prop, child) ?? prop;
				const childPath = [...path, key];
				if (stop?.(value, childPath)) return predicate(value, path);
				const next = inner(child, childPath);
				if (isNotNullish(next)) result[key] = next;
			}
			return result;
		}
		return predicate(value, path);
	}
	return inner(target);
}
function mapObject(obj, fn) {
	if (Array.isArray(obj)) return obj.map((value) => fn(value));
	if (!isObject(obj)) return fn(obj);
	return walkObject(obj, (value) => fn(value));
}
//#endregion
//#region src/normalize-style-object.ts
function toResponsiveObject(values, breakpoints) {
	return values.reduce((acc, current, index) => {
		const key = breakpoints[index];
		if (current != null) acc[key] = current;
		return acc;
	}, {});
}
function normalizeStyleObject(styles, context, shorthand = true) {
	const { utility, conditions } = context;
	const { hasShorthand, resolveShorthand } = utility;
	return walkObject(styles, (value) => {
		return Array.isArray(value) ? toResponsiveObject(value, conditions.breakpoints.keys) : value;
	}, {
		stop: (value) => Array.isArray(value),
		getKey: shorthand ? (prop) => hasShorthand ? resolveShorthand(prop) : prop : void 0
	});
}
//#endregion
//#region src/classname.ts
const fallbackCondition = {
	shift: (v) => v,
	finalize: (v) => v,
	breakpoints: { keys: [] }
};
const sanitize = (value) => typeof value === "string" ? value.replaceAll(/[\n\s]+/g, " ") : value;
const ENTRY_SEP = "]___[";
const COND_SEP = "<___>";
function createCss(context) {
	const { utility, hash, grouped, conditions: conds = fallbackCondition } = context;
	const formatClassName = (str) => [utility.prefix, str].filter(Boolean).join("-");
	const hashFn = (conditions, className) => {
		let result;
		if (hash) {
			const baseArray = [...conds.finalize(conditions), className];
			result = formatClassName(utility.toHash(baseArray, toHash));
		} else result = [...conds.finalize(conditions), formatClassName(className)].join(":");
		return result;
	};
	if (grouped) return memo(({ base, ...styles } = {}) => {
		const normalizedObject = normalizeStyleObject(Object.assign(styles, base), context);
		const hashes = [];
		walkObject(normalizedObject, (value, paths) => {
			if (value == null) return;
			const [prop, ...allConditions] = conds.shift(paths);
			const conditions = filterBaseConditions(allConditions);
			const parts = [`${prop}${ENTRY_SEP}value:${value}`];
			if (conditions.length) parts.push(`cond:${conditions.join(COND_SEP)}`);
			hashes.push(parts.join(ENTRY_SEP));
		});
		if (hashes.length === 0) return "";
		hashes.sort();
		const groupId = hashes.join("|");
		return formatClassName(utility.toHash(["grouped", groupId], toHash));
	});
	return memo(({ base, ...styles } = {}) => {
		const normalizedObject = normalizeStyleObject(Object.assign(styles, base), context);
		const classNames = /* @__PURE__ */ new Set();
		walkObject(normalizedObject, (value, paths) => {
			if (value == null) return;
			const important = isImportant(value);
			const [prop, ...allConditions] = conds.shift(paths);
			let className = hashFn(filterBaseConditions(allConditions), utility.transform(prop, withoutImportant(sanitize(value))).className);
			if (important) className = `${className}!`;
			classNames.add(className);
		});
		return Array.from(classNames).join(" ");
	});
}
function compactStyles(...styles) {
	return styles.flat().filter((style) => isObject(style) && Object.keys(compact(style)).length > 0);
}
function createMergeCss(context) {
	function resolve(styles) {
		const allStyles = compactStyles(...styles);
		if (allStyles.length === 1) return allStyles;
		return allStyles.map((style) => normalizeStyleObject(style, context));
	}
	function mergeCss(...styles) {
		return mergeProps(...resolve(styles));
	}
	function assignCss(...styles) {
		return Object.assign({}, ...resolve(styles));
	}
	return {
		mergeCss: memo(mergeCss),
		assignCss
	};
}
//#endregion
//#region src/hypenate-property.ts
const wordRegex = /([A-Z])/g;
const msRegex = /^ms-/;
const hypenateProperty = memo((property) => {
	if (property.startsWith("--")) return property;
	return property.replace(wordRegex, "-$1").replace(msRegex, "-ms-").toLowerCase();
});
//#endregion
//#region src/is-css-function.ts
const fnRegExp = new RegExp(`^(${[
	"min",
	"max",
	"clamp",
	"calc"
].join("|")})\\(.*\\)`);
const isCssFunction = (v) => typeof v === "string" && fnRegExp.test(v);
//#endregion
//#region src/is-css-unit.ts
const lengthUnitsPattern = `(?:${"cm,mm,Q,in,pc,pt,px,em,ex,ch,rem,lh,rlh,vw,vh,vmin,vmax,vb,vi,svw,svh,lvw,lvh,dvw,dvh,cqw,cqh,cqi,cqb,cqmin,cqmax,%".split(",").join("|")})`;
const lengthRegExp = new RegExp(`^[+-]?[0-9]*.?[0-9]+(?:[eE][+-]?[0-9]+)?${lengthUnitsPattern}$`);
const isCssUnit = (v) => typeof v === "string" && lengthRegExp.test(v);
//#endregion
//#region src/is-css-var.ts
const isCssVar = (v) => typeof v === "string" && /^var\(--.+\)$/.test(v);
//#endregion
//#region src/pattern-fns.ts
const patternFns = {
	map: mapObject,
	isCssFunction,
	isCssVar,
	isCssUnit
};
const getPatternStyles = (pattern, styles) => {
	if (!pattern?.defaultValues) return styles;
	const defaults = typeof pattern.defaultValues === "function" ? pattern.defaultValues(styles) : pattern.defaultValues;
	return Object.assign({}, defaults, compact(styles));
};
//#endregion
//#region src/slot.ts
const getSlotRecipes = (recipe = {}) => {
	const init = (slot) => ({
		className: [recipe.className, slot].filter(Boolean).join("__"),
		base: recipe.base?.[slot] ?? {},
		variants: {},
		defaultVariants: recipe.defaultVariants ?? {},
		compoundVariants: recipe.compoundVariants ? getSlotCompoundVariant(recipe.compoundVariants, slot) : []
	});
	const recipeParts = (recipe.slots ?? []).map((slot) => [slot, init(slot)]);
	for (const [variantsKey, variantsSpec] of Object.entries(recipe.variants ?? {})) for (const [variantKey, variantSpec] of Object.entries(variantsSpec)) recipeParts.forEach(([slot, slotRecipe]) => {
		slotRecipe.variants[variantsKey] ??= {};
		slotRecipe.variants[variantsKey][variantKey] = variantSpec[slot] ?? {};
	});
	return Object.fromEntries(recipeParts);
};
const getSlotCompoundVariant = (compoundVariants, slotName) => compoundVariants.filter((compoundVariant) => compoundVariant.css[slotName]).map((compoundVariant) => ({
	...compoundVariant,
	css: compoundVariant.css[slotName]
}));
//#endregion
//#region src/split-props.ts
function splitProps(props, ...keys) {
	const descriptors = Object.getOwnPropertyDescriptors(props);
	const dKeys = Object.keys(descriptors);
	const split = (k) => {
		const clone = {};
		for (let i = 0; i < k.length; i++) {
			const key = k[i];
			if (descriptors[key]) {
				Object.defineProperty(clone, key, descriptors[key]);
				delete descriptors[key];
			}
		}
		return clone;
	};
	const fn = (key) => split(Array.isArray(key) ? key : dKeys.filter(key));
	return keys.map(fn).concat(split(dKeys));
}
//#endregion
//#region src/uniq.ts
const uniq = (...items) => {
	const set = items.reduce((acc, currItems) => {
		if (currItems) currItems.forEach((item) => acc.add(item));
		return acc;
	}, /* @__PURE__ */ new Set([]));
	return Array.from(set);
};
//#endregion
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