import type { Context } from '@bamboocss/core'
import { outdent } from 'outdent'

export function generateCssFn(ctx: Context) {
  const { utility, hash, prefix, conditions } = ctx

  const { separator, getPropShorthands } = utility

  return {
    dts: outdent`
    ${ctx.file.importType('SystemStyleObject', '../types/index')}

    type Styles = SystemStyleObject | undefined | null | false

    interface CssRawFunction {
      (styles: Styles): SystemStyleObject
      (styles: Styles[]): SystemStyleObject
      (...styles: Array<Styles | Styles[]>): SystemStyleObject
      (styles: Styles): SystemStyleObject
    }

    interface CssFunction {
      (styles: Styles): string
      (styles: Styles[]): string
      (...styles: Array<Styles | Styles[]>): string
      (styles: Styles): string

      raw: CssRawFunction
    }

    export declare const css: CssFunction;

    /**
     * Build a fallback value: a list of candidates, most-preferred first, emitted as repeated
     * declarations so the browser keeps the last one it understands.
     *
     * Sugar for the string form — \`fallback('100dvh', '100vh')\` is \`'fallback(100dvh, 100vh)'\`.
     * The candidates are not individually type-checked, the same trade the \`[...]\` escape
     * hatch makes.
     *
     * @example
     * css({ height: fallback('calc(100dvh - 100px)', 'calc(100vh - 100px)') })
     *
     * @see https://bamboocss.com/docs/concepts/writing-styles#fallback-values
     */
    export declare function fallback(preferred: string | number, ...rest: Array<string | number>): \`fallback(\${string})\`;

    /**
     * Internal. Emitted for the source transform, which rewrites a single dynamic style
     * leaf into a call to this. Not part of the authoring API.
     */
    export declare const cssLeaf: (prefix: string, prop: string, value: unknown) => string;
    `,
    js: outdent`
    ${ctx.file.import(
      'cloneStyles, createCss, createMergeCss, hypenateProperty, leafClass, memo, withoutSpace',
      '../helpers',
    )}
    ${ctx.file.import('sortConditions, finalizeConditions', './conditions')}

    const utilities = "${utility
      .entries()
      .map(([prop, className]) => {
        const shorthandList = getPropShorthands(prop)

        // encode utility as:
        // prop:className/shorthand1/shorthand2/shorthand3

        // ex without shorthand
        // { prop: 'aspectRatio', className: 'aspect', result: 'aspectRatio:aspect' }

        // ex: with 1 shorthand
        // { prop: 'flexDirection', className: 'flex', result: 'flexDirection:flex/flexDir }

        // ex: with 1 shorthand with same shorthand as className
        // { prop: 'position', className: 'pos', result: 'position:pos/1' }

        // ex: with more than 1 shorthand
        // { prop: 'marginInlineStart', className: 'ms', result: 'marginInlineStart:ms/1/marginStart' }
        const result = [
          prop,
          [
            className,
            shorthandList.length
              ? // mark shorthand equal to className as 1 to save a few bytes
                shorthandList.map((shorthand) => (shorthand === className ? 1 : shorthand)).join('/')
              : null,
          ]
            .filter(Boolean)
            .join('/'),
        ].join(':')

        return result
      })
      .join(',')}"

    const classNameByProp = new Map()
    ${
      utility.hasShorthand
        ? outdent`
    const shorthands = new Map()
    utilities.split(',').forEach((utility) => {
      const [prop, meta] = utility.split(':')
      const [className, ...shorthandList] = meta.split('/')
      classNameByProp.set(prop, className)
      if (shorthandList.length) {
        shorthandList.forEach((shorthand) => {
          shorthands.set(shorthand === '1' ? className : shorthand, prop)
        })
      }
    })

    const resolveShorthand = (prop) => shorthands.get(prop) || prop
    `
        : outdent`
    utilities.split(',').forEach((utility) => {
      const [prop, className] = utility.split(':')
      classNameByProp.set(prop, className)
    })
    `
    }

    const context = {
      ${[hash.className && 'hash: true,', ctx.config.cssMode === 'grouped' && 'grouped: true,'].filter(Boolean).join('\n      ')}
      conditions: {
        shift: sortConditions,
        finalize: finalizeConditions,
        breakpoints: { keys: ${JSON.stringify(conditions.breakpoints.keys)} }
      },
      utility: {
        ${prefix.className ? 'prefix: ' + JSON.stringify(prefix.className) + ',' : ''}
        transform: ${
          utility.hasShorthand
            ? `(prop, value) => {
              const key = resolveShorthand(prop)
              const propKey = classNameByProp.get(key) || hypenateProperty(key)
              return { className: \`$\{propKey}${separator}$\{withoutSpace(value)}\` }
            }`
            : `(key, value) => ({ className: \`$\{classNameByProp.get(key) || hypenateProperty(key)}${separator}$\{withoutSpace(value)}\` })`
        },
        ${utility.hasShorthand ? 'hasShorthand: true,' : ''}
        toHash: ${utility.toHash},
        resolveShorthand: ${utility.hasShorthand ? 'resolveShorthand' : 'prop => prop'},
      }
    }

    const cssFn = createCss(context)
    export const css = /* @__PURE__ */ memo((...styles) => cssFn(mergeCss(...styles)))
    // The merged result is cached and shared, so a caller mutating a nested
    // condition object would otherwise poison it for everyone after them.
    css.raw = (...styles) => cloneStyles(mergeCss(...styles))

    // Emitted for the source transform, which rewrites a single dynamic style leaf into a
    // call to this rather than leaving a \`css()\` behind. \`prefix\` is the class up to the
    // value, resolved at build time; \`prop\` is only used for the shapes \`leafClass\`
    // declines, which have to run the real thing.
    export const cssLeaf = (prefix, prop, value) => {
      const className = leafClass(prefix, value)
      return className === undefined ? css({ [prop]: value }) : className
    }

    // Sugar for the string form, so the feature has an import to discover, a signature to
    // hover and a name the editor can complete. The extractor evaluates the call, so the
    // value reaching \`css()\` is the same literal either way.
    export const fallback = (...values) => \`fallback($\{values.join(', ')})\`

    export const { mergeCss, assignCss } = createMergeCss(context)
    `,
  }
}
