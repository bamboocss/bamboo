import { diffConfigs, loadConfig } from '@bamboocss/config'
import { Generator } from '@bamboocss/generator'
import type { Config, LoadConfigResult } from '@bamboocss/types'
import { getTsConfigResolutionFiles, loadTsConfig, rememberTsConfigResolutionFiles } from './load-tsconfig'

const applyTsConfig = (conf: LoadConfigResult, next: Awaited<ReturnType<typeof loadTsConfig>>) => {
  // Assign every field, including `undefined`: a removed tsconfig must retract the previous
  // paths/baseUrl rather than leaving them attached to the otherwise fresh Bamboo config.
  conf.tsconfig = next?.tsconfig ?? {}
  conf.tsconfigFile = next?.tsconfigFile
  conf.tsOptions = next?.tsOptions
}

export class DiffEngine {
  private prevConfig: Config | undefined

  constructor(private ctx: Generator) {
    this.prevConfig = ctx.conf.deserialize()
  }

  /**
   * Reload config from disk and refresh the context
   */
  async reloadConfigAndRefreshContext(fn?: (conf: LoadConfigResult) => void) {
    const conf = await loadConfig({ cwd: this.ctx.config.cwd, file: this.ctx.conf.path })
    const resolutionFiles: { value?: readonly string[] } = {}
    const tsconfig = await loadTsConfig(conf, conf.config.cwd || this.ctx.config.cwd, undefined, resolutionFiles)
    applyTsConfig(conf, tsconfig)
    rememberTsConfigResolutionFiles(conf, resolutionFiles.value ?? [])

    const affected = this.refresh(conf, fn)
    if (!affected.hasConfigChanged) {
      // Keep the existing Context/encoder when only TypeScript resolution changed. Builder
      // invalidates the exact semantic owners after comparing the recorded config bytes.
      applyTsConfig(this.ctx.conf, tsconfig)
      rememberTsConfigResolutionFiles(this.ctx.conf, resolutionFiles.value ?? [])
    }
    return affected
  }

  /** @internal Exact tsconfig files behind the currently attached resolution options. */
  getResolutionConfigFiles = (): readonly string[] => getTsConfigResolutionFiles(this.ctx.conf)

  /**
   * Update the context from the refreshed config
   * then persist the changes on each affected engines
   * Returns the list of affected artifacts/engines
   */
  refresh(conf: LoadConfigResult, fn?: (conf: LoadConfigResult) => void) {
    const affected = diffConfigs(() => conf.deserialize(), this.prevConfig)

    if (!affected.hasConfigChanged || !this.prevConfig) return affected

    fn?.(conf)
    this.prevConfig = conf.deserialize()

    return affected
  }
}
