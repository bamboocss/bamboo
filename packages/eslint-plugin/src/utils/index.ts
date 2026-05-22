import { type run } from './worker'
import { ESLintUtils } from '@typescript-eslint/utils'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createSyncFn } from 'synckit'

// Rule creator
export const createRule = ESLintUtils.RuleCreator(
  (name) => `https://github.com/bamboocss/bamboo/blob/main/packages/eslint-plugin/docs/rules/${name}.md`,
)

// Determine the distribution directory
const isBase = process.env.NODE_ENV !== 'test' || import.meta.url.endsWith('dist/index.js')

const distDir = fileURLToPath(new URL(isBase ? './' : '../../dist', import.meta.url))

// Create synchronous function using synckit
const _syncAction = createSyncFn(join(distDir, 'utils/worker.mjs'))

// Define syncAction with proper typing and error handling
const cache = new Map<string, any>()

export const syncAction = ((...args: Parameters<typeof run>) => {
  // Generate cache key from arguments
  const cacheKey = JSON.stringify(args)

  // Return cached result if exists
  if (cache.has(cacheKey)) {
    return cache.get(cacheKey)
  }

  try {
    const result = _syncAction(...args)
    // Store result in cache
    cache.set(cacheKey, result)
    return result
  } catch (error) {
    console.error('syncAction error:', error)
    return undefined
  }
}) as typeof run

export type ImportResult = {
  alias: string
  importMapValue?: string
  mod: string
  name: string
}
