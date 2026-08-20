import type { Preset } from '@bamboocss/types'
import { breakpoints } from './breakpoints'
import { containerSizes } from './containers'
import { keyframes } from './keyframes'
import { tokens } from './tokens'
import { mixins } from './typography'

const definePreset = <T extends Preset>(config: T) => config

const BUILTIN_PRESET_PROVENANCE = Symbol.for('@bamboocss/builtin-preset-provenance/v1')

/** See preset-base: the marker retains the module-owned references without freezing users. */
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

export const preset = definePreset({
  name: '@bamboocss/preset-bamboo',
  theme: {
    keyframes,
    breakpoints,
    tokens,
    mixins,
    containerSizes,
  },
})

markBuiltInPreset(preset, '@bamboocss/preset-bamboo')

export default preset
