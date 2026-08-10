import { loadConfig, mergeHooks } from '@bamboocss/config'
import type { Config, BambooPlugin } from '@bamboocss/types'
import { pluginSvelte } from '@bamboocss/plugin-svelte'
import { pluginVue } from '@bamboocss/plugin-vue'
import { BambooContext } from './create-context'
import { loadTsConfig } from './load-tsconfig'

const RESOLVED_HOOKS_NAME = '__resolved__'

/**
 * Built-in plugins that are auto-injected when using the CLI or PostCSS plugin.
 * These provide Vue/Svelte single-file-component support.
 *
 * LightningCSS is not among them any more. It was reached through a `lightningcss: true`
 * config flag whose only job was to push `pluginLightningcss()` into this list — a second
 * way to say something `plugins` already said, and the expensive one: naming the plugin
 * here meant a static import, which made `@bamboocss/plugin-lightningcss` a hard dependency
 * of this package, which put a native binary in every install whether or not the flag was
 * ever set. List the plugin yourself to use it.
 */
function getAutoPlugins(): BambooPlugin[] {
  return [pluginVue(), pluginSvelte()]
}

/**
 * Load config and create context with auto-injected plugins.
 * Used by the CLI and PostCSS plugin.
 */
export async function loadConfigAndCreateContext(options: { cwd?: string; config?: Config; configPath?: string } = {}) {
  const { config, configPath } = options

  const cwd = options.cwd ?? options?.config?.cwd ?? process.cwd()
  const conf = await loadConfig({ cwd, file: configPath })

  if (config) {
    Object.assign(conf.config, config)
  }

  if (options.cwd) {
    conf.config.cwd = options.cwd
  }

  // Auto plugins run first, then the already-resolved user hooks run after
  const autoPlugins = getAutoPlugins()

  // conf.hooks is already properly merged from user plugins + inline hooks by resolveConfig.
  // Prepend auto-plugins before it — don't re-process user plugins to avoid double-execution.
  conf.hooks = mergeHooks([...autoPlugins, { name: RESOLVED_HOOKS_NAME, hooks: conf.hooks }])
  conf.config.plugins = [...autoPlugins, ...(conf.config.plugins ?? [])]

  const tsConfResult = await loadTsConfig(conf, cwd)

  if (tsConfResult) {
    Object.assign(conf, tsConfResult)
  }

  return new BambooContext(conf)
}
