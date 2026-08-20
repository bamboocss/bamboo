import type { ParserOptions } from '@bamboocss/core'
import type {
  ConfigTsOptions,
  BambooHooks,
  ParserResultConfigureOptions,
  ParserResultInterface,
  Runtime,
} from '@bamboocss/types'
import {
  FileSystemRefreshResult,
  ScriptKind,
  SourceFile,
  Project as TsProject,
  ts,
  type ProjectOptions as TsProjectOptions,
} from 'ts-morph'
import { clearBoxNodeCache } from '@bamboocss/extractor'
import { classifyProject } from './classify'
import { clearImportedRecipeCache } from './imported-recipes'
import { createParser } from './parser'
import { ParserResult } from './parser-result'

/**
 * Everything memoized against another file's contents.
 *
 * Both caches answer a question about a *different* module than the one being parsed — what
 * an identifier resolved to, and which recipes a module exports — so both go stale on exactly
 * the same events, and clearing one without the other leaves the pair disagreeing.
 */
const invalidateResolutions = () => {
  clearBoxNodeCache()
  clearImportedRecipeCache()
}

// TS 6.0 rejects raw JSON compiler options (e.g. `target: "ESNext"`) in createProgram.
// They must be normalized to numeric enum values via TypeScript's own parser API first.
const normalizeCompilerOptions = (
  raw: ts.CompilerOptions | undefined,
  basePath = process.cwd(),
): ts.CompilerOptions => {
  if (!raw) return {}
  const { options } = ts.convertCompilerOptionsFromJson(raw, basePath)
  return options
}

/** Snapshot the JSON-shaped ts-morph options while retaining opaque hosts and callbacks. */
const snapshotProjectOption = <T>(value: T): T => {
  if (Array.isArray(value)) return value.map(snapshotProjectOption) as T
  if (!value || typeof value !== 'object') return value
  if (Object.getPrototypeOf(value) !== Object.prototype) return value

  return Object.fromEntries(Object.entries(value).map(([key, entry]) => [key, snapshotProjectOption(entry)])) as T
}

const prepareTsProjectOptions = (
  options: TsProjectOptions,
  snapshotNested = false,
  compilerOptionsBasePath = process.cwd(),
): TsProjectOptions => {
  const snapshot = { ...options } as TsProjectOptions & Record<string, unknown>

  // These are ts-morph's nested data options. Hosts and resolution callbacks deliberately
  // retain their identity, matching the eager Project that consumed them immediately.
  if (snapshotNested) {
    for (const key of ['compilerOptions', 'defaultCompilerOptions', 'manipulationSettings']) {
      if (key in snapshot) snapshot[key] = snapshotProjectOption(snapshot[key])
    }
  }

  return {
    skipAddingFilesFromTsConfig: true,
    skipFileDependencyResolution: true,
    skipLoadingLibFiles: true,
    ...snapshot,
    compilerOptions: {
      allowJs: true,
      strictNullChecks: false,
      skipLibCheck: true,
      // Normalize now, so a deferred ts-morph constructor cannot observe a later cwd or
      // mutation of the raw compiler options that the old eager constructor had consumed.
      ...normalizeCompilerOptions(snapshot.compilerOptions, compilerOptionsBasePath),
    },
  }
}

const createTsProject = (options: TsProjectOptions) => new TsProject(options)

/** Filesystem errors proving a lexical candidate cannot name a resolvable file. */
const isMissingPathShapeError = (error: unknown): boolean => {
  const code = (error as NodeJS.ErrnoException | undefined)?.code
  return code === 'ENOENT' || code === 'ENOTDIR' || code === 'ELOOP' || code === 'ENAMETOOLONG'
}

/** Match the successful receiver cases of an ordinary writable data-property assignment. */
const setProjectOnReceiver = (receiver: unknown, project: TsProject): void => {
  if ((typeof receiver !== 'object' && typeof receiver !== 'function') || receiver === null) return

  const descriptor = Reflect.getOwnPropertyDescriptor(receiver, 'project')
  if (descriptor) {
    if ('value' in descriptor && descriptor.writable) {
      Reflect.defineProperty(receiver, 'project', { value: project })
    }
    return
  }

  Reflect.defineProperty(receiver, 'project', {
    configurable: true,
    enumerable: true,
    value: project,
    writable: true,
  })
}

export interface ProjectOptions extends TsProjectOptions {
  /**
   * Snapshot `getFiles()` now, but defer reading and parsing that inventory until a source
   * graph operation. `BambooContext` opts into this; standalone Projects remain eager.
   *
   * @internal
   */
  deferInitialSourceFiles?: boolean
  readFile: Runtime['fs']['readFileSync']
  getFiles(): string[]
  hooks: Partial<BambooHooks>
  parserOptions: ParserOptions
  /** @internal Exact tsconfig files which produced the current compiler resolution options. */
  resolutionConfigFiles?: readonly string[]
  tsOptions?: ConfigTsOptions
}

/** @internal One stable local module-resolution observation from a source AST. */
export interface ResolutionFact {
  readonly importer: string
  readonly target: string | null
  readonly specifier: string
  readonly kind: 'import' | 'export'
  readonly ordinal: number
}

/** @internal Exact semantic closure plus missing local paths which can redirect it. */
export interface ResolutionReadSet {
  readonly dependencies: readonly string[]
  readonly pendingCandidates: readonly string[]
}

/** @internal Deterministic filesystem work performed by the Project-owned resolver. */
export interface ResolutionWork {
  readonly moduleResolutionsAttempted: number
  readonly sourceFilesAdded: number
  readonly sourceFilesRead: number
}

type MutableResolutionWork = { -readonly [Key in keyof ResolutionWork]: ResolutionWork[Key] }

interface ImporterResolution {
  readonly configurationFiles: readonly ResolutionConfigurationFile[]
  readonly facts: readonly ResolutionFact[]
  readonly hasPendingLocalCandidate: boolean
  readonly pendingCandidates: readonly PendingResolutionCandidate[]
  readonly sourceFile: SourceFile
  readonly text: string
  readonly treeRevision: number
}

interface ResolutionConfigurationFile {
  readonly importer: string
  readonly target: string
  readonly specifier: string
  readonly kind: ResolutionFact['kind']
  readonly ordinal: number
}

interface PendingResolutionCandidate {
  readonly importer: string
  readonly target: string
  readonly specifier: string
  readonly kind: ResolutionFact['kind']
  readonly ordinal: number
}

interface SourcePreparationTransaction {
  readonly state: 'preparing'
  readonly sourceFile: SourceFile
  readonly inputText: string
  invalidated: boolean
}

interface EffectiveSourcePreparation {
  readonly state: 'ready'
  readonly sourceFile: SourceFile
  readonly inputText: string
  readonly effectiveText: string
  readonly options: ParserResultConfigureOptions
}

type SourcePreparation = SourcePreparationTransaction | EffectiveSourcePreparation

