import type { Preset } from '@bamboocss/types'
import { conditions } from './conditions'
import { patterns } from './patterns'
import { utilities } from './utilities'

const definePreset = <T extends Preset>(preset: T) => preset

const BUILTIN_PRESET_PROVENANCE = Symbol.for('@bamboocss/builtin-preset-provenance/v1')

/**
 * Capture the functions while this module still owns the freshly assembled preset. The
 * public preset remains mutable for compatibility, but later mutation cannot turn a custom
 * closure into a built-in function merely by placing it in that object.
 */
const markBuiltInPreset = (owner: object, prefix: string) => {
  const functions: Array<Readonly<{ identity: string; value: Function }>> = []
  const active = new WeakSet<object>()

  const visit = (value: unknown, identity: string) => {
    if (typeof value === 'function') {
      functions.push(Object.freeze({ identity, value }))
      return
    }
    if (value === null || typeof value !== 'object' || active.has(value)) return

    active.add(value)
    for (const key of Reflect.ownKeys(value)) {
      if (typeof key === 'symbol' || (Array.isArray(value) && key === 'length')) continue
      const descriptor = Object.getOwnPropertyDescriptor(value, key)
      if (descriptor && 'value' in descriptor) visit(descriptor.value, `${identity}[${JSON.stringify(key)}]`)
    }
    active.delete(value)
  }

  visit(owner, prefix)
  const marker = Object.freeze({ functions: Object.freeze(functions), owner })
  Object.defineProperty(owner, BUILTIN_PRESET_PROVENANCE, {
    configurable: false,
    enumerable: false,
    value: marker,
    writable: false,
  })
}

// No `globalCss`. The composed custom properties used to be defaulted by a rule on
// `*, ::before, ::after, ::backdrop`, which is how they were kept from inheriting before
// `@property` existed. Each is now registered by the utility that composes it — see
// `customProperties` on `filter`, `translate`, `scale` and the rest.
export const preset = definePreset({
  name: '@bamboocss/preset-base',
  conditions,
  utilities,
  patterns,
})

markBuiltInPreset(preset, '@bamboocss/preset-base')

export default preset
