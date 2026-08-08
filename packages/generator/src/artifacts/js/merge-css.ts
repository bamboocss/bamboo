import type { Context } from '@bamboocss/core'
import { outdent } from 'outdent'

/**
 * `mergeCss` and friends, in a module of their own.
 *
 * Split out of `css.mjs` because `cva` needs the merge and nothing else. While it lived
 * there, `cva` imported `createCss`, `cssLeaf`, `viewTransition` and the rest of the engine
 * to reach one function — and `css.mjs` could never be tree-shaken out of a bundle using
 * recipes, however completely the fold resolved that bundle's `css()` calls.
 *
 * The utility table stays shared rather than being split along with it; see
 * `generateUtilitiesTable` for why. `css.mjs` re-exports these, so the authoring API is
 * unchanged.
 */
export function generateMergeCssFn(ctx: Context) {
  const { conditions } = ctx

  return {
    dts: outdent`
    import type { SystemStyleObject } from '../types/index';

    /** Deep-merge style objects, resolving shorthands before merging. */
    export declare function mergeCss(...styles: SystemStyleObject[]): SystemStyleObject;
    /** Shallow-assign style objects, resolving shorthands first. */
    export declare function assignCss(...styles: SystemStyleObject[]): SystemStyleObject;
    /** \`mergeCss\` without the memo, for callers that already cache. */
    export declare function mergeCssUncached(...styles: SystemStyleObject[]): SystemStyleObject;
    `,
    js: outdent`
    ${ctx.file.import('createMergeCss', '../helpers')}
    ${ctx.file.import('hasShorthand, resolveShorthand', './utilities')}

    // Only what \`normalizeStyleObject\` reads: shorthand resolution, and the breakpoint keys
    // it needs to turn a responsive array into an object. No class naming, so none of the
    // engine that does it.
    const mergeContext = {
      conditions: { breakpoints: { keys: ${JSON.stringify(conditions.breakpoints.keys)} } },
      utility: { hasShorthand, resolveShorthand },
    }

    export const { mergeCss, assignCss, mergeCssUncached } = createMergeCss(mergeContext)
    `,
  }
}
