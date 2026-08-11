import type { Context } from '@bamboocss/core'
import { outdent } from 'outdent'

export function generateCssFn(ctx: Context) {
  const { utility, hash, prefix } = ctx

  const { separator } = utility

  // The one reference that decides whether a bundle can drop the css engine. See
  // `leafFallback` in the config for what turning it off asserts about your source.
  const leafFallback = ctx.config.leafFallback ?? true

  return {
    dts: outdent`
    ${ctx.file.importType('SystemStyleObject, ViewTransitionFn', '../types/index')}

    type Styles = SystemStyleObject | undefined | null | false

    interface CssFunction {
      /** Spread a list you built — \`css(...styles)\`. An array argument is an error. */
      (...styles: Styles[]): string

      raw: (...styles: Styles[]) => SystemStyleObject
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
     * Style the View Transitions API and get back one stable class for the bag.
     *
     * The class is applied through \`view-transition-class\`, so the same transition can be
     * shared by any number of elements. You still set \`view-transition-name\` yourself —
     * it has to be unique per element, so bamboo cannot share it for you.
     *
     * @example
     * const slide = viewTransition({
     *   group: { animationDuration: '0.4s' },
     *   old: { animationName: 'slide-out' },
     *   new: { animationName: 'slide-in' },
     * })
     *
     * @see https://bamboocss.com/docs/concepts/view-transitions
     */
    export declare const viewTransition: ViewTransitionFn;

    /**
     * Internal. Emitted for the source transform, which rewrites a single dynamic style
     * leaf into a call to this. Not part of the authoring API.
     */
    export declare const cssLeaf: (prefix: string, prop: string, value: unknown) => string;
    `,
    js: outdent`
    ${ctx.file.import(
      'cloneStyles, createCssUncached, hypenateProperty, leafClass, memo, viewTransitionClassName, withoutSpace',
      '../helpers',
    )}
    ${ctx.file.import('sortConditions, finalizeConditions', './conditions')}
    ${ctx.file.import('classNameByProp', './utilities')}
    ${ctx.file.import('mergeCss, mergeCssUncached, resolveShorthand', './merge-css')}

    const context = {
      ${hash.className ? 'hash: true,' : ''}
      conditions: {
        shift: sortConditions,
        finalize: finalizeConditions,
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

    const cssFn = createCssUncached(context)
    // \`createCssUncached\` and \`mergeCssUncached\` rather than their cached forms: this
    // callback runs only when the memo above it missed, and a miss means these arguments
    // have not been seen — so a second cache keyed on the same arguments, or on the merge
    // derived from them, can only miss too, after paying for the lookup.
    export const css = /* @__PURE__ */ memo((...styles) => cssFn(mergeCssUncached(...styles)))
    // The cached merge here, since \`raw\` is called straight from user code with no memo
    // above it. The merged result is cached and shared, so a caller mutating a nested
    // condition object would otherwise poison it for everyone after them.
    css.raw = (...styles) => cloneStyles(mergeCss(...styles))


    // Emitted for the source transform, which rewrites a single dynamic style leaf into a
    // call to this rather than leaving a \`css()\` behind. \`prefix\` is the class up to the
    // value, resolved at build time; \`prop\` names the property for the shapes \`leafClass\`
    // declines.
    ${
      leafFallback
        ? `export const cssLeaf = (prefix, prop, value) => {
      const className = leafClass(prefix, value)
      return className === undefined ? css({ [prop]: value }) : className
    }`
        : // \`leafFallback: false\`. The reference to \`css\` is gone, which is the whole point —
          // it is the only edge from a fully-lowered module to the engine, and without it the
          // bundler drops \`createCss\`, the merge, the utility table and the conditions.
          //
          // Nothing emitted below may contain the substring the tests assert against, comments
          // included — a note *about* avoiding that reference reads to a substring check
          // exactly like the reference would. Keep such notes here, in the generator.
          //
          // Throws rather than guessing. \`leafClass\` declines exactly two shapes, a condition
          // object and a responsive array, and both mean one class per entry rather than one
          // class — so there is no string to return that is not wrong. Returning \`''\` would
          // drop the style silently, which is the failure this project spends most of its
          // diagnostics trying to prevent.
          `export const cssLeaf = (prefix, prop, value) => {
      const className = leafClass(prefix, value)
      if (className === undefined) {
        throw new Error(
          \`[bamboocss] \\\`\${prop}\\\` got a \${Array.isArray(value) ? 'responsive array' : 'condition object'} from a \` +
            \`runtime value, and \\\`leafFallback\\\` is off. Write the conditions as a literal at the call site, so \` +
            \`the build resolves each branch, or set \\\`leafFallback: true\\\` to keep the runtime.\`,
        )
      }
      return className
    }`
    }

    // Sugar for the string form, so the feature has an import to discover, a signature to
    // hover and a name the editor can complete. The extractor evaluates the call, so the
    // value reaching \`css()\` is the same literal either way.
    export const fallback = (...values) => \`fallback($\{values.join(', ')})\`

    // The class is the whole return value — the CSS behind it was emitted at build time
    // from the same options, hashed by this same function. A call the extractor never saw
    // still returns a class, exactly as \`css()\` does for a value it never saw.
    export const viewTransition = (options) => viewTransitionClassName(options, ${JSON.stringify(prefix.className ?? '')})

`,
  }
}
