import { isObject } from './assert'

const OMIT = new Set(['__proto__', 'constructor', 'prototype'])

/**
 * Independent copy of a style object, nested condition blocks included.
 *
 * Merged style objects are cached, so anything handed to user code has to be
 * copied first: a caller mutating what it received would otherwise change what
 * every later caller reads back. `css.raw()` and `cva.raw()` are those boundaries.
 *
 * Kept separate from `mergeProps` deliberately. Merging is on the hot path — it
 * runs on every `css()` cache miss and on every render of a pattern component
 * under `jsxStyleProps: 'minimal'` — and copying there charges every caller for a
 * guarantee only the two `raw()` helpers need. Measured on a realistic style
 * object (5 base properties, 4 condition blocks) that was roughly twice the cost
 * of merging alone.
 */
export function cloneStyles<T>(styles: T): T {
  if (Array.isArray(styles)) return styles.map((value) => cloneStyles(value)) as T
  if (!isObject(styles)) return styles

  const out: Record<string, any> = {}
  for (const key of Object.keys(styles)) {
    if (OMIT.has(key)) continue
    out[key] = cloneStyles((styles as Record<string, any>)[key])
  }

  return out as T
}
