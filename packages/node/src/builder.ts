import { findConfig, getConfigDependencies } from '@bamboocss/config'
import { logger } from '@bamboocss/logger'
import { BambooError, uniq } from '@bamboocss/shared'
import type { DiffConfigResult } from '@bamboocss/types'
import { existsSync, statSync } from 'fs'
import { normalize, resolve } from 'path'
import postcss, { type Message, type Root } from 'postcss'
import { codegen } from './codegen'
import { loadConfigAndCreateContext } from './config'
import { BambooContext } from './create-context'
import { parseDependency } from './parse-dependency'
import { collectKeyframeReferences, collectTokenReferences, keyframeNames } from './token-references'

const fileModifiedMap = new Map<string, number>()

/**
 * Bracket the css `write` injects, so a second pass replaces it instead of adding to it.
 *
 * Comments rather than a node flag: the root can be stringified and re-parsed between two
 * plugins in the same chain, and nothing on the node itself survives that round trip.
 */
const INJECTED_START = 'bamboocss:start'
const INJECTED_END = 'bamboocss:end'

/**
 * Remove a previously injected block, markers included.
 *
 * Bounded by the end marker rather than running to the end of the root, so anything a later
 * plugin appended after the injection is left where it is. A start marker with no end -- the
 * shape a minifier that strips comments unevenly could leave behind -- removes nothing,
 * which is the safe direction: a duplicate is a size problem, dropping a user's css is not.
 */
function dropPreviousInjection(root: Root) {
  const nodes = root.nodes ?? []
  const start = nodes.findIndex((n) => n.type === 'comment' && n.text === INJECTED_START)
  if (start < 0) return

  const end = nodes.findIndex((n, i) => i > start && n.type === 'comment' && n.text === INJECTED_END)
  if (end < 0) return

  for (const node of nodes.slice(start, end + 1)) node.remove()
}

interface FileChanges {
  changes: Map<string, FileMeta>
  hasFilesChanged: boolean
}

export class Builder {
  /**
   * The current bamboo context
   */
  context: BambooContext | undefined

  private hasEmitted = false
  private filesMeta: FileChanges | undefined
  private explicitDepsMeta: FileChanges | undefined
  private affecteds: DiffConfigResult | undefined
  private configDependencies: Set<string> = new Set()

  setConfigDependencies(options: SetupContextOptions) {
    const tsOptions = this.context?.conf.tsOptions ?? { baseUrl: undefined, pathMappings: [] }
    const compilerOptions = this.context?.conf.tsconfig?.compilerOptions ?? {}

    const { deps: foundDeps } = getConfigDependencies(options.configPath, tsOptions, compilerOptions)
    const cwd = options?.cwd ?? this.context?.config.cwd ?? process.cwd()

    const configDeps = new Set([
      ...foundDeps,
      ...(this.context?.conf.dependencies ?? []).map((file) => resolve(cwd, file)),
    ])

    configDeps.forEach((file) => {
      this.configDependencies.add(file)
    })

    logger.debug('builder', 'Config dependencies')
    logger.debug('builder', configDeps)
  }

  setup = async (options: { configPath?: string; cwd?: string } = {}) => {
    logger.debug('builder', '🚧 Setup')

    const configPath = options.configPath ?? findConfig({ cwd: options.cwd })
    this.setConfigDependencies({ configPath, cwd: options.cwd })

    if (!this.context) {
      return this.setupContext({ configPath, cwd: options.cwd })
    }

    const ctx = this.getContextOrThrow()

    this.affecteds = await ctx.diff.reloadConfigAndRefreshContext((conf) => {
      this.context = new BambooContext(conf)
    })

    logger.debug('builder', this.affecteds)

    // explicit config dependencies change
    this.explicitDepsMeta = this.checkFilesChanged(this.context.explicitDeps)

    if (this.explicitDepsMeta.hasFilesChanged) {
      this.explicitDepsMeta.changes.forEach((meta, file) => {
        fileModifiedMap.set(file, meta.mtime)
      })

      logger.debug('builder', '⚙️ Explicit config dependencies changed')
      this.affecteds.hasConfigChanged = true
    }

    // config change
    if (this.affecteds.hasConfigChanged) {
      logger.debug('builder', '⚙️ Config changed, reloading')
      await ctx.hooks['config:change']?.({ config: ctx.config, changes: this.affecteds })
      return
    }

    // file changes
    this.filesMeta = this.checkFilesChanged(ctx.getFiles())
    if (this.filesMeta.hasFilesChanged) {
      logger.debug('builder', 'Files changed, invalidating them')
      ctx.project.reloadSourceFiles()
    }
  }

  async emit() {
    // ensure emit is only called when the config is changed
    if (this.hasEmitted && this.affecteds?.hasConfigChanged) {
      logger.debug('builder', 'Emit artifacts after config change')
      await codegen(this.getContextOrThrow(), Array.from(this.affecteds.artifacts))
    }

    this.hasEmitted = true
  }

