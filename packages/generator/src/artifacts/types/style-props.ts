import type { Context } from '@bamboocss/core'
import { allCssProperties } from '@bamboocss/is-valid-prop'
import { unionType } from '@bamboocss/shared'
import outdent from 'outdent'

import type { UserConfig } from '@bamboocss/types'
import csstype from '../generated/csstype.d.ts.json' assert { type: 'json' }

export function generateStyleProps(ctx: Context) {
  const props = new Set(allCssProperties.concat(ctx.utility.keys()).filter(Boolean))
  const propTypes = ctx.utility.getTypes()

  const cssVars = unionType(ctx.globalVars.vars)

  return outdent`
    ${ctx.file.importType('ConditionalValue', './conditions')}
    ${ctx.file.importType('CssValueShape, KnownKeywords, OnlyKnown, UtilityValues, WithEscapeHatch', './prop-type')}
    ${ctx.file.importType('CssProperties', './system-types')}
    ${ctx.file.importType('Token', '../tokens/index')}

    type AnyString = (string & {})
    type CssVars = ${[cssVars || '`var(--${string})`'].filter(Boolean).join(' | ')}
    type CssVarValue = ConditionalValue<Token${ctx.globalVars.isEmpty() ? '' : ' | CssVars'} | AnyString | (number & {})>

    type CssVarKeys = ${[...ctx.globalVars.names.map((name) => `"--${name}"`), '`--${string}` & {}'].filter(Boolean).join(' | ')}

    export type CssVarProperties = {
      [key in CssVarKeys]?: CssVarValue
    }

    export interface SystemProperties {
      ${Array.from(props)
        .map((key) => {
          // mt -> marginTop
          const prop = ctx.utility.shorthands.get(key) ?? key

          const union = []
          // `scaleX` isn't a valid css property, will fallback to `string | number`
          const cssFallback = allCssProperties.includes(prop) ? `CssProperties["${prop}"]` : ''

          /**
           * How much of csstype's own union for this property survives.
           *
           * All of it by default. None of it under `strictTokens: true`, where a raw value is
           * written `[14px]`. Under `'unknown-tokens'`, the keywords it enumerates and not the
           * open `string` it ends with — which is the member that makes a misspelled token
           * type-check, and dropping it is the whole of that setting. Keeping the keywords is
           * what stops `display: 'flex'` needing to be a token.
           *
           * Except where the property's values *are* identifiers the author invents, in which
           * case there is nothing to be strict against and everything to get wrong — see
           * `authorIdentProperties`.
           */
          const narrowable = ctx.config.strictTokens === 'unknown-tokens' && !authorIdentProperties.has(prop)
          const knownFallback = narrowable && cssFallback ? `KnownKeywords<${cssFallback}>` : ''
          const gradedFallback = ctx.config.strictTokens === true ? '' : knownFallback || cssFallback

          /**
           * The token side, held out of the union under `'unknown-tokens'` so `restrict` can
           * put it back inside `WithEscapeHatch`.
           *
           * `WithModifier` is `[T] extends [string] ? … : never`, so one non-string member of
           * `T` — and csstype supplies `undefined` and a boxed `Number` — turns `'blue.300/40'`
           * and `'blue.300!'` off for the whole property. Wrapping the tokens alone is what
           * keeps those working, and listing them in both places instead would repeat one of
           * the largest members a property has.
           */
          let heldOutTokens = ''
          const separateTokens = ctx.config.strictTokens === 'unknown-tokens'

          /**
           * The keywords go with them, so a mark does not depend on being a token.
           *
           * Only what `WithEscapeHatch` wraps carries `!` and `/`, and that used to be the
           * tokens alone — so `shadow: 'none!'` was an error while `shadow: 'none'` and
           * `color: 'red.300!'` were both fine, decided by whether the value happened to be a
           * token rather than by anything the author can see.
           *
           * Held out only where there is a narrowed list to hold: an `authorIdentProperty`
           * keeps csstype's open string, which must stay outside the wrapper or the property
           * accepts nothing but marked values.
           */
          const heldOutKeywords = separateTokens ? knownFallback : ''

          // has values (utility or tokens)
          if (propTypes.has(prop)) {
            const tokenValue = `UtilityValues["${prop}"]`
            if (separateTokens) heldOutTokens = tokenValue
            const own = separateTokens ? '' : tokenValue
            if (strictPropertyList.has(key)) {
              // These carry their own keyword list, which `strictPropertyValues` then narrows
              // to it exactly. Under `'unknown-tokens'` the list has to be *present* — the
              // open string is gone, and `AnyString` is not added back below.
              union.push([own, 'CssVars', heldOutKeywords ? '' : knownFallback].filter(Boolean).join(' | '))
            } else {
              union.push([own, 'CssVars', heldOutKeywords ? '' : gradedFallback].filter(Boolean).join(' | '))
            }
          } else {
            union.push(
              [strictPropertyList.has(key) ? 'CssVars' : '', heldOutKeywords ? '' : knownFallback || cssFallback]
                .filter(Boolean)
                .join(' | '),
            )
          }

          const filtered = union.filter(Boolean)
          // most likely a custom utility that maps to a CSS variable
          if (!filtered.length) {
            filtered.push('string | number')
          }

          let comment = (csstype.comments as Record<string, string>)?.[prop] || ''
          if (ctx.utility.isDeprecated(prop)) {
            comment = comment ? comment.replace('@see', '@deprecated\n@see') : '/** @deprecated */'
          }

          const value = filtered.filter(Boolean).join(' | ')
          const line = `${key}?: ${restrict(prop, value, ctx.config, [heldOutTokens, heldOutKeywords].filter(Boolean).join(' | '))}`

          return ' ' + [comment, line].filter(Boolean).join('\n')
        })
        .join('\n')}
    }
    `
}

