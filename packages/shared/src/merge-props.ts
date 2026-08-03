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
      } else if (isObject(value)) {
        // Copy rather than alias. The merged object is cached and handed to user
        // code, so keeping a reference to a source's nested object lets one caller
        // mutate a value that a later, unrelated caller reads back.
        prev[key] = mergeProps({}, value)
      } else if (Array.isArray(value)) {
        prev[key] = value.slice()
      } else {
        prev[key] = value
      }
    })
    return prev
  }, {} as T)
}