/**
 * How to parse a file, decided by its extension.
 *
 * Everything used to be `TSX`, which is not a superset of `TS`: the two disagree on exactly
 * the constructs where `<` is ambiguous. Under `TSX` a generic arrow `<T>(x: T) => x` and an
 * old-style assertion `<HTMLElement>node` parse as a *JSX element*, which then swallows the
 * rest of the file into its children. The file still reads fine and the bytes are unchanged;
 * the tree is simply wrong, and every `css()` call below the offending line stops existing as
 * far as extraction is concerned. It reports as styles that silently never got emitted.
 *
 * Only `.ts` moves. A `.ts` file cannot legally contain JSX — TypeScript requires `.tsx` for
 * that — so parsing one as `TSX` can only ever mis-parse, never accept something real.
 *
 * Everything else stays `TSX` deliberately:
 *
 * - `.js` and `.jsx` routinely carry JSX in projects that never adopted TypeScript, and `TSX`
 *   accepts the type syntax they do not use anyway.
 * - a single-file component is stored under its own extension after `parser:before` rewrites
 *   it to tsx, so `.vue` and `.svelte` have to keep parsing as tsx.
 * - an unknown extension is somebody's template that a hook may have compiled to jsx.
 */
const scriptKindFor = (filePath: string): ScriptKind => {
  const extension = filePath.slice(filePath.lastIndexOf('.')).toLowerCase()
  return extension === '.ts' || extension === '.mts' || extension === '.cts' ? ScriptKind.TS : ScriptKind.TSX
}

export class Project {
  /**
   * Source-loading contract for the opt-in deferred mode:
   *
   * - materializing: `project`, `getSourceFile`, `getDependents`, every create/add/remove/reload
   *   API, and non-JSON `parseSourceFile`;
   * - graph-independent: `files`, `parser`, `parserOptions`, `readFile`, `getFiles`, the
   *   resolution-ledger/work getters, `getUnresolvedImporters`, `parseJson`/JSON
   *   `parseSourceFile`, `transformFile`, `classify`.
   *
   * Graph-independent means outside the atomic preload. While it is `loading`, every public
   * wrapper entry rejects reentrancy before returning live state or invoking a callback.
   *
   * Private resolution and dependency helpers are reachable only after a materializing parse.
   */
  parser!: ReturnType<typeof createParser>
  project!: TsProject

  #guardedParser!: ReturnType<typeof createParser>
  #parser!: ReturnType<typeof createParser>

