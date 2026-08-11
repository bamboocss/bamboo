import { createContext, createGeneratorContext } from '@bamboocss/fixture'
import { describe, expect, test } from 'vitest'
import { generateCssFn } from '../src/artifacts/js/css-fn'

describe('generate css-fn', () => {
  test('basic', () => {
    expect(generateCssFn(createContext())).toMatchInlineSnapshot(`
      {
        "dts": "import type { SystemStyleObject, ViewTransitionFn } from '../types/index';

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
      export declare const cssLeaf: (prefix: string, prop: string, value: unknown) => string;",
        "js": "import { cloneStyles, createCssUncached, hypenateProperty, leafClass, memo, viewTransitionClassName, withoutSpace } from '../helpers.mjs';
      import { sortConditions, finalizeConditions } from './conditions.mjs';
      import { classNameByProp } from './utilities.mjs';
      import { mergeCss, mergeCssUncached, resolveShorthand } from './merge-css.mjs';

      const context = {
        
        conditions: {
          shift: sortConditions,
          finalize: finalizeConditions,
        },
        utility: {
          
          transform: (prop, value) => {
                    const key = resolveShorthand(prop)
                    const propKey = classNameByProp.get(key) || hypenateProperty(key)
                    return { className: \`\${propKey}_\${withoutSpace(value)}\` }
                  },
          hasShorthand: true,
          toHash: (path, hashFn) => hashFn(path.join(":")),
          resolveShorthand: resolveShorthand,
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
      // value, resolved at build time; \`prop\` is only used for the shapes \`leafClass\`
      // declines, which have to run the real thing.
      export const cssLeaf = (prefix, prop, value) => {
        const className = leafClass(prefix, value)
        return className === undefined ? css({ [prop]: value }) : className
      }

      // Sugar for the string form, so the feature has an import to discover, a signature to
      // hover and a name the editor can complete. The extractor evaluates the call, so the
      // value reaching \`css()\` is the same literal either way.
      export const fallback = (...values) => \`fallback(\${values.join(', ')})\`

      // The class is the whole return value — the CSS behind it was emitted at build time
      // from the same options, hashed by this same function. A call the extractor never saw
      // still returns a class, exactly as \`css()\` does for a value it never saw.
      export const viewTransition = (options) => viewTransitionClassName(options, "")
      ",
      }
    `)
  })

  test('basic', () => {
    expect(
      generateCssFn(
        createContext({
          hooks: {
            'utility:created': ({ configure }) => {
              configure({
                toHash(paths, toHash) {
                  const stringConds = paths.join(':')
                  const splitConds = stringConds.split('_')
                  const hashConds = splitConds.map(toHash)
                  return hashConds.join('_')
                },
              })
            },
          },
        }),
      ),
    ).toMatchInlineSnapshot(`
      {
        "dts": "import type { SystemStyleObject, ViewTransitionFn } from '../types/index';

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
      export declare const cssLeaf: (prefix: string, prop: string, value: unknown) => string;",
        "js": "import { cloneStyles, createCssUncached, hypenateProperty, leafClass, memo, viewTransitionClassName, withoutSpace } from '../helpers.mjs';
      import { sortConditions, finalizeConditions } from './conditions.mjs';
      import { classNameByProp } from './utilities.mjs';
      import { mergeCss, mergeCssUncached, resolveShorthand } from './merge-css.mjs';

      const context = {
        
        conditions: {
          shift: sortConditions,
          finalize: finalizeConditions,
        },
        utility: {
          
          transform: (prop, value) => {
                    const key = resolveShorthand(prop)
                    const propKey = classNameByProp.get(key) || hypenateProperty(key)
                    return { className: \`\${propKey}_\${withoutSpace(value)}\` }
                  },
          hasShorthand: true,
          toHash: toHash(paths, toHash) {
                        const stringConds = paths.join(":");
                        const splitConds = stringConds.split("_");
                        const hashConds = splitConds.map(toHash);
                        return hashConds.join("_");
                      },
          resolveShorthand: resolveShorthand,
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
      // value, resolved at build time; \`prop\` is only used for the shapes \`leafClass\`
      // declines, which have to run the real thing.
      export const cssLeaf = (prefix, prop, value) => {
        const className = leafClass(prefix, value)
        return className === undefined ? css({ [prop]: value }) : className
      }

      // Sugar for the string form, so the feature has an import to discover, a signature to
      // hover and a name the editor can complete. The extractor evaluates the call, so the
      // value reaching \`css()\` is the same literal either way.
      export const fallback = (...values) => \`fallback(\${values.join(', ')})\`

      // The class is the whole return value — the CSS behind it was emitted at build time
      // from the same options, hashed by this same function. A call the extractor never saw
      // still returns a class, exactly as \`css()\` does for a value it never saw.
      export const viewTransition = (options) => viewTransitionClassName(options, "")
      ",
      }
    `)
  })
})

describe('generate css-fn — the recipe seam', () => {
  /**
   * There is no longer a seam to keep.
   *
   * Recipes used to be extracted atomically while `css()` calls were grouped, because which
   * variant combination a caller selects is not knowable at build time and grouping would
   * have needed a rule per combination. That forced a second `createCss`, exported as
   * `__atomicCss`, purely so the recipe runtimes could name classes the way the stylesheet
   * did.
   *
   * A recipe now names its classes semantically — `btn--size_sm`, from the config — which is
   * knowable at build time. So no second instance.
   */
  test('no second css instance', () => {
    const js = generateCssFn(createGeneratorContext({}) as any).js
    expect(js).not.toContain('__atomicCss')
    expect(js).not.toContain('grouped: false')
  })
})
