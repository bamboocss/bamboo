import type { Context } from '@bamboocss/core'
import { outdent } from 'outdent'

/**
 * The utility table, in a module of its own.
 *
 * One encoding serving two readers. `css()` needs property→className to name a class;
 * `mergeCss` needs shorthand→property to resolve `mx` against `marginInline` before merging.
 * Both are derived from the same string here rather than emitted separately, because the two
 * halves share every property name — splitting the table into a naming half and a shorthand
 * half measured **+402 B gzipped**, since each half then spells the property list again.
 *
 * Why a separate module at all, then: `cva` needs the merge and nothing else. While
 * `mergeCss` lived in `css.mjs`, importing it dragged in `createCss`, `cssLeaf`,
 * `viewTransition` and the rest of the engine. With the table shared from here, a bundle
 * whose `css()` calls have all been folded away keeps the table and the merge, and drops the
 * engine — worth roughly 1.3 kB gzipped, and worth nothing until the fold reaches every call
 * site. It costs nothing before then, which is the point: the alternative structures all
 * charged today's users for tomorrow's saving.
 */
export function generateUtilitiesTable(ctx: Context) {
  const { utility } = ctx

  const getPropShorthands = (prop: string) => utility.getPropShorthands(prop)

  return {
    js: outdent`
    // Encoded as \`prop:className/shorthand1/shorthand2\`, with a shorthand equal to the
    // className written as \`1\` to save the repetition.
    const utilities = "${utility
      .entries()
      .map(([prop, className]) => {
        const shorthandList = getPropShorthands(prop)
        return [
          prop,
          [
            className,
            shorthandList.length
              ? shorthandList.map((shorthand) => (shorthand === className ? 1 : shorthand)).join('/')
              : null,
          ]
            .filter(Boolean)
            .join('/'),
        ].join(':')
      })
      .join(',')}"

    export const classNameByProp = new Map()
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

    export const hasShorthand = true
    export const resolveShorthand = (prop) => shorthands.get(prop) || prop
    `
        : outdent`
    utilities.split(',').forEach((utility) => {
      const [prop, className] = utility.split(':')
      classNameByProp.set(prop, className)
    })

    export const hasShorthand = false
    export const resolveShorthand = (prop) => prop
    `
    }
    `,
  }
}
