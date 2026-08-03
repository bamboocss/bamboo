import type { Context } from '@bamboocss/core'
import { outdent } from 'outdent'

export function generateStringLiteralCssFn(ctx: Context) {
  const { utility, hash, prefix } = ctx

  const { separator } = utility

  return {
    dts: outdent`
    ${ctx.file.importType('SystemStyleObject', '../types/index')}

    type Styles =
      | { raw: readonly string[] | ArrayLike<string> }
      | SystemStyleObject
      | boolean
      | null
      | undefined

    interface CssRawFunction {
      (...styles: Styles[]): SystemStyleObject
    }

    interface CssFunction {
      (...styles: Styles[]): string

      raw: CssRawFunction
    }

    export declare const css: CssFunction;
    `,
    js: outdent`
    ${ctx.file.import('astish, cloneStyles, createCss, isObject, mergeProps, withoutSpace', '../helpers')}
    ${ctx.file.import('finalizeConditions, sortConditions', './conditions')}

    function transform(prop, value) {
      const className = \`$\{prop}${separator}$\{withoutSpace(value)}\`
      return { className }
    }

    const context = {
      hash: ${hash.className ? 'true' : 'false'},
      conditions: {
        shift: sortConditions,
        finalize: finalizeConditions,
        breakpoints: { keys: [] },
      },
      utility: {
        prefix: ${prefix.className ? JSON.stringify(prefix.className) : undefined},
        transform,
        hasShorthand: false,
        toHash: ${utility.toHash},
        resolveShorthand(prop) {
          return prop
        },
      }
    }

    const cssFn = createCss(context)

    const fn = (style) => (isObject(style) ? style : astish(style[0]))
    export const css = (...styles) => cssFn(mergeProps(...styles.filter(Boolean).map(fn)))
    // Same independence guarantee as the object-syntax css.raw(), so the public
    // API behaves identically across both syntaxes.
    css.raw = (...styles) => cloneStyles(mergeProps(...styles.filter(Boolean).map(fn)))
    `,
  }
}
