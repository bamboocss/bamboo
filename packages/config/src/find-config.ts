import { BambooError } from '@bamboocss/shared'
import findUp from 'escalade/sync'
import { resolve } from 'path'
import { isBambooConfig } from './is-bamboo-config'
import type { ConfigFileOptions } from './types'

export function findConfig(options: Partial<ConfigFileOptions>): string {
  const { cwd = process.cwd(), file } = options

  if (file) {
    return resolve(cwd, file)
  }

  const configPath = findUp(cwd, (_dir, paths) => paths.find(isBambooConfig))

  if (!configPath) {
    throw new BambooError(
      'CONFIG_NOT_FOUND',
      `Cannot find config file \`bamboo.config.{ts,js,mjs,mts}\`. Did you forget to run \`bamboo init\`?`,
    )
  }

  return configPath
}
