// Must stay a fully type-only import: under `verbatimModuleSyntax` an
// `import { type X }` survives as a runtime import, which pulls the plugin
// entry — and its `createSyncFn` call — into this worker's bundle.
import type { ImportResult } from '.'
import { findConfig, loadConfig } from '@bamboocss/config'
import { resolveTsPathPattern } from '@bamboocss/config/ts-path'
import { Generator } from '@bamboocss/generator'
import micromatch from 'micromatch'
import path from 'path'
import { runAsWorker } from 'synckit'

type Options = {
  configPath?: string
  currentFile: string
}

const contextCache: { [configPath: string]: Promise<Generator> } = {}

export type DeprecatedToken =
  | string
  | {
      category: string
      value: string
    }

// Set by this repo's own test suite to the module that builds a Generator from
// the fixture config. Never set for consumers of the published package, which
// ships `dist` only — keying this off NODE_ENV would break anyone linting with
// NODE_ENV=test, since the fixtures are not published.
const testContextModule = process.env.BAMBOO_ESLINT_TEST_CONTEXT

export async function getContext(options: Options) {
  if (testContextModule) {
    const { createGeneratorContext } = await import(testContextModule)
    const context = createGeneratorContext({
      exclude: ['**/Invalid.tsx', '**/bamboo.config.ts'],
      importMap: './bamboo',
      include: ['**/*'],
      jsxFactory: 'styled',
    })
    return context
  } else {
    const configPath = findConfig({
      cwd: options.configPath ?? options.currentFile,
    })

    // The context cache ensures we don't reload the same config multiple times
    if (!contextCache[configPath]) {
      contextCache[configPath] = _getContext(configPath)
    }

    return contextCache[configPath]
  }
}

async function _getContext(configPath: string | undefined) {
  if (!configPath) {
    throw new Error('Invalid config path')
  }

  const cwd = path.dirname(configPath)

  const conf = await loadConfig({ cwd, file: configPath })
  const context = new Generator(conf)

  return context
}

// Refactored to arrow function, removed async
const filterDeprecatedTokens = (context: Generator, tokens: DeprecatedToken[]): DeprecatedToken[] => {
  return tokens.filter((token) => {
    const value = typeof token === 'string' ? token : token.category + '.' + token.value
    return context.utility.tokens.isDeprecated(value)
  })
}

// Refactored to arrow function, removed async
const filterInvalidTokens = (context: Generator, paths: string[]): string[] => {
  return paths.filter((path) => !context.utility.tokens.view.get(path))
}

// Refactored to arrow function, removed async
const getPropertyCategory = (context: Generator, _attribute: string) => {
  const longhand = resolveLongHand(context, _attribute)
  const attribute = longhand || _attribute
  const attributeConfig = context.utility.config[attribute]
  return typeof attributeConfig?.values === 'string' ? attributeConfig.values : undefined
}

// Refactored to arrow function, removed async
const isColorAttribute = (context: Generator, _attribute: string): boolean => {
  const category = getPropertyCategory(context, _attribute)
  return category === 'colors'
}

// Refactored to arrow function, removed async
const isColorToken = (context: Generator, value: string): boolean => {
  return Boolean(context.utility.tokens.view.categoryMap.get('colors')?.get(value))
}

type MatchImportResult = {
  alias: string
  mod: string
  name: string
}

export function run(action: 'filterInvalidTokens', options: Options, paths: string[]): string[]

export function run(action: 'isColorToken', options: Options, value: string): boolean

export function run(action: 'isColorAttribute', options: Options, attribute: string): boolean

export function run(action: 'isValidFile', options: Options): boolean

export function run(action: 'resolveShorthands', options: Options, name: string): string[] | undefined
export function run(action: 'resolveLongHand', options: Options, name: string): string | undefined

export function run(action: 'isValidProperty', options: Options, name: string, patternName?: string): boolean
export function run(action: 'matchFile', options: Options, name: string, imports: ImportResult[]): boolean
export function run(action: 'matchImports', options: Options, result: MatchImportResult): boolean
export function run(action: 'filterImports', options: Options, imports: MatchImportResult[]): MatchImportResult[]
export function run(action: 'getPropCategory', options: Options, property: string): string
export function run(action: 'filterDeprecatedTokens', options: Options, tokens: DeprecatedToken[]): DeprecatedToken[]
export function run(action: 'getJsxFactory', options: Options): string | undefined
export function run(action: string, options: Options, ...args: any[]): any {
  // @ts-expect-error cast
  return runAsync(action, options, ...args)
}

export function runAsync(action: 'filterInvalidTokens', options: Options, paths: string[]): Promise<string[]>
export function runAsync(action: 'isColorToken', options: Options, value: string): Promise<boolean>
export function runAsync(action: 'isColorAttribute', options: Options, attribute: string): Promise<boolean>
export function runAsync(action: 'isValidFile', options: Options, fileName: string): Promise<string>
export function runAsync(action: 'resolveShorthands', options: Options, name: string): Promise<string[] | undefined>
export function runAsync(action: 'resolveLongHand', options: Options, name: string): Promise<string | undefined>

