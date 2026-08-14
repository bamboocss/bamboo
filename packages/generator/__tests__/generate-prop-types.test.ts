import { createContext } from '@bamboocss/fixture'
import { describe, expect, test } from 'vitest'
import { generatePropTypes } from '../src/artifacts/types/prop-types'

describe('generate property types', () => {
  test('should work', () => {
    expect(generatePropTypes(createContext())).toMatchInlineSnapshot(`
      "import type { ConditionalValue } from './conditions';
      import type { CssProperties } from './system-types';
      import type { Tokens } from '../tokens/index';
      export interface UtilityValues {
      	aspectRatio: Tokens["aspectRatios"];
      	top: Tokens["spacing"];
      	left: Tokens["spacing"];
      	inset: "auto" | Tokens["spacing"];
      	insetInline: Tokens["spacing"];
      	insetBlock: Tokens["spacing"];
      	insetBlockEnd: Tokens["spacing"];
      	insetBlockStart: Tokens["spacing"];
      	insetInlineEnd: Tokens["spacing"];
      	insetInlineStart: Tokens["spacing"];
      	right: Tokens["spacing"];
      	bottom: Tokens["spacing"];
      	float: "start" | "end" | CssProperties["float"];
      	flexBasis: Tokens["sizes"] | "1/2" | "1/3" | "2/3" | "1/4" | "2/4" | "3/4" | "1/5" | "2/5" | "3/5" | "4/5" | "1/6" | "2/6" | "3/6" | "4/6" | "5/6" | "1/12" | "2/12" | "3/12" | "4/12" | "5/12" | "6/12" | "7/12" | "8/12" | "9/12" | "10/12" | "11/12" | "full";
      	flex: "1" | "auto" | "initial" | "none";
      	gridAutoColumns: "min" | "max" | "fr";
      	gridAutoRows: "min" | "max" | "fr";
      	gap: Tokens["spacing"];
      	gridGap: Tokens["spacing"];
      	gridRowGap: Tokens["spacing"];
      	gridColumnGap: Tokens["spacing"];
      	rowGap: Tokens["spacing"];
      	columnGap: Tokens["spacing"];
      	padding: Tokens["spacing"];
      	paddingLeft: Tokens["spacing"];
      	paddingRight: Tokens["spacing"];
      	paddingTop: Tokens["spacing"];
      	paddingBottom: Tokens["spacing"];
      	paddingBlock: Tokens["spacing"];
      	paddingBlockEnd: Tokens["spacing"];
      	paddingBlockStart: Tokens["spacing"];
      	paddingInline: Tokens["spacing"];
      	paddingInlineEnd: Tokens["spacing"];
      	paddingInlineStart: Tokens["spacing"];
      	marginLeft: "auto" | Tokens["spacing"];
      	marginRight: "auto" | Tokens["spacing"];
      	marginTop: "auto" | Tokens["spacing"];
      	marginBottom: "auto" | Tokens["spacing"];
      	margin: "auto" | Tokens["spacing"];
      	marginBlock: "auto" | Tokens["spacing"];
      	marginBlockEnd: "auto" | Tokens["spacing"];
      	marginBlockStart: "auto" | Tokens["spacing"];
      	marginInline: "auto" | Tokens["spacing"];
      	marginInlineEnd: "auto" | Tokens["spacing"];
      	marginInlineStart: "auto" | Tokens["spacing"];
      	spaceX: "auto" | Tokens["spacing"] | CssProperties["marginInlineStart"];
      	spaceY: "auto" | Tokens["spacing"] | CssProperties["marginBlockStart"];
      	outlineColor: Tokens["colors"];
      	outline: Tokens["borders"];
      	outlineOffset: Tokens["spacing"];
      	focusRing: "outside" | "inside" | "mixed" | "none";
      	focusVisibleRing: "outside" | "inside" | "mixed" | "none";
      	focusRingColor: Tokens["colors"];
      	focusRingOffset: Tokens["spacing"];
      	focusRingWidth: CssProperties["outlineWidth"];
      	focusRingStyle: CssProperties["outlineStyle"];
      	divideColor: Tokens["colors"];
      	divideStyle: CssProperties["borderStyle"];
      	width: "auto" | Tokens["sizes"] | "1/2" | "1/3" | "2/3" | "1/4" | "2/4" | "3/4" | "1/5" | "2/5" | "3/5" | "4/5" | "1/6" | "2/6" | "3/6" | "4/6" | "5/6" | "1/12" | "2/12" | "3/12" | "4/12" | "5/12" | "6/12" | "7/12" | "8/12" | "9/12" | "10/12" | "11/12" | "screen";
      	inlineSize: "auto" | Tokens["sizes"] | "1/2" | "1/3" | "2/3" | "1/4" | "2/4" | "3/4" | "1/5" | "2/5" | "3/5" | "4/5" | "1/6" | "2/6" | "3/6" | "4/6" | "5/6" | "1/12" | "2/12" | "3/12" | "4/12" | "5/12" | "6/12" | "7/12" | "8/12" | "9/12" | "10/12" | "11/12" | "screen";
      	minWidth: "auto" | Tokens["sizes"] | "1/2" | "1/3" | "2/3" | "1/4" | "2/4" | "3/4" | "1/5" | "2/5" | "3/5" | "4/5" | "1/6" | "2/6" | "3/6" | "4/6" | "5/6" | "1/12" | "2/12" | "3/12" | "4/12" | "5/12" | "6/12" | "7/12" | "8/12" | "9/12" | "10/12" | "11/12" | "screen";
      	minInlineSize: "auto" | Tokens["sizes"] | "1/2" | "1/3" | "2/3" | "1/4" | "2/4" | "3/4" | "1/5" | "2/5" | "3/5" | "4/5" | "1/6" | "2/6" | "3/6" | "4/6" | "5/6" | "1/12" | "2/12" | "3/12" | "4/12" | "5/12" | "6/12" | "7/12" | "8/12" | "9/12" | "10/12" | "11/12" | "screen";
      	maxWidth: "auto" | Tokens["sizes"] | "1/2" | "1/3" | "2/3" | "1/4" | "2/4" | "3/4" | "1/5" | "2/5" | "3/5" | "4/5" | "1/6" | "2/6" | "3/6" | "4/6" | "5/6" | "1/12" | "2/12" | "3/12" | "4/12" | "5/12" | "6/12" | "7/12" | "8/12" | "9/12" | "10/12" | "11/12" | "screen";
      	maxInlineSize: "auto" | Tokens["sizes"] | "1/2" | "1/3" | "2/3" | "1/4" | "2/4" | "3/4" | "1/5" | "2/5" | "3/5" | "4/5" | "1/6" | "2/6" | "3/6" | "4/6" | "5/6" | "1/12" | "2/12" | "3/12" | "4/12" | "5/12" | "6/12" | "7/12" | "8/12" | "9/12" | "10/12" | "11/12" | "screen";
      	height: "auto" | Tokens["sizes"] | "svh" | "lvh" | "dvh" | "screen" | "1/2" | "1/3" | "2/3" | "1/4" | "2/4" | "3/4" | "1/5" | "2/5" | "3/5" | "4/5" | "1/6" | "2/6" | "3/6" | "4/6" | "5/6";
      	blockSize: "auto" | Tokens["sizes"] | "svh" | "lvh" | "dvh" | "screen" | "1/2" | "1/3" | "2/3" | "1/4" | "2/4" | "3/4" | "1/5" | "2/5" | "3/5" | "4/5" | "1/6" | "2/6" | "3/6" | "4/6" | "5/6";
      	minHeight: "auto" | Tokens["sizes"] | "svh" | "lvh" | "dvh" | "screen" | "1/2" | "1/3" | "2/3" | "1/4" | "2/4" | "3/4" | "1/5" | "2/5" | "3/5" | "4/5" | "1/6" | "2/6" | "3/6" | "4/6" | "5/6";
      	minBlockSize: "auto" | Tokens["sizes"] | "svh" | "lvh" | "dvh" | "screen" | "1/2" | "1/3" | "2/3" | "1/4" | "2/4" | "3/4" | "1/5" | "2/5" | "3/5" | "4/5" | "1/6" | "2/6" | "3/6" | "4/6" | "5/6";
      	maxHeight: "auto" | Tokens["sizes"] | "svh" | "lvh" | "dvh" | "screen" | "1/2" | "1/3" | "2/3" | "1/4" | "2/4" | "3/4" | "1/5" | "2/5" | "3/5" | "4/5" | "1/6" | "2/6" | "3/6" | "4/6" | "5/6";
      	maxBlockSize: "auto" | Tokens["sizes"] | "svh" | "lvh" | "dvh" | "screen" | "1/2" | "1/3" | "2/3" | "1/4" | "2/4" | "3/4" | "1/5" | "2/5" | "3/5" | "4/5" | "1/6" | "2/6" | "3/6" | "4/6" | "5/6";
      	boxSize: "auto" | Tokens["sizes"] | "1/2" | "1/3" | "2/3" | "1/4" | "2/4" | "3/4" | "1/5" | "2/5" | "3/5" | "4/5" | "1/6" | "2/6" | "3/6" | "4/6" | "5/6" | "1/12" | "2/12" | "3/12" | "4/12" | "5/12" | "6/12" | "7/12" | "8/12" | "9/12" | "10/12" | "11/12" | "screen";
      	color: Tokens["colors"];
      	fontFamily: Tokens["fonts"];
      	fontSize: Tokens["fontSizes"];
      	fontWeight: Tokens["fontWeights"];
      	fontSmoothing: "antialiased" | "subpixel-antialiased";
      	letterSpacing: Tokens["letterSpacings"];
      	lineHeight: Tokens["lineHeights"];
      	textDecorationColor: Tokens["colors"];
      	textEmphasisColor: Tokens["colors"];
      	textIndent: Tokens["spacing"];
      	textShadow: Tokens["shadows"];
      	textShadowColor: Tokens["colors"];
      	WebkitTextFillColor: Tokens["colors"];
      	textWrap: "wrap" | "balance" | "nowrap";
      	truncate: boolean;
      	background: Tokens["colors"];
      	backgroundColor: Tokens["colors"];
      	backgroundGradient: "to-t" | "to-tr" | "to-r" | "to-br" | "to-b" | "to-bl" | "to-l" | "to-tl";
      	backgroundLinear: "to-t" | "to-tr" | "to-r" | "to-br" | "to-b" | "to-bl" | "to-l" | "to-tl";
      	textGradient: "to-t" | "to-tr" | "to-r" | "to-br" | "to-b" | "to-bl" | "to-l" | "to-tl";
      	gradientFrom: Tokens["colors"];
      	gradientTo: Tokens["colors"];
      	gradientVia: Tokens["colors"];
      	borderRadius: Tokens["radii"];
      	borderTopLeftRadius: Tokens["radii"];
      	borderTopRightRadius: Tokens["radii"];
      	borderBottomRightRadius: Tokens["radii"];
      	borderBottomLeftRadius: Tokens["radii"];
      	borderTopRadius: Tokens["radii"] | CssProperties["borderRadius"];
      	borderRightRadius: Tokens["radii"] | CssProperties["borderRadius"];
      	borderBottomRadius: Tokens["radii"] | CssProperties["borderRadius"];
      	borderLeftRadius: Tokens["radii"] | CssProperties["borderRadius"];
      	borderStartStartRadius: Tokens["radii"];
      	borderStartEndRadius: Tokens["radii"];
      	borderStartRadius: Tokens["radii"] | CssProperties["borderRadius"];
      	borderEndStartRadius: Tokens["radii"];
      	borderEndEndRadius: Tokens["radii"];
      	borderEndRadius: Tokens["radii"] | CssProperties["borderRadius"];
      	border: Tokens["borders"];
      	borderColor: Tokens["colors"];
      	borderInline: Tokens["borders"];
      	borderInlineColor: Tokens["colors"];
      	borderBlock: Tokens["borders"];
      	borderBlockColor: Tokens["colors"];
      	borderLeft: Tokens["borders"];
      	borderLeftColor: Tokens["colors"];
      	borderInlineStart: Tokens["borders"];
      	borderInlineStartColor: Tokens["colors"];
      	borderRight: Tokens["borders"];
      	borderRightColor: Tokens["colors"];
      	borderInlineEnd: Tokens["borders"];
      	borderInlineEndColor: Tokens["colors"];
      	borderTop: Tokens["borders"];
      	borderTopColor: Tokens["colors"];
      	borderBottom: Tokens["borders"];
      	borderBottomColor: Tokens["colors"];
      	borderBlockEnd: Tokens["borders"];
      	borderBlockEndColor: Tokens["colors"];
      	borderBlockStart: Tokens["borders"];
      	borderBlockStartColor: Tokens["colors"];
      	boxShadow: Tokens["shadows"];
      	boxShadowColor: Tokens["colors"];
      	filter: "auto";
      	blur: Tokens["blurs"];
      	backdropFilter: "auto";
      	backdropBlur: Tokens["blurs"];
      	borderSpacing: Tokens["spacing"] | "auto";
      	borderSpacingX: Tokens["spacing"];
      	borderSpacingY: Tokens["spacing"];
      	transitionTimingFunction: Tokens["easings"];
      	transitionDelay: Tokens["durations"];
      	transitionDuration: Tokens["durations"];
      	transitionProperty: "common" | "colors" | "size" | "position" | "background";
      	transition: "all" | "common" | "size" | "position" | "background" | "colors" | "opacity" | "shadow" | "transform";
      	animation: Tokens["animations"];
      	animationName: "spin" | "ping" | "pulse" | "bounce";
      	animationTimingFunction: Tokens["easings"];
      	animationDuration: Tokens["durations"];
      	animationDelay: Tokens["durations"];
      	rotate: "auto" | "auto-3d" | CssProperties["rotate"];
      	rotateX: CssProperties["rotate"];
      	rotateY: CssProperties["rotate"];
      	rotateZ: CssProperties["rotate"];
      	scale: "auto" | CssProperties["scale"];
      	translate: "auto" | "auto-3d" | CssProperties["translate"];
      	translateX: Tokens["spacing"] | "1/2" | "1/3" | "2/3" | "1/4" | "2/4" | "3/4" | "full" | "-1/2" | "-1/3" | "-2/3" | "-1/4" | "-2/4" | "-3/4" | "-full";
      	translateY: Tokens["spacing"] | "1/2" | "1/3" | "2/3" | "1/4" | "2/4" | "3/4" | "full" | "-1/2" | "-1/3" | "-2/3" | "-1/4" | "-2/4" | "-3/4" | "-full";
      	translateZ: Tokens["spacing"] | "1/2" | "1/3" | "2/3" | "1/4" | "2/4" | "3/4" | "full" | "-1/2" | "-1/3" | "-2/3" | "-1/4" | "-2/4" | "-3/4" | "-full";
      	accentColor: Tokens["colors"];
      	caretColor: Tokens["colors"];
      	scrollbar: "visible" | "hidden";
      	scrollbarColor: Tokens["colors"];
      	scrollbarWidth: Tokens["sizes"];
      	scrollMargin: Tokens["spacing"];
      	scrollMarginLeft: Tokens["spacing"];
      	scrollMarginRight: Tokens["spacing"];
      	scrollMarginTop: Tokens["spacing"];
      	scrollMarginBottom: Tokens["spacing"];
      	scrollMarginBlock: Tokens["spacing"];
      	scrollMarginBlockEnd: Tokens["spacing"];
      	scrollMarginBlockStart: Tokens["spacing"];
      	scrollMarginInline: Tokens["spacing"];
      	scrollMarginInlineEnd: Tokens["spacing"];
      	scrollMarginInlineStart: Tokens["spacing"];
      	scrollPadding: Tokens["spacing"];
      	scrollPaddingBlock: Tokens["spacing"];
      	scrollPaddingBlockStart: Tokens["spacing"];
      	scrollPaddingBlockEnd: Tokens["spacing"];
      	scrollPaddingInline: Tokens["spacing"];
      	scrollPaddingInlineEnd: Tokens["spacing"];
      	scrollPaddingInlineStart: Tokens["spacing"];
      	scrollPaddingLeft: Tokens["spacing"];
      	scrollPaddingRight: Tokens["spacing"];
      	scrollPaddingTop: Tokens["spacing"];
      	scrollPaddingBottom: Tokens["spacing"];
      	scrollSnapType: "none" | "x" | "y" | "both";
      	scrollSnapStrictness: "mandatory" | "proximity";
      	scrollSnapMargin: Tokens["spacing"];
      	scrollSnapMarginTop: Tokens["spacing"];
      	scrollSnapMarginBottom: Tokens["spacing"];
      	scrollSnapMarginLeft: Tokens["spacing"];
      	scrollSnapMarginRight: Tokens["spacing"];
      	fill: Tokens["colors"];
      	stroke: Tokens["colors"];
      	srOnly: boolean;
      	debug: boolean;
      	containerName: CssProperties["containerName"];
      	colorPalette: "current" | "black" | "white" | "transparent" | "rose" | "pink" | "fuchsia" | "purple" | "violet" | "indigo" | "blue" | "sky" | "cyan" | "teal" | "emerald" | "green" | "lime" | "yellow" | "amber" | "orange" | "red" | "neutral" | "stone" | "zinc" | "gray" | "slate" | "deep" | "deep.test" | "deep.test.pool" | "primary" | "secondary" | "complex" | "button" | "button.card" | "surface";
      	mixin: "headline" | "headline.h1" | "headline.h2";
      }



      type ImportantMark = "!" | "!important"
      type WhitespaceImportant = \` \${ImportantMark}\`
      type Important = ImportantMark | WhitespaceImportant
      type WithImportant<T> = [T] extends [string] ? \`\${T}\${Important}\` & { __important?: true } : never

      /**
       * The modifiers a token path may carry, as one open-ended tail rather than one closed
       * template per form.
       *
       * ⚠️ The \`& { __modifier?: true }\` is load-bearing, and nothing reads it. Deleting it as
       * dead weight costs **12.8x** on \`tsc\` — measured at 87.2s against 6.8s over 4,000 call
       * sites — because it is what stops TypeScript attempting subtype reduction across the
       * union these expand into. The same applies to \`__important\` above.
       *
       * A template literal distributes over a union in any placeholder, so \`\${T}\` against a
       * 258-token colour palette is 258 members, and the old \`\${T}\${Important}\` was four times
       * that. Between them the two modifier forms were 5N of a ~1,560-member union for \`color\`
       * alone, and half the cost of type-checking a \`css()\` call under \`strictTokens\`. Folding
       * them into one 3N tail is 14.5% off that — 7.09s against 8.29s over the same 4,000 call
       * sites, with a control repeat agreeing to 3.5%.
       *
       * What it gives up is the tail: \`red.300!nonsense\` type-checks now, where five exact
       * templates would have rejected it. \`unresolvedToken\` strips the mark and resolves the
       * path underneath, so the build still reports it — warning by default, failing under
       * \`'error'\`. The diagnostic moves rather than disappears, and only for a value nobody
       * writes on purpose.
       */
      type Modifier = "/" | "!" | " !"
      /**
       * \`Extract\`, not a \`[T] extends [string]\` test, which was the same thing until a utility
       * declared a non-string member. One of those turned every modifier form off for the whole
       * property: \`roundedBottom: 'lg!'\` was rejected while \`rounded: 'lg!'\` passed, decided by
       * nothing but how the two utilities happen to be declared — both emit
       * \`var(--radii-lg) !important\`.
       *
       * Filtering costs nothing the test did not: the same string members distribute either way,
       * and \`Extract\` of no strings is \`never\`, exactly what the false branch returned.
       */
      type WithModifier<T> = \`\${Extract<T, string>}\${Modifier}\${string}\` & { __modifier?: true }

      /**
       * A list of candidate values, most-preferred first, emitted as repeated declarations so the
       * browser keeps the last one it understands.
       *
       * @example
       * css({ height: 'fallback(100dvh, 100vh)' })
       */
      type FallbackValue = \`fallback(\${string})\`

      /**
       * Only relevant when using \`strictTokens\` or \`strictPropertyValues\` in your config.
       * - Allows you to use an escape hatch (e.g. \`[123px]\`) to use any string as a value.
       * - Allows you to use a color opacity modifier (e.g. \`red/300\`) with known color values.
       * - Allows you to use an important mark (e.g. \`!\` or \`!important\`) in the value.
       * - Allows you to use a fallback list (e.g. \`fallback(100dvh, 100vh)\`).
       *
       * This is useful when you want to use a value that is not defined in the config or want to opt-out of the defaults.
       *
       * @example
       * css({
       *   fontSize: '[123px]', // ⚠️ will not throw even if you haven't defined 123px as a token
       * })
       *
       * @see https://bamboocss.com/docs/concepts/writing-styles#stricttokens
       * @see https://bamboocss.com/docs/concepts/writing-styles#strictpropertyvalues
       */
      export type WithEscapeHatch<T> =
        | T
        | \`[\${string}]\`
        | FallbackValue
        | WithImportant<FallbackValue>
        | WithModifier<T>

      /**
       * Will restrict the value of properties that have predefined values to those values only.
       *
       * @example
       * css({
       *   display: 'abc', // ❌ will throw
       * })
       *
       * @see https://bamboocss.com/docs/concepts/writing-styles#strictpropertyvalues
       */
      export type OnlyKnown<Key, Value> = Value extends boolean
        ? Value
        : Value extends \`\${infer _}\` ? Value : never"
    `)
  })

  test('with globalVars', () => {
    expect(
      generatePropTypes(
        createContext({
          plugins: [
            {
              name: 'test',
              hooks: {
                'config:resolved': ({ config, utils }) => {
                  return utils.omit(config, ['utilities', 'theme.tokens', 'theme.semanticTokens'])
                },
              },
            },
          ],
          global: {
            vars: {
              '--random-color': 'red',
              '--button-color': {
                syntax: '<color>',
                inherits: false,
                initialValue: 'blue',
              },
            },
          },
        }),
      ),
    ).toMatchInlineSnapshot(`
      "import type { ConditionalValue } from './conditions';
      import type { CssProperties } from './system-types';
      import type { Tokens } from '../tokens/index';
      export interface UtilityValues {
      	mixin: "headline" | "headline.h1" | "headline.h2";
      	animationName: "spin" | "ping" | "pulse" | "bounce";
      }



      type ImportantMark = "!" | "!important"
      type WhitespaceImportant = \` \${ImportantMark}\`
      type Important = ImportantMark | WhitespaceImportant
      type WithImportant<T> = [T] extends [string] ? \`\${T}\${Important}\` & { __important?: true } : never

      /**
       * The modifiers a token path may carry, as one open-ended tail rather than one closed
       * template per form.
       *
       * ⚠️ The \`& { __modifier?: true }\` is load-bearing, and nothing reads it. Deleting it as
       * dead weight costs **12.8x** on \`tsc\` — measured at 87.2s against 6.8s over 4,000 call
       * sites — because it is what stops TypeScript attempting subtype reduction across the
       * union these expand into. The same applies to \`__important\` above.
       *
       * A template literal distributes over a union in any placeholder, so \`\${T}\` against a
       * 258-token colour palette is 258 members, and the old \`\${T}\${Important}\` was four times
       * that. Between them the two modifier forms were 5N of a ~1,560-member union for \`color\`
       * alone, and half the cost of type-checking a \`css()\` call under \`strictTokens\`. Folding
       * them into one 3N tail is 14.5% off that — 7.09s against 8.29s over the same 4,000 call
       * sites, with a control repeat agreeing to 3.5%.
       *
       * What it gives up is the tail: \`red.300!nonsense\` type-checks now, where five exact
       * templates would have rejected it. \`unresolvedToken\` strips the mark and resolves the
       * path underneath, so the build still reports it — warning by default, failing under
       * \`'error'\`. The diagnostic moves rather than disappears, and only for a value nobody
       * writes on purpose.
       */
      type Modifier = "/" | "!" | " !"
      /**
       * \`Extract\`, not a \`[T] extends [string]\` test, which was the same thing until a utility
       * declared a non-string member. One of those turned every modifier form off for the whole
       * property: \`roundedBottom: 'lg!'\` was rejected while \`rounded: 'lg!'\` passed, decided by
       * nothing but how the two utilities happen to be declared — both emit
       * \`var(--radii-lg) !important\`.
       *
       * Filtering costs nothing the test did not: the same string members distribute either way,
       * and \`Extract\` of no strings is \`never\`, exactly what the false branch returned.
       */
      type WithModifier<T> = \`\${Extract<T, string>}\${Modifier}\${string}\` & { __modifier?: true }

      /**
       * A list of candidate values, most-preferred first, emitted as repeated declarations so the
       * browser keeps the last one it understands.
       *
       * @example
       * css({ height: 'fallback(100dvh, 100vh)' })
       */
      type FallbackValue = \`fallback(\${string})\`

      /**
       * Only relevant when using \`strictTokens\` or \`strictPropertyValues\` in your config.
       * - Allows you to use an escape hatch (e.g. \`[123px]\`) to use any string as a value.
       * - Allows you to use a color opacity modifier (e.g. \`red/300\`) with known color values.
       * - Allows you to use an important mark (e.g. \`!\` or \`!important\`) in the value.
       * - Allows you to use a fallback list (e.g. \`fallback(100dvh, 100vh)\`).
       *
       * This is useful when you want to use a value that is not defined in the config or want to opt-out of the defaults.
       *
       * @example
       * css({
       *   fontSize: '[123px]', // ⚠️ will not throw even if you haven't defined 123px as a token
       * })
       *
       * @see https://bamboocss.com/docs/concepts/writing-styles#stricttokens
       * @see https://bamboocss.com/docs/concepts/writing-styles#strictpropertyvalues
       */
      export type WithEscapeHatch<T> =
        | T
        | \`[\${string}]\`
        | FallbackValue
        | WithImportant<FallbackValue>
        | WithModifier<T>

      /**
       * Will restrict the value of properties that have predefined values to those values only.
       *
       * @example
       * css({
       *   display: 'abc', // ❌ will throw
       * })
       *
       * @see https://bamboocss.com/docs/concepts/writing-styles#strictpropertyvalues
       */
      export type OnlyKnown<Key, Value> = Value extends boolean
        ? Value
        : Value extends \`\${infer _}\` ? Value : never"
    `)
  })

  /**
   * A custom utility that maps to a CSS property inherits that property's values, and under
   *
   * Asserted as a *type* and not a string, which is the whole of the bug this covers: the
   * generator quotes an entry it does not recognise, so the emitted `UtilityValues` read
   * `containerName: "KnownKeywords<CssProperties[\"containerName\"]>"` — a string literal,
   * which rejected `containerName: 'sidebar'` and accepted that sentence.
   */

  test('the other settings still inherit the whole property, or none of it', () => {
    const lineFor = (config?: Parameters<typeof createContext>[0]) =>
      generatePropTypes(createContext(config))
        .split('\n')
        .find((entry) => entry.trimStart().startsWith('float:'))

    expect(lineFor()).toContain('CssProperties["float"]')
    expect(lineFor()).not.toContain('KnownKeywords')
    expect(lineFor({ strictTokens: true })).not.toContain('CssProperties["float"]')
  })
})
