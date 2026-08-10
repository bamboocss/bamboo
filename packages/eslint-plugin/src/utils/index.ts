import { type run } from './worker'
import { ESLintUtils } from '@typescript-eslint/utils'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createSyncFn } from 'synckit'

// Rule creator
export const createRule = ESLintUtils.RuleCreator(
  (name) => `https://github.com/gajus/bamboocss/blob/main/packages/eslint-plugin/docs/rules/${name}.md`,
)

// Determine the distribution directory. Under test the plugin is loaded from
// `src/utils/index.ts`, so the built worker sits two levels up in `dist`; when
// published it is `dist/index.mjs` alongside `dist/utils`. Deriving this from
// the module URL keeps it independent of NODE_ENV, which consumers may set.
const isSourceRun = import.meta.url.endsWith('/src/utils/index.ts')

const distDir = fileURLToPath(new URL(isSourceRun ? '../../dist' : './', import.meta.url))

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
