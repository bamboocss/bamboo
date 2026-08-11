import { assign, mergeWith, mergeAndConcat, walkObject } from '@bamboocss/shared'
import type { Config } from '@bamboocss/types'
import { mergeHooks } from './merge-hooks'
export { mergeHooks }
import { isValidToken } from './validation/utils'

type Extendable<T> = T & { extend?: T }
interface Dict {
  [key: string]: any
}
type ExtendableRecord = Extendable<Dict>
type ExtendableConfig = Extendable<Config>

/**
 * Collect all `extend` properties into an array (to avoid mutation)
 */
function getExtends(items: ExtendableRecord[]) {
  return items.reduce((merged, { extend }) => {
    if (!extend) return merged

    return mergeWith(merged, extend, (originalValue: any, newValue: any) => {
      if (newValue === undefined) {
        return originalValue ?? []
      }

      if (originalValue === undefined) {
        return [newValue]
      }

      if (Array.isArray(originalValue)) {
        return [newValue, ...originalValue]
      }

      return [newValue, originalValue]
    })
  }, {})
}

/**
 * Separate the `extend` properties from the rest of the object
 */
function mergeRecords(records: ExtendableRecord[]) {
  return {
    ...records.reduce((acc, record) => assign(acc, record), {}),
    extend: getExtends(records),
  }
}

/**
 * Merge all `extend` properties into the rest of the object
 */
function mergeExtensions(records: ExtendableRecord[]) {
  const { extend = [], ...restProps } = mergeRecords(records)
  return mergeWith(restProps, extend, (obj: any, extensions: any[]) => {
    return mergeAndConcat({}, obj, ...extensions)
  })
}

const isEmptyObject = (obj: any) => typeof obj === 'object' && Object.keys(obj).length === 0

const compact = (obj: any) => {
  return Object.keys(obj).reduce((acc, key) => {
    if (obj[key] !== undefined && !isEmptyObject(obj[key])) {
      acc[key] = obj[key]
    }
    return acc
  }, {} as any)
}

const tokenKeys = ['description', 'extensions', 'type', 'value', 'deprecated']

/**
 * Options whose scalar form is shorthand for setting every member of their object form.
 *
 * `hash: true` says both `cssVar` and `className`; `prefix: 'bb'` says both; `preflight: true`
 * says "on, with the defaults". Expanding them is what lets the object forms compose: a preset
 * that sets `prefix.className` and an app that sets `prefix.cssVar` should end up with both,
 * and before this the app's object replaced the preset's wholesale — silently, since the two
 * name different members. `hash`'s members are optional, so writing the partial form that
 * triggered it is the natural thing to do.
 *
 * `preflight: false` has no object form — there is no member meaning "off" — so it stays a
 * scalar and wins outright when it is the value the winning config states.
 */
const SCALAR_SHORTHANDS: Record<string, (value: any) => any> = {
  hash: (value) => (typeof value === 'boolean' ? { cssVar: value, className: value } : value),
  prefix: (value) => (typeof value === 'string' ? { cssVar: value, className: value } : value),
  preflight: (value) => (value === true ? {} : value),
}

/**
 * Merge one of those, winner-first per member.
 *
 * `records` arrives in precedence order — the user's config, then each preset — which is the
 * order `assign` wants, since it only fills keys the target does not already have.
 */
function mergeScalarShorthand(key: string, records: ExtendableConfig[]) {
  const normalize = SCALAR_SHORTHANDS[key]!
  const values = records.map((record) => (record as Dict)[key]).filter((value) => value !== undefined)

  if (!values.length) return undefined
  if (values[0] === false) return false

  const objects = values.map(normalize).filter((value) => value !== null && typeof value === 'object')
  if (!objects.length) return values[0]

  const merged = objects.reduce((acc, object) => assign(acc, object), {} as Dict)

  // `preflight: true` normalizes to `{}` — an object with nothing to contribute. If that is all
  // there was, hand back the scalar: the empty object would be dropped by the `compact` below
  // and the option would be lost rather than merged.
  return isEmptyObject(merged) ? values[0] : merged
}

/**
 * Merge all configs into a single config
 */
export function mergeConfigs(configs: ExtendableConfig[]) {
  const reversed = Array.from(configs).reverse()

  const theme: Dict = mergeExtensions(reversed.map((config) => config.theme ?? {}))

  // `theme.variants` carries an `extend` of its own, and `mergeExtensions` only unwraps the
  // level it is handed — so merging `theme` leaves a nested `extend` sitting there as literal
  // data. Merged explicitly against the source configs instead. Was a top-level `themes`,
  // which got this for free by being its own key.
  const themeVariants = mergeExtensions(reversed.map((config) => (config.theme as Dict | undefined)?.variants ?? {}))
  if (isEmptyObject(themeVariants)) delete theme.variants
  else theme.variants = themeVariants

  // Every object-valued key has to be named here, because everything not named is
  // shallow-assigned. Left off, a config setting one sub-key replaces a preset's whole object
  // — so a preset that turns keyframe pruning off would be silently re-enabled by an app
  // setting `preflight`, and a preset's `global.vars` would vanish behind an app's
  // `global.css`.
  const global = compact({
    css: mergeExtensions(reversed.map((config) => config.global?.css ?? {})),
    vars: mergeExtensions(reversed.map((config) => config.global?.vars ?? {})),
    fontface: mergeExtensions(reversed.map((config) => config.global?.fontface ?? {})),
    positionTry: mergeExtensions(reversed.map((config) => config.global?.positionTry ?? {})),
  })

  // Not compacted here, though the result is compacted below. Dropping a key whose merged
  // value is `undefined` before `assign` runs would let `assign` copy the raw value straight
  // off a config, which is exactly the merge being bypassed.
  const mergedResult = assign(
    {
      conditions: mergeExtensions(reversed.map((config) => config.conditions ?? {})),
      theme,
      patterns: mergeExtensions(reversed.map((config) => config.patterns ?? {})),
      utilities: mergeExtensions(reversed.map((config) => config.utilities ?? {})),
      global,
      staticCss: mergeExtensions(reversed.map((config) => config.staticCss ?? {})),
      prune: mergeExtensions(reversed.map((config) => config.prune ?? {})),
      hash: mergeScalarShorthand('hash', reversed),
      prefix: mergeScalarShorthand('prefix', reversed),
      preflight: mergeScalarShorthand('preflight', reversed),
    },
    ...reversed,
  )

  const withoutEmpty = compact(mergedResult)

  /**
   * Properly merge tokens between flat/nested forms by setting the flat form as the default
   * preset:
   * ```
   * tokens: {
   *   black: {
   *     value: "black"
   *   }
   * }
   * // color: "black"
   * ```
   *
   * config:
   * ```
   * tokens: {
   *   black: {
   *     0: { value: "black" },
   *     10: { value: "black/10" },
   *     20: { value: "black/20" },
   *     // ...
   *   }
   * }
   *
   * // color: "black.20"
   * ```
   */
  if (withoutEmpty.theme?.tokens) {
    walkObject(withoutEmpty.theme.tokens, (args) => args, {
      stop(token) {
        if (!isValidToken(token)) return false

        const keys = Object.keys(token)
        const nestedKeys = keys.filter((k) => !tokenKeys.includes(k))
        const nested = nestedKeys.length > 0

        if (nested) {
          token.DEFAULT ||= {}
          tokenKeys.forEach((key) => {
            if (token[key] == null) return
            token.DEFAULT[key] ||= token[key]
            delete token[key]
          })
        }

        return true
      },
    })
  }

  return withoutEmpty
}