export function runAsync(
  action: 'isValidProperty',
  options: Options,
  name: string,
  patternName?: string,
): Promise<boolean>
export function runAsync(action: 'matchFile', options: Options, name: string, imports: ImportResult[]): Promise<boolean>
export function runAsync(action: 'matchImports', options: Options, result: MatchImportResult): Promise<boolean>
export function runAsync(
  action: 'filterImports',
  options: Options,
  imports: MatchImportResult[],
): Promise<MatchImportResult[]>
export function runAsync(action: 'getPropCategory', options: Options, property: string): Promise<string>
export function runAsync(
  action: 'filterDeprecatedTokens',
  options: Options,
  tokens: DeprecatedToken[],
): Promise<DeprecatedToken[]>
export function runAsync(action: 'getJsxFactory', options: Options): Promise<string | undefined>
export async function runAsync(action: string, options: Options, ...args: any): Promise<any> {
  const context = await getContext(options)

  switch (action) {
    case 'filterDeprecatedTokens':
      // @ts-expect-error cast
      return filterDeprecatedTokens(context, ...args)
    case 'filterImports':
      // @ts-expect-error cast
      return filterImports(context, ...args)
    case 'filterInvalidTokens':
      // @ts-expect-error cast
      return filterInvalidTokens(context, ...args)
    case 'getJsxFactory':
      return getJsxFactory(context)
    case 'getPropCategory':
      // @ts-expect-error cast
      return getPropertyCategory(context, ...args)
    case 'isColorAttribute':
      // @ts-expect-error cast
      return isColorAttribute(context, ...args)
    case 'isColorToken':
      // @ts-expect-error cast
      return isColorToken(context, ...args)
    case 'isValidFile':
      return isValidFile(context, options.currentFile)
    case 'isValidProperty':
      // @ts-expect-error cast
      return isValidProperty(context, ...args)
    case 'matchFile':
      // @ts-expect-error cast
      return matchFile(context, ...args)
    case 'matchImports':
      // @ts-expect-error cast
      return matchImports(context, ...args)
    case 'resolveLongHand':
      // @ts-expect-error cast
      return resolveLongHand(context, ...args)
    case 'resolveShorthands':
      // @ts-expect-error cast
      return resolveShorthands(context, ...args)
  }
}

// Refactored to use micromatch instead of getFiles() for O(1) performance
const isValidFile = (context: Generator, fileName: string): boolean => {
  const { exclude, include } = context.config
  const cwd = context.config.cwd || process.cwd()

  const relativePath = path.isAbsolute(fileName) ? path.relative(cwd, fileName) : fileName

  return micromatch.isMatch(relativePath, include, {
    dot: true,
    ignore: exclude,
  })
}

// Refactored to arrow function, removed async
const isValidProperty = (context: Generator, name: string, patternName?: string) => {
  if (context.isValidProperty(name)) {
    return true
  }

  if (!patternName) {
    return false
  }

  // If the pattern name is the jsxFactory (e.g., 'styled'), we should accept
  // any property that is valid according to the global property check
  // Since styled components are generic wrappers, we don't need pattern-specific checks
  if (patternName === context.config.jsxFactory) {
    // Already checked globally above, so return false if we got here
    return false
  }

  const pattern = context.patterns.details.find((p) => p.baseName === patternName || p.jsx.includes(patternName))
    ?.config.properties
  if (!pattern) {
    return false
  }

  return Object.keys(pattern).includes(name)
}

// Refactored to arrow function, removed async
const matchFile = (context: Generator, name: string, imports: ImportResult[]) => {
  const file = context.imports.file(imports)
  return file.match(name)
}

// Refactored to arrow function, removed async
const matchImports = (context: Generator, result: MatchImportResult) => {
  return context.imports.match(result, (module_) => {
    const { tsOptions } = context.parserOptions
    if (!tsOptions?.pathMappings) {
      return
    }

    return resolveTsPathPattern(tsOptions.pathMappings, module_)
  })
}

// Batch filter imports to reduce worker thread crossings
const filterImports = (context: Generator, imports: MatchImportResult[]): MatchImportResult[] => {
  return imports.filter((imp) =>
    context.imports.match(imp, (module_) => {
      const { tsOptions } = context.parserOptions
      if (!tsOptions?.pathMappings) {
        return
      }

      return resolveTsPathPattern(tsOptions.pathMappings, module_)
    }),
  )
}

// Cache reverse shorthand map per context to avoid O(N) rebuild on every call
const reverseShorthandsMapCache = new WeakMap<Generator, Map<string, string>>()

const getReverseShorthandsMap = (context: Generator): Map<string, string> => {
  let reverseMap = reverseShorthandsMapCache.get(context)
  if (!reverseMap) {
    reverseMap = new Map()
    const shorthands = context.utility.getPropShorthandsMap()
    for (const [key, values] of shorthands) {
      for (const value of values) {
        reverseMap.set(value, key)
      }
    }

    reverseShorthandsMapCache.set(context, reverseMap)
  }

  return reverseMap
}

// Refactored to use cached reverse shorthand map
const resolveLongHand = (context: Generator, name: string): string | undefined => {
  return getReverseShorthandsMap(context).get(name)
}

// Refactored to arrow function, removed async
const resolveShorthands = (context: Generator, name: string): string[] | undefined => {
  return context.utility.getPropShorthandsMap().get(name)
}

const getJsxFactory = (context: Generator): string | undefined => {
  return context.config.jsxFactory
}

runAsWorker(run as any)
