/**
 * Private provenance carried from config evaluation to the Node extraction policy.
 *
 * It is deliberately absent from the package entrypoint and from `LoadConfigResult`'s public
 * shape. A non-enumerable registered symbol survives the config package's ESM/CJS boundary
 * without changing serialization, hook arguments, object spreads, or documented API keys.
 */
export const CONFIG_RESOLUTION_PROVENANCE = Symbol.for('@bamboocss/config-resolution-provenance/v1')

export interface ExternalPresetProvenance {
  readonly dependencies: readonly string[]
  readonly index: number
  readonly specifier: string
}

export interface ConfigResolutionProvenance {
  readonly baseline: {
    readonly deserialize: () => unknown
    readonly serialized: string
  }
  readonly bundleDependencies: readonly string[]
  readonly externalPresets: readonly ExternalPresetProvenance[]
}

const presetProvenance = new WeakMap<object, ExternalPresetProvenance[]>()

export const rememberExternalPreset = (config: object, externalPresets: ExternalPresetProvenance[]) => {
  presetProvenance.set(config, externalPresets)
}

export const takeExternalPresets = (config: object) => presetProvenance.get(config) ?? []

export const attachConfigResolutionProvenance = (target: object, value: ConfigResolutionProvenance) => {
  Object.defineProperty(target, CONFIG_RESOLUTION_PROVENANCE, {
    configurable: false,
    enumerable: false,
    value: Object.freeze({
      baseline: Object.freeze({ ...value.baseline }),
      bundleDependencies: Object.freeze([...value.bundleDependencies]),
      externalPresets: Object.freeze(
        value.externalPresets.map((entry) =>
          Object.freeze({ ...entry, dependencies: Object.freeze([...entry.dependencies]) }),
        ),
      ),
    }),
    writable: false,
  })
}
