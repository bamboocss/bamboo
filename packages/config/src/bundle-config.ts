import { logger } from '@bamboocss/logger'
import { BambooError } from '@bamboocss/shared'
import type { Config } from '@bamboocss/types'
import { bundleNRequire } from 'bundle-n-require'
import { findConfig } from './find-config'
import type { BundleConfigResult, ConfigFileOptions } from './types'

export async function bundle<T extends Config = Config>(filepath: string, cwd: string) {
  const { mod, dependencies } = await bundleNRequire(filepath, {
    cwd,
    interopDefault: true,
  })

  const config = (mod?.default ?? mod) as T

  return {
    config,
    dependencies,
  }
}

export async function bundleConfig(options: ConfigFileOptions): Promise<BundleConfigResult> {
  const { cwd, file } = options

  const filePath = findConfig({ cwd, file })

  logger.debug('config:path', filePath)

  const result = await bundle(filePath, cwd)

  if (typeof result.config !== 'object') {
    throw new BambooError('CONFIG_ERROR', `💥 Config must export or return an object.`)
  }

  result.config.outdir ??= 'styled-system'
  result.config.validation ??= 'warn'

  return {
    ...result,
    config: result.config,
    path: filePath,
  }
}