  #sourceFiles: {
    accessor:
      | {
          get: () => TsProject
          set: (this: unknown, project: TsProject) => void
        }
      | undefined
    initialFiles: readonly string[]
    phase: 'pending' | 'loading' | 'ready'
    project: TsProject | undefined
    projectOptions: TsProjectOptions
    revision: number
  }
  private options: ProjectOptions

  get parserOptions() {
    this.#assertNotLoading()
    return this.options.parserOptions
  }

  constructor(options: ProjectOptions) {
    const { deferInitialSourceFiles, getFiles, parserOptions } = options
    const tsProjectOptions = { ...options }
    delete tsProjectOptions.deferInitialSourceFiles
    delete tsProjectOptions.resolutionConfigFiles

    this.options = options
    this.#sourceFiles = {
      accessor: undefined,
      initialFiles: [],
      phase: deferInitialSourceFiles ? 'pending' : 'ready',
      project: undefined,
      projectOptions: prepareTsProjectOptions(
        tsProjectOptions,
        Boolean(deferInitialSourceFiles),
        parserOptions.config.cwd || process.cwd(),
      ),
      revision: 0,
    }

    // Preserve standalone `new Project()` exactly: ts-morph and the complete inventory are
    // still constructed before the wrapper returns. Only the explicit context opt-in moves
    // that work behind the private source gate.
    if (!deferInitialSourceFiles) {
      this.project = createTsProject(this.#sourceFiles.projectOptions)
      this.#sourceFiles.project = this.project
    }
    const parser = createParser(parserOptions)
    this.#parser = parser

    if (deferInitialSourceFiles) {
      this.#guardedParser = (...args) => {
        this.#assertNotLoading()
        return this.#parser(...args)
      }
      Object.defineProperty(this, 'parser', {
        configurable: false,
        enumerable: true,
        get: () => {
          this.#assertNotLoading()
          return this.#guardedParser
        },
        set: (next: ReturnType<typeof createParser>) => {
          this.#assertNotLoading()
          if (Object.isFrozen(this)) {
            throw new TypeError("Cannot assign to read only property 'parser' of Project")
          }
          this.#parser = next
        },
      })

      // Glob/configuration errors deliberately stay at BambooContext construction. The list
      // is frozen, while bytes are read later and `files` remains the live callback below.
      this.#sourceFiles.initialFiles = Object.freeze([...getFiles()])
      const getProject = () => {
        this.#ensureSourceFiles()
        return this.#sourceFiles.project!
      }
      const isOwner = (receiver: unknown) => receiver === this
      const isFrozen = () => Object.isFrozen(this)
      const setOwnerProject = (project: TsProject) => {
        this.#sourceFiles.revision++
        if (Object.isFrozen(this)) {
          throw new TypeError("Cannot assign to read only property 'project' of Project")
        }
        this.#sourceFiles.project = project
        this.#sourceFiles.phase = 'ready'
        this.resetResolutionState()
      }
      const assertNotLoading = () => this.#assertNotLoading()
      const setProject = function (this: unknown, project: TsProject) {
        assertNotLoading()
        if (!isOwner(this)) {
          if (isFrozen()) return
          setProjectOnReceiver(this, project)
          return
        }
        setOwnerProject(project)
      }
      this.#sourceFiles.accessor = { get: getProject, set: setProject }
      Object.defineProperty(this, 'project', {
        // This opt-in low-level boundary is deliberately narrower than the standalone
        // Project's native data property. Assignment remains supported through the setter;
        // descriptor replacement/deletion cannot bypass the loading transaction.
        configurable: false,
        enumerable: true,
        get: getProject,
        set: setProject,
      })
    } else {
      this.parser = parser
      this.createSourceFiles()
    }
  }

  get files() {
    this.#assertNotLoading()
    return this.options.getFiles()
  }

  /**
   * Atomically preload the inventory captured when this wrapper was constructed.
   *
   * The candidate ts-morph Project stays local until every non-ENOENT read and AST creation
   * succeeds. A failure discards it, and the next operation retries with a fresh candidate
   * over the same frozen membership. A materializing callback that re-enters this wrapper
   * sees no candidate and fails explicitly rather than observing a partial module graph.
   */
  #hasSourceFilesAccessor = (): boolean => {
    const expected = this.#sourceFiles.accessor
    const descriptor = Object.getOwnPropertyDescriptor(this, 'project')
    return Boolean(expected && descriptor?.get === expected.get && descriptor.set === expected.set)
  }

  #assertSourceFilesAccessor = (): void => {
    if (!this.#hasSourceFilesAccessor()) {
      throw new Error('Project property changed during source initialization')
    }
  }

  #assertNotLoading = (): void => {
    if (this.#sourceFiles.phase !== 'loading') return
    // Monotonic even when a caller catches the error: the outer transaction observes the
    // attempted reentry or assignment and cannot publish a candidate after the callback.
    this.#sourceFiles.revision++
    throw new Error('Project source files are already being initialized')
  }

  #assertSourceFilesTransaction = (revision: number): void => {
    this.#assertSourceFilesAccessor()
    if (this.#sourceFiles.revision !== revision) {
      throw new Error('Project source files are already being initialized; transaction was re-entered or mutated')
    }
  }

  #materializeSourceFiles = (read: (filePath: string, index: number) => string, skipMissing: boolean): void => {
    this.#assertSourceFilesAccessor()

    const revision = this.#sourceFiles.revision
    this.#sourceFiles.phase = 'loading'

    try {
      const candidate = createTsProject(this.#sourceFiles.projectOptions)
      this.#assertSourceFilesTransaction(revision)
      let loaded = 0

      for (const [index, file] of this.#sourceFiles.initialFiles.entries()) {
        try {
          const content = read(file, index)
          this.#assertSourceFilesTransaction(revision)
          candidate.createSourceFile(file, content, {
            overwrite: true,
            scriptKind: scriptKindFor(file),
          })
          this.#assertSourceFilesTransaction(revision)
          loaded++
        } catch (error) {
          // A callback can also replace/delete the public handle and then throw ENOENT. The
          // mutation wins over the skip: publishing a private candidate would split the graph.
          this.#assertSourceFilesTransaction(revision)
          // A snapshotted member can disappear before its deferred read. This is the same
          // watch-safe skip as the eager constructor; every other failure aborts the candidate.
          if (!skipMissing || (error as NodeJS.ErrnoException)?.code !== 'ENOENT') throw error
        }
      }

      this.#assertSourceFilesTransaction(revision)
      if (loaded > 0) invalidateResolutions()
      // Global invalidation dispatches into other packages and, ultimately, built-ins such as
      // Map#clear. It must be inside the transaction. After this last assertion, publication
      // is only existing private-slot/data-field assignment with no user-code boundary.
      this.#moduleResolutionCache = undefined
      this.#fileTreeRevision++
      this.#assertSourceFilesTransaction(revision)
      this.#sourceFiles.project = candidate
      this.#sourceFiles.phase = 'ready'
      return
    } catch (error) {
      this.#sourceFiles.project = undefined
      this.#sourceFiles.phase = 'pending'
      throw error
    }
  }

  #ensureSourceFiles = (): void => {
    if (this.#sourceFiles.phase === 'ready') return
    this.#assertNotLoading()
    this.#materializeSourceFiles((file) => this.options.readFile(file), true)
  }

  /** Reverse dependency graph: resolved target -> importers. */
  private dependents = new Map<string, Set<string>>()

  /** Forward edges, so a re-parse can retract exactly the previous ones. */
  private dependencies = new Map<string, Set<string>>()

  /**
   * Deleted targets retain their last importers until those importers are reparsed.
   *
   * A watcher commonly removes first and asks second. The ledger itself must say the target
   * is now unresolved, while this one-turn tombstone keeps that unlink query answerable.
   */
  private removedDependents = new Map<string, Set<string>>()

  /**
   * Path as a caller spells it -> the source file's own path.
   *
   * The graph is keyed on the latter, but callers pass whatever the watcher gave
   * them. Resolving through the project covers that while the file is loaded;
   * this keeps it resolvable afterwards too, so asking which files imported a
   * *deleted* file still works and the unlink path does not depend on querying
   * before removal.
   */
  private canonicalPaths = new Map<string, string>()

  /**
   * Files holding at least one import whose local resolution is not final.
   *
   * A broken or not-yet-created import produces no edge. A successful fallback edge
   * likewise cannot point at the missing higher-priority candidate that may replace it.
   * These importers are the only candidates for either add-event transition, and the
   * set is normally empty.
   */
  private unresolvedImporters = new Set<string>()

  /** Exact post-transform resolution facts, one immutable list per importer. */
  private resolutionsByImporter = new Map<string, ImporterResolution>()

  /** One hook/transform transaction for each source revision Bamboo can semantically read. */
  private sourcePreparations = new Map<string, SourcePreparation>()

  /** Paths explicitly removed through this wrapper, until an add/create observes them again. */
  private removedSourcePaths = new Set<string>()

  /** File-tree changes invalidate even successful resolutions (extension precedence can move). */
  #fileTreeRevision = 0

  private resolutionWork: MutableResolutionWork = {
    moduleResolutionsAttempted: 0,
    sourceFilesAdded: 0,
    sourceFilesRead: 0,
  }

  private resetResolutionState = () => {
    this.#moduleResolutionCache = undefined
    this.#fileTreeRevision++
    this.dependents = new Map()
    this.dependencies = new Map()
    this.removedDependents = new Map()
    this.canonicalPaths = new Map()
    this.unresolvedImporters = new Set()
    this.resolutionsByImporter = new Map()
    this.sourcePreparations = new Map()
    this.removedSourcePaths = new Set()
    this.resolutionWork = {
      moduleResolutionsAttempted: 0,
      sourceFilesAdded: 0,
      sourceFilesRead: 0,
    }
  }

  /** Files whose imports may resolve differently after a local file appears. */
  getUnresolvedImporters = (): string[] => {
    this.#assertNotLoading()
    return [...this.unresolvedImporters].sort()
  }

  /** @internal Immutable resolution facts in importer/AST order. */
  getResolutionLedger = (): readonly ResolutionFact[] => {
    this.#assertNotLoading()
    return Object.freeze(
      [...this.resolutionsByImporter.entries()]
        .sort(([left], [right]) => (left < right ? -1 : left > right ? 1 : 0))
        .flatMap(([, entry]) => entry.facts),
    )
  }

  /** @internal Every distinct local target represented by the current ledger. */
  getResolvedSourceFiles = (): readonly string[] => {
    this.#assertNotLoading()
    const paths = new Set<string>()
    for (const entry of this.resolutionsByImporter.values()) {
      for (const fact of entry.facts) if (fact.target) paths.add(fact.target)
    }
    return Object.freeze([...paths].sort())
  }

  /** @internal Deterministic resolver/add/read work, for regression assertions. */
  getResolutionWork = (): ResolutionWork => {
    this.#assertNotLoading()
    return Object.freeze({ ...this.resolutionWork })
  }

  getSourceFile = (filePath: string): SourceFile | undefined => {
    this.#assertNotLoading()
    return this.project.getSourceFile(filePath)
  }

  /** ts-morph reports forward slashes; normalize callers' paths to match on Windows. */
  private normalizePath = (filePath: string) => filePath.replaceAll('\\', '/')

  /** Shared filesystem-only resolution cache; no type checker is constructed. */
  #moduleResolutionCache: ts.ModuleResolutionCache | undefined

  /**
   * Everything memoized against the shape of the file tree, including the negative half.
   *
   * `resolveModuleName` caches failures too, so a specifier that resolved to nothing before
   * its target existed stays unresolved for the life of the process. That silently dropped a
   * dependency edge; now it would also leave a recipe permanently invisible to the module
   * importing it, since resolution is what finds one.
   */
  private invalidate = (fileTreeChanged = true) => {
    this.#assertNotLoading()
    invalidateResolutions()
    // Only when the set of files could have changed. Overwriting a file the project already
    // holds cannot satisfy a resolution that previously failed, and `addSourceFile` runs once
    // per module on the transform path — dropping the cache there measured +50% on a module
    // with eight relative imports, for no correctness gained.
    if (fileTreeChanged) {
      this.#moduleResolutionCache = undefined
      this.#fileTreeRevision++
    }
  }

  /**
   * Invalidate module/evaluator state after a resolver configuration byte changes.
   *
   * Unlike `resetResolutionState`, this keeps the published dependency graph long enough for
   * an incremental consumer to take its old dependent closure. Each reparsed importer replaces
   * its own facts under the bumped revision; unrelated graph entries remain available until
   * they are next queried instead of forcing a whole-project rebuild.
   *
   * @internal
   */
  refreshResolutionConfiguration = (
    compilerOptions: ts.CompilerOptions | undefined,
    resolutionConfigFiles: readonly string[],
    replaceCompilerOptions: boolean,
  ) => {
    this.#assertNotLoading()
    this.options.resolutionConfigFiles = Object.freeze([...new Set(resolutionConfigFiles)].sort())

    if (replaceCompilerOptions) {
      const next =
        prepareTsProjectOptions({ compilerOptions }, false, this.options.parserOptions.config.cwd || process.cwd())
          .compilerOptions ?? {}
      this.#sourceFiles.projectOptions = {
        ...this.#sourceFiles.projectOptions,
        compilerOptions: snapshotProjectOption(next),
      }
      if (this.#sourceFiles.phase === 'ready') {
        const current = this.project.getCompilerOptions()
        const cleared = Object.fromEntries(Object.keys(current).map((key) => [key, undefined]))
        this.project.compilerOptions.set({ ...cleared, ...next })
      }
    }

    invalidateResolutions()
    this.#moduleResolutionCache = undefined
    this.#fileTreeRevision++
    this.sourcePreparations.clear()
  }

  private isLocalAlias = (specifier: string): boolean => {
    const paths = this.project.getCompilerOptions().paths
    if (!paths) return false

    return Object.keys(paths).some((pattern) => {
      const wildcard = pattern.indexOf('*')
      if (wildcard === -1) return pattern === specifier
      return specifier.startsWith(pattern.slice(0, wildcard)) && specifier.endsWith(pattern.slice(wildcard + 1))
    })
  }

  private getLocalFailedLookupCandidates = (failedLookupLocations: readonly string[] | undefined): string[] => {
    const seen = new Set<string>()
    const candidates: string[] = []
    for (const filePath of failedLookupLocations ?? []) {
      const normalized = this.normalizePath(filePath)
      // Package discovery walks package.json files above the importer for every bare name;
      // those probes do not make the name local. Concrete non-node_modules file candidates
      // in the checkout do: paths/baseUrl substitutions and package imports/self exports
      // expose precisely the priority paths TypeScript tried before the successful fallback.
      if (normalized.includes('/node_modules/') || normalized.endsWith('/package.json')) continue
      if (!seen.has(normalized) && this.isInCheckout(normalized)) {
        seen.add(normalized)
        candidates.push(normalized)
      }
    }
    return candidates
  }

  private isUnresolvedLocalSpecifier = (specifier: string, pendingCandidates: readonly string[]): boolean =>
    specifier.startsWith('.') ||
    specifier.startsWith('/') ||
    this.isLocalAlias(specifier) ||
    pendingCandidates.length > 0

  private isInCheckout = (filePath: string): boolean => {
    if (this.#sourceFiles.projectOptions.useInMemoryFileSystem) return true

    const project = this.project
    const fileSystem = project.getFileSystem()
    const configured = this.options.parserOptions.config.cwd
    const spelledRoot = this.normalizePath(configured || fileSystem.getCurrentDirectory()).replace(/\/$/, '')
    const root = this.normalizePath(fileSystem.realpathSync(spelledRoot)).replace(/\/$/, '')
    let target: string
    try {
      target = this.normalizePath(fileSystem.realpathSync(filePath))
    } catch (error) {
      // Failed module lookup paths need not have a directory at every lexical segment:
      // resolving `./index.css` legitimately probes `index.css/index.ts`, whose realpath is
      // ENOTDIR when the CSS file exists. Missing components, symlink loops and overlong
      // candidates are the same kind of non-resolvable path shape. Permission and I/O errors
      // are not; those still surface instead of silently deleting a potentially semantic read.
      if (!isMissingPathShapeError(error)) throw error
      target = this.normalizePath(filePath)
    }
    // A missing target cannot itself be realpathed. Keep the checkout spelling as a second
    // boundary so a symlinked ancestor (macOS `/var` -> `/private/var`, for example) does not
    // make a genuine failed local candidate look external until it appears.
    return [root, spelledRoot].some((boundary) => target === boundary || target.startsWith(`${boundary}/`))
  }

  private resolveSpecifier = (
    moduleName: string,
    from: SourceFile,
  ): {
    configurationFiles: readonly string[]
    local: boolean
    pendingCandidates: readonly string[]
    sourceFile?: SourceFile
  } => {
    this.#assertNotLoading()

    const project = this.project
    const compilerOptions = project.getCompilerOptions()
    this.#moduleResolutionCache ??= ts.createModuleResolutionCache(
      project.getFileSystem().getCurrentDirectory(),
      (f) => f,
      compilerOptions,
    )

    const configurationFiles = new Set<string>()
    const resolutionHost = project.getModuleResolutionHost()
    const recordConfigurationFile = (filePath: string) => {
      const normalized = this.normalizePath(filePath)
      if (!normalized.endsWith('/package.json') || normalized.includes('/node_modules/')) return
      if (!this.isInCheckout(normalized)) return
      configurationFiles.add(normalized)
    }
    const host: ts.ModuleResolutionHost = {
      ...resolutionHost,
      fileExists: (filePath) => {
        recordConfigurationFile(filePath)
        return resolutionHost.fileExists(filePath)
      },
      readFile: (filePath) => {
        recordConfigurationFile(filePath)
        return resolutionHost.readFile?.(filePath)
      },
    }

    this.resolutionWork.moduleResolutionsAttempted++
    const resolved = ts.resolveModuleName(
      moduleName,
      from.getFilePath(),
      compilerOptions,
      host,
      this.#moduleResolutionCache,
    )
    // TypeScript returns these concrete probes at runtime but intentionally omits them from
    // the public result type. They are the only evidence that an unresolved bare name was
    // redirected into this checkout rather than searched solely as an external package.
    const failedLookupLocations = (resolved as unknown as { readonly failedLookupLocations?: readonly string[] })
      .failedLookupLocations
    const affectingLocations = (resolved as unknown as { readonly affectingLocations?: readonly string[] })
      .affectingLocations
    for (const filePath of affectingLocations ?? []) recordConfigurationFile(filePath)
    const pendingCandidates = this.getLocalFailedLookupCandidates(failedLookupLocations)

    const module = resolved.resolvedModule
    if (!module) {
      return {
        configurationFiles: [...configurationFiles].sort(),
        local: this.isUnresolvedLocalSpecifier(moduleName, pendingCandidates) || moduleName.startsWith('#'),
        pendingCandidates,
      }
    }

    const name = this.normalizePath(module.resolvedFileName)
    if (module.isExternalLibraryImport || name.includes('/node_modules/')) {
      return { configurationFiles: [], local: false, pendingCandidates: [] }
    }
    if (!this.isInCheckout(name)) {
      return {
        configurationFiles: [...configurationFiles].sort(),
        local: this.isUnresolvedLocalSpecifier(moduleName, pendingCandidates),
        pendingCandidates,
      }
    }

    const existing = project.getSourceFile(name)
    if (existing) {
      this.removedSourcePaths.delete(name)
      return {
        configurationFiles: [...configurationFiles].sort(),
        local: true,
        pendingCandidates,
        sourceFile: existing,
      }
    }
    const withResolvedTarget = pendingCandidates.includes(name) ? pendingCandidates : [...pendingCandidates, name]
    if (this.removedSourcePaths.has(name)) {
      return {
        configurationFiles: [...configurationFiles].sort(),
        local: true,
        pendingCandidates: withResolvedTarget,
      }
    }

    try {
      this.resolutionWork.sourceFilesRead++
      const content = project.getFileSystem().readFileSync(name)
      const sourceFile = project.createSourceFile(name, content, {
        // Resolution hosts can leave a compiler source in ts-morph's factory without adding
        // it to the Project. It is not observable through getSourceFile, but create still
        // sees it; overwrite publishes our explicitly read copy into the owned graph.
        overwrite: true,
        scriptKind: scriptKindFor(name),
      })
      this.resolutionWork.sourceFilesAdded++
      this.canonicalPaths.set(name, this.normalizePath(sourceFile.getFilePath()))
      return { configurationFiles: [...configurationFiles].sort(), local: true, pendingCandidates, sourceFile }
    } catch (error) {
      if ((error as NodeJS.ErrnoException)?.code !== 'ENOENT') throw error
      return {
        configurationFiles: [...configurationFiles].sort(),
        local: true,
        pendingCandidates: withResolvedTarget,
      }
    }
  }

  private retractImporter = (importer: string) => {
    for (const previous of this.dependencies.get(importer) ?? []) {
      const reverse = this.dependents.get(previous)
      reverse?.delete(importer)
      if (reverse?.size === 0) this.dependents.delete(previous)
    }
    this.dependencies.delete(importer)
    this.unresolvedImporters.delete(importer)
    this.resolutionsByImporter.delete(importer)

    for (const [removed, importers] of this.removedDependents) {
      importers.delete(importer)
      if (importers.size === 0) this.removedDependents.delete(removed)
    }
  }

  private publishResolutionFacts = (
    importer: string,
    sourceFile: SourceFile,
    text: string,
    facts: readonly ResolutionFact[],
    pendingCandidates: readonly PendingResolutionCandidate[],
    configurationFiles: readonly ResolutionConfigurationFile[],
  ) => {
    this.retractImporter(importer)
    const current = new Set<string>()

    for (const fact of facts) {
      if (!fact.target || fact.target === importer) continue
      const importers = this.dependents.get(fact.target) ?? new Set<string>()
      importers.add(importer)
      this.dependents.set(fact.target, importers)
      current.add(fact.target)
    }

    this.dependencies.set(importer, current)
    if (pendingCandidates.length > 0 || facts.some((fact) => fact.target === null)) {
      this.unresolvedImporters.add(importer)
    }
    this.resolutionsByImporter.set(importer, {
      configurationFiles: Object.freeze([...configurationFiles]),
      facts: Object.freeze([...facts]),
      hasPendingLocalCandidate: pendingCandidates.length > 0,
      pendingCandidates: Object.freeze([...pendingCandidates]),
      sourceFile,
      text,
      treeRevision: this.#fileTreeRevision,
    })
  }

  private ensureResolutionFacts = (sourceFile: SourceFile): ImporterResolution => {
    this.#assertNotLoading()
    const importer = this.normalizePath(sourceFile.getFilePath())
    const text = sourceFile.getFullText()
    const cached = this.resolutionsByImporter.get(importer)
    if (cached?.sourceFile === sourceFile && cached.text === text && cached.treeRevision === this.#fileTreeRevision) {
      return cached
    }
    const declarations = [
      ...sourceFile.getImportDeclarations().map((declaration) => ({ declaration, kind: 'import' as const })),
      ...sourceFile.getExportDeclarations().map((declaration) => ({ declaration, kind: 'export' as const })),
    ]
      .filter(({ declaration }) => declaration.getModuleSpecifierValue() !== undefined)
      .sort((left, right) => left.declaration.getStart() - right.declaration.getStart())

    const facts: ResolutionFact[] = []
    const pendingCandidates: PendingResolutionCandidate[] = []
    const configurationFiles: ResolutionConfigurationFile[] = []
    for (const [ordinal, { declaration, kind }] of declarations.entries()) {
      const specifier = declaration.getModuleSpecifierValue()
      if (!specifier) continue
      const resolved = this.resolveSpecifier(specifier, sourceFile)
      if (!resolved.local) continue

      facts.push(
        Object.freeze({
          importer,
          target: resolved.sourceFile ? this.normalizePath(resolved.sourceFile.getFilePath()) : null,
          specifier,
          kind,
          ordinal,
        }),
      )
      for (const target of resolved.pendingCandidates) {
        pendingCandidates.push(Object.freeze({ importer, target, specifier, kind, ordinal }))
      }
      for (const target of resolved.configurationFiles) {
        configurationFiles.push(Object.freeze({ importer, target, specifier, kind, ordinal }))
      }
    }

    this.publishResolutionFacts(importer, sourceFile, text, facts, pendingCandidates, configurationFiles)
    return this.resolutionsByImporter.get(importer)!
  }

  /** The sole cross-file source resolver supplied to parser and extractor. */
  private resolveModule = (specifier: string, from: SourceFile): SourceFile | undefined => {
    const resolution = this.ensureResolutionFacts(from)
    const target = resolution.facts.find((fact) => fact.specifier === specifier)?.target
    if (!target) return

    const sourceFile = this.project.getSourceFile(target)
    if (!sourceFile) return
    this.prepareEffectiveSource(sourceFile.getFilePath(), sourceFile)
    return sourceFile
  }

  private trackDependencies = (filePath: string, sourceFile: SourceFile) => {
    this.#assertNotLoading()
    const importer = this.normalizePath(sourceFile.getFilePath())
    this.canonicalPaths.set(this.normalizePath(filePath), importer)
    this.canonicalPaths.set(importer, importer)
    this.ensureResolutionFacts(sourceFile)
  }

  private invalidateSourcePreparation = (filePath: string, sourceFile?: SourceFile) => {
    const sourcePath = this.normalizePath(sourceFile?.getFilePath() ?? filePath)
    const preparation = this.sourcePreparations.get(sourcePath)
    if (preparation?.state === 'preparing') preparation.invalidated = true
    this.sourcePreparations.delete(sourcePath)
    this.retractImporter(sourcePath)
  }

  /**
   * Apply the parser hook and built-in transform once to one source revision.
   *
   * Resolver traversal is a semantic read just as surely as an explicit parse: returning a
   * raw dependency here would let parse order decide both the value extraction sees and the
   * downstream edges the ledger records. The transaction is published only after the AST and
   * its facts agree. A failed or re-entered attempt restores the input AST and can be retried.
   */
  private prepareEffectiveSource = (filePath: string, sourceFile: SourceFile): EffectiveSourcePreparation => {
    this.#assertNotLoading()
    const sourcePath = this.normalizePath(sourceFile.getFilePath())
    const currentText = sourceFile.getFullText()
    const current = this.sourcePreparations.get(sourcePath)

    if (current?.state === 'ready' && current.sourceFile === sourceFile && current.effectiveText === currentText) {
      // The hook is revision-scoped, but resolution facts are tree-revision-scoped. A file
      // appearing beside an unchanged prepared source can satisfy one of its previous misses.
      this.trackDependencies(filePath, sourceFile)
      return current
    }

    if (current?.state === 'preparing') {
      // Poison the outer transaction even when user hook code catches this error. Publishing
      // after observed re-entry would expose whichever partial AST the nested call happened to
      // see, just like publishing a partially materialized deferred Project would.
      current.invalidated = true
      throw new Error(`Project source is already being prepared: ${sourcePath}`)
    }

    this.sourcePreparations.delete(sourcePath)
    this.retractImporter(sourcePath)

    const transaction: SourcePreparationTransaction = {
      state: 'preparing',
      sourceFile,
      inputText: currentText,
      invalidated: false,
    }
    this.sourcePreparations.set(sourcePath, transaction)

    const assertTransaction = (expectedText: string) => {
      let actualText: string
      try {
        actualText = sourceFile.getFullText()
      } catch {
        transaction.invalidated = true
        actualText = ''
      }
      if (
        transaction.invalidated ||
        this.sourcePreparations.get(sourcePath) !== transaction ||
        actualText !== expectedText
      ) {
        throw new Error(`Project source changed while it was being prepared: ${sourcePath}`)
      }
    }

    const options: ParserResultConfigureOptions = {}

    try {
      const custom = this.options.hooks['parser:before']?.({
        filePath,
        content: currentText,
        configure(next) {
          const { matchTag, matchTagMode, matchTagProp } = next
          if (matchTag) options.matchTag = matchTag
          if (matchTagMode) options.matchTagMode = matchTagMode
          if (matchTagProp) options.matchTagProp = matchTagProp
        },
      })
      assertTransaction(currentText)

      const transformed = custom ?? this.transformFile(filePath, currentText)
      assertTransaction(currentText)
      if (currentText !== transformed) sourceFile.replaceWithText(transformed)
      assertTransaction(transformed)

      this.trackDependencies(filePath, sourceFile)
      assertTransaction(transformed)

      const ready = Object.freeze({
        state: 'ready' as const,
        sourceFile,
        inputText: currentText,
        effectiveText: transformed,
        options: Object.freeze({ ...options }),
      })
      this.sourcePreparations.set(sourcePath, ready)
      return ready
    } catch (error) {
      if (this.sourcePreparations.get(sourcePath) === transaction) this.sourcePreparations.delete(sourcePath)
      this.retractImporter(sourcePath)
      try {
        if (sourceFile.getFullText() !== currentText) sourceFile.replaceWithText(currentText)
      } catch {
        // The source may have been removed by the re-entrant operation. Its replacement or
        // re-add is the next revision and will create a fresh preparation transaction.
      }
      throw error
    }
  }

  private markTargetRemoved = (target: string, sourceFile: SourceFile) => {
    const importers = new Set(this.dependents.get(target) ?? [])
    if (importers.size > 0) this.removedDependents.set(target, importers)

    for (const importer of importers) {
      const entry = this.resolutionsByImporter.get(importer)
      if (!entry) continue

      const facts = entry.facts.map((fact) =>
        fact.target === target ? Object.freeze({ ...fact, target: null }) : fact,
      )
      const current = this.dependencies.get(importer)
      current?.delete(target)
      if (facts.some((fact) => fact.target === null)) {
        this.unresolvedImporters.add(importer)
      }
      this.resolutionsByImporter.set(importer, {
        ...entry,
        facts: Object.freeze(facts),
        hasPendingLocalCandidate: true,
      })
    }

    this.dependents.delete(target)
    this.retractImporter(target)
    this.removedSourcePaths.add(target)
    this.canonicalPaths.set(target, target)
    this.canonicalPaths.set(this.normalizePath(sourceFile.getFilePath()), target)
  }

  /**
   * Every file that transitively imports `filePath`, so a watcher can re-parse the
   * consumers of an edited file. Excludes `filePath` itself.
   */
  getDependents = (filePath: string): string[] => {
    this.#assertNotLoading()
    // Callers pass whatever the watcher handed them — relative, aliased, or
    // platform-specific. The graph is keyed on the source file's own path, so
    // resolve through the project first rather than string-matching.
    const given = this.normalizePath(filePath)
    const resolved = this.project.getSourceFile(filePath)?.getFilePath()
    const start = resolved ? this.normalizePath(resolved) : (this.canonicalPaths.get(given) ?? given)
    const seen = new Set<string>()
    const queue = [start]

    while (queue.length) {
      const current = queue.shift()!
      const importers = new Set([
        ...(this.dependents.get(current) ?? []),
        ...(this.removedDependents.get(current) ?? []),
      ])
      for (const importer of [...importers].sort()) {
        if (importer === start || seen.has(importer)) continue
        seen.add(importer)
        queue.push(importer)
      }
    }

    return [...seen].sort()
  }

  /**
   * Every local source transitively read by `filePath`, excluding the file itself. When
   * `targets` are supplied, retain only paths leading to one of those semantic reads.
   *
   * This is the forward half of `getDependents`, exposed for bundler consumers which must
   * register the complete semantic read-set as watch files. Walking the indexed ledger closure
   * avoids rescanning every resolution fact once per transformed module.
   */
  getDependencies = (filePath: string, targets?: Iterable<string>): string[] => {
    this.#assertNotLoading()
    const given = this.normalizePath(filePath)
    const resolved = this.project.getSourceFile(filePath)?.getFilePath()
    const start = resolved ? this.normalizePath(resolved) : (this.canonicalPaths.get(given) ?? given)
    const seen = new Set<string>()
    const importersByDependency = new Map<string, Set<string>>()
    const queue = [start]

    while (queue.length) {
      const current = queue.shift()!
      for (const dependency of [...(this.dependencies.get(current) ?? [])].sort()) {
        const importers = importersByDependency.get(dependency) ?? new Set<string>()
        importers.add(current)
        importersByDependency.set(dependency, importers)
        if (dependency === start || seen.has(dependency)) continue
        seen.add(dependency)
        queue.push(dependency)
      }
    }

    if (targets === undefined) return [...seen].sort()

    // Keep only paths lying between this importer and a dependency the semantic consumer
    // actually read. This preserves re-export/barrel bridges without turning every unrelated
    // runtime import into a direct watch dependency.
    const selected = new Set<string>()
    const reverse = Array.from(targets, (target) => {
      const normalized = this.normalizePath(target)
      const source = this.project.getSourceFile(target)?.getFilePath()
      return source ? this.normalizePath(source) : (this.canonicalPaths.get(normalized) ?? normalized)
    }).filter((target) => seen.has(target))

    while (reverse.length) {
      const dependency = reverse.shift()!
      if (selected.has(dependency)) continue
      selected.add(dependency)
      for (const importer of importersByDependency.get(dependency) ?? []) {
        if (importer !== start && !selected.has(importer)) reverse.push(importer)
      }
    }

    return [...selected].sort()
  }

  /**
   * Exact semantic dependencies plus missing local resolver candidates which can supersede
   * one of those dependencies.
   *
   * Candidate provenance stays attached to its import/export fact. Filtering those facts
   * through the selected dependency closure keeps an unrelated runtime import—even a local
   * alias with its own fallback—out of the watch set without asking consumers to reinterpret
   * specifiers or scan the checkout.
   */
  getResolutionReadSet = (
    filePath: string,
    targets?: Iterable<string>,
    previous?: ResolutionReadSet,
  ): ResolutionReadSet => {
    const dependencies = this.getDependencies(filePath, targets)
    const selected = new Set(dependencies)
    const retained = new Set([...(previous?.dependencies ?? []), ...(previous?.pendingCandidates ?? [])])
    const given = this.normalizePath(filePath)
    const resolved = this.project.getSourceFile(filePath)?.getFilePath()
    const start = resolved ? this.normalizePath(resolved) : (this.canonicalPaths.get(given) ?? given)
    const pendingCandidates = new Set<string>()

    for (const importer of [start, ...dependencies]) {
      const resolution = this.resolutionsByImporter.get(importer)
      if (!resolution) continue
      const semanticOrdinals = new Set(
        resolution.facts
          .filter((fact) => fact.target !== null && selected.has(fact.target))
          .map((fact) => fact.ordinal),
      )
      // Once the active fallback disappears there is no target node for a fresh ParserResult
      // to name. Preserve semantic status only for the same null resolution fact, and only
      // when one of the resolver's current candidates was part of the caller's prior exact
      // read-set. The caller omits history after an owner/config change, so unrelated local
      // runtime misses cannot acquire this status.
      for (const fact of resolution.facts) {
        if (fact.target !== null) continue
        if (
          resolution.pendingCandidates.some(
            (candidate) => candidate.ordinal === fact.ordinal && retained.has(candidate.target),
          )
        ) {
          semanticOrdinals.add(fact.ordinal)
        }
      }
      for (const candidate of resolution.pendingCandidates) {
        if (semanticOrdinals.has(candidate.ordinal)) pendingCandidates.add(candidate.target)
      }
    }

    return Object.freeze({
      dependencies: Object.freeze([...dependencies]),
      pendingCandidates: Object.freeze([...pendingCandidates].sort()),
    })
  }

  /**
   * Exact resolution configuration files read by the semantic closure selected by `targets`.
   *
   * Package manifests stay attached to their import/export ordinal, so a runtime-only branch
   * cannot turn an arbitrary package.json into a Builder dependency. Tsconfig files are global
   * inputs to those same selected facts and are added only when the owner has a semantic
   * cross-file read.
   *
   * @internal
   */
  getResolutionConfigurationFiles = (
    filePath: string,
    targets?: Iterable<string>,
    previous: Iterable<string> = [],
  ): readonly string[] => {
    const dependencies = this.getDependencies(filePath, targets)
    const selected = new Set(dependencies)
    const retained = new Set(Array.from(previous, (file) => this.normalizePath(file)))
    const given = this.normalizePath(filePath)
    const resolved = this.project.getSourceFile(filePath)?.getFilePath()
    const start = resolved ? this.normalizePath(resolved) : (this.canonicalPaths.get(given) ?? given)
    const files = new Set<string>()
    let hasSemanticFact = false

    for (const importer of [start, ...dependencies]) {
      const resolution = this.resolutionsByImporter.get(importer)
      if (!resolution) continue
      const semanticOrdinals = new Set(
        resolution.facts
          .filter((fact) => fact.target !== null && selected.has(fact.target))
          .map((fact) => fact.ordinal),
      )
      for (const fact of resolution.facts) {
        if (fact.target !== null) continue
        if (
          resolution.configurationFiles.some(
            (configuration) => configuration.ordinal === fact.ordinal && retained.has(configuration.target),
          )
        ) {
          semanticOrdinals.add(fact.ordinal)
        }
      }
      if (semanticOrdinals.size > 0) hasSemanticFact = true
      for (const configuration of resolution.configurationFiles) {
        if (semanticOrdinals.has(configuration.ordinal)) files.add(configuration.target)
      }
    }

    if (hasSemanticFact) {
      for (const file of this.options.resolutionConfigFiles ?? []) files.add(this.normalizePath(file))
    }
    return Object.freeze([...files].sort())
  }

  createSourceFile = (filePath: string): SourceFile => {
    this.#assertNotLoading()
    this.#ensureSourceFiles()
    const { readFile } = this.options
    const content = readFile(filePath)
    // A file appearing can satisfy an import that previously resolved to nothing,
    // and this overwrites when the path already exists.
    const existing = this.project.getSourceFile(filePath)
    this.invalidateSourcePreparation(filePath, existing)
    this.removedSourcePaths.delete(this.normalizePath(filePath))
    this.invalidate()
    return this.project.createSourceFile(filePath, content, {
      overwrite: true,
      scriptKind: scriptKindFor(filePath),
    })
  }

  createSourceFiles = () => {
    this.#assertNotLoading()
    this.#ensureSourceFiles()
    const files = this.getFiles()
    for (const file of files) {
      // A file can disappear between being globbed and being read — a watch rebuild racing a
      // delete, a generated fixture cleaning itself up, a branch switch mid-build. That is a
      // file to skip, not a build to fail: it is not in the project any more, so it has no
      // styles to contribute. Anything else still throws.
      try {
        this.createSourceFile(file)
      } catch (error) {
        if ((error as NodeJS.ErrnoException)?.code !== 'ENOENT') throw error
      }
    }
  }

  addSourceFile = (filePath: string, content: string): SourceFile => {
    this.#assertNotLoading()
    this.#ensureSourceFiles()
    // Path-qualified, because `getSourceFile` falls back to a suffix search for a bare
    // filename — so `styles.ts` would match an existing `/app/styles.ts`, report the tree
    // unchanged, and leave a negative resolution cached against the `/styles.ts` this then
    // creates.
    const existing = filePath.includes('/') ? this.project.getSourceFile(filePath) : undefined

    /**
     * Re-adding a file the text it already holds is a no-op, and saying so is what makes the
     * bundler transform path affordable.
     *
     * That path adds every module before parsing it, handing back what the extractor already
     * read off disk — measured on a 6,307-file build, 6,001 of 6,001 `addSourceFile` calls
     * from the vite transform passed byte-identical content, with none differing and none
     * absent. Each paid twice: `createSourceFile` overwrites, which re-parses the file and
     * forgets every node previously taken from it, and `invalidate` drops both caches
     * memoized against *other* files' contents. The second is what actually hurt — the
     * imported-recipe walk runs one line later, in `parseSourceFile`, so emptying its memo
     * here meant every module re-walked the whole export closure of every barrel it imports.
     * On that build: 1,866,610 `walkExports` and 3,734,123 module resolutions, against 36,610
     * and 98,123 once the memo survives.
     *
     * Nothing changed, so nothing needs invalidating, and the file's existing tree is not
     * merely reusable but strictly better — a caller holding one of its nodes keeps it.
     *
     * Compared against `getFullText` rather than the bytes on disk, because `parseSourceFile`
     * may have replaced this file's text through a `parser:before` hook. Such a file no longer
     * matches its own source, falls through, and is overwritten exactly as before.
     */
    if (existing && existing.getFullText() === content) return existing

    // Resolutions memoized against other files' nodes can now be out of date.
    this.invalidateSourcePreparation(filePath, existing)
    this.removedSourcePaths.delete(this.normalizePath(filePath))
    this.invalidate(!existing)
    return this.project.createSourceFile(filePath, content, {
      overwrite: true,
      scriptKind: scriptKindFor(filePath),
    })
  }

  removeSourceFile = (filePath: string): boolean => {
    this.#assertNotLoading()
    this.#ensureSourceFiles()
    const sourceFile = this.project.getSourceFile(filePath)
    if (sourceFile) {
      // Importers memoized the values this file exported; without dropping them
      // they would keep emitting styles from a file that no longer exists.
      this.invalidate()
      this.invalidateSourcePreparation(filePath, sourceFile)
      this.markTargetRemoved(this.normalizePath(sourceFile.getFilePath()), sourceFile)
      // Same for the styles themselves. Nothing re-parses a file that is gone, so its rules
      // would otherwise outlive it for as long as the context does.
      this.options.parserOptions.encoder.releaseFile(sourceFile.getFilePath())
      return this.project.removeSourceFile(sourceFile)
    }
    return false
  }

  reloadSourceFile = (filePath: string): FileSystemRefreshResult | undefined => {
    this.#assertNotLoading()
    this.#ensureSourceFiles()
    // Same reason as `addSourceFile`: this is the watch-mode entry point for an
    // edit, and importers' memoized resolutions must not survive it. The file tree is
    // unchanged — this path re-reads a file the project already holds.
    this.invalidate(false)
    const sourceFile = this.getSourceFile(filePath)
    if (!sourceFile) return
    this.invalidateSourcePreparation(filePath, sourceFile)
    return sourceFile.refreshFromFileSystemSync()
  }

  reloadSourceFiles = () => {
    this.#assertNotLoading()
    this.#ensureSourceFiles()
    const files = this.getFiles()

    // Once for the batch rather than per file: every file is about to be re-read,
    // so any resolution memoized against another file's contents is suspect.
    this.invalidate()

    for (const file of files) {
      const source = this.getSourceFile(file)
      if (source) {
        this.invalidateSourcePreparation(file, source)
        source.refreshFromFileSystemSync()
      } else {
        this.invalidateSourcePreparation(file)
        this.removedSourcePaths.delete(this.normalizePath(file))
        this.project.createSourceFile(file, this.options.readFile(file), {
          overwrite: true,
          scriptKind: scriptKindFor(file),
        })
      }
    }
  }

  get readFile() {
    this.#assertNotLoading()
    return this.options.readFile
  }

  get getFiles() {
    this.#assertNotLoading()
    return this.options.getFiles
  }

  parseJson = (filePath: string) => {
    this.#assertNotLoading()
    const { readFile, parserOptions } = this.options

    const content = readFile(filePath)
    parserOptions.encoder.fromJSON(JSON.parse(content))

    const result = new ParserResult(parserOptions)
    return result.setFilePath(filePath)
  }

  parseSourceFile = (filePath: string, encoder?: ParserOptions['encoder']) => {
    this.#assertNotLoading()
    const { hooks } = this.options

    if (filePath.endsWith('.json')) {
      return this.parseJson(filePath)
    }

    const sourceFile = this.project.getSourceFile(filePath)
    if (!sourceFile) return
    const { options } = this.prepareEffectiveSource(filePath, sourceFile)

    // Attributed to this file, so a later reading of it replaces what this one encoded rather
    // than adding to it. Keyed off the source file's own path rather than the argument, which
    // callers spell differently; and under `parse` rather than `extract`, so a bundler
    // transform and the extraction pass hold their readings of the same module separately.
    // `withOwner` defers to an owner already recording, which is how `BambooContext.parseFile`
    // claims the whole parse for `extract` instead.
    const target = encoder ?? this.options.parserOptions.encoder
    const result = target
      .withOwner('parse', sourceFile.getFilePath(), () => this.parser(sourceFile, encoder, options, this.resolveModule))
      ?.setFilePath(filePath)

    hooks['parser:after']?.({ filePath, result })

    return result
  }

  transformFile = (_filePath: string, content: string): string => {
    this.#assertNotLoading()
    return content
  }

  classify = (fileMap: Map<string, ParserResultInterface>) => {
    this.#assertNotLoading()
    const { parserOptions } = this.options
    return classifyProject(parserOptions, fileMap)
  }
}
