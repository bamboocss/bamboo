import { findConfig, getConfigDependencies } from '@bamboocss/config'
import { logger } from '@bamboocss/logger'
import { BambooError, uniq } from '@bamboocss/shared'
import type { DiffConfigResult } from '@bamboocss/types'
import { existsSync, statSync } from 'fs'
import { normalize, resolve } from 'path'
import type { Message, Root } from 'postcss'
import { codegen } from './codegen'
import { loadConfigAndCreateContext } from './config'
import { BambooContext } from './create-context'
import { parseDependency } from './parse-dependency'
import { collectKeyframeReferences, collectTokenReferences, keyframeNames } from './token-references'

const fileModifiedMap = new Map<string, number>()

/**
 * The declaration that says generated css is already present in a root.
 *
 * `generateGlobalCss` emits it unconditionally and `appendBaselineCss` always reaches that
 * artifact, so anything carrying it holds a copy of the sheet however it got there — written
 * by `write` on an earlier pass, or inlined from `styles.css` by `postcss-import`.
 *
 * A declaration rather than a comment because it has to survive the css being minified
 * between the copy landing and this check running, which a comment does not.
 */
const GENERATED_SENTINEL = '--made-with-bamboo'

function hasGeneratedCss(root: Root) {
  let found = false
  root.walkDecls(GENERATED_SENTINEL, () => {
    found = true
  })
  return found
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
    // A root that already holds generated css gets nothing further. `isValidRoot` only reads
    // the `@layer` statement, and that statement is ordinary css -- listing every layer in
    // order is what a project has to write once it has layers of its own beside bamboo's. So
    // a file that both imports `styles.css` and declares the order satisfies the guard while
    // already holding the sheet, and appending gives it a second copy on every build:
    //
    //     @import '#app/styled-system/styles.css';                    <- copy 1, inlined by
    //     @layer reset, base, tokens, recipes, utilities, overrides;     postcss-import first
    //
    // Vite puts `postcss-import` at the front of the chain, so the artifact is already inlined
    // by the time this runs. The duplication then hides: a minifier merges the two `@layer X{}`
    // blocks and dedupes most of the collision, leaving a fraction of it behind -- 11% of one
    // production stylesheet, which reads as a rounding error rather than as the whole sheet
    // twice. Nothing else catches it either, since each copy is internally consistent and only
    // duplicated against the other.
    if (hasGeneratedCss(root)) {
      logger.warn(
        'postcss',
        'Generated css is already present in this file, so nothing was injected. It is imported and generated here at once — keep the `@import` of `styles.css` or the `@layer` statement that the postcss plugin injects at, not both.',
      )
      return
    }

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

    // What this appends carries the sentinel, so a second pass over the same root takes the
    // branch above rather than adding to it.
    root.append(css)
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
