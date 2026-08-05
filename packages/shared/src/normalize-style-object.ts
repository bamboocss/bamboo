import type { CreateCssContext } from './classname'
import { walkObject } from './walk-object'

type NormalizeContext = Pick<CreateCssContext, 'utility' | 'conditions'>

export function toResponsiveObject(values: string[], breakpoints: string[]) {
  return values.reduce(
    (acc, current, index) => {
      const key = breakpoints[index]
      if (current != null) {
        acc[key] = current
      }
      return acc
    },
    {} as Record<string, string>,
  )
}

/**
 * Whether walking the object would only rebuild it.
 *
 * Normalizing does three things: it renames a shorthand to its longhand, expands a responsive
 * array into a breakpoint object, and drops nullish leaves. A flat object of plain values
 * written in longhand needs none of them, and that is most of what `css()` is handed — but it
 * still paid for a full rebuild plus a path array per key.
 *
 * Every clause has to be exact, since a false positive returns an object the walk would have
 * changed. Nullish is one of them: a leaf the walk removes must not survive, or a later merge
 * would see it override the value beneath it. The array check is another, and it is on the
 * container as well as the values — `stop` is handed the container, so an array arriving at
 * the top level becomes a breakpoint object rather than being walked into.
 *
 * `for...in` reads inherited keys the walk ignores, which is safe in the only direction it can
 * be wrong — an extra key can send this to the slow path, never past it.
 *
 * It does read every value, as `compactStyles` and the argument memo already do, so an
 * accessor prop is read once more than before. Style props are values by the time they get
 * here and reading one has no effect, but it is the reason this cannot be reordered to read
 * lazily.
 */
function needsNoNormalizing(styles: Record<string, any>, resolveShorthand: ((prop: string) => string) | undefined) {
  if (Array.isArray(styles)) return false

  for (const key in styles) {
    const value = styles[key]
    if (value == null || typeof value === 'object') return false
    if (resolveShorthand !== undefined && resolveShorthand(key) !== key) return false
  }
  return true
}

/**
 * The result may be the argument itself rather than a fresh object, so callers have to treat
 * it as read-only. Every one of them does today: merging accumulates into its own object and
 * the two `raw()` helpers clone at the boundary.
 */
export function normalizeStyleObject(styles: Record<string, any>, context: NormalizeContext, shorthand = true) {
  const { utility, conditions } = context
  const { hasShorthand, resolveShorthand } = utility

  if (needsNoNormalizing(styles, shorthand && hasShorthand ? resolveShorthand : undefined)) return styles

  return walkObject(
    styles,
    (value) => {
      return Array.isArray(value) ? toResponsiveObject(value, conditions!.breakpoints.keys) : value
    },
    {
      stop: (value) => Array.isArray(value),
      getKey: shorthand ? (prop) => (hasShorthand ? resolveShorthand(prop) : prop) : undefined,
    },
  )
}
