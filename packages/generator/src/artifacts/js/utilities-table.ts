import type { Context } from '@bamboocss/core'
import { outdent } from 'outdent'

/**
 * The property→className map, and nothing else.
 *
 * Only `css()` names a class, so only `css()` reads this. The shorthand half of what used to
 * be one table now lives in `merge-css`, which is what `cva` reaches — see that file for why
 * the two were separated and what it costs.
 */
export function generateUtilitiesTable(ctx: Context) {
  const { utility } = ctx

  return {
    js: outdent`
    // Encoded as \`prop:className\`.
    const utilities = "${utility
      .entries()
      .map(([prop, className]) => `${prop}:${className}`)
      .join(',')}"

    export const classNameByProp = new Map()
    utilities.split(',').forEach((entry) => {
      const [prop, className] = entry.split(':')
      classNameByProp.set(prop, className)
    })
    `,
  }
}
