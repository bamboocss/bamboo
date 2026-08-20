import { logger } from '@bamboocss/logger'
import { BAMBOO_CONFIG_NAME, omit, parseJson, pick, stringifyJson, traverse } from '@bamboocss/shared'
import type { LoadConfigResult, Preset, UserConfig } from '@bamboocss/types'
import { defaultPresets, getBundledPreset } from './bundled-preset'
import { getResolvedConfig } from './get-resolved-config'
import { mergeHooks } from './merge-hooks'
import { attachConfigResolutionProvenance, takeExternalPresets } from './resolution-provenance'
import type { BundleConfigResult } from './types'
import { validateConfig } from './validate-config'

const hookUtils = {
  omit,
  pick,
  traverse,
}

/**
 * The one way this rename can break a config without saying so.
 *
 * `presets` still exists and still takes a list, so nothing in `validate-removed` notices
 * that its meaning changed. A config that listed `[myPreset]` used to get `preset-base`
 * underneath it and now does not — and what `preset-base` carries is the utility table, so
 * the failure is every class name silently changing (`c_red_300` becomes `color_red_300`)
 * rather than an error. That is the shape this codebase treats as the worst upgrade there
 * is, so it gets a message.
 *
 * Skipped for an empty list, which is a deliberate eject and the replacement for
 * `eject: true`. Drop this a release or two after the rename.
 */
function warnIfBaseDropped(listed: unknown[] | undefined, resolved: Preset[]) {
  if (!listed?.length) return
  if (resolved.some((preset) => preset?.name === '@bamboocss/preset-base')) return

  logger.warn(
    'config',
    `\`presets\` is now the complete list, and this one does not include \`@bamboocss/preset-base\` — ` +
      `so its utilities, conditions and patterns are not loaded, and generated class names change. ` +
      `Listing a preset used to keep \`preset-base\` underneath it.\n\n` +
      `  import { defaultPresets } from '@bamboocss/dev/presets'\n` +
      `  presets: [...defaultPresets, yourPreset]\n\n` +
      `If dropping it is deliberate, this is the intended behaviour and the warning goes away once ` +
      `\`preset-base\` is listed explicitly.`,
  )
}

/**
 * Resolve the final config (including presets).
 *
 * `presets` is authoritative: what the config lists is what is loaded, and an unset
 * `presets` loads `defaultPresets`. There is no implicit preset a listed one sits on top
 * of — `eject` used to control that, badly. Under it, listing any preset kept
 * `@bamboocss/preset-base` and silently dropped `@bamboocss/preset-bamboo`, so `presets`
 * was neither additive nor replacing, and `presets: []` meant "base only" rather than
 * "none". Both of those had to be discovered by reading this function.
 */
export async function resolveConfig(result: BundleConfigResult, cwd: string): Promise<LoadConfigResult> {
  const listed = result.config.presets

  result.config.presets = listed
    ? Array.from(new Set(listed.map((preset: any) => getBundledPreset(preset) ?? preset)))
    : [...defaultPresets]

  warnIfBaseDropped(listed, result.config.presets as Preset[])

  // `plugins` is the only source of hooks — a preset cannot carry them — so this is the
  // complete set, not a preliminary one. Merged before `getResolvedConfig` because
  // `preset:resolved` fires during it, and kept off the config object so that a `hooks` key
  // surviving on a config is unambiguously the removed authoring option.
  const hooks = mergeHooks(result.config.plugins ?? [])

  const mergedConfig = await getResolvedConfig(result.config, cwd, hooks)
  const externalPresets = takeExternalPresets(mergedConfig)

  if (mergedConfig.logLevel) {
    logger.level = mergedConfig.logLevel
  }

  if (mergedConfig.logFilter) {
    logger.filter = mergedConfig.logFilter
  }

  validateConfig(mergedConfig as UserConfig)

  const loadConfigResult = {
    ...result,
    config: mergedConfig as any,
  } as LoadConfigResult

  // This allows editing the config before the context is created
  if (hooks['config:resolved']) {
    const result = await hooks['config:resolved']({
      config: loadConfigResult.config,
      path: loadConfigResult.path,
      dependencies: loadConfigResult.dependencies,
      utils: hookUtils,
    })

    if (result) {
      loadConfigResult.config = result
    }
  }

  const serialized = stringifyJson(
    Object.assign({}, loadConfigResult.config, { name: BAMBOO_CONFIG_NAME, presets: [] }),
  )
  const deserialize = () => parseJson(serialized)

  const resolved = { ...loadConfigResult, serialized, deserialize, hooks }

  attachConfigResolutionProvenance(resolved, {
    baseline: { deserialize, serialized },
    bundleDependencies: result.dependencies,
    externalPresets,
  })

  return resolved
}