  setupContext = async (options: SetupContextOptions) => {
    const { configPath, cwd } = options

    const ctx = await loadConfigAndCreateContext({ configPath, cwd })

    const configDeps = uniq([...ctx.conf.dependencies, ...ctx.explicitDeps])

    configDeps.forEach((file) => {
      this.configDependencies.add(resolve(cwd || ctx.conf.config.cwd, file))
    })

    this.context = ctx
    return ctx
  }

  getContextOrThrow = (): BambooContext => {
    if (!this.context) {
      throw new BambooError('NO_CONTEXT', 'context not loaded')
    }
    return this.context
  }

  getFileMeta = (file: string) => {
    const mtime = existsSync(file) ? statSync(file).mtimeMs : -Infinity
    const isUnchanged = fileModifiedMap.has(file) && mtime === fileModifiedMap.get(file)
    return { mtime, isUnchanged }
  }

  checkFilesChanged(files: string[]) {
    const changes = new Map<string, FileMeta>()

    let hasFilesChanged = false

    for (const file of files) {
      const meta = this.getFileMeta(file)
      changes.set(file, meta)
      if (!meta.isUnchanged) {
        hasFilesChanged = true
      }
    }

    return { changes, hasFilesChanged }
  }

  extractFile = (ctx: BambooContext, file: string) => {
    const meta = this.filesMeta?.changes.get(file) ?? this.getFileMeta(file)

    const hasConfigChanged = this.affecteds ? this.affecteds.hasConfigChanged : true
    if (meta.isUnchanged && !hasConfigChanged) return

    const parserResult = ctx.parseFile(file)
    fileModifiedMap.set(file, meta.mtime)

    return parserResult
  }

  extract = () => {
    const hasConfigChanged = this.affecteds ? this.affecteds.hasConfigChanged : true
    if (!this.filesMeta && !hasConfigChanged) {
      logger.debug('builder', 'No files or config changed, skipping extract')
      return
    }

    const ctx = this.getContextOrThrow()
    const files = ctx.getFiles()

    const done = logger.time.info('Extracted in')

    files.map((file) => this.extractFile(ctx, file))

    // Every path reaches here — the PostCSS plugin, `cssgen`, `generate` — and the groups
    // are known as soon as extraction is. Writing it alongside the CSS instead would miss
    // the PostCSS plugin, which never writes a stylesheet to disk.
    ctx.writeGroupRegistry()

    done()
  }

  isValidRoot = (root: Root) => {
    const ctx = this.getContextOrThrow()
    let valid = false

    root.walkAtRules('layer', (rule) => {
      if (ctx.isValidLayerParams(rule.params)) {
        valid = true
      }
    })

    return valid
  }

  write = (root: Root) => {
    const ctx = this.getContextOrThrow()
    const sheet = ctx.createSheet()
    ctx.appendBaselineCss(sheet)

    // `extract` has already run, so this sheet carries the utilities and recipes too.
    // Parser results are not retained across that call, so the reference set comes from
    // the source scan alone; re-parsing here would encode every style a second time.
    // Opting out still prunes the `@property` registrations; see `generate.ts`.
    if (ctx.config.pruneUnusedTokens) {
      ctx.pruneTokens(sheet, collectTokenReferences(ctx, []))
    } else {
      ctx.pruneTokens(sheet)
    }

    if (ctx.config.pruneUnusedKeyframes) {
      ctx.pruneKeyframes(sheet, collectKeyframeReferences(ctx, keyframeNames(ctx)))
    }

    const css = ctx.getCss(sheet)

    // Replace a previous injection rather than adding to it. `write` appends, and what it
    // appends contains the `@layer` declaration that `isValidRoot` looks for -- so the guard
    // deciding whether to inject is satisfied by the result of injecting. A root that
    // reaches this twice, which a duplicated plugin registration or a chain that re-processes
    // the emitted css both do, otherwise accumulates a full copy each time: 101 rules become
    // 201, and nothing downstream takes them apart again, because each copy is internally
    // consistent and only duplicated against the other.
    dropPreviousInjection(root)

    root.append(postcss.comment({ text: INJECTED_START }))
    root.append(css)
    root.append(postcss.comment({ text: INJECTED_END }))
  }

  registerDependency = (fn: (dep: Message) => void) => {
    const ctx = this.getContextOrThrow()

    for (const fileOrGlob of ctx.config.include) {
      const dependency = parseDependency(fileOrGlob)
      if (dependency) fn(dependency)
    }

    for (const file of this.configDependencies) {
      fn({ type: 'dependency', file: normalize(resolve(file)) })
    }
  }
}

interface FileMeta {
  mtime: number
  isUnchanged: boolean
}

interface SetupContextOptions {
  configPath: string
  cwd?: string
}
