import { mergeConfigs } from '@bamboocss/config'
import { RuleProcessor } from '@bamboocss/core'
import { Generator } from '@bamboocss/generator'
import { BambooContext } from '@bamboocss/node'
import { omit, parseJson, pick, stringifyJson, traverse } from '@bamboocss/shared'
import type { Config, LoadConfigResult, UserConfig } from '@bamboocss/types'
import { fixturePreset } from './config'

const hookUtils = {
  omit,
  pick,
  traverse,
}

const defaults: UserConfig = {
  cwd: '',
  outdir: 'styled-system',
  include: [],
  //
  cssVarRoot: ':where(html)',
}
const config = Object.assign({}, fixturePreset, defaults)

export const fixtureDefaults = {
  dependencies: [],
  config,
  path: '',
  hooks: {},
  serialized: stringifyJson(config),
  deserialize: () => parseJson(stringifyJson(config)),
} as LoadConfigResult

/**
 * Whether a test wants a context with none of the fixture defaults.
 *
 * Spelled `presets: []` because that is what it means to a real config now — the list is
 * authoritative, so an empty one loads nothing. It used to be `eject: true`, an option
 * whose whole job was to change what a *different* option meant.
 */
const isBare = (userConfig?: Config) => userConfig?.presets?.length === 0

export const createGeneratorContext = (userConfig?: Config) => {
  const resolvedConfig = mergeConfigs([
    isBare(userConfig) ? {} : fixtureDefaults.config,
    userConfig ?? {},
  ]) as UserConfig

  return new Generator({ ...fixtureDefaults, config: resolvedConfig })
}

export const createContext = (userConfig?: Config & Pick<Partial<LoadConfigResult>, 'tsconfig' | 'tsOptions'>) => {
  let resolvedConfig = mergeConfigs([isBare(userConfig) ? {} : fixtureDefaults.config, userConfig ?? {}]) as UserConfig

  const hooks = userConfig?.hooks ?? {}

  // This allows editing the config before the context is created
  // since this function is only used in tests, we only look at the user hooks
  // not the presets hooks, so that we can keep this fn sync
  if (hooks['config:resolved']) {
    const result = hooks['config:resolved']({
      config: resolvedConfig,
      path: fixtureDefaults.path,
      dependencies: fixtureDefaults.dependencies,
      utils: hookUtils,
    })
    if (result) {
      resolvedConfig = result as UserConfig
    }
  }

  return new BambooContext({
    ...fixtureDefaults,
    hooks: userConfig?.hooks ?? {},
    // Path mappings reach the context through `conf`, not through the config, so a test
    // exercising alias resolution has to supply them here.
    ...(userConfig?.tsOptions ? { tsOptions: userConfig.tsOptions } : {}),
    config: Object.assign({}, defaults, resolvedConfig),
    tsconfig: {
      ...userConfig?.tsconfig,
      // @ts-expect-error
      useInMemoryFileSystem: true,
    },
  })
}

export const createRuleProcessor = (userConfig?: Config) => {
  const ctx = createContext(userConfig)
  return new RuleProcessor(ctx)
}
