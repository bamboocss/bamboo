import { findConfig, getConfigDependencies } from '@bamboocss/config'
import { prunesPreflight } from '@bamboocss/core'
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
import {
  collectKeyframeReferences,
  collectRenderedElements,
  keyframeNames,
  pruneTokensForBuild,
} from './token-references'

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
    const ctx = this.getContextOrThrow()

    const hasConfigChanged = this.affecteds ? this.affecteds.hasConfigChanged : true
    if (!this.filesMeta && !hasConfigChanged) {
      logger.debug('builder', 'No files or config changed, skipping extract')
      // Still asserted. A file that failed to extract on an earlier pass is not re-parsed by
      // one that skips it, so the failure has to outlive the pass that recorded it or a
      // no-op rebuild would launder a broken build into a green one. No file list to hand it:
      // this branch globbed nothing, and `assertExtracted` only reaches for one when there is
      // a failure to place.
      return ctx.assertExtracted()
    }

    const files = ctx.getFiles()

    const done = logger.time.info('Extracted in')

    files.map((file) => this.extractFile(ctx, file))

    done()

    // After `done()`, so the timing line still reports the pass that just ran rather than
    // being swallowed by the throw. Handed the list this pass walked, so it does not glob
    // a second time to ask which files still exist.
    ctx.assertExtracted(files)
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

    // What this appends carries the sentinel, so a second pass over the same root takes the
    // branch above rather than adding to it.
    root.append(this.toCss())
  }

  /**
   * The finished stylesheet, as a string.
   *
   * The same sheet `write` injects into a postcss root, for callers that want the css
   * rather than a mutated root -- the vite plugin serves it as a virtual module. Both go
   * through here so a build cannot depend on which integration asked for it.
   *
   * `layerParams` is the one thing that differs between them, and it is not cosmetic: the
   * `@layer a, b, c;` statement is what fixes layer *order*, and css layers are ordered by
   * first appearance otherwise. `write` leaves it out because the root it appends to is a
   * file that already declares it -- that declaration is what `isValidRoot` matches on. A
   * virtual module is the whole stylesheet and has nothing to inherit it from.
   *
   * `extract` has to have run first: this reads the encoder rather than filling it.
   */
  toCss = ({ layerParams = false }: { layerParams?: boolean } = {}) => {
    const ctx = this.getContextOrThrow()
    const sheet = ctx.createSheet()
    if (layerParams) ctx.appendLayerParams(sheet)
    ctx.appendBaselineCss(sheet)

    // `extract` has already run, so this sheet carries the utilities and recipes too.
    // Parser results are not retained across that call, so the reference set comes from
    // the source scan alone; re-parsing here would encode every style a second time.
    pruneTokensForBuild(ctx, sheet, [])

    if (prunesPreflight(ctx.config.preflight)) {
      ctx.prunePreflight(sheet, collectRenderedElements(ctx))
    }

    if (ctx.config.prune?.keyframes) {
      ctx.pruneKeyframes(sheet, collectKeyframeReferences(ctx, keyframeNames(ctx)))
    }

    return ctx.getCss(sheet)
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
