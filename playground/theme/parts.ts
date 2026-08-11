import type { SystemStyleObject } from '@bamboocss/dev'

interface Anatomy {
  [part: string]: { selector: string }
}

/**
 * Key a style object by part name instead of by selector.
 *
 * This used to be `defineParts` in `@bamboocss/dev`. It is not framework API — a slot recipe
 * is how bamboo models a multi-part component, and where you want one class that reaches its
 * children instead, the selector is writable directly:
 *
 *     base: { '& [data-part="root"]': { display: 'flex' } }
 *
 * It survives here because Ark and Zag generate their selectors, so spelling them out by hand
 * would mean copying `&[data-scope="card"][data-part="root"], & [data-scope=…]` per part.
 */
export function toParts<T extends Anatomy>(anatomy: T) {
  return (config: Partial<Record<keyof T, SystemStyleObject>>): SystemStyleObject =>
    Object.fromEntries(
      Object.entries(config).map(([part, styles]) => {
        const selector = anatomy[part]?.selector
        if (selector == null) {
          throw new Error(`Part "${part}" is not in the anatomy. Available: ${Object.keys(anatomy).join(', ')}`)
        }
        return [selector, styles]
      }),
    )
}
