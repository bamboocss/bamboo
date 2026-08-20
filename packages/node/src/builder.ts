import { findConfig, getConfigDependencies } from '@bamboocss/config'
import { prunesPreflight } from '@bamboocss/core'
import { logger } from '@bamboocss/logger'
import { BambooError, uniq } from '@bamboocss/shared'
import type { DiffConfigResult } from '@bamboocss/types'
import { createHash } from 'node:crypto'
import { existsSync, readFileSync, statSync } from 'fs'
import { normalize, resolve } from 'path'
import type { Message, Root } from 'postcss'
import { codegen } from './codegen'
import { loadConfigAndCreateContext } from './config'
import { BambooContext } from './create-context'
import { parseDependency } from './parse-dependency'
import { collectSourceScans, createSourceScanCache, keyframeNames, pruneTokensForBuild } from './token-references'

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
  private pendingConfigCrawl: SetupContextOptions | undefined
  /** Last complete included inventory, including members which have since been deleted. */
  private sourceInventory: string[] | undefined
  /** Existing included owners selected by the last resolution-ledger invalidation pass. */
  private affectedFiles: Set<string> | undefined
  /** Dependency-before-importer parse order for the selected owners. */
  private extractionOrder: string[] | undefined
  /** Exact cross-file semantic reads retained per included extraction owner. */
  private resolutionReadSets = new Map<string, readonly string[]>()
  /** Previously semantic paths which are absent, retained only while their owner is unchanged. */
  private pendingResolutionReadSets = new Map<string, readonly string[]>()
  /** Missing local priority candidates which can redirect a current semantic resolution. */
  private resolutionCandidateSets = new Map<string, readonly string[]>()
  /** Exact resolver configuration reads retained per included semantic owner. */
  private resolutionConfigurationSets = new Map<string, readonly string[]>()
  /** Byte snapshots for resolver configuration files, independent of filesystem mtimes. */
  private resolutionConfigurationBytes = new Map<string, string | undefined>()
  /** Previous effective tsconfig read-set, needed to classify its deletion as an option reload. */
  private tsconfigResolutionFiles: readonly string[] = []
  /** Config-graph mtimes as of the last completed setup, consulted by the dev fast path. */
  private configGraphMtimes: Map<string, number> | undefined
  /** Per-file source-scan results for `toCss`, valid while each file's mtime stands still. */
  private sourceScanCache = createSourceScanCache()
  /** Cross-file value reads each owner's last extraction performed, with parse-time digests. */
  private extractionReadsByOwner = new Map<
    string,
    ReadonlyArray<{ file: string; name: string; digest: string | undefined }>
  >()
  /** Each owner's recipe surface — declared cva/sva configs plus export-statement texts. */
  private recipeSurfaceByOwner = new Map<string, string | undefined>()
  /** Whether each file changed this pass kept its recipe surface; consulted by dependents. */
  private recipeSurfaceStable = new Map<string, boolean>()
  /** Files this pass re-extracts because their bytes moved, as `sourcePath` spellings. */
  private changedThisPass = new Set<string>()
  /** Whether this pass selected any owner through resolution-configuration changes. */
  private resolutionAffectedThisPass = false
  /** Per-pass digests of re-read values, so N dependents of one edit digest each value once. */
  private readDigestMemo = new Map<string, string | undefined>()

  /** @internal Current and missing resolver paths which can change the stylesheet. */
  getResolutionReadFiles = (): readonly string[] => {
    const files = new Set<string>()
    for (const readSets of [this.resolutionReadSets, this.pendingResolutionReadSets, this.resolutionCandidateSets]) {
      for (const dependencies of readSets.values()) {
        for (const dependency of dependencies) files.add(dependency)
      }
    }
    return Object.freeze([...files].sort())
  }

  /** @internal Exact local package/tsconfig files which can change semantic resolution. */
  getResolutionConfigurationFiles = (): readonly string[] => {
    const files = new Set<string>()
    for (const configurations of this.resolutionConfigurationSets.values()) {
      for (const configuration of configurations) files.add(configuration)
    }
    return Object.freeze([...files].sort())
  }

  private readResolutionConfiguration = (file: string): string | undefined => {
    try {
      return readFileSync(file).toString('base64')
    } catch (error) {
      if ((error as NodeJS.ErrnoException)?.code === 'ENOENT') return undefined
      throw error
    }
  }

  private changedResolutionConfigurations = (): string[] =>
    this.getResolutionConfigurationFiles().filter(
      (file) => this.resolutionConfigurationBytes.get(file) !== this.readResolutionConfiguration(file),
    )

  private snapshotResolutionConfigurations = () => {
    const current = new Set(this.getResolutionConfigurationFiles())
    for (const file of current) this.resolutionConfigurationBytes.set(file, this.readResolutionConfiguration(file))
    for (const file of this.resolutionConfigurationBytes.keys()) {
      if (!current.has(file)) this.resolutionConfigurationBytes.delete(file)
    }
  }

  /**
   * Remember what to crawl; do not crawl yet.
   *
   * The crawl walks the config's own import graph, and resolving a bare specifier there loads a
   * whole TypeScript compiler. Only `registerDependency` reads the result, and only the PostCSS
   * plugin calls that — the CLI and the Vite plugin (which crawls separately, when it watches)
   * paid ~155ms of compiler load per build for a set neither of them ever read.
   */
  setConfigDependencies(options: SetupContextOptions) {
    this.pendingConfigCrawl = options

    const cwd = options?.cwd ?? this.context?.config.cwd ?? process.cwd()
    for (const file of this.context?.conf.dependencies ?? []) this.configDependencies.add(resolve(cwd, file))
  }

  /** Crawl on first read, once per `setConfigDependencies`. */
  private crawlConfigDependencies() {
    const options = this.pendingConfigCrawl
    if (!options) return
    this.pendingConfigCrawl = undefined

    const tsOptions = this.context?.conf.tsOptions ?? { baseUrl: undefined, pathMappings: [] }
    const compilerOptions = this.context?.conf.tsconfig?.compilerOptions ?? {}
    const { deps } = getConfigDependencies(options.configPath, tsOptions, compilerOptions)
    deps.forEach((file) => this.configDependencies.add(file))

    logger.debug('builder', 'Config dependencies')
    logger.debug('builder', deps)
  }

  setup = async (options: { configPath?: string; cwd?: string; dev?: boolean } = {}) => {
    logger.debug('builder', '🚧 Setup')

    const configPath = options.configPath ?? findConfig({ cwd: options.cwd })
    this.setConfigDependencies({ configPath, cwd: options.cwd })

    if (!this.context) {
      return this.setupContext({ configPath, cwd: options.cwd, dev: options.dev })
    }

    const ctx = this.getContextOrThrow()
    const previousTsconfigFiles = this.tsconfigResolutionFiles.length
      ? this.tsconfigResolutionFiles
      : ctx.diff.getResolutionConfigFiles()

    /**
     * Dev fast path: skip the config reload when nothing that can change the resolved config
     * has moved on disk.
     *
     * `reloadConfigAndRefreshContext` re-bundles and re-evaluates the config file and the
     * tsconfig chain on every call, and a dev server reaches `setup` on every stylesheet
     * rebuild — that is 10–18ms paid per source edit for a config that cannot have changed,
     * since editing the config restarts the dev server outside this method's control anyway.
     * The guard set is exactly what the reload would re-read: the config file, its bundled
     * import graph, the explicit `dependencies`, and the tsconfig files behind resolution. Any
     * of them moving — including appearing or disappearing, which `getFileMeta` reports as a
     * changed mtime — takes the full reload below, as does a file the last snapshot never saw.
     *
     * Dev-only because the reload is also the recovery for edits this guard cannot see — a
     * preset external to the config bundle — and a one-shot build keeps paying the reload
     * rather than trading that recovery for a latency only watch mode feels.
     */
    if (options.dev && this.configGraphUnchanged(configPath)) {
      this.affecteds = { artifacts: new Set(), hasConfigChanged: false, diffs: [] }
      this.explicitDepsMeta = this.checkFilesChanged(this.context.explicitDeps)
      this.refreshSourceState(ctx, previousTsconfigFiles)
      return
    }

    this.affecteds = await ctx.diff.reloadConfigAndRefreshContext((conf) => {
      this.context = new BambooContext(conf)
    })
    this.tsconfigResolutionFiles = this.getContextOrThrow().diff.getResolutionConfigFiles()

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
      this.filesMeta = undefined
      this.affectedFiles = undefined
      this.extractionOrder = undefined
      this.sourceInventory = undefined
      this.resolutionReadSets.clear()
      this.pendingResolutionReadSets.clear()
      this.resolutionCandidateSets.clear()
      this.resolutionConfigurationSets.clear()
      this.resolutionConfigurationBytes.clear()
      this.sourceScanCache.entries.clear()
      this.extractionReadsByOwner.clear()
      this.recipeSurfaceByOwner.clear()
      await ctx.hooks['config:change']?.({ config: ctx.config, changes: this.affecteds })
      this.snapshotConfigGraphMtimes(configPath)
      return
    }

    this.refreshSourceState(ctx, previousTsconfigFiles)
    this.snapshotConfigGraphMtimes(configPath)
  }

  /** Every file whose content participates in the resolved config, for the dev fast path. */
  private configGraphFiles = (configPath: string | undefined): string[] =>
    uniq(
      [
        ...(configPath ? [configPath] : []),
        ...this.configDependencies,
        ...this.tsconfigResolutionFiles,
        ...(this.context?.explicitDeps ?? []),
      ].map(normalize),
    )

  private configGraphUnchanged = (configPath: string | undefined): boolean => {
    const snapshot = this.configGraphMtimes
    if (!snapshot) return false
    for (const file of this.configGraphFiles(configPath)) {
      const recorded = snapshot.get(file)
      if (recorded === undefined || recorded !== this.getFileMeta(file).mtime) return false
    }
    return true
  }

  private snapshotConfigGraphMtimes = (configPath: string | undefined) => {
    const snapshot = new Map<string, number>()
    for (const file of this.configGraphFiles(configPath)) snapshot.set(file, this.getFileMeta(file).mtime)
    this.configGraphMtimes = snapshot
  }

  /** The per-pass source bookkeeping every setup ends with, config reload or not. */
  private refreshSourceState = (ctx: BambooContext, previousTsconfigFiles: readonly string[]) => {
    const changedResolutionConfigurations = this.changedResolutionConfigurations()
    const changedResolutionSet = new Set(changedResolutionConfigurations)
    const resolutionAffected = new Set<string>()
    const resolutionLedger = changedResolutionConfigurations.length ? ctx.project.getResolutionLedger() : undefined
    for (const [owner, configurations] of this.resolutionConfigurationSets) {
      if (configurations.some((file) => changedResolutionSet.has(file))) resolutionAffected.add(owner)
    }
    this.resolutionAffectedThisPass = resolutionAffected.size > 0

    if (changedResolutionConfigurations.length) {
      const tsconfigCandidates = new Set([...previousTsconfigFiles, ...this.tsconfigResolutionFiles])
      const replaceCompilerOptions = changedResolutionConfigurations.some((file) => tsconfigCandidates.has(file))
      ctx.project.refreshResolutionConfiguration(
        ctx.conf.tsconfig?.compilerOptions,
        this.tsconfigResolutionFiles,
        replaceCompilerOptions,
      )
    }

    // Source edits are invalidated from the Project's exact resolution read-set. `include`
    // alone misses a plain-object helper outside the glob; the previous inventory alone misses
    // a newly added member; the current inventory alone misses a deletion.
    const inventory = ctx.getFiles()
    const previousInventory = this.sourceInventory ?? inventory
    const tracked = uniq([...previousInventory, ...inventory, ...this.getResolutionReadFiles()])
    this.filesMeta = this.checkFilesChanged(tracked)
    if (this.filesMeta.hasFilesChanged) {
      logger.debug('builder', 'Files changed, invalidating them')
      this.invalidateChangedSources(ctx, inventory, resolutionAffected, resolutionLedger)
    } else if (changedResolutionConfigurations.length) {
      ctx.encoder?.reconcileFileOwnerOrder('extract', inventory)
      this.extractionOrder = this.orderAffectedFiles(inventory, resolutionAffected, resolutionLedger ?? [], [])
      this.affectedFiles = new Set(this.extractionOrder.map(this.sourcePath))
    } else {
      this.affectedFiles = new Set()
      this.extractionOrder = []
    }
    this.sourceInventory = [...inventory]
  }

  /** Normalize the path identity shared by the Project ledger and file-owner keys. */
  private sourcePath = (file: string) => file.replaceAll('\\', '/')

  /**
   * Reload only changed ledger members, then select their transitive included consumers.
   *
   * The dependency graph is snapshotted before mutation: reloading an importer retracts its
   * old forward edges, while deletion removes the target. Waiting until afterwards loses the
   * very closure the rebuild needs. New targets also select every pending importer and each
   * pending importer's dependent closure, because no edge to the new path existed yet.
   */
  private invalidateChangedSources = (
    ctx: BambooContext,
    inventory: string[],
    seededAffected: ReadonlySet<string> = new Set(),
    previousLedger?: ReturnType<BambooContext['project']['getResolutionLedger']>,
  ) => {
    const project = ctx.project
    const current = new Set(inventory.map(this.sourcePath))
    const changed = [...(this.filesMeta?.changes ?? [])]
      .filter(([, meta]) => !meta.isUnchanged)
      .map(([file]) => this.sourcePath(file))
    const ledger = previousLedger ?? project.getResolutionLedger()
    const pending = project.getUnresolvedImporters().map(this.sourcePath)
    const affected = new Set<string>(seededAffected)
    const added: string[] = []

    for (const file of changed) {
      if (current.has(file)) affected.add(file)
      for (const dependent of project.getDependents(file)) affected.add(this.sourcePath(dependent))

      if (existsSync(file) && !project.getSourceFile(file)) added.push(file)
    }

    // Snapshot this before createSourceFile reparses resolution candidates and clears the
    // pending bit. Every pending importer can have consumers of its own.
    if (added.length) {
      for (const importer of pending) {
        affected.add(importer)
        for (const dependent of project.getDependents(importer)) affected.add(this.sourcePath(dependent))
      }
    }

    for (const file of changed) {
      if (!existsSync(file)) {
        project.removeSourceFile(file)
        fileModifiedMap.set(file, -Infinity)
      } else if (project.getSourceFile(file)) {
        project.reloadSourceFile(file)
      } else {
        project.createSourceFile(file)
      }
    }

    // Rank all current owners before committing any newly added contribution. This separates
    // semantic output order from discovery/parse completion order.
    ctx.encoder?.reconcileFileOwnerOrder('extract', inventory)

    const syntheticEdges = added.flatMap((target) => pending.map((importer) => [target, importer] as const))
    this.extractionOrder = this.orderAffectedFiles(inventory, affected, ledger, syntheticEdges)
    this.affectedFiles = new Set(this.extractionOrder.map(this.sourcePath))
  }

  /** Deterministic topological order, with current inventory order as the stable tie-break. */
  private orderAffectedFiles = (
    inventory: string[],
    affected: ReadonlySet<string>,
    ledger: ReturnType<BambooContext['project']['getResolutionLedger']>,
    syntheticEdges: readonly (readonly [string, string])[],
  ) => {
    const files = inventory.filter((file) => affected.has(this.sourcePath(file)))
    const byPath = new Map(files.map((file) => [this.sourcePath(file), file]))
    const inventoryRank = new Map(files.map((file, index) => [this.sourcePath(file), index]))
    const outgoing = new Map<string, Set<string>>()
    const indegree = new Map(files.map((file) => [this.sourcePath(file), 0]))

    const addEdge = (rawTarget: string | null, rawImporter: string) => {
      if (!rawTarget) return
      const target = this.sourcePath(rawTarget)
      const importer = this.sourcePath(rawImporter)
      if (target === importer || !byPath.has(target) || !byPath.has(importer)) return
      const importers = outgoing.get(target) ?? new Set<string>()
      if (importers.has(importer)) return
      importers.add(importer)
      outgoing.set(target, importers)
      indegree.set(importer, (indegree.get(importer) ?? 0) + 1)
    }

    for (const fact of ledger) addEdge(fact.target, fact.importer)
    for (const [target, importer] of syntheticEdges) addEdge(target, importer)

    const compare = (left: string, right: string) => (inventoryRank.get(left) ?? 0) - (inventoryRank.get(right) ?? 0)
    const ready = [...indegree]
      .filter(([, degree]) => degree === 0)
      .map(([file]) => file)
      .sort(compare)
    const ordered: string[] = []
    while (ready.length) {
      const file = ready.shift()!
      ordered.push(file)
      for (const importer of [...(outgoing.get(file) ?? [])].sort(compare)) {
        const next = (indegree.get(importer) ?? 0) - 1
        indegree.set(importer, next)
        if (next === 0) {
          ready.push(importer)
          ready.sort(compare)
        }
      }
    }

    // Cycles retain inventory order. Resolution/evaluation already handles their semantics;
    // this is only a deterministic staging order, not a second graph architecture.
    for (const file of [...byPath.keys()].sort(compare)) if (!ordered.includes(file)) ordered.push(file)
    return ordered.map((file) => byPath.get(file)!)
  }

  /**
   * Write the generated `styled-system`, so an integration can be a project's only codegen.
   *
   * The first call writes everything. That looks like the redundant half — a project that ran
   * `bamboo codegen` already has the files — but it is the only call that ever mattered, and it
   * used to do nothing: the guard below read `hasEmitted` before it was ever set, so the first
   * call fell straight through to setting the flag and the artifacts were written only after a
   * *subsequent* config change. A clone with no `styled-system/` on disk therefore got none from
   * `vite dev` or `vite build` either, which is what the callers exist to guarantee — the dev
   * server answered with an error overlay, and the build failed to resolve `styled-system/css`
   * from the first module that imports it. Every project has had to run the CLI first and pass
   * for a build step, which on one react-router app is 585 ms of a 2,242 ms build, ~97% of it
   * spent loading modules to do 21 ms of work.
   *
   * Later calls stay narrow, which is what the guard was reaching for. A watch rebuild re-emits
   * only the artifacts a config change affected, and a rebuild that changed no config writes
   * nothing at all.
   */
  async emit() {
    if (!this.hasEmitted) {
      logger.debug('builder', 'Emit artifacts')
      await codegen(this.getContextOrThrow())
    } else if (this.affecteds?.hasConfigChanged) {
      logger.debug('builder', 'Emit artifacts after config change')
      await codegen(this.getContextOrThrow(), Array.from(this.affecteds.artifacts))
    }

    this.hasEmitted = true
  }

  setupContext = async (options: SetupContextOptions) => {
    const { configPath, cwd, dev } = options

    const ctx = await loadConfigAndCreateContext({ configPath, cwd, dev })

    const configDeps = uniq([...ctx.conf.dependencies, ...ctx.explicitDeps])

    configDeps.forEach((file) => {
      this.configDependencies.add(resolve(cwd || ctx.conf.config.cwd, file))
    })

    this.context = ctx
    this.tsconfigResolutionFiles = ctx.diff.getResolutionConfigFiles()
    return ctx
  }

  getContextOrThrow = (): BambooContext => {
    if (!this.context) {
      throw new BambooError('NO_CONTEXT', 'context not loaded')
    }
    return this.context
  }

  /**
   * The changed file's recipe surface: every declared `cva`/`sva` config, in declaration
   * order, plus the text of every export statement. A value edit inside a `css()` call moves
   * neither; a recipe config edit moves the first; an export alias or re-export edit — which
   * can re-route what a consumer's call resolves to without any declaration changing — moves
   * the second. `undefined` when any part cannot be pinned down, which disables skipping.
   */
  private digestRecipeSurface = (
    ctx: BambooContext,
    file: string,
    parserResult: ReturnType<BambooContext['parseFile']>,
  ): string | undefined => {
    try {
      const recipes: Array<[string, unknown]> = []
      for (const set of [parserResult?.cva, parserResult?.sva]) {
        for (const item of set ?? []) recipes.push([item.name ?? '', item.data])
      }
      const sourceFile = ctx.project?.getSourceFile?.(file)
      const exports = sourceFile ? sourceFile.getExportDeclarations().map((declaration) => declaration.getText()) : []
      const json = JSON.stringify([recipes, exports], (_key, value) =>
        value === undefined ? 'bamboo:undefined' : value,
      )
      if (json === undefined) return undefined
      return createHash('sha256').update(json).digest('base64')
    } catch {
      return undefined
    }
  }

  /** One canonical spelling for verification keys: absolute, forward slashes. */
  private absOwner = (ctx: BambooContext, file: string) =>
    this.sourcePath(ctx.runtime?.path?.abs ? ctx.runtime.path.abs(ctx.config.cwd, file) : file)

  /** Whether every changed file this dependent reads kept both its values and its surface. */
  private dependentUnchangedByReads = (ctx: BambooContext, owner: string): boolean => {
    // A dependent can be selected without any tracked source changing at all — an import-map
    // or tsconfig edit retargets what its specifiers resolve to — and nothing these records
    // witness can vouch for resolution. Any such selection this pass disables skipping, as
    // does an empty changed set, which means the selection came from that machinery.
    if (this.resolutionAffectedThisPass || this.changedThisPass.size === 0) return false

    const reads = this.extractionReadsByOwner.get(owner)
    if (reads === undefined) return false

    for (const changed of this.changedThisPass) {
      if (this.recipeSurfaceStable.get(changed) !== true) return false
    }

    for (const read of reads) {
      const readOwner = this.sourcePath(ctx.runtime.path.abs(ctx.config.cwd, read.file))
      if (!this.changedThisPass.has(readOwner)) continue
      if (read.digest === undefined) return false
      const key = `${read.file}\u0000${read.name}`
      if (!this.readDigestMemo.has(key)) {
        this.readDigestMemo.set(key, ctx.project.digestExportRead(read.file, read.name))
      }
      const current = this.readDigestMemo.get(key)
      if (current === undefined || current !== read.digest) return false
    }
    return true
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
    if (meta.isUnchanged && !hasConfigChanged && !this.affectedFiles?.has(this.sourcePath(file))) return

    /**
     * A dependent selected only because a file it reads changed can be verified instead of
     * re-extracted: its own bytes did not move, so its extraction output moves only if a
     * value it read moved, or if the changed file's recipe surface — which decides how its
     * calls classify — moved. Both are checked against digests recorded when this owner was
     * last extracted; the changed file itself was re-extracted earlier in this same ordered
     * pass, which is what makes the surface comparison current. Any gap — a read that could
     * not be digested, a surface this pass has no verdict for, a JSX-component config whose
     * classification these records do not witness — falls through to the re-extraction this
     * replaces.
     */
    if (
      meta.isUnchanged &&
      !hasConfigChanged &&
      !this.changedThisPass.has(this.absOwner(ctx, file)) &&
      // Conservative when the answer is unknowable: JSX component classification can hinge on
      // cross-file resolution these records do not witness, so its presence disables skipping.
      !((ctx as unknown as { jsx?: { isEnabled?: boolean } }).jsx?.isEnabled ?? true) &&
      this.dependentUnchangedByReads(ctx, this.absOwner(ctx, file))
    ) {
      return
    }

    const owner = this.sourcePath(file)
    const previousReads = this.resolutionReadSets.get(owner) ?? []
    const previousPending = this.pendingResolutionReadSets.get(owner) ?? []
    const previousCandidates = this.resolutionCandidateSets.get(owner) ?? []
    const previousConfigurations = this.resolutionConfigurationSets.get(owner) ?? []
    const parserResult = ctx.parseFile(file)
    fileModifiedMap.set(file, meta.mtime)

    {
      // What this owner read, and what its recipe surface is now — the two records dependent
      // verification compares against on the next pass. The surface verdict for a *changed*
      // file is decided here, against the digest its previous extraction recorded. Every key
      // is the absolute spelling, which is the one the parser's read records carry.
      const owner = this.absOwner(ctx, file)
      const reads =
        (
          parserResult as
            | { getExportReads?: () => ReadonlyArray<{ file: string; name: string; digest: string | undefined }> }
            | undefined
        )?.getExportReads?.() ?? []
      this.extractionReadsByOwner.set(owner, reads)
      const surface = ctx.project ? this.digestRecipeSurface(ctx, file, parserResult) : undefined
      if (this.changedThisPass.has(owner)) {
        const previous = this.recipeSurfaceByOwner.get(owner)
        this.recipeSurfaceStable.set(owner, previous !== undefined && surface !== undefined && previous === surface)
      }
      this.recipeSurfaceByOwner.set(owner, surface)
    }

    if (parserResult) {
      const previousReadSet = meta.isUnchanged
        ? {
            dependencies: uniq([...previousReads, ...previousPending]).sort(),
            pendingCandidates: previousCandidates,
          }
        : undefined
      const readSet = ctx.project.getResolutionReadSet(file, parserResult.getDependencies(), previousReadSet)
      const currentReads = readSet.dependencies
      const currentConfigurations = ctx.project.getResolutionConfigurationFiles(
        file,
        parserResult.getDependencies(),
        meta.isUnchanged ? previousConfigurations : [],
      )
      this.resolutionReadSets.set(owner, currentReads)
      if (readSet.pendingCandidates.length) {
        this.resolutionCandidateSets.set(owner, readSet.pendingCandidates)
      } else {
        this.resolutionCandidateSets.delete(owner)
      }

      // A dependency which disappeared cannot occur in the fresh ParserResult: there is no
      // declaration node to carry its path. It is nevertheless still the exact semantic read
      // which selected this unchanged owner on the unlink pass. Keep polling only those prior
      // reads while they are absent. A source edit to the owner recomputes intent from scratch,
      // so removing or making that import runtime-only releases the pending path immediately.
      // Keeping this separate from `resolutionReadSets` preserves the meaning of the live set
      // and never promotes arbitrary unresolved/runtime ledger branches into watch inputs.
      const pending = meta.isUnchanged
        ? uniq([...previousPending, ...previousReads])
            .filter(
              (dependency) =>
                !existsSync(dependency) &&
                !currentReads.includes(dependency) &&
                (!previousCandidates.includes(dependency) || readSet.pendingCandidates.includes(dependency)),
            )
            .sort()
        : []
      if (pending.length) this.pendingResolutionReadSets.set(owner, pending)
      else this.pendingResolutionReadSets.delete(owner)

      // A config edit can make a formerly semantic alias unresolved, leaving no current
      // dependency node from which to rediscover its tsconfig/package manifest. Retain that
      // exact prior config read only while the owner itself is unchanged; an owner edit which
      // removes or makes the import runtime-only releases it immediately.
      const configurations =
        currentConfigurations.length || !meta.isUnchanged ? currentConfigurations : previousConfigurations
      if (configurations.length) this.resolutionConfigurationSets.set(owner, configurations)
      else this.resolutionConfigurationSets.delete(owner)
    }

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
      ctx.assertExtracted()
      return ctx.assertNoDeadCalls()
    }

    // The list `refreshSourceState` globbed moments ago in this same pass. Re-globbing here
    // costs a directory walk per rebuild and can only disagree with `filesMeta` — which was
    // computed from that inventory — about files that appeared in between, and those are the
    // next watcher event's to handle either way.
    const files = !hasConfigChanged && this.sourceInventory ? [...this.sourceInventory] : ctx.getFiles()
    const inventory = new Set(files.map(this.sourcePath))
    if (hasConfigChanged) {
      this.resolutionReadSets.clear()
      this.pendingResolutionReadSets.clear()
      this.resolutionCandidateSets.clear()
      this.resolutionConfigurationSets.clear()
    } else {
      for (const owner of this.resolutionReadSets.keys()) {
        if (!inventory.has(owner)) this.resolutionReadSets.delete(owner)
      }
      for (const owner of this.pendingResolutionReadSets.keys()) {
        if (!inventory.has(owner)) this.pendingResolutionReadSets.delete(owner)
      }
      for (const owner of this.resolutionCandidateSets.keys()) {
        if (!inventory.has(owner)) this.resolutionCandidateSets.delete(owner)
      }
      for (const owner of this.resolutionConfigurationSets.keys()) {
        if (!inventory.has(owner)) this.resolutionConfigurationSets.delete(owner)
      }
    }
    ctx.encoder?.reconcileFileOwnerOrder('extract', files)
    const filesToExtract = hasConfigChanged ? files : (this.extractionOrder ?? files)

    // The set this pass genuinely re-reads, and a fresh digest memo for it. Dependents whose
    // bytes did not move consult both: `extractionOrder` puts every changed file before its
    // dependents, so by the time a dependent is visited, each changed file's fresh recipe
    // surface has been recorded and its values are one memoized digest away.
    this.changedThisPass = new Set(
      [...(this.filesMeta?.changes ?? [])]
        .filter(([, fileMeta]) => !fileMeta.isUnchanged)
        .map(([changed]) => this.sourcePath(ctx.runtime.path.abs(ctx.config.cwd, changed))),
    )
    this.recipeSurfaceStable.clear()
    this.readDigestMemo.clear()

    const done = logger.time.info('Extracted in')

    // `for…of` rather than `.map`, whose result is discarded. `.map` also builds an array
    // holding every `ParserResult` until the statement ends, keeping the whole set reachable
    // across the pass for nothing — what each result carries is in the encoder by then.
    //
    // Measured neutral, and recorded as such so nobody re-derives it: on a 2,000-file build,
    // median extract 1,724ms against 1,712ms, with a control repeat of the original at
    // 1,697ms — the three within 1.6%, and peak RSS flat. The retention is real and the
    // collector does not care. Kept because a `.map` for its side effects reads as a bug.
    for (const file of filesToExtract) {
      this.extractFile(ctx, file)
    }

    done()

    this.sourceInventory = [...files]
    // Resolver-discovered modules can sit outside `include`. Their bytes were semantically
    // read by this pass, so remember the same mtimes as included owners and detect their next
    // edit without globbing the checkout.
    for (const file of uniq([...files, ...this.getResolutionReadFiles()])) {
      fileModifiedMap.set(file, this.getFileMeta(file).mtime)
    }
    this.snapshotResolutionConfigurations()
    this.affectedFiles = undefined
    this.extractionOrder = undefined

    // After `done()`, so the timing line still reports the pass that just ran rather than
    // being swallowed by the throw. Handed the list this pass walked, so it does not glob
    // a second time to ask which files still exist.
    ctx.assertExtracted(files)
    ctx.assertNoDeadCalls(files)
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
  toCss = ({
    layerParams = false,
    includeRecipes = true,
  }: { layerParams?: boolean; includeRecipes?: boolean } = {}) => {
    const ctx = this.getContextOrThrow()
    const sheet = ctx.createSheet()
    if (layerParams) {
      if (includeRecipes) {
        ctx.appendLayerParams(sheet)
      } else {
        const recipeLayer = ctx.config.layers?.recipes ?? 'recipes'
        sheet.layers.root.prepend(
          `@layer ${sheet.layers.layerNames.filter((name) => name !== recipeLayer).join(', ')};`,
        )
      }
    }
    ctx.appendBaselineCss(sheet)

    // A strict static-style build lowers every recipe selection to ordinary shared atoms.
    // Its encoder has already interned those atoms before this method is called, so retaining
    // the extraction-only recipe rules would ship both representations. Clear all four staging layers
    // before reachability scans: tokens referenced only by removed recipe rules should leave
    // with them, while the atomized utility rules keep the declarations they actually use.
    if (!includeRecipes) {
      sheet.layers.recipes.removeAll()
      sheet.layers.recipes_base.removeAll()
      sheet.layers.recipes_slots.removeAll()
      sheet.layers.recipes_slots_base.removeAll()
    }

    // `extract` has already run, so this sheet carries the utilities and recipes too.
    // Parser results are not retained across that call, so the reference set comes from
    // the source scan alone; re-parsing here would encode every style a second time.
    //
    // One walk answers every prune step, and the per-file cache keeps it O(changed) on a
    // rebuild: the mtimes come from the sweep `setup` already performed this pass, so a file
    // the pass knows to be unchanged contributes its previous scan without being re-read.
    const collectElements = prunesPreflight(ctx.config.preflight)
    const declaredKeyframes = ctx.config.prune?.keyframes ? keyframeNames(ctx) : []
    // Walked only when a pass below will read the answers: `prune.tokens: false` skips the
    // token scan inside `pruneTokensForBuild` too, and a context with every pass off — the
    // shape harness tests hand `write` — must not pay for or depend on a source walk.
    const needsScans = ctx.config.prune?.tokens !== false || collectElements || declaredKeyframes.length > 0
    const scans = needsScans
      ? collectSourceScans(
          ctx,
          { keyframeNames: declaredKeyframes, elements: collectElements },
          this.sourceScanCache,
          (filePath) => this.filesMeta?.changes.get(filePath)?.mtime,
          this.sourceInventory,
        )
      : undefined
    const reachableVars = pruneTokensForBuild(ctx, sheet, [], scans)

    if (collectElements && scans) {
      ctx.prunePreflight(sheet, scans.elements)
    }

    if (ctx.config.prune?.keyframes && scans) {
      ctx.pruneKeyframes(sheet, scans.keyframeHits, reachableVars)
    }

    return ctx.getCss(sheet)
  }

  registerDependency = (fn: (dep: Message) => void) => {
    const ctx = this.getContextOrThrow()
    this.crawlConfigDependencies()

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
  /** Set by the integration; only a dev server knows it is one. @see `hash: 'auto'` */
  dev?: boolean
}
