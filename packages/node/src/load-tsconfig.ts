import { convertTsPathsToRegexes } from '@bamboocss/config'
import type { LoadConfigResult, LoadTsConfigResult } from '@bamboocss/types'
import { promises as fs } from 'node:fs'
import path from 'node:path'
import { ts } from 'ts-morph'
import type { TsconfigResolutionProvenance } from './tsconfig-provenance'

import {
  findClosestTsconfig,
  resolveBaseUrlForCompilerOptions,
  resolveDirectTsconfigJson,
  resolveSolutionTsconfigForFile,
} from './tsconfig-utils'

const readPathsFromCache = (cache: Map<string, string>) => {
  const prefix = 'readFileSync:'
  const suffix = ':utf8'
  return Array.from(cache.keys())
    .filter((key) => key.startsWith(prefix) && key.endsWith(suffix))
    .map((key) => key.slice(prefix.length, -suffix.length))
}

/**
 * Exact tsconfig files read while producing one resolved Node config.
 *
 * This metadata is deliberately kept outside `LoadConfigResult`: it is incremental resolver
 * provenance, not Bamboo configuration, and must therefore neither participate in
 * `diffConfigs` nor become part of the public/serialized config shape.
 */
const resolutionFilesByConfig = new WeakMap<object, readonly string[]>()

export const rememberTsConfigResolutionFiles = (conf: LoadConfigResult, files: Iterable<string>) => {
  resolutionFilesByConfig.set(conf, Object.freeze([...new Set(files)].sort()))
}

export const getTsConfigResolutionFiles = (conf: LoadConfigResult): readonly string[] =>
  resolutionFilesByConfig.get(conf) ?? Object.freeze(conf.tsconfigFile ? [path.resolve(conf.tsconfigFile)] : [])

const referencedTsconfigPath = (reference: string, rootPath: string) =>
  path.resolve(path.dirname(rootPath), reference.endsWith('.json') ? reference : path.join(reference, 'tsconfig.json'))

const MAX_TSCONFIG_REFERENCE_FILES = 256

const getImplicitBaseUrl = (compilerOptions: object | undefined) => {
  if (!compilerOptions) return undefined
  const matches = Object.getOwnPropertySymbols(compilerOptions).filter(
    (candidate) => candidate.description === 'implicitBaseUrl',
  )
  if (matches.length !== 1) return undefined
  const symbol = matches[0]!
  const descriptor = Object.getOwnPropertyDescriptor(compilerOptions, symbol)
  if (!descriptor || !('value' in descriptor) || typeof descriptor.value !== 'string') return undefined
  return { owner: compilerOptions, symbol, value: descriptor.value }
}

const collectReferenceGraph = async (
  rootPath: string,
  rootParsed: import('get-tsconfig').TsConfigJsonResolved,
  parseTsconfig: typeof import('get-tsconfig').parseTsconfig,
  cache: Map<string, string>,
) => {
  const references: Array<{ from: string; path: string }> = []
  const unresolvedReferences: string[] = []
  let traversalLimitExceeded = false
  // Reference paths stay lexical deliberately. Two symlink aliases to the same bytes can
  // resolve their own relative references against different directories, so realpath-based
  // deduplication would silently discard one semantic graph.
  const visited = new Set([path.resolve(rootPath)])
  const queue = [{ parsed: rootParsed, path: rootPath }]

  for (let index = 0; index < queue.length; index++) {
    const current = queue[index]!
    for (const reference of current.parsed.references ?? []) {
      const referencedPath = referencedTsconfigPath(reference.path, current.path)
      references.push({ from: current.path, path: referencedPath })

      if (visited.has(referencedPath)) continue
      if (visited.size >= MAX_TSCONFIG_REFERENCE_FILES) {
        traversalLimitExceeded = true
        unresolvedReferences.push(referencedPath)
        continue
      }
      visited.add(referencedPath)
      try {
        const source = await fs.readFile(referencedPath, 'utf8')
        if (ts.parseConfigFileTextToJson(referencedPath, source).error) throw new Error('Invalid tsconfig')
        queue.push({ parsed: parseTsconfig(referencedPath, cache), path: referencedPath })
      } catch {
        unresolvedReferences.push(referencedPath)
      }
    }
  }

  return { references, traversalLimitExceeded, unresolvedReferences }
}

export async function loadTsConfig(
  conf: LoadConfigResult,
  cwd: string,
  provenance?: { value?: TsconfigResolutionProvenance },
  resolutionFiles?: { value?: readonly string[] },
): Promise<LoadTsConfigResult | undefined> {
  const root = cwd

  let tsconfigFile: string | null = await resolveDirectTsconfigJson(conf.path)
  const direct = tsconfigFile !== null
  if (!tsconfigFile) {
    if (resolutionFiles) resolutionFiles.value = Object.freeze([])
    tsconfigFile = await findClosestTsconfig(conf.path, root, 'tsconfig.json')
  }

  if (!tsconfigFile) {
    if (provenance) {
      provenance.value = {
        direct: false,
        readPaths: [],
        references: [],
        traversalLimitExceeded: false,
        unresolvedReferences: [],
      }
    }
    return {
      tsconfig: {},
      tsconfigFile: undefined,
    }
  }

  const gtc = await import('get-tsconfig')
  const cache = new Map<string, string>()
  const rootParsed = gtc.parseTsconfig(tsconfigFile, cache)
  const { tsconfig, tsconfigFile: effectiveTsconfigPath } = await resolveSolutionTsconfigForFile(
    path.resolve(conf.path),
    tsconfigFile,
    rootParsed,
    gtc,
    cache,
  )
  const compilerOptions = tsconfig?.compilerOptions
  const implicitBaseUrl = getImplicitBaseUrl(compilerOptions)

  const result: LoadTsConfigResult = {
    tsconfig,
    tsconfigFile: effectiveTsconfigPath,
  }

  if (resolutionFiles) {
    resolutionFiles.value = Object.freeze(
      [...new Set(readPathsFromCache(cache).map((file) => path.resolve(file)))].sort(),
    )
  }

  if (compilerOptions?.paths) {
    const baseUrl = compilerOptions.baseUrl
    result.tsOptions = {
      baseUrl,
      pathMappings: convertTsPathsToRegexes(
        compilerOptions.paths,
        resolveBaseUrlForCompilerOptions(baseUrl, effectiveTsconfigPath, cwd),
      ),
    }
  }

  if (provenance) {
    const referenceGraph = await collectReferenceGraph(tsconfigFile, rootParsed, gtc.parseTsconfig, cache)
    provenance.value = {
      direct,
      effectivePath: effectiveTsconfigPath,
      implicitBaseUrl,
      readPaths: readPathsFromCache(cache),
      references: referenceGraph.references,
      rootPath: tsconfigFile,
      traversalLimitExceeded: referenceGraph.traversalLimitExceeded,
      unresolvedReferences: referenceGraph.unresolvedReferences,
    }
  }

  return result
}
