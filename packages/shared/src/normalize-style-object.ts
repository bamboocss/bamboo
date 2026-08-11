import type { CreateCssContext } from './classname'
import { BambooError } from './error'
import { walkObject } from './walk-object'

type NormalizeContext = Pick<CreateCssContext, 'utility'>

/**
 * Whether walking the object would only rebuild it.
 *
 * Normalizing does two things: it renames a shorthand to its longhand and drops nullish
 * leaves. A flat object of plain values written in longhand needs neither, and that is most
 * of what `css()` is handed — but it still paid for a full rebuild plus a path array per key.
 *
 * Every clause has to be exact, since a false positive returns an object the walk would have
 * changed. Nullish is one of them: a leaf the walk removes must not survive, or a later merge
 * would see it override the value beneath it. The array check is another, and it is on the
 * container as well as the values — `stop` is handed the container, so an array arriving at
 * the top level has to reach the walk to be rejected rather than being returned as it came.
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
 *
 * An array is not a style value. It used to be read as one value per breakpoint, which meant
 * a font stack written the way CSS writes one — `['Inter', 'sans-serif']` — silently became
 * `Inter` at base and `sans-serif` at `sm`. The type no longer admits an array, so reaching
 * this throw takes a cast or untyped javascript; it says which property, since the walk knows
 * the path and the caller usually does not.
 */
export function normalizeStyleObject(styles: Record<string, any>, context: NormalizeContext, shorthand = true) {
  const { utility } = context
  const { hasShorthand, resolveShorthand } = utility

  if (needsNoNormalizing(styles, shorthand && hasShorthand ? resolveShorthand : undefined)) return styles

  return walkObject(
    styles,
    (value, path) => {
      if (Array.isArray(value)) {
        const at = path.length ? `: "${path.join('.')}"` : ''
        throw new BambooError('INVALID_STYLE_VALUE', `An array is not a style value${at}.`, {
          hint: 'Write a responsive value as a condition object, e.g. { base: "medium", lg: "bold" }.',
        })
      }
      return value
    },
    {
      stop: (value) => Array.isArray(value),
      getKey: shorthand ? (prop) => (hasShorthand ? resolveShorthand(prop) : prop) : undefined,
    },
  )
}
