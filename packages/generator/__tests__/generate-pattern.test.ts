import { fixtureDefaults } from '@bamboocss/fixture'
import type { LoadConfigResult } from '@bamboocss/types'
import { expect, test } from 'vitest'
import { Generator } from '../src'
import { generatePattern } from '../src/artifacts/js/pattern'

const patterns = (config: LoadConfigResult) => {
  const generator = new Generator(config)
  return generatePattern(generator)
}

test('should generate pattern', () => {
  expect(patterns(fixtureDefaults)).toMatchInlineSnapshot(`
    [
      {
        "dts": "import type { SystemStyleObject, ConditionalValue } from '../types/index';
    import type { Properties } from '../types/csstype';
    import type { SystemProperties } from '../types/style-props';
    import type { DistributiveOmit } from '../types/system-types';
    import type { Tokens } from '../tokens/index';

    export interface FlexProperties {
       align?: SystemProperties["alignItems"]
    	justify?: SystemProperties["justifyContent"]
    	direction?: SystemProperties["flexDirection"]
    	wrap?: SystemProperties["flexWrap"]
    	basis?: SystemProperties["flexBasis"]
    	grow?: SystemProperties["flexGrow"]
    	shrink?: SystemProperties["flexShrink"]
    }

    interface FlexStyles extends FlexProperties, DistributiveOmit<SystemStyleObject, keyof FlexProperties > {}

    interface FlexPatternFn {
      (styles?: FlexStyles): string
      raw: (styles?: FlexStyles) => SystemStyleObject
    }


    export declare const flex: FlexPatternFn;
    ",
        "js": "import { getPatternStyles, createPatternFns, memo } from '../helpers.mjs';
    import { css } from '../css/index.mjs';
    import { token } from '../tokens/index.mjs';

    /**
     * The transform's token lookup, answered by the generated tokens artifact.
     *
     * Read from there rather than from a copy emitted here, so the browser cannot disagree with
     * the build about a token's variable name — both come from the same generated source. The
     * artifact is shared with any other \`token()\` use in the app, so it is deduped rather than
     * paid twice.
     */
    const patternHelpers = /* @__PURE__ */ createPatternFns((path, fallback) => token(path) ?? fallback)

    const flexConfig = {
    transform(props) {
      const { direction, align, justify, wrap, basis, grow, shrink, ...rest } = props;
      return {
        display: "flex",
        flexDirection: direction,
        alignItems: align,
        justifyContent: justify,
        flexWrap: wrap,
        flexBasis: basis,
        flexGrow: grow,
        flexShrink: shrink,
        ...rest
      };
    }}

    export const getFlexStyle = (styles = {}) => {
      const _styles = getPatternStyles(flexConfig, styles)
      return flexConfig.transform(_styles, patternHelpers)
    }

    export const flex = /* @__PURE__ */ memo((styles) => css(getFlexStyle(styles)))
    flex.raw = getFlexStyle",
        "name": "flex",
      },
      {
        "dts": "import type { SystemStyleObject, ConditionalValue } from '../types/index';
    import type { Properties } from '../types/csstype';
    import type { SystemProperties } from '../types/style-props';
    import type { DistributiveOmit } from '../types/system-types';
    import type { Tokens } from '../tokens/index';

    export interface SpacerProperties {
       size?: ConditionalValue<Tokens["spacing"]>
    }

    interface SpacerStyles extends SpacerProperties, DistributiveOmit<SystemStyleObject, keyof SpacerProperties > {}

    interface SpacerPatternFn {
      (styles?: SpacerStyles): string
      raw: (styles?: SpacerStyles) => SystemStyleObject
    }


    export declare const spacer: SpacerPatternFn;
    ",
        "js": "import { getPatternStyles, createPatternFns, memo } from '../helpers.mjs';
    import { css } from '../css/index.mjs';
    import { token } from '../tokens/index.mjs';

    /**
     * The transform's token lookup, answered by the generated tokens artifact.
     *
     * Read from there rather than from a copy emitted here, so the browser cannot disagree with
     * the build about a token's variable name — both come from the same generated source. The
     * artifact is shared with any other \`token()\` use in the app, so it is deduped rather than
     * paid twice.
     */
    const patternHelpers = /* @__PURE__ */ createPatternFns((path, fallback) => token(path) ?? fallback)

    const spacerConfig = {
    transform(props, { map, isCssUnit, isCssVar, token }) {
      const { size, ...rest } = props;
      return {
        alignSelf: "stretch",
        justifySelf: "stretch",
        flex: map(size, (v) => {
          if (v == null) return "1";
          const val = isCssUnit(v) || isCssVar(v) ? v : token(\`spacing.\${v}\`, v);
          return \`0 0 \${val}\`;
        }),
        ...rest
      };
    }}

    export const getSpacerStyle = (styles = {}) => {
      const _styles = getPatternStyles(spacerConfig, styles)
      return spacerConfig.transform(_styles, patternHelpers)
    }

    export const spacer = /* @__PURE__ */ memo((styles) => css(getSpacerStyle(styles)))
    spacer.raw = getSpacerStyle",
        "name": "spacer",
      },
      {
        "dts": "import type { SystemStyleObject, ConditionalValue } from '../types/index';
    import type { Properties } from '../types/csstype';
    import type { SystemProperties } from '../types/style-props';
    import type { DistributiveOmit } from '../types/system-types';
    import type { Tokens } from '../tokens/index';

    export interface CenterProperties {
       inline?: ConditionalValue<boolean>
    	size?: SystemProperties["width"]
    }

    interface CenterStyles extends CenterProperties, DistributiveOmit<SystemStyleObject, keyof CenterProperties > {}

    interface CenterPatternFn {
      (styles?: CenterStyles): string
      raw: (styles?: CenterStyles) => SystemStyleObject
    }


    export declare const center: CenterPatternFn;
    ",
        "js": "import { getPatternStyles, createPatternFns, memo } from '../helpers.mjs';
    import { css } from '../css/index.mjs';
    import { token } from '../tokens/index.mjs';

    /**
     * The transform's token lookup, answered by the generated tokens artifact.
     *
     * Read from there rather than from a copy emitted here, so the browser cannot disagree with
     * the build about a token's variable name — both come from the same generated source. The
     * artifact is shared with any other \`token()\` use in the app, so it is deduped rather than
     * paid twice.
     */
    const patternHelpers = /* @__PURE__ */ createPatternFns((path, fallback) => token(path) ?? fallback)

    const centerConfig = {
    transform(props) {
      const { inline, size, ...rest } = props;
      return {
        display: inline ? "inline-flex" : "flex",
        alignItems: "center",
        justifyContent: "center",
        flex: size == null ? void 0 : "0 0 auto",
        width: size,
        height: size,
        ...rest
      };
    }}

    export const getCenterStyle = (styles = {}) => {
      const _styles = getPatternStyles(centerConfig, styles)
      return centerConfig.transform(_styles, patternHelpers)
    }

    export const center = /* @__PURE__ */ memo((styles) => css(getCenterStyle(styles)))
    center.raw = getCenterStyle",
        "name": "center",
      },
      {
        "dts": "import type { SystemStyleObject, ConditionalValue } from '../types/index';
    import type { Properties } from '../types/csstype';
    import type { SystemProperties } from '../types/style-props';
    import type { DistributiveOmit } from '../types/system-types';
    import type { Tokens } from '../tokens/index';

    export interface LinkOverlayProperties {
       
    }

    interface LinkOverlayStyles extends LinkOverlayProperties, DistributiveOmit<SystemStyleObject, keyof LinkOverlayProperties > {}

    interface LinkOverlayPatternFn {
      (styles?: LinkOverlayStyles): string
      raw: (styles?: LinkOverlayStyles) => SystemStyleObject
    }


    export declare const linkOverlay: LinkOverlayPatternFn;
    ",
        "js": "import { getPatternStyles, createPatternFns, memo } from '../helpers.mjs';
    import { css } from '../css/index.mjs';
    import { token } from '../tokens/index.mjs';

    /**
     * The transform's token lookup, answered by the generated tokens artifact.
     *
     * Read from there rather than from a copy emitted here, so the browser cannot disagree with
     * the build about a token's variable name — both come from the same generated source. The
     * artifact is shared with any other \`token()\` use in the app, so it is deduped rather than
     * paid twice.
     */
    const patternHelpers = /* @__PURE__ */ createPatternFns((path, fallback) => token(path) ?? fallback)

    const linkOverlayConfig = {
    transform(props) {
      return {
        _before: {
          content: '""',
          position: "absolute",
          inset: "0",
          zIndex: "0",
          ...props["_before"]
        },
        ...props
      };
    }}

    export const getLinkOverlayStyle = (styles = {}) => {
      const _styles = getPatternStyles(linkOverlayConfig, styles)
      return linkOverlayConfig.transform(_styles, patternHelpers)
    }

    export const linkOverlay = /* @__PURE__ */ memo((styles) => css(getLinkOverlayStyle(styles)))
    linkOverlay.raw = getLinkOverlayStyle",
        "name": "link-overlay",
      },
      {
        "dts": "import type { SystemStyleObject, ConditionalValue } from '../types/index';
    import type { Properties } from '../types/csstype';
    import type { SystemProperties } from '../types/style-props';
    import type { DistributiveOmit } from '../types/system-types';
    import type { Tokens } from '../tokens/index';

    export interface AspectRatioProperties {
       ratio?: ConditionalValue<number>
    }

    interface AspectRatioStyles extends AspectRatioProperties, DistributiveOmit<SystemStyleObject, keyof AspectRatioProperties | 'aspectRatio'> {}

    interface AspectRatioPatternFn {
      (styles?: AspectRatioStyles): string
      raw: (styles?: AspectRatioStyles) => SystemStyleObject
    }


    export declare const aspectRatio: AspectRatioPatternFn;
    ",
        "js": "import { getPatternStyles, createPatternFns, memo } from '../helpers.mjs';
    import { css } from '../css/index.mjs';
    import { token } from '../tokens/index.mjs';

    /**
     * The transform's token lookup, answered by the generated tokens artifact.
     *
     * Read from there rather than from a copy emitted here, so the browser cannot disagree with
     * the build about a token's variable name — both come from the same generated source. The
     * artifact is shared with any other \`token()\` use in the app, so it is deduped rather than
     * paid twice.
     */
    const patternHelpers = /* @__PURE__ */ createPatternFns((path, fallback) => token(path) ?? fallback)

    const aspectRatioConfig = {
    transform(props, { map }) {
      const { ratio = 4 / 3, ...rest } = props;
      return {
        position: "relative",
        _before: {
          content: \`""\`,
          display: "block",
          height: "0",
          paddingBottom: map(ratio, (r) => \`\${1 / r * 100}%\`)
        },
        "&>*": {
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
          overflow: "hidden",
          position: "absolute",
          inset: "0",
          width: "100%",
          height: "100%"
        },
        "&>img, &>video": {
          objectFit: "cover"
        },
        ...rest
      };
    }}

    export const getAspectRatioStyle = (styles = {}) => {
      const _styles = getPatternStyles(aspectRatioConfig, styles)
      return aspectRatioConfig.transform(_styles, patternHelpers)
    }

    export const aspectRatio = /* @__PURE__ */ memo((styles) => css(getAspectRatioStyle(styles)))
    aspectRatio.raw = getAspectRatioStyle",
        "name": "aspect-ratio",
      },
      {
        "dts": "import type { SystemStyleObject, ConditionalValue } from '../types/index';
    import type { Properties } from '../types/csstype';
    import type { SystemProperties } from '../types/style-props';
    import type { DistributiveOmit } from '../types/system-types';
    import type { Tokens } from '../tokens/index';

    export interface GridProperties {
       gap?: SystemProperties["gap"]
    	columnGap?: SystemProperties["gap"]
    	rowGap?: SystemProperties["gap"]
    	columns?: ConditionalValue<number>
    	minChildWidth?: ConditionalValue<Tokens["sizes"] | Properties["width"]>
    }

    interface GridStyles extends GridProperties, DistributiveOmit<SystemStyleObject, keyof GridProperties > {}

    interface GridPatternFn {
      (styles?: GridStyles): string
      raw: (styles?: GridStyles) => SystemStyleObject
    }


    export declare const grid: GridPatternFn;
    ",
        "js": "import { getPatternStyles, createPatternFns, memo } from '../helpers.mjs';
    import { css } from '../css/index.mjs';
    import { token } from '../tokens/index.mjs';

    /**
     * The transform's token lookup, answered by the generated tokens artifact.
     *
     * Read from there rather than from a copy emitted here, so the browser cannot disagree with
     * the build about a token's variable name — both come from the same generated source. The
     * artifact is shared with any other \`token()\` use in the app, so it is deduped rather than
     * paid twice.
     */
    const patternHelpers = /* @__PURE__ */ createPatternFns((path, fallback) => token(path) ?? fallback)

    const gridConfig = {
    transform(props, { map, isCssUnit, token }) {
      const { columnGap, rowGap, gap, columns, minChildWidth, ...rest } = props;
      const getValue = (v) => isCssUnit(v) ? v : token(\`sizes.\${v}\`, v);
      return {
        display: "grid",
        gridTemplateColumns: columns != null ? map(columns, (v) => \`repeat(\${v}, minmax(0, 1fr))\`) : minChildWidth != null ? map(minChildWidth, (v) => \`repeat(auto-fit, minmax(\${getValue(v)}, 1fr))\`) : void 0,
        gap,
        columnGap,
        rowGap,
        ...rest
      };
    },
    defaultValues(props) {
      return { gap: props.columnGap || props.rowGap ? void 0 : "8px" };
    }}

    export const getGridStyle = (styles = {}) => {
      const _styles = getPatternStyles(gridConfig, styles)
      return gridConfig.transform(_styles, patternHelpers)
    }

    export const grid = /* @__PURE__ */ memo((styles) => css(getGridStyle(styles)))
    grid.raw = getGridStyle",
        "name": "grid",
      },
      {
        "dts": "import type { SystemStyleObject, ConditionalValue } from '../types/index';
    import type { Properties } from '../types/csstype';
    import type { SystemProperties } from '../types/style-props';
    import type { DistributiveOmit } from '../types/system-types';
    import type { Tokens } from '../tokens/index';

    export interface GridItemProperties {
       colSpan?: ConditionalValue<number>
    	rowSpan?: ConditionalValue<number>
    	colStart?: ConditionalValue<number>
    	rowStart?: ConditionalValue<number>
    	colEnd?: ConditionalValue<number>
    	rowEnd?: ConditionalValue<number>
    }

    interface GridItemStyles extends GridItemProperties, DistributiveOmit<SystemStyleObject, keyof GridItemProperties > {}

    interface GridItemPatternFn {
      (styles?: GridItemStyles): string
      raw: (styles?: GridItemStyles) => SystemStyleObject
    }


    export declare const gridItem: GridItemPatternFn;
    ",
        "js": "import { getPatternStyles, createPatternFns, memo } from '../helpers.mjs';
    import { css } from '../css/index.mjs';
    import { token } from '../tokens/index.mjs';

    /**
     * The transform's token lookup, answered by the generated tokens artifact.
     *
     * Read from there rather than from a copy emitted here, so the browser cannot disagree with
     * the build about a token's variable name — both come from the same generated source. The
     * artifact is shared with any other \`token()\` use in the app, so it is deduped rather than
     * paid twice.
     */
    const patternHelpers = /* @__PURE__ */ createPatternFns((path, fallback) => token(path) ?? fallback)

    const gridItemConfig = {
    transform(props, { map }) {
      const { colSpan, rowSpan, colStart, rowStart, colEnd, rowEnd, ...rest } = props;
      const spanFn = (v) => v === "auto" ? v : \`span \${v}\`;
      return {
        gridColumn: colSpan != null ? map(colSpan, spanFn) : void 0,
        gridRow: rowSpan != null ? map(rowSpan, spanFn) : void 0,
        gridColumnStart: colStart,
        gridColumnEnd: colEnd,
        gridRowStart: rowStart,
        gridRowEnd: rowEnd,
        ...rest
      };
    }}

    export const getGridItemStyle = (styles = {}) => {
      const _styles = getPatternStyles(gridItemConfig, styles)
      return gridItemConfig.transform(_styles, patternHelpers)
    }

    export const gridItem = /* @__PURE__ */ memo((styles) => css(getGridItemStyle(styles)))
    gridItem.raw = getGridItemStyle",
        "name": "grid-item",
      },
      {
        "dts": "import type { SystemStyleObject, ConditionalValue } from '../types/index';
    import type { Properties } from '../types/csstype';
    import type { SystemProperties } from '../types/style-props';
    import type { DistributiveOmit } from '../types/system-types';
    import type { Tokens } from '../tokens/index';

    export interface ContainerProperties {
       
    }

    interface ContainerStyles extends ContainerProperties, DistributiveOmit<SystemStyleObject, keyof ContainerProperties > {}

    interface ContainerPatternFn {
      (styles?: ContainerStyles): string
      raw: (styles?: ContainerStyles) => SystemStyleObject
    }


    export declare const container: ContainerPatternFn;
    ",
        "js": "import { getPatternStyles, createPatternFns, memo } from '../helpers.mjs';
    import { css } from '../css/index.mjs';
    import { token } from '../tokens/index.mjs';

    /**
     * The transform's token lookup, answered by the generated tokens artifact.
     *
     * Read from there rather than from a copy emitted here, so the browser cannot disagree with
     * the build about a token's variable name — both come from the same generated source. The
     * artifact is shared with any other \`token()\` use in the app, so it is deduped rather than
     * paid twice.
     */
    const patternHelpers = /* @__PURE__ */ createPatternFns((path, fallback) => token(path) ?? fallback)

    const containerConfig = {
    transform(props) {
      return {
        position: "relative",
        maxWidth: "8xl",
        mx: "auto",
        px: { base: "4", md: "6", lg: "8" },
        ...props
      };
    }}

    export const getContainerStyle = (styles = {}) => {
      const _styles = getPatternStyles(containerConfig, styles)
      return containerConfig.transform(_styles, patternHelpers)
    }

    export const container = /* @__PURE__ */ memo((styles) => css(getContainerStyle(styles)))
    container.raw = getContainerStyle",
        "name": "container",
      },
      {
        "dts": "import type { SystemStyleObject, ConditionalValue } from '../types/index';
    import type { Properties } from '../types/csstype';
    import type { SystemProperties } from '../types/style-props';
    import type { DistributiveOmit } from '../types/system-types';
    import type { Tokens } from '../tokens/index';

    export interface DividerProperties {
       orientation?: ConditionalValue<"horizontal" | "vertical">
    	thickness?: ConditionalValue<Tokens["sizes"] | Properties["borderWidth"]>
    	color?: ConditionalValue<Tokens["colors"] | Properties["borderColor"]>
    }

    interface DividerStyles extends DividerProperties, DistributiveOmit<SystemStyleObject, keyof DividerProperties > {}

    interface DividerPatternFn {
      (styles?: DividerStyles): string
      raw: (styles?: DividerStyles) => SystemStyleObject
    }


    export declare const divider: DividerPatternFn;
    ",
        "js": "import { getPatternStyles, createPatternFns, memo } from '../helpers.mjs';
    import { css } from '../css/index.mjs';
    import { token } from '../tokens/index.mjs';

    /**
     * The transform's token lookup, answered by the generated tokens artifact.
     *
     * Read from there rather than from a copy emitted here, so the browser cannot disagree with
     * the build about a token's variable name — both come from the same generated source. The
     * artifact is shared with any other \`token()\` use in the app, so it is deduped rather than
     * paid twice.
     */
    const patternHelpers = /* @__PURE__ */ createPatternFns((path, fallback) => token(path) ?? fallback)

    const dividerConfig = {
    transform(props, { map }) {
      const { orientation, thickness, color, ...rest } = props;
      return {
        "--thickness": thickness,
        width: map(orientation, (v) => v === "vertical" ? void 0 : "100%"),
        height: map(orientation, (v) => v === "horizontal" ? void 0 : "100%"),
        borderBlockEndWidth: map(orientation, (v) => v === "horizontal" ? "var(--thickness)" : void 0),
        borderInlineEndWidth: map(orientation, (v) => v === "vertical" ? "var(--thickness)" : void 0),
        borderColor: color,
        ...rest
      };
    },
    defaultValues:{orientation:'horizontal',thickness:'1px'}}

    export const getDividerStyle = (styles = {}) => {
      const _styles = getPatternStyles(dividerConfig, styles)
      return dividerConfig.transform(_styles, patternHelpers)
    }

    export const divider = /* @__PURE__ */ memo((styles) => css(getDividerStyle(styles)))
    divider.raw = getDividerStyle",
        "name": "divider",
      },
      {
        "dts": "import type { SystemStyleObject, ConditionalValue } from '../types/index';
    import type { Properties } from '../types/csstype';
    import type { SystemProperties } from '../types/style-props';
    import type { DistributiveOmit } from '../types/system-types';
    import type { Tokens } from '../tokens/index';

    export interface FloatProperties {
       offsetX?: ConditionalValue<Tokens["spacing"] | Properties["left"]>
    	offsetY?: ConditionalValue<Tokens["spacing"] | Properties["top"]>
    	offset?: ConditionalValue<Tokens["spacing"] | Properties["top"]>
    	placement?: ConditionalValue<"bottom-end" | "bottom-start" | "top-end" | "top-start" | "bottom-center" | "top-center" | "middle-center" | "middle-end" | "middle-start">
    }

    interface FloatStyles extends FloatProperties, DistributiveOmit<SystemStyleObject, keyof FloatProperties > {}

    interface FloatPatternFn {
      (styles?: FloatStyles): string
      raw: (styles?: FloatStyles) => SystemStyleObject
    }


    export declare const float: FloatPatternFn;
    ",
        "js": "import { getPatternStyles, createPatternFns, memo } from '../helpers.mjs';
    import { css } from '../css/index.mjs';
    import { token } from '../tokens/index.mjs';

    /**
     * The transform's token lookup, answered by the generated tokens artifact.
     *
     * Read from there rather than from a copy emitted here, so the browser cannot disagree with
     * the build about a token's variable name — both come from the same generated source. The
     * artifact is shared with any other \`token()\` use in the app, so it is deduped rather than
     * paid twice.
     */
    const patternHelpers = /* @__PURE__ */ createPatternFns((path, fallback) => token(path) ?? fallback)

    const floatConfig = {
    transform(props, { map }) {
      const { offset, offsetX, offsetY, placement, ...rest } = props;
      return {
        display: "inline-flex",
        justifyContent: "center",
        alignItems: "center",
        position: "absolute",
        insetBlockStart: map(placement, (v) => {
          const [side] = v.split("-");
          const map2 = { top: offsetY, middle: "50%", bottom: "auto" };
          return map2[side];
        }),
        insetBlockEnd: map(placement, (v) => {
          const [side] = v.split("-");
          const map2 = { top: "auto", middle: "50%", bottom: offsetY };
          return map2[side];
        }),
        insetInlineStart: map(placement, (v) => {
          const [, align] = v.split("-");
          const map2 = { start: offsetX, center: "50%", end: "auto" };
          return map2[align];
        }),
        insetInlineEnd: map(placement, (v) => {
          const [, align] = v.split("-");
          const map2 = { start: "auto", center: "50%", end: offsetX };
          return map2[align];
        }),
        translate: map(placement, (v) => {
          const [side, align] = v.split("-");
          const mapX = { start: "-50%", center: "-50%", end: "50%" };
          const mapY = { top: "-50%", middle: "-50%", bottom: "50%" };
          return \`\${mapX[align]} \${mapY[side]}\`;
        }),
        ...rest
      };
    },
    defaultValues(props) {
      const offset = props.offset || "0";
      return { offset, offsetX: offset, offsetY: offset, placement: "top-end" };
    }}

    export const getFloatStyle = (styles = {}) => {
      const _styles = getPatternStyles(floatConfig, styles)
      return floatConfig.transform(_styles, patternHelpers)
    }

    export const float = /* @__PURE__ */ memo((styles) => css(getFloatStyle(styles)))
    float.raw = getFloatStyle",
        "name": "float",
      },
      {
        "dts": "import type { SystemStyleObject, ConditionalValue } from '../types/index';
    import type { Properties } from '../types/csstype';
    import type { SystemProperties } from '../types/style-props';
    import type { DistributiveOmit } from '../types/system-types';
    import type { Tokens } from '../tokens/index';

    export interface BleedProperties {
       inline?: SystemProperties["marginInline"]
    	block?: SystemProperties["marginBlock"]
    }

    interface BleedStyles extends BleedProperties, DistributiveOmit<SystemStyleObject, keyof BleedProperties > {}

    interface BleedPatternFn {
      (styles?: BleedStyles): string
      raw: (styles?: BleedStyles) => SystemStyleObject
    }


    export declare const bleed: BleedPatternFn;
    ",
        "js": "import { getPatternStyles, createPatternFns, memo } from '../helpers.mjs';
    import { css } from '../css/index.mjs';
    import { token } from '../tokens/index.mjs';

    /**
     * The transform's token lookup, answered by the generated tokens artifact.
     *
     * Read from there rather than from a copy emitted here, so the browser cannot disagree with
     * the build about a token's variable name — both come from the same generated source. The
     * artifact is shared with any other \`token()\` use in the app, so it is deduped rather than
     * paid twice.
     */
    const patternHelpers = /* @__PURE__ */ createPatternFns((path, fallback) => token(path) ?? fallback)

    const bleedConfig = {
    transform(props, { map, isCssUnit, isCssVar, token }) {
      const { inline, block, ...rest } = props;
      const valueFn = (v) => isCssUnit(v) || isCssVar(v) ? v : token(\`spacing.\${v}\`, v);
      return {
        "--bleed-x": map(inline, valueFn),
        "--bleed-y": map(block, valueFn),
        marginInline: "calc(var(--bleed-x, 0) * -1)",
        marginBlock: "calc(var(--bleed-y, 0) * -1)",
        ...rest
      };
    },
    defaultValues:{inline:'0',block:'0'}}

    export const getBleedStyle = (styles = {}) => {
      const _styles = getPatternStyles(bleedConfig, styles)
      return bleedConfig.transform(_styles, patternHelpers)
    }

    export const bleed = /* @__PURE__ */ memo((styles) => css(getBleedStyle(styles)))
    bleed.raw = getBleedStyle",
        "name": "bleed",
      },
    ]
  `)
})