/**
 * Properties whose values are identifiers the author invents, not values anything enumerates.
 *
 * `strictTokens: 'unknown-tokens'` rejects a bare identifier that names no token and no keyword,
 * on the reasoning that nothing else is shaped like one. That reasoning stops at a property
 * whose values *are* bare identifiers by design: a `@keyframes` name written in CSS rather than
 * in `theme.keyframes`, a grid area, a counter, a container, a view-transition name, a font
 * family, a property name in `transitionProperty`. csstype types all of these as open strings
 * for the same reason, so there is nothing to check against and everything to reject wrongly.
 *
 * Left alone rather than narrowed, so they behave under this setting exactly as they do under
 * the default. The cost is that a typo in one of them is not caught — which is what
 * `strictTokens: true` is for.
 *
 * `content` is here because its values are quoted strings, and `''""''` is neither a keyword nor
 * a shape this can recognise.
 */
const authorIdentProperties = new Set([
  'anchorName',
  'anchorScope',
  'animationName',
  'animationTimeline',
  'containerName',
  'content',
  'counterIncrement',
  'counterReset',
  'counterSet',
  'fontFamily',
  'fontPalette',
  'gridArea',
  'gridColumn',
  'gridColumnEnd',
  'gridColumnStart',
  'gridRow',
  'gridRowEnd',
  'gridRowStart',
  'gridTemplateAreas',
  'listStyleType',
  'page',
  'positionAnchor',
  'positionTryFallbacks',
  'scrollTimelineName',
  'timelineScope',
  'transitionProperty',
  'viewTimelineName',
  'viewTransitionName',
  'willChange',
])

const strictPropertyList = new Set([
  'alignContent',
  'alignItems',
  'alignSelf',
  'all',
  'animationComposition',
  'animationDirection',
  'animationFillMode',
  'appearance',
  'backfaceVisibility',
  'backgroundAttachment',
  'backgroundClip',
  'borderCollapse',
  'borderBlockEndStyle',
  'borderBlockStartStyle',
  'borderBlockStyle',
  'borderBottomStyle',
  'borderInlineEndStyle',
  'borderInlineStartStyle',
  'borderInlineStyle',
  'borderLeftStyle',
  'borderRightStyle',
  'borderTopStyle',
  'boxDecorationBreak',
  'boxSizing',
  'breakAfter',
  'breakBefore',
  'breakInside',
  'captionSide',
  'clear',
  'columnFill',
  'columnRuleStyle',
  'contentVisibility',
  'direction',
  'display',
  'emptyCells',
  'flexDirection',
  'flexWrap',
  'float',
  'fontKerning',
  'forcedColorAdjust',
  'isolation',
  'lineBreak',
  'mixBlendMode',
  'objectFit',
  'outlineStyle',
  'overflow',
  'overflowX',
  'overflowY',
  'overflowBlock',
  'overflowInline',
  'overflowWrap',
  'pointerEvents',
  'position',
  'resize',
  'scrollBehavior',
  'touchAction',
  'transformBox',
  'transformStyle',
  'userSelect',
  'visibility',
  'wordBreak',
  'writingMode',
])

const restrict = (key: string, value: string, config: UserConfig, heldOutTokens = '') => {
  if (config.strictPropertyValues && strictPropertyList.has(key)) {
    // The tokens go back in. `'unknown-tokens'` holds them out of `value` for the escape-hatch
    // wrapping below, and this branch returns before that — which dropped bamboo's own values
    // for the one property in both lists: `float: 'start'` and `'end'` were rejected under this
    // combination of settings and accepted under either setting alone.
    const known = [heldOutTokens, value].filter(Boolean).join(' | ')
    return `ConditionalValue<WithEscapeHatch<OnlyKnown<"${key}", ${known}>>>`
  }

  /**
   * The escape hatch wraps the *tokens*, not the whole value.
   *
   * `WithModifier` is `[T] extends [string] ? … : never`, so one non-string member of `T`
   * turns the modifier forms off for the property entirely — and under this setting `T`
   * carries csstype's keywords, which include `undefined` and boxed `Number`. Wrapping the
   * whole union that way silently rejected `color: 'blue.300/40'` and `'blue.300!'`, which
   * decorate a token and have nothing to do with raw values.
   *
   * `CssValueShape` is what keeps raw values writable without an escape hatch: the shapes a
   * token path cannot have — a leading digit, `#` or `-`, or a space, comma or call anywhere.
   * A bare identifier that names no token and no keyword matches none of them, which is the
   * mistake this setting exists to catch.
   */
  if (config.strictTokens === 'unknown-tokens') {
    return `ConditionalValue<WithEscapeHatch<${heldOutTokens || 'never'}> | ${value} | CssValueShape>`
  }

  if (config.strictTokens) return `ConditionalValue<WithEscapeHatch<${value}>>`
  return `ConditionalValue<${value} | AnyString>`
}
