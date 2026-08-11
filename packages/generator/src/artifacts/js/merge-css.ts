import type { Context } from '@bamboocss/core'
import { outdent } from 'outdent'

/**
 * `mergeCss` and friends, plus the shorthand table they need.
 *
 * Split out of `css.mjs` because `cva` needs the merge and nothing else. While it lived
 * there, `cva` imported `createCss`, `cssLeaf`, `viewTransition` and the rest of the engine
 * to reach one function.
 *
 * The shorthand table lives here rather than beside the class names, and that is the second
 * half of the same problem. `cva` reaches `mergeCss` through `raw()` and `merge()` — both
 * properties on the object `cva()` returns, so neither can be shaken away — and while the
 * two tables were one, that dragged the *naming* table into every bundle using recipes.
 * Measured on `sandbox/vite-ts`: 2,786 B gzipped of a 6,769 B `cva`-only bundle, 41% of it,
 * for a map the recipe path never reads.
 *
 * Separating them costs about 402 B gzipped in a bundle that still calls `css()` at runtime,
 * because the two halves share every property name and each now spells the list. That is the
 * trade, and it is the right way round: a `css()` call surviving to runtime already costs
 * 1,684 B for the engine behind it, and `failOnUnfolded` exists to drive that count to zero.
 *
 * Nothing here reaches the `styled-system/css` barrel. `css.raw(...)` is the authoring API
 * for merging style objects, and it is `mergeCss` plus the defensive clone that makes a
 * shared, memoized result safe to hand to a caller — so exporting the uncloned function
 * beside it offered a footgun under a second name. `cva` imports it from here directly.
 */
export function generateMergeCssFn(ctx: Context) {
  const { utility } = ctx

  // Only the properties that declare a shorthand, and only the shorthand names. The class
  // each property maps to belongs to the naming table.
  const shorthandTable = utility
    .keys()
    .map((prop) => {
      const list = utility.getPropShorthands(prop)
      return list.length ? `${prop}:${list.join('/')}` : null
    })
    .filter(Boolean)
    .join(',')

  return {
    dts: outdent`
    import type { SystemStyleObject } from '../types/index';

    /** Deep-merge style objects, resolving shorthands before merging. */
    export declare function mergeCss(...styles: SystemStyleObject[]): SystemStyleObject;
    /** \`mergeCss\` without the memo, for callers that already cache. */
    export declare function mergeCssUncached(...styles: SystemStyleObject[]): SystemStyleObject;
    /** Whether any utility declares a shorthand. */
    export declare const hasShorthand: boolean;
    /** The property a shorthand names, or the input when it names none. */
    export declare function resolveShorthand(prop: string): string;
    `,
    js: outdent`
    ${ctx.file.import('createMergeCss', '../helpers')}

    ${
      utility.hasShorthand
        ? outdent`
    const shorthandTable = "${shorthandTable}"

    const shorthands = new Map()
    shorthandTable.split(',').forEach((entry) => {
      const [prop, list] = entry.split(':')
      list.split('/').forEach((shorthand) => shorthands.set(shorthand, prop))
    })

    export const hasShorthand = true
    export const resolveShorthand = (prop) => shorthands.get(prop) || prop
    `
        : outdent`
    export const hasShorthand = false
    export const resolveShorthand = (prop) => prop
    `
    }

    // Only what \`normalizeStyleObject\` reads: shorthand resolution. No class naming, so
    // none of the engine that does it.
    const mergeContext = {
      utility: { hasShorthand, resolveShorthand },
    }

    export const { mergeCss, mergeCssUncached } = createMergeCss(mergeContext)
    `,
  }
}
