import { isObject } from './assert'

const MERGE_OMIT = new Set(['__proto__', 'constructor', 'prototype'])

export function mergeProps<T extends Record<string, unknown>>(...sources: T[]): T {
  return sources.reduce((prev: any, obj) => {
    if (!obj) return prev
    Object.keys(obj).forEach((key) => {
      if (MERGE_OMIT.has(key)) return
      const prevValue = prev[key]
      const value = obj[key]
      if (isObject(prevValue) && isObject(value)) {
        prev[key] = mergeProps(prevValue, value)
      } else {
        // Aliases the source's value rather than copying it. This runs on every
        // `css()` cache miss, so callers that hand the result to user code copy it
        // themselves with `cloneStyles` — see `css.raw()` and `cva.raw()`.
        prev[key] = value
      }
    })
    return prev
  }, {} as T)
}
