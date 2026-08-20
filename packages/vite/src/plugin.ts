import { createHash, createHmac, randomBytes, timingSafeEqual } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

import { logger } from '@bamboocss/logger'
import { truncateList } from '@bamboocss/shared'
import { markStaticCompilerActive } from '@bamboocss/node/static-compiler'
import type { Plugin } from 'vite'
import { asError, bamboocssCss, VIRTUAL_CSS_ID } from './css'
import { bare } from './class-name'
import type { FoldResult, ForeignRecipes, SkipReason, SkippedCall } from './fold'
import { createLazyCompilerState, createRetryableLazy, loadFoldModule, loadNodeModule } from './lazy-modules'
import type { RuntimeCss } from './runtime-css'
import type { StaticStyleSetCompiler } from './style-set'
import { createStaticCompilationSession, remainingEnvironments } from './static-session'

export interface BambooVitePluginOptions {
  /** Path to `bamboo.config.ts`. Resolved the same way the CLI resolves it. */
  configPath?: string
  cwd?: string
  /**
   * Report every call site the compiler rejected, and why, per file.
   *
   * @default false
   */
  reportSkipped?: boolean
  /**
   * Print a coverage summary when the build finishes: how much compiled, and why any
   * candidates were rejected.
   *
   * On by default. Without it there is no signal that the transform did anything, and
   * no way to tell a project where everything folds from one where nothing does.
   *
   * @default true
   */
  reportSummary?: boolean
  /**
   * Maximum complete selections compiled for one runtime `cva`/`sva` call. This bounds
   * build time and memory for the exact compound-variant decision table. @default 65536
   */
  maxRecipeStates?: number
  /**
   * Remove rules for atoms no compiled module can emit. Builds only; dev never prunes.
   *
   * Off ships the whole extracted stylesheet: every rule the source graph produced, including
   * ones nothing reaches. Larger, and never wrong *by pruning*. Bamboo still refuses a sheet
   * which lacks a compiler-owned rule named by live JavaScript; disabling pruning cannot make
   * that mixed-generation output styled.
   *
   * The pruned sheet is also renamed to a hash of its own bytes, and that is not a separate
   * setting because it cannot safely be one. Rollup and Rolldown expand `[hash]` before
   * `generateBundle`, where pruning has to run, so the name Vite assigned describes the sheet
   * as it was *before* pruning. Leaving that name on pruned bytes is how a stale stylesheet
   * outlives a deploy — a change to reachability alone, which is what upgrading Bamboo is,
   * leaves identical source CSS under an identical name with different content, and a CDN
   * holding that key keeps serving the old one. So the bytes and the name move together or
   * neither does.
   *
   * Reach for this if something downstream derives an artifact from the stylesheet's *content*
   * during `generateBundle` before Bamboo runs — subresource integrity is the clear case, since
   * an `integrity` attribute is a digest of the bytes and no amount of reference rewriting can
   * carry it across an edit — or to rule pruning out while diagnosing a missing rule. Where the
   * consumer can be moved after Bamboo instead (`order: 'post'`, `writeBundle`, `closeBundle`),
   * do that and keep the pruning.
   *
   * @default true
   */
  pruneCss?: boolean
}

const DEFAULT_EXTENSIONS = /\.(?:[cm]?[jt]sx?)$/
const NODE_MODULES = /node_modules/
const TRANSFORM_META_KEY = 'bamboocss:transform'
const TRANSFORM_ARTIFACT_VERSION = 3 as const

/**
 * Queries that make Vite serve something other than the module's own source.
 *
 * `./theme.tsx?raw` is a module whose text is `export default "…"`, and `?url`, `?worker` and
 * `?sharedworker` are wrappers of the same kind. The query has to be stripped before the
 * extension is tested — otherwise nothing matches `.tsx` — and stripping it is what made these
 * look like the file itself. The transform then handed the wrapper's text to ts-morph *under
 * the real file's path*, overwriting the parsed module every fold reads for that path.
 *
 * That is not theoretical: a module folding `css(shared)` against a sibling the entry also
 * imported as `?raw` failed the build with "1 call(s) could not be compiled" — the compiler
 * had read `export default "…"` and found no `shared` to resolve. The advice it prints, to
 * make the value statically analyzable, is unfollowable, because the source already was.
 *
 * Whether it bites depends on which of the two ids Rollup transforms last, so the same project
 * can build and then stop building because an import moved.
 *
 * A deny list rather than an allow list of benign queries: dev ids carry `?t=` after an edit
 * and `?import` when a dynamic import is rewritten, and rejecting an unrecognised one of those
 * would silently stop folding a module rather than loudly refuse it.
 *
 * Exactly these four, matching Vite's own `SPECIAL_QUERY_RE`. The list was drafted wider —
 * `?inline`, `?no-inline`, `?worklet`, `?init` — and every one of those was wrong: Vite has no
 * `worklet` query at all, `?init` is `.wasm` only and that extension is already rejected below,
 * and `inline`/`no-inline` merely pick base64-versus-file for something that *already* matched
 * `raw`/`url`, so `./a.tsx?inline` is served as the module's own source. Rejecting an id that
 * carries real source is the expensive direction: the transform declines, its atoms never reach
 * the reachability set, pruning removes their rules, and the runtime still returns the class
 * names — unstyled elements, no error. Only names verified against Vite belong here.
 *
 * Note `?worker_file`, which is how dev serves a worker's *real* source, is deliberately absent
 * and must stay absent. It contains "worker" and is the obvious next entry; adding it would
 * stop folding every worker module in dev, silently, by the mechanism above.
 *
 * Tested against the whole id rather than a split-off query, so it cannot disagree with
 * `queryOf` in `css.ts` about where the query starts.
 */
const WRAPPED_MODULE_QUERY = /[?&](?:raw|url|worker|sharedworker)(?:&|=|$)/

const shouldTransform = (id: string) => {
  // Rollup marks a virtual module by prefixing its id with a NUL. Those have no file
  // on disk, so the CSS extractor never reads them and a class folded here could have
  // no rule behind it — besides which, the id is not a path ts-morph should be given.
  if (id.startsWith('\0')) return false
  if (WRAPPED_MODULE_QUERY.test(id)) return false

  const [filePath] = id.split('?')
  if (!filePath) return false
  if (NODE_MODULES.test(filePath)) return false
  return DEFAULT_EXTENSIONS.test(filePath)
}

/**
 * Is this file part of the generated `styled-system` rather than the user's source?
 *
 * Resolved to a path and compared as a prefix, rather than by looking for the outdir's
 * last segment somewhere in the file's path. `outdir` is a user setting: a project that
 * generates into `src/styles` would otherwise have *every* directory named `styles`
 * treated as generated, and folding would quietly stop happening in the one place an app
 * is most likely to keep its style calls.
 *
 * `resolve` rather than `join`, so an absolute `outdir` is honoured rather than appended
 * to the cwd.
 */
export const isGeneratedOutput = (filePath: string, ctx: { config: { cwd: string; outdir: string } }) => {
  const { cwd, outdir } = ctx.config
  if (!outdir) return false

  const slashed = (value: string) => value.replaceAll('\\', '/').replace(/\/$/, '')

  const root = slashed(resolve(cwd, outdir))
  const file = slashed(filePath)

  return file === root || file.startsWith(`${root}/`)
}

/** 1-indexed line of a source offset, for an error a user can navigate to. */
const lineAt = (code: string, offset: number) => code.slice(0, offset).split('\n').length

/**
 * One spelling for a path used as a map key against paths from somewhere else.
 *
 * The fold reports dependencies as ts-morph sees them and Vite reports a changed file as its
 * watcher saw it. On Windows those differ by separator, and can differ by the case of the
 * drive letter alone — chokidar reports what the OS handed it, `path.resolve` preserves
 * whatever the cwd had. Either would make every lookup below miss and restore the exact
 * staleness they exist to fix, silently, since a miss is indistinguishable from a module that
 * folded nothing. Only the drive letter is case-folded: the rest of the path is compared as
 * written, because elsewhere the filesystem may well be case-sensitive.
 */
export const normalizeFsPath = (file: string) =>
  resolve(file)
    .replaceAll('\\', '/')
    .replace(/^[a-z]:\//, (drive) => drive.toUpperCase())

const formatSkipped = (id: string, skipped: SkippedCall[]) => {
  const counts = new Map<string, number>()
  for (const entry of skipped) {
    counts.set(entry.reason, (counts.get(entry.reason) ?? 0) + 1)
  }
  const summary = Array.from(counts.entries())
    .map(([reason, count]) => `${reason}=${count}`)
    .join(' ')
  return `${id}: ${summary}`
}

/**
 * Vite integration for Bamboo CSS.
 *
 * Two plugins, because they do unrelated jobs on different schedules. The first emits the
 * stylesheet as a virtual module and runs in dev and build alike — that is the integration,
 * and nothing styles without it. The second compiles every Bamboo source call in both dev
 * and build; there is no runtime styling fallback.
 *
 * The compiler runs with `enforce: 'pre'` so it sees module source as close as possible to what
 * the CSS extractor reads off disk. A plugin that rewrites style calls before bamboo
 * sees them would otherwise make the two disagree, and a folded class could end up
 * with no matching rule.
 */
export const bamboocss = (options: BambooVitePluginOptions = {}): Plugin[] => {
  const { configPath, cwd, reportSkipped = false, reportSummary = true, maxRecipeStates, pruneCss = true } = options

  // Announced here, as the Vite config is evaluated, which is before anything else Bamboo runs
  // in this process. `@bamboocss/postcss` reads it to tell a project that deliberately emits
  // CSS through PostCSS from one that has Vite and never added this plugin — the second ships
  // the style engine to the client, and nothing else about it looks wrong.
  markStaticCompilerActive()

  if (maxRecipeStates !== undefined && (!Number.isSafeInteger(maxRecipeStates) || maxRecipeStates < 1)) {
    throw new Error('bamboocss: `maxRecipeStates` must be a positive safe integer.')
  }

  // Thrown rather than ignored, because ignoring it silently restores the behaviour the
  // setting existed to decline. Vite loads `vite.config.ts` through esbuild, which strips
  // types without checking them, so a removed option is not a type error to anyone who does
  // not separately run `tsc` over their config — it is a key that stops doing anything. A
  // project that set this because a renamed asset breaks something downstream would have
  // pruning *and* renaming quietly switched back on by upgrading.
  if ('renameCssAsset' in options) {
    throw new Error(
      'bamboocss: `renameCssAsset` has been replaced by `pruneCss`. Use `pruneCss: false` for what ' +
        '`renameCssAsset: false` did — it always disabled the pruning as well, since pruned bytes under the ' +
        "unpruned sheet's name is what lets a CDN serve a stale stylesheet. The new name says which of the two " +
        'it is really about.',
    )
  }

  const staticSession = createStaticCompilationSession()

  type Survivor = { file: string; line: number; name: string; reason: SkipReason }
  interface TransformArtifactPayload {
    version: typeof TRANSFORM_ARTIFACT_VERSION
    moduleId: string
    file: string
    folded: number
    skipped: Array<[reason: SkipReason, count: number]>
    survivors: Array<Omit<Survivor, 'file'>>
    transformedFile: boolean
    classNames: string[]
    dependencies: string[]
    signature?: { input: string; output: string; path: string }
  }
  interface TransformArtifact extends TransformArtifactPayload {
    integrity: string
  }

  // Private to this plugin instance and deliberately absent from transform metadata. A later
  // plugin may read and even replace the serializable artifact, but it cannot mint a valid tag
  // for changed reachability, diagnostics, dependency edges or signatures.
  const transformArtifactIntegrityKey = randomBytes(32)
  const serializeTransformArtifact = (environment: string, artifact: TransformArtifactPayload) =>
    JSON.stringify([
      TRANSFORM_META_KEY,
      environment,
      artifact.version,
      artifact.moduleId,
      artifact.file,
      artifact.folded,
      artifact.skipped.map(([reason, count]) => [reason, count]),
      artifact.survivors.map(({ line, name, reason }) => [line, name, reason]),
      artifact.transformedFile,
      [...artifact.classNames],
      [...artifact.dependencies],
      artifact.signature ? [artifact.signature.input, artifact.signature.output, artifact.signature.path] : null,
    ])
  const transformArtifactIntegrity = (environment: string, artifact: TransformArtifactPayload) =>
    createHmac('sha256', transformArtifactIntegrityKey)
      .update(serializeTransformArtifact(environment, artifact))
      .digest('base64url')
  const sealTransformArtifact = (environment: string, artifact: TransformArtifactPayload): TransformArtifact => ({
    ...artifact,
    integrity: transformArtifactIntegrity(environment, artifact),
  })

  const skipReasons = new Set<SkipReason>([
    'dynamic',
    'raw-call',
    'recipe-call',
    'unsupported-kind',
    'not-imported',
    'no-call-expression',
    'overlapping',
    'unresolved-token',
    'runtime-binding',
    'compile-failed',
  ])
  const isRecord = (value: unknown): value is Record<string, unknown> =>
    typeof value === 'object' && value !== null && !Array.isArray(value)
  const isNonNegativeInteger = (value: unknown) => Number.isSafeInteger(value) && (value as number) >= 0
  const isPositiveInteger = (value: unknown) => Number.isSafeInteger(value) && (value as number) > 0
  const isTransformArtifact = (value: unknown): value is TransformArtifact => {
    if (!isRecord(value) || value.version !== TRANSFORM_ARTIFACT_VERSION) return false
    if (typeof value.moduleId !== 'string' || typeof value.file !== 'string') return false
    if (!isNonNegativeInteger(value.folded) || typeof value.transformedFile !== 'boolean') return false
    if (typeof value.integrity !== 'string' || !/^[\w-]{43}$/.test(value.integrity)) return false
    if (!Array.isArray(value.classNames) || !value.classNames.every((entry) => typeof entry === 'string')) return false
    if (!Array.isArray(value.dependencies) || !value.dependencies.every((entry) => typeof entry === 'string'))
      return false
    if (
      !Array.isArray(value.skipped) ||
      !value.skipped.every(
        (entry) =>
          Array.isArray(entry) &&
          entry.length === 2 &&
          typeof entry[0] === 'string' &&
          skipReasons.has(entry[0] as SkipReason) &&
          isPositiveInteger(entry[1]),
      )
    ) {
      return false
    }
    if (
      !Array.isArray(value.survivors) ||
      !value.survivors.every(
        (entry) =>
          isRecord(entry) &&
          Number.isSafeInteger(entry.line) &&
          (entry.line as number) >= 1 &&
          typeof entry.name === 'string' &&
          typeof entry.reason === 'string' &&
          skipReasons.has(entry.reason as SkipReason),
      )
    ) {
      return false
    }
    if (value.signature === undefined) return true
    return (
      isRecord(value.signature) &&
      typeof value.signature.input === 'string' &&
      typeof value.signature.output === 'string' &&
      value.signature.path === value.file
    )
  }

  const hasValidTransformArtifactIntegrity = (environment: string, artifact: TransformArtifact) => {
    const expected = Buffer.from(transformArtifactIntegrity(environment, artifact))
    const actual = Buffer.from(artifact.integrity)
    return actual.length === expected.length && timingSafeEqual(actual, expected)
  }

  const cachedArtifactError = (id: string, environment: string, value: unknown, snapshotProblem?: string) => {
    let problem: string
    if (snapshotProblem) {
      problem = snapshotProblem
    } else if (!isRecord(value) || value.version !== TRANSFORM_ARTIFACT_VERSION) {
      problem =
        isRecord(value) && (typeof value.version === 'number' || typeof value.version === 'string')
          ? `uses version ${JSON.stringify(value.version)}; expected schema version ${TRANSFORM_ARTIFACT_VERSION}`
          : `is malformed and has no valid version; expected schema version ${TRANSFORM_ARTIFACT_VERSION}`
    } else if (!isTransformArtifact(value)) {
      problem = `is malformed for schema version ${TRANSFORM_ARTIFACT_VERSION}`
    } else if (value.moduleId !== id || value.file !== id.split('?')[0]) {
      problem = `does not belong to this module id and physical file`
    } else if (!hasValidTransformArtifactIntegrity(environment, value)) {
      problem = `failed its schema version ${TRANSFORM_ARTIFACT_VERSION} integrity check`
    } else {
      problem = `could not be validated for schema version ${TRANSFORM_ARTIFACT_VERSION}`
    }
    return new Error(
      `bamboocss: cached transform metadata for ${JSON.stringify(id)} in the ${JSON.stringify(environment)} ` +
        `environment ${problem}.\n\n` +
        `Bamboo cannot safely rebuild from this entry because cached JavaScript may still name CSS classes whose ` +
        `rules would be dropped. Restart Vite to invalidate its in-memory transform cache. If this persists, clear ` +
        `Vite's cache directory and rebuild.`,
    )
  }

  /**
   * One contribution per live bundler module ID, inside one Vite environment.
   *
   * Reporting groups these by physical file later, but ownership cannot: query variants share
   * one parser path while carrying independent transform output, diagnostics, dependencies and
   * cache entries. Replacing `dual.tsx?a` must not erase `dual.tsx?b`, fresh or cached. Nor can a
   * client transform replace the SSR contribution for the same ID: an upstream environment-aware
   * plugin is allowed to hand Bamboo different code in each graph.
   */
  interface EnvironmentTransformState {
    transformArtifactsByModule: Map<string, TransformArtifact>
    dependentsByDependency: Map<string, Set<string>>
    dependenciesByModule: Map<string, Set<string>>
    filesByModule: Map<string, string>
    foldSignatures: Map<string, { input: string; output: string; path: string }>
    recipeConfigCache: Map<string, ForeignRecipes>
    transformedModulesThisRun: Set<string>
    unchangedFolds: Map<string, boolean>
    changedRun: number
    cssLoaded: boolean
  }

  type EnvironmentContext = {
    environment?: { name?: string; config?: { build?: { emitAssets?: boolean } } }
  }
  // The configured name is Vite's stable identity across hook contexts. Vite 5 has no
  // environment object and runs one graph, which deliberately shares the `default` state.
  const transformStateByEnvironment = new Map<string, EnvironmentTransformState>()

  interface FoldMemoEntry {
    result: FoldResult
    parserDependencies: readonly string[]
    /** Whether the fold ran the survivor scan, which `transform`'s artifact requires. */
    reportedSurvivors: boolean
  }
  /**
   * One fold per file content per change event, shared across environments and hooks.
   *
   * A single edit folds the same bytes repeatedly: `hotUpdate` provisionally re-folds every
   * dependent once per environment to decide what to invalidate, then `transform` folds the
   * edited module for the client graph, again for SSR, and once more for each update a
   * framework re-drives — react-router's server-change trigger calls `reloadModule` per pass.
   * All of them read the same shared ts-morph project under the same config, so the result is
   * a function of the bytes alone and the repeats were pure cost: on the app this was measured
   * on, four transforms of a 46 kB route module per edit, ~10 ms each.
   *
   * `watchChange` clears it, which is the exact validity window: entries are correct until a
   * file event changes what a fold could resolve, and `watchChange` is the one hook Vite calls
   * for every such event before any update work begins. The per-environment resolution closure
   * is deliberately not memoized — `withResolutionClosure` is recomputed per consumer against
   * that environment's own recorded dependencies.
   *
   * Keyed by path *and* content digest, not path alone, because one physical file is served
   * as more than one module shape in the same event — react-router clips a route module down
   * to its route exports for the client graph while SSR gets the full file — and a last-write
   * key would make the two shapes evict each other on every pass.
   *
   * Dev only, like the verdict memo it sits beside: a build transforms each module once per
   * environment with no bracketing events, and holding every module's fold for the length of a
   * build is memory a one-shot pass has no reason to spend.
   */
  const foldMemoByContent = new Map<string, FoldMemoEntry>()
  const foldMemoKey = (filePath: string, inputDigest: string) => `${filePath}\0${inputDigest}`
  /**
   * The Project resolution walk `withResolutionClosure` runs, memoized per change event.
   *
   * The walk is the dominant per-dependent cost once the fold itself is memoized — it runs
   * once per dependent per environment with identical inputs, since both environments record
   * the same fold dependencies for byte-identical source. Same bracketing as the fold memo:
   * `watchChange` clears it, so no entry outlives the project state it was computed against.
   */
  const resolutionClosureMemo = new Map<string, readonly string[]>()
  interface TransformEpoch {
    id: number
    state: EnvironmentTransformState
    /** Atoms this immutable JavaScript generation owns in its extraction generation. */
    ownedClasses: ReadonlySet<string>
  }
  interface LiveOutputSlot {
    epoch: TransformEpoch
    prunedClasses?: Set<string>
  }
  interface OutputStage {
    cssDigest?: string
    prunedClasses?: Set<string>
  }
  /** The immutable generation currently occupying each configured output on disk. */
  const liveOutputSlotsByEnvironment = new Map<string, Map<number, LiveOutputSlot>>()
  interface PreparedEnvironmentGeneration {
    state: EnvironmentTransformState
    epoch: TransformEpoch
    buildSerial: number
    outputTokens: Set<number>
    stagedOutputs: Map<number, OutputStage>
  }
  interface PendingOutputCycle {
    expectedTokens: Set<number>
    successfulTokens: Set<number>
    candidatesBySlot: Map<number, LiveOutputSlot>
    lastBuildSerial: number
    lastOutputSlot: number
    mode: 'memory' | 'write'
  }
  /** Graphs which passed `buildEnd`, but whose output has not succeeded yet. */
  const preparedGenerations = new Map<string, PreparedEnvironmentGeneration>()
  /** Success accumulated across hosts which run one buildStart/buildEnd pair per output. */
  const pendingOutputCycles = new Map<string, PendingOutputCycle>()
  /** Last configured output whose render phase actually began, for missing-marker recovery. */
  const lastStartedOutputSlotByEnvironment = new Map<string, number>()
  const nextBuildSerialByEnvironment = new Map<string, number>()
  const observedBuildSerialByEnvironment = new Map<string, number>()
  const buildSerialByState = new WeakMap<EnvironmentTransformState, number>()
  /** Output finalizers installed by the `options` hook for the next generation. */
  const outputTokensByEnvironment = new Map<string, Set<number>>()
  const OUTPUT_FINALIZER = Symbol('bamboocss-output-finalizer')
  const OUTPUT_START_MARKER = Symbol('bamboocss-output-start-marker')
  const DIRECT_OUTPUT_TOKEN = 0
  let nextOutputToken = 0
  let nextEpochId = 0
  interface OutputIdentity {
    environment: string
    outputSlot: number
    outputToken: number
  }
  const outputIdentityByBundle = new WeakMap<object, OutputIdentity>()
  const outputIdentityByOptions = new WeakMap<object, OutputIdentity>()
  const outputStageByBundle = new WeakMap<object, OutputStage>()
  const outputStageByOptions = new WeakMap<object, OutputStage>()
  const environmentOf = (context: unknown) => (context as EnvironmentContext).environment
  const environmentName = (context: unknown) => environmentOf(context)?.name ?? 'default'
  const newEnvironmentState = (): EnvironmentTransformState => ({
    transformArtifactsByModule: new Map(),
    dependentsByDependency: new Map(),
    dependenciesByModule: new Map(),
    filesByModule: new Map(),
    foldSignatures: new Map(),
    recipeConfigCache: new Map(),
    transformedModulesThisRun: new Set(),
    unchangedFolds: new Map(),
    changedRun: 0,
    cssLoaded: false,
  })
  const cloneEnvironmentState = (state: EnvironmentTransformState): EnvironmentTransformState => ({
    transformArtifactsByModule: new Map(state.transformArtifactsByModule),
    dependentsByDependency: new Map(
      [...state.dependentsByDependency].map(([dependency, dependents]) => [dependency, new Set(dependents)]),
    ),
    dependenciesByModule: new Map(
      [...state.dependenciesByModule].map(([moduleId, dependencies]) => [moduleId, new Set(dependencies)]),
    ),
    filesByModule: new Map(state.filesByModule),
    foldSignatures: new Map(state.foldSignatures),
    recipeConfigCache: new Map(state.recipeConfigCache),
    transformedModulesThisRun: new Set(state.transformedModulesThisRun),
    unchangedFolds: new Map(state.unchangedFolds),
    changedRun: state.changedRun,
    cssLoaded: state.cssLoaded,
  })
  const environmentState = (context: unknown) => {
    const identity = environmentName(context)
    let state = transformStateByEnvironment.get(identity)
    if (!state) {
      state = newEnvironmentState()
      transformStateByEnvironment.set(identity, state)
    }
    return state
  }

  const allSurvivors = (states: Iterable<EnvironmentTransformState>) =>
    [...states].flatMap((state) =>
      [...state.transformArtifactsByModule.values()].flatMap((artifact) =>
        artifact.survivors.map(({ line, name, reason }) => ({ file: artifact.file, line, name, reason })),
      ),
    )
  const createSurvivorError = (entries: Survivor[]) => {
    const byFile = new Map<string, Survivor[]>()
    for (const entry of entries) {
      const list = byFile.get(entry.file) ?? []
      list.push(entry)
      byFile.set(entry.file, list)
    }

    const named = (entry: Survivor) =>
      entry.reason === 'runtime-binding' || entry.reason === 'compile-failed' ? entry.name : `${entry.name}()`
    const detail = truncateList(
      Array.from(byFile.entries(), ([file, fileEntries]) =>
        [`  ${file}`, ...fileEntries.map((entry) => `    ${entry.line}: ${named(entry)} — ${entry.reason}`)].join('\n'),
      ),
      { unit: 'file', separator: '\n' },
    )
    const threw = entries.some((entry) => entry.reason === 'compile-failed')

    return new Error(
      `bamboocss: ${entries.length} call(s) could not be compiled.\n\n` +
        `${detail}\n\n` +
        (threw
          ? `\`compile-failed\` is a module the compiler threw on — see the error logged for it above. ` +
            `Nothing was established about its calls either way.\n\n`
          : '') +
        (entries.some((entry) => entry.reason === 'runtime-binding')
          ? `\`runtime-binding\` is a Bamboo value read rather than called. An inline \`cva\`/\`sva\` ` +
            `declaration is erased, so its binding is \`undefined\` at runtime: calling it compiles, including ` +
            `from another module, but reading the value itself — \`const alias = badge\`, \`badge.raw(...)\`, ` +
            `re-exporting it — has nothing behind it. The location given is the read to change, not the ` +
            `declaration.\n\n`
          : '') +
        `Bamboo emits no runtime styling fallback or recipe layer. Make the values finite and statically ` +
        `analyzable, move variation into declared recipe variants, or safelist intentional dynamic classes ` +
        `with \`staticCss\`.\n\n` +
        `Set \`BAMBOO_DIAGNOSTIC_LIMIT=all\` to list every finding rather than the first few.`,
    )
  }

  /**
   * Which modules folded a value read out of which other module, for dev invalidation.
   *
   * `addWatchFile` reports the same edges, and in a build that is enough — Rollup discards a
   * module whose watched file changed. Vite's dev server does not: a module that *statically
   * imports* the changed one is only **soft**-invalidated, which by design keeps its cached
   * transform result and rewrites nothing but the timestamps on its import specifiers. That
   * cached result is where the compiled class string lives, so the edit never reaches it.
   *
   * The recipe case is the one users meet, because it is the one where the class is compiled
   * into somebody else's module: an inline `cva` declaration is erased, and each *call site*
   * becomes a literal in the module that calls it. Editing the recipe then updates the class
   * in a module Vite has decided not to re-transform, so the browser and the SSR render keep
   * the old class — with no error, and with Vite and Bamboo both logging as if the edit landed.
   * A restart applies it, which is what makes it read as "recipes do not hot-reload".
   *
   * `css(sharedObject)` across modules fails identically; it is rarer only because a consumer
   * that folds *nothing but* recipe calls has its import erased, and an erased import is not a
   * static one, so Vite hard-invalidates it and the bug hides. Import one more value from the
   * same module — the shape any real `ui.ts` has — and the import survives, and so does the
   * stale class.
   *
   * Keyed by dependency, since "what changed" is the question asked, and tracked in the other
   * direction as well so a re-transform can retract edges the module no longer has.
   */
  const recordFoldDependencies = (
    state: EnvironmentTransformState,
    moduleId: string,
    file: string,
    dependencies: readonly string[],
  ) => {
    const { dependenciesByModule, dependentsByDependency, filesByModule } = state
    const normalizedFile = normalizeFsPath(file)
    const next = new Set(dependencies.map(normalizeFsPath).filter((dependency) => dependency !== normalizedFile))
    const previous = dependenciesByModule.get(moduleId)
    filesByModule.set(moduleId, file)

    for (const dependency of previous ?? []) {
      if (next.has(dependency)) continue
      const dependents = dependentsByDependency.get(dependency)
      if (!dependents?.delete(moduleId)) continue
      if (!dependents.size) dependentsByDependency.delete(dependency)
    }

    if (!next.size) {
      dependenciesByModule.delete(moduleId)
      return
    }
    dependenciesByModule.set(moduleId, next)
    for (const dependency of next) {
      const dependents = dependentsByDependency.get(dependency)
      if (dependents) dependents.add(moduleId)
      else dependentsByDependency.set(dependency, new Set([moduleId]))
    }
  }

  /**
   * What each cross-file consumer was last handed, and what it last compiled to.
   *
   * Editing a shared module re-transforms everything that folded a value out of it, and most of
   * those re-transforms recompute the bytes they already had: an edit to one export changes the
   * consumers reading *that* export, not the ones reading something else from the same file.
   * `foldDependentModules` uses this to tell those two apart.
   *
   * Digests, not text. Retaining every consumer's source and compiled output for the life of the
   * process is the same order of memory as the ts-morph project already holding it; two 44-byte
   * strings per entry is not, and it does not grow with module size. The set is bounded the way
   * `dependenciesByModule` is — an entry exists only while a module's fold actually reads another
   * file, which most modules never do — so a project that folds nothing across a boundary pays
   * neither the bytes nor the hashing.
   *
   * The *input* digest is what makes the output digest safe to act on. The check below re-folds
   * a consumer from disk, and disk is the right text only if that is what the last transform was
   * handed: a module built by another plugin's `load`, or one edited in the same save, fails
   * that comparison and is treated as changed. `path` is the spelling `transform` used, because
   * ts-morph and the fold both key on it and Windows spells it more than one way.
   */
  const digest = (text: string) => createHash('sha256').update(text).digest('base64')

  /** Fingerprint the generated Bamboo assets after every plugin which may rewrite the bundle. */
  const bambooCssDigest = (bundle: object) => {
    const assets: string[] = []
    for (const output of Object.values(bundle)) {
      if (!isRecord(output) || output.type !== 'asset') continue
      const { source } = output
      if (typeof source !== 'string' && !(source instanceof Uint8Array)) continue
      const text = typeof source === 'string' ? source : Buffer.from(source).toString()
      if (!text.includes('--made-with-bamboo')) continue
      assets.push(text)
    }
    if (!assets.length) return undefined
    // Rolldown resolves asset placeholders between input and output plugin hooks. The bytes are
    // the safety boundary; a host-only file-name change does not alter which classes the sheet
    // backs and must not look like a downstream CSS rewrite.
    return digest(JSON.stringify(assets.sort()))
  }

  /** Add one detached transform contribution to the global reachability projection. */
  const applyStaticTransformContribution = (artifact: TransformArtifact) => {
    if (artifact.transformedFile) staticSession.transformedFiles.add(resolve(artifact.file))
    for (const className of artifact.classNames) staticSession.markClassUsed(className)
  }

  /**
   * Re-derive the two global sets CSS pruning consumes from environment-owned artifacts.
   *
   * A watch run may rebuild one environment or several at once. The candidate being judged
   * replaces its own previous contribution; every sibling contributes its committed generation,
   * even when a replacement for that sibling is already in flight. Its old JavaScript remains
   * the live output until the replacement succeeds, so pruning against a half-filled candidate
   * would remove rules that output still names.
   */
  const contributionStates = (
    candidateEnvironment?: string,
    candidateState?: EnvironmentTransformState,
  ): EnvironmentTransformState[] => {
    const states: EnvironmentTransformState[] = []
    const seenEpochs = new Set<number>()
    let candidateIncluded = false
    for (const [environment, slots] of liveOutputSlotsByEnvironment) {
      if (environment === candidateEnvironment && candidateState) {
        states.push(candidateState)
        candidateIncluded = true
      } else {
        for (const { epoch } of slots.values()) {
          if (seenEpochs.has(epoch.id)) continue
          seenEpochs.add(epoch.id)
          states.push(epoch.state)
        }
      }
    }
    if (candidateEnvironment && candidateState && !candidateIncluded) states.push(candidateState)
    return states
  }

  const rebuildStaticTransformContributions = (
    candidateEnvironment?: string,
    candidateState?: EnvironmentTransformState,
  ) => {
    staticSession.transformedFiles.clear()
    staticSession.usedClasses.clear()
    staticSession.cssLoaded = false

    for (const state of contributionStates(candidateEnvironment, candidateState)) {
      if (state.cssLoaded) staticSession.cssLoaded = true
      for (const artifact of state.transformArtifactsByModule.values()) {
        applyStaticTransformContribution(artifact)
      }
    }
  }

  /**
   * Snapshot which reported classes Bamboo actually extracted for this JavaScript generation.
   *
   * Fold artifacts also report literal classes passed through helpers such as `cx('external',
   * css(...))`. Intersecting with the extraction inventory keeps those useful reachability facts
   * without later demanding that Bamboo provide a rule it never owned.
   */
  const ownedClassesForState = (state: EnvironmentTransformState) => {
    const extracted = new Map([...staticSession.prunableClasses].map((className) => [bare(className), className]))
    const owned = new Set<string>()
    for (const artifact of state.transformArtifactsByModule.values()) {
      for (const reported of artifact.classNames) {
        for (const token of reported.split(' ')) {
          if (!token) continue
          const extractedClass = extracted.get(bare(token))
          if (extractedClass !== undefined) owned.add(extractedClass)
        }
      }
    }
    return owned
  }

  const createTransformEpoch = (state: EnvironmentTransformState): TransformEpoch => {
    const detachedState = cloneEnvironmentState(state)
    return {
      id: ++nextEpochId,
      state: detachedState,
      ownedClasses: ownedClassesForState(detachedState),
    }
  }

  /** Apply the same candidate-replaces-its-environment rule as the reachability projection. */
  const requiredClassesForProjection = (candidateEnvironment: string, candidateOwnedClasses: ReadonlySet<string>) => {
    const required = new Set<string>()
    let candidateIncluded = false
    const seenEpochs = new Set<number>()
    for (const [environment, slots] of liveOutputSlotsByEnvironment) {
      if (environment === candidateEnvironment) {
        for (const className of candidateOwnedClasses) required.add(className)
        candidateIncluded = true
        continue
      }
      for (const { epoch } of slots.values()) {
        if (seenEpochs.has(epoch.id)) continue
        seenEpochs.add(epoch.id)
        for (const className of epoch.ownedClasses) required.add(className)
      }
    }
    if (!candidateIncluded) {
      for (const className of candidateOwnedClasses) required.add(className)
    }
    return required
  }

  const currentRequiredClasses = () => {
    const prunable = new Set([...staticSession.prunableClasses].map(bare))
    return new Set([...staticSession.usedClasses].filter((className) => prunable.has(bare(className))))
  }

  /** Derive loss history from the stylesheet outputs which are still observable. */
  const rebuildLivePrunedClasses = () => {
    staticSession.prunedClasses.clear()
    for (const slots of liveOutputSlotsByEnvironment.values()) {
      for (const slot of slots.values()) {
        for (const className of slot.prunedClasses ?? []) staticSession.prunedClasses.add(className)
      }
    }
  }

  const observeEnvironmentBuildStart = (environment: string) => {
    const serial = (nextBuildSerialByEnvironment.get(environment) ?? 0) + 1
    nextBuildSerialByEnvironment.set(environment, serial)
    observedBuildSerialByEnvironment.set(environment, serial)
  }

  /** Open a replacement without discarding the generation a failed rebuild can fall back to. */
  const beginEnvironmentGeneration = (environment: string) => {
    // A previous watch generation can fail in a downstream `generateBundle` hook. Neither
    // Rollup nor Rolldown calls `renderError` or `closeBundle` for that watcher result, so the
    // next generation is also the cleanup boundary for its unpublished candidate.
    preparedGenerations.delete(environment)
    const state = newEnvironmentState()
    // Real Vite builds are numbered by the private head plugin before any user buildStart can
    // throw. Direct hook harnesses do not install that plugin, so allocate their serial here.
    const observedSerial = observedBuildSerialByEnvironment.get(environment)
    const buildSerial = observedSerial ?? (nextBuildSerialByEnvironment.get(environment) ?? 0) + 1
    if (observedSerial === undefined) nextBuildSerialByEnvironment.set(environment, buildSerial)
    else observedBuildSerialByEnvironment.delete(environment)
    buildSerialByState.set(state, buildSerial)
    transformStateByEnvironment.set(environment, state)
    staticSession.participatingEnvironments.add(environment)
    // A replacement is in progress, but every existing output slot still names a detached,
    // complete contribution. Whole-run guards may judge that conservative live union; only a
    // cold environment with no observable output is incomplete.
    if (liveOutputSlotsByEnvironment.get(environment)?.size) {
      staticSession.completedEnvironments.add(environment)
    } else {
      staticSession.completedEnvironments.delete(environment)
    }
    // Until this candidate proves complete, the output on disk is still described by the
    // committed generation. A concurrently finishing sibling must prune against that stable
    // view, never against a half-transformed replacement.
    rebuildStaticTransformContributions()
    return state
  }

  /** Collapse an environment to a generation which replaced all of its observable outputs. */
  const completeEnvironmentGeneration = (environment: string, state: EnvironmentTransformState) => {
    // A watcher serializes generations for one environment. Keep the identity check anyway:
    // if a host ever overlaps them, an older buildEnd must not publish over its replacement.
    if (transformStateByEnvironment.get(environment) !== state) return
    // Kept detached from the effective state: watchChange may retract deleted modules before
    // the next buildStart. Those mutations belong to the candidate being prepared, not to the
    // output snapshot rollback must retain if that candidate fails.
    const epoch = createTransformEpoch(state)
    liveOutputSlotsByEnvironment.set(environment, new Map([[DIRECT_OUTPUT_TOKEN, { epoch }]]))
    staticSession.completedEnvironments.add(environment)
    rebuildStaticTransformContributions()
    rebuildLivePrunedClasses()
  }

  const prepareEnvironmentGeneration = (environment: string, state: EnvironmentTransformState) => {
    if (transformStateByEnvironment.get(environment) !== state) return
    preparedGenerations.set(environment, {
      state,
      epoch: createTransformEpoch(state),
      buildSerial: buildSerialByState.get(state) ?? 0,
      outputTokens: new Set(outputTokensByEnvironment.get(environment) ?? []),
      stagedOutputs: new Map(),
    })
    // `buildEnd` validated the candidate, but the previous output is still the one users have.
    // Do not leave its reachability projected while rendering or a concurrently finishing
    // sibling could prune against JavaScript which has not been emitted.
    rebuildStaticTransformContributions()
  }

  const sameTokens = (left: Set<number>, right: Set<number>) =>
    left.size === right.size && [...left].every((token) => right.has(token))

  /** The first configured output is an observable boundary even when its later hooks throw. */
  const beginOutputCycle = (environment: string, outputSlot: number) => {
    const previousSlot = lastStartedOutputSlotByEnvironment.get(environment)
    // Rolldown can keep dispatching later outputs after an earlier one failed in an input
    // `buildEnd`, before that output reached this marker. In that case the next marker can be
    // slot one again with no intervening slot zero. A repeated or backwards slot is therefore
    // just as much an aggregate-cycle boundary as observing slot zero normally.
    if (outputSlot === 0 || (previousSlot !== undefined && outputSlot <= previousSlot)) {
      pendingOutputCycles.delete(environment)
    }
    lastStartedOutputSlotByEnvironment.set(environment, outputSlot)
  }

  const completeOutputCycle = (environment: string, cycle: PendingOutputCycle) => {
    // Candidate slots are authoritative. Rolldown builds configured outputs separately, so an
    // edit or deletion between them can legitimately give each one a different immutable epoch.
    // Relabelling every slot as the last epoch would erase classes still named by earlier output.
    liveOutputSlotsByEnvironment.set(environment, new Map(cycle.candidatesBySlot))
    pendingOutputCycles.delete(environment)
    preparedGenerations.delete(environment)
    staticSession.completedEnvironments.add(environment)
    rebuildStaticTransformContributions()
    rebuildLivePrunedClasses()
  }

  const publishPreparedOutput = (environment: string, outputToken: number, outputSlot: number, wasWritten: boolean) => {
    const generation = preparedGenerations.get(environment)
    if (!generation || transformStateByEnvironment.get(environment) !== generation.state) return
    if (!generation.outputTokens.has(outputToken)) return
    const mode = wasWritten ? 'write' : 'memory'
    let cycle = pendingOutputCycles.get(environment)
    const serialContinues =
      cycle !== undefined &&
      outputSlot > cycle.lastOutputSlot &&
      (generation.buildSerial === cycle.lastBuildSerial ||
        generation.buildSerial === cycle.lastBuildSerial + (outputSlot - cycle.lastOutputSlot))
    // Seeing the same output slot/token again means a later aggregate generation started after
    // an earlier one stopped part-way through. Discard its unpublished bookkeeping; the live
    // output slots already retain exactly the subset which reached disk.
    if (
      !cycle ||
      cycle.mode !== mode ||
      !sameTokens(cycle.expectedTokens, generation.outputTokens) ||
      cycle.successfulTokens.has(outputToken) ||
      !serialContinues
    ) {
      cycle = {
        expectedTokens: new Set(generation.outputTokens),
        successfulTokens: new Set(),
        candidatesBySlot: new Map(),
        lastBuildSerial: generation.buildSerial,
        lastOutputSlot: outputSlot,
        mode,
      }
      pendingOutputCycles.set(environment, cycle)
    }

    const stage = generation.stagedOutputs.get(outputToken)
    const candidateSlot: LiveOutputSlot = {
      epoch: generation.epoch,
      ...(stage?.prunedClasses ? { prunedClasses: new Set(stage.prunedClasses) } : {}),
    }
    cycle.successfulTokens.add(outputToken)
    cycle.candidatesBySlot.set(outputSlot, candidateSlot)
    cycle.lastBuildSerial = generation.buildSerial
    cycle.lastOutputSlot = outputSlot
    const allOutputsSucceeded = cycle.successfulTokens.size === cycle.expectedTokens.size

    // `writeBundle` begins after this one output's files have replaced their predecessors. Its
    // token is a real output slot: repeated partial failures overwrite that slot rather than
    // accumulating epochs which no file names any more. Unwritten slots continue to reference
    // their old epochs, so the projection is the exact conservative union of live JavaScript.
    if (wasWritten) {
      const slots = liveOutputSlotsByEnvironment.get(environment) ?? new Map<number, LiveOutputSlot>()
      slots.set(outputSlot, candidateSlot)
      liveOutputSlotsByEnvironment.set(environment, slots)
      // Even a mixed generation is a stable, exact description of the files currently on disk.
      // Counting that union complete prevents a downstream failure (which has no rollback hook)
      // from wedging every later sibling guard and coverage report indefinitely.
      staticSession.completedEnvironments.add(environment)
      rebuildStaticTransformContributions()
      rebuildLivePrunedClasses()
    }

    if (!allOutputsSucceeded || !wasWritten) return
    completeOutputCycle(environment, cycle)
  }

  const closePreparedMemoryOutputs = (environment: string) => {
    const cycle = pendingOutputCycles.get(environment)
    if (!cycle || cycle.mode !== 'memory' || cycle.successfulTokens.size !== cycle.expectedTokens.size) return
    completeOutputCycle(environment, cycle)
  }

  /** Restore the still-live output contribution when the replacement generation fails. */
  const rollbackEnvironmentGeneration = (environment: string, state: EnvironmentTransformState) => {
    if (transformStateByEnvironment.get(environment) !== state) return
    preparedGenerations.delete(environment)
    // Rolldown may continue with a later configured output after this one fails in `buildEnd`,
    // before any output-plugin `renderStart` marker could announce a new aggregate cycle. Do not
    // let that later slot combine with successes retained from an earlier partial generation.
    // Live slots were published independently at their filesystem boundaries and remain the
    // authoritative rollback view.
    pendingOutputCycles.delete(environment)
    const slots = liveOutputSlotsByEnvironment.get(environment)
    const liveEpochs = new Map<number, TransformEpoch>()
    for (const { epoch } of slots?.values() ?? []) liveEpochs.set(epoch.id, epoch)
    const latestLive = [...liveEpochs.values()].sort((a, b) => a.id - b.id).at(-1)
    if (latestLive) {
      transformStateByEnvironment.set(environment, cloneEnvironmentState(latestLive.state))
      staticSession.completedEnvironments.add(environment)
    } else {
      transformStateByEnvironment.delete(environment)
      staticSession.completedEnvironments.delete(environment)
    }
    rebuildStaticTransformContributions()
    rebuildLivePrunedClasses()
  }

  staticSession.beginOutputProjection = (environment, outputOptions, bundle, replacesGeneratedStylesheet) => {
    const generation = preparedGenerations.get(environment)
    if (!generation || transformStateByEnvironment.get(environment) !== generation.state) {
      const currentState = transformStateByEnvironment.get(environment)
      return {
        cssLoaded: currentState?.cssLoaded ?? staticSession.cssLoaded,
        requiredClasses: requiredClassesForProjection(
          environment,
          currentState ? ownedClassesForState(currentState) : currentRequiredClasses(),
        ),
        restore() {},
      }
    }

    const committedPrunedClasses = staticSession.prunedClasses
    staticSession.prunedClasses = new Set(committedPrunedClasses)
    rebuildStaticTransformContributions(environment, generation.epoch.state)
    const requiredClasses = requiredClassesForProjection(environment, generation.epoch.ownedClasses)
    if (replacesGeneratedStylesheet) staticSession.prunedClasses.clear()

    let restored = false
    return {
      cssLoaded: generation.epoch.state.cssLoaded,
      requiredClasses,
      restore() {
        if (restored) return
        restored = true
        const stage = replacesGeneratedStylesheet
          ? { cssDigest: bambooCssDigest(bundle), prunedClasses: new Set(staticSession.prunedClasses) }
          : {}
        outputStageByBundle.set(bundle, stage)
        outputStageByOptions.set(outputOptions, stage)
        staticSession.prunedClasses = committedPrunedClasses
        rebuildStaticTransformContributions()
      },
    }
  }

  /** Aggregate environment-owned coverage once the participating generation is complete. */
  const reportTransformCoverage = (states: Iterable<EnvironmentTransformState>) => {
    // Equivalent coverage for one full module ID is counted once across environments,
    // preserving the source-coverage contract. If environment-aware transforms disagree on
    // counts or diagnostics, both contributions remain visible; query variants are distinct IDs.
    const perFile = new Map<string, { folded: number; skipped: Map<string, number> }>()
    const reportedCoverageByModule = new Map<string, Set<string>>()
    for (const state of states) {
      for (const artifact of state.transformArtifactsByModule.values()) {
        const coverageKey = JSON.stringify([artifact.file, artifact.folded, artifact.skipped])
        const reported = reportedCoverageByModule.get(artifact.moduleId)
        if (reported?.has(coverageKey)) continue
        if (reported) reported.add(coverageKey)
        else reportedCoverageByModule.set(artifact.moduleId, new Set([coverageKey]))

        const entry = perFile.get(artifact.file) ?? { folded: 0, skipped: new Map<string, number>() }
        entry.folded += artifact.folded
        for (const [reason, count] of artifact.skipped) {
          entry.skipped.set(reason, (entry.skipped.get(reason) ?? 0) + count)
        }
        perFile.set(artifact.file, entry)
      }
    }

    let folded = 0
    let filesWithFolds = 0
    const skipped = new Map<string, number>()
    for (const entry of perFile.values()) {
      folded += entry.folded
      if (entry.folded) filesWithFolds++
      for (const [reason, count] of entry.skipped) {
        skipped.set(reason, (skipped.get(reason) ?? 0) + count)
      }
    }

    const declined = Array.from(skipped.values()).reduce((sum, count) => sum + count, 0)
    const total = folded + declined
    if (!total) return

    const share = Math.round((folded / total) * 100)
    const reasons = Array.from(skipped.entries())
      .sort((a, b) => b[1] - a[1])
      .map(([reason, count]) => `${reason}=${count}`)
      .join(' ')

    logger.info(
      'vite:transform',
      `Compiled ${folded}/${total} (${share}%) across ${filesWithFolds}/${perFile.size} files` +
        (reasons ? ` — declined: ${reasons}` : ''),
    )
  }

  /** Restore every per-build fact established by one successful transform. */
  const applyTransformArtifact = (
    state: EnvironmentTransformState,
    value: unknown,
    expectedModuleId: string,
    environment: string,
  ) => {
    // Snapshot before inspecting even the version. Metadata belongs to another plugin and may
    // carry accessors or a Proxy: validating it and then reading it again would let those reads
    // return signed values for the HMAC and different class/dependency facts for state. A
    // structured clone reads the external graph once and gives every subsequent operation the
    // same detached plain data. Non-cloneable metadata is not serializable cache metadata and
    // therefore fails closed too.
    let snapshot: unknown
    try {
      snapshot = structuredClone(value)
    } catch {
      throw cachedArtifactError(
        expectedModuleId,
        environment,
        undefined,
        `could not be snapshotted as serializable schema version ${TRANSFORM_ARTIFACT_VERSION} data`,
      )
    }

    // Centralized here so neither fresh transforms nor cache replay can acquire a second,
    // weaker mutation path as new semantic fields are added to the artifact.
    if (
      !isTransformArtifact(snapshot) ||
      snapshot.moduleId !== expectedModuleId ||
      snapshot.file !== expectedModuleId.split('?')[0] ||
      !hasValidTransformArtifactIntegrity(environment, snapshot)
    ) {
      throw cachedArtifactError(expectedModuleId, environment, snapshot)
    }
    const artifact = snapshot
    const { file, moduleId } = artifact
    state.transformArtifactsByModule.set(moduleId, artifact)

    recordFoldDependencies(state, moduleId, file, artifact.dependencies)
    if (artifact.signature) state.foldSignatures.set(moduleId, artifact.signature)
    else state.foldSignatures.delete(moduleId)
  }

  /**
   * Replay transform metadata for modules Rollup reused from its cache.
   *
   * `buildStart` has to clear reachability because a watch rebuild may have a different graph,
   * but Rollup does not call `transform` again for an unchanged module. The transform result is
   * still present on that module as serializable metadata, and `buildEnd` is the common Rollup
   * and Rolldown point where the complete graph can be enumerated while CSS generation is still
   * ahead of us. Replaying here restores the exact state pruning and the finished-build guards
   * would have observed after a clean build.
   *
   * Freshly transformed module IDs are skipped inside this environment only. Besides avoiding
   * duplicate work, that makes a failed transform authoritative: an older cached artifact must
   * not overwrite the diagnostic and signature retraction established by the failing pass.
   */
  const replayCachedTransformArtifacts = (
    pluginContext: EnvironmentContext & {
      getModuleIds?: () => IterableIterator<string>
      getModuleInfo?: (id: string) => { meta?: Record<string, unknown> } | null
    },
  ) => {
    if (!pluginContext.getModuleIds || !pluginContext.getModuleInfo) return
    const state = environmentState(pluginContext)

    for (const id of pluginContext.getModuleIds()) {
      // Suppression is environment/module-scoped, not file-scoped. `dual.tsx?a` and
      // `dual.tsx?b` share the parser's filesystem identity but have independent cache entries;
      // client and SSR independently cache even the same full ID.
      if (state.transformedModulesThisRun.has(id)) continue

      const meta = pluginContext.getModuleInfo(id)?.meta
      // Most graph modules are not Bamboo transform candidates. No key is the ordinary case;
      // a present key is Bamboo claiming ownership and therefore must be safe to replay.
      if (!meta || !Object.prototype.hasOwnProperty.call(meta, TRANSFORM_META_KEY)) continue
      const artifact = meta[TRANSFORM_META_KEY]
      applyTransformArtifact(state, artifact, id, environmentName(pluginContext))
    }
  }

  /**
   * How many dependents in a row may come back changed before the check gives up for this event.
   *
   * The check costs a re-fold — ~0.2 ms per dependent measured on a twenty-consumer fan-out — and
   * it is paid on the awaited path, before Vite is told anything. That is linear in the number of
   * consumers and does not bound itself: a shared module with three hundred of them adds ~59 ms to
   * every edit, including the edits where nothing *can* be suppressed because the change moved the
   * recipe base and every consumer really did recompile.
   *
   * The trade is worth it whenever anything is suppressible. Measured on the same fan-out, a
   * suppressed consumer saves ~2.3 ms of re-transform for the ~0.23 ms its check costs, so the
   * check pays for itself at about one consumer in ten. What does not pay is the case where the
   * answer is going to be "changed" for all of them, and that case announces itself: a run of
   * consumers that all came back changed. Stopping after eight bounds it. On a three-hundred
   * consumer fan-out, an edit to the recipe base — where nothing can be suppressed — costs 3.6 ms
   * here rather than the 59 ms checking every one of them would, stacked onto an edit already
   * spending 600 ms re-transforming. A single unchanged consumer resets the run, so the same
   * fan-out editing a value no fold reads still checks all three hundred: 49 ms spent against
   * 520 ms of re-transform not done, and a 715 ms edit reduced to 183 ms.
   *
   * Giving up is always the safe direction — an unchecked dependent is treated as changed, which
   * is what this path did before any of this existed — so the bound can only cost the
   * optimisation, never correctness. It costs it where the optimisation was worth least: for the
   * run to reach eight, the consumers seen so far have to be uniformly changed.
   */
  const CHANGED_RUN_LIMIT = 8
  /**
   * Whether re-folding `dependent` now produces exactly the bytes it produced last time.
   *
   * Only the fold can answer that. The consumer's own source has not changed, so whether its
   * compiled output moves depends entirely on what the edited module resolves to *this* time,
   * and there is no cheaper way to learn that than to resolve it. Doing it here rather than
   * waiting for the re-transform is the whole point: the decision is needed before the update is
   * announced, and for a consumer that turns out to be unchanged this fold *replaces* the
   * re-transform rather than adding to it.
   *
   * Conservative in every failure — no recorded signature, a file that will not read, a parse
   * that returns nothing, a fold that throws — because "changed" is what this path did before,
   * and a wrong "unchanged" is a stale class string in the browser.
   */
  const foldOutputUnchanged = (state: EnvironmentTransformState, dependent: string) => {
    const memoized = state.unchangedFolds.get(dependent)
    if (memoized !== undefined) return memoized

    // Memoized like any other verdict, not merely returned. Each environment owns its own
    // signature and counter because an upstream plugin may have handed them different source.
    const unchanged = state.changedRun < CHANGED_RUN_LIMIT && refoldMatchesSignature(state, dependent)
    state.changedRun = unchanged ? 0 : state.changedRun + 1
    state.unchangedFolds.set(dependent, unchanged)
    return unchanged
  }

  const refoldMatchesSignature = (state: EnvironmentTransformState, dependent: string) => {
    const signature = state.foldSignatures.get(dependent)
    if (!signature || !ctx || !foldSourceImpl || !runtimeCss || !styleCompiler) return false

    try {
      const code = readFileSync(signature.path, 'utf8')
      const inputDigest = digest(code)
      if (inputDigest !== signature.input) return false

      let raw: FoldResult
      let parserDependencies: readonly string[]
      const memoKey = foldMemoKey(signature.path, inputDigest)
      const memoized = foldMemoByContent.get(memoKey)
      if (memoized) {
        // Another environment's pass over this same event already folded these bytes. The
        // digest comparison below stays per-environment; the fold itself never was.
        raw = memoized.result
        parserDependencies = memoized.parserDependencies
      } else {
        // `addSourceFile` returns the tree it already holds when the text matches, which it does
        // here by the line above — so this is a parse and a fold, not a re-parse of the module.
        const sourceFile = ctx.project.addSourceFile(signature.path, code)
        const parserResult = ctx.project.parseSourceFile(signature.path)
        if (!parserResult) return false

        raw = foldSourceImpl({
          ctx,
          code,
          parserResult,
          filePath: signature.path,
          runtimeCss,
          styleCompiler,
          maxRecipeStates,
          parseModule: (path) => ctx?.project.parseSourceFile(path),
          recipeConfigCache: state.recipeConfigCache,
          // Reaches only `skipped`, and `code` is what is being compared. Left off because the
          // scan it enables wraps every identifier in the module to build a report nothing here
          // reads.
          reportSurvivors: false,
          sourceFile,
        })
        parserDependencies = parserResult.getDependencies()
        // `reportedSurvivors: false` keeps `transform` from consuming this entry — its
        // artifact needs the survivor scan this provisional fold skips. A later transform of
        // the same bytes overwrites it with the reporting variant; `code` is identical in both.
        foldMemoByContent.set(memoKey, { result: raw, parserDependencies, reportedSurvivors: false })
      }

      const result = withResolutionClosure(
        signature.path,
        raw,
        parserDependencies,
        state.dependenciesByModule.get(dependent),
      )

      const unchanged = digest(result.code) === signature.output

      /**
       * Edges re-recorded exactly on the way to suppressing a module. A changed provisional
       * fold may add newly observed edges, but never retracts the last recoverable ones.
       *
       * The first is necessary: *which* files a module folds from can move while the bytes it
       * emits do not — a value now re-exported through a different module, say — and suppressing
       * the announcement means no transform will run to notice. Leaving the old edges would make
       * the next edit to the new dependency reach nobody.
       *
       * A changed result is only a provisional check on the way to a real transform. Its reads
       * can warm the extractor cache, so the authoritative parse may not cross every nested
       * module again; retaining the union gives that transform semantic targets to validate
       * against the current Project ledger. It then records the exact answer. If that pass
       * throws, the additive update has kept every old edge while also making a fix in a newly
       * observed dependency able to retry it.
       */
      if (unchanged) {
        recordFoldDependencies(state, dependent, signature.path, result.dependencies)
      } else {
        recordFoldDependencies(state, dependent, signature.path, [
          ...(state.dependenciesByModule.get(dependent) ?? []),
          ...result.dependencies,
        ])
      }

      return unchanged
    } catch {
      return false
    }
  }

  /**
   * Modules to re-transform because `file` changed, hard-invalidated on the way out.
   *
   * Invalidating is the fix. It drops the stale compiled result, which is the defect itself,
   * and it has to happen here rather than being left to `updateModules`: Vite *soft*-
   * invalidates an importer that statically imports the changed module, and a soft invalidation
   * keeps the cached transform — the very place the compiled class string lives.
   *
   * Doing it here also survives another plugin filtering the list afterwards — a framework's
   * own `hotUpdate` decides what its route modules do, and the stale bytes have to go either
   * way.
   *
   * *Naming* those modules back to Vite is a different question, and the answer is almost
   * always no. `addWatchFile` makes every consumer a direct importer of the dependency in the
   * module graph, so `propagateUpdate` walks to all of them from the changed file by itself and
   * sends exactly the same update. Returning them as well does not merge into that pass: a
   * framework plugin downstream reads the list and re-drives HMR per entry — react-router's
   * `react-router-server-change-trigger-client-hmr` calls `reloadModule` once per module, in
   * both its client and its ssr pass — and each of those is a separate `updateModules`, a
   * separate `hmr update`, and a separate refetch of the whole module by the browser.
   *
   * Measured on a five-route react-router app, one `css()` edit in a shared `ui.ts`: eight
   * `hmr update` messages, `root.tsx` and `dashboard.tsx` fetched five times each, 554 kB over
   * the socket for a one-line edit. Dropping the redundant half takes it to four messages and
   * 367 kB with the same modules re-transformed and the same edit applied.
   *
   * So the list is returned only when Vite has matched nothing for the file and would otherwise
   * do nothing at all — a dependency the fold read that never became a module of its own. That
   * one can end in a page reload, which is the honest outcome: its compiled classes really did
   * change, and a reload is what Vite does with any update nothing accepts.
   */
  const foldDependentModules = <Module extends { id?: string | null; isSelfAccepting?: boolean }>(
    state: EnvironmentTransformState,
    file: string,
    modules: readonly Module[],
    graph: {
      getModuleById?: (id: string) => Module | undefined
      getModulesByFile: (file: string) => Set<Module> | undefined
      invalidateModule: (module: Module) => void
    },
  ) => {
    const dependents = state.dependentsByDependency.get(normalizeFsPath(file))
    if (!dependents?.size) return

    const added: Module[] = []
    // Copied before it is walked. Re-folding a dependent below can re-record its edges, which
    // writes to this very set — deleting the entry being visited and, when the dependency is
    // still among its edges, appending it again for the walk to revisit. The verdict memo makes
    // that revisit harmless today, so the copy protects this walk from an in-place edge update.
    for (const dependent of [...dependents]) {
      /**
       * A consumer whose compiled bytes this edit does not move is left entirely alone.
       *
       * Announcing one tells the browser to refetch a module it already has verbatim: a round
       * trip, and behind it — in a framework that re-drives HMR per entry, as react-router does
       * with `reloadModule` in both its client and its ssr pass — a router revalidation.
       *
       * Skipping the *invalidation* follows from the same fact, and is where the cost actually
       * sits. Vite only soft-invalidates a module that statically imports the changed one, which
       * keeps its cached transform result and re-serves it for the price of rewriting import
       * timestamps; hard-invalidating turns that into a full re-transform through every plugin
       * in the chain. On a fan-out of twenty consumers of one shared module, editing a runtime
       * value no fold reads took the transforms Bamboo runs for that edit from 22 to 2.
       *
       * How much that is worth depends on whether the consumer's import statement *survives* the
       * fold. When it imports nothing from the module but the value being folded, the binding
       * goes dead, esbuild drops the statement, and the only edge left is the non-static one
       * `addWatchFile` created — which Vite hard-invalidates by itself, so declining to here
       * saves nothing and the re-fold is pure cost. Import one more thing from the same module,
       * which is the shape a real shared `ui.ts` has, and the statement stays, the consumer is a
       * static importer, and Bamboo's invalidation is the only reason it re-transforms at all.
       *
       * Safe by what "identical" means. The invalidation exists to drop a compiled class string
       * that no longer matches the source it was compiled from; when recompiling produces the
       * same string, there is nothing stale to drop. Whichever way the module is reached next —
       * Vite's own propagation, a later request, or nothing at all — the bytes it yields are the
       * bytes this fold just computed.
       *
       * Nor can it mask an update Vite would have sent by itself. This only ever withholds a
       * name Bamboo added; `modules` is passed through untouched. A consumer that also *imports*
       * the edited module for a runtime value is still reached by `propagateUpdate` exactly as
       * it would be with no plugin here at all — that direction was never this list's to decide.
       */
      if (foldOutputUnchanged(state, dependent)) continue
      const exact = graph.getModuleById?.(dependent)
      const dependentFile = state.filesByModule.get(dependent) ?? dependent
      const candidates = exact ? [exact] : (graph.getModulesByFile(normalizeFsPath(dependentFile)) ?? [])
      for (const module of candidates) {
        if (modules.includes(module) || added.includes(module)) continue
        graph.invalidateModule(module)
        added.push(module)
      }
    }
    if (!added.length) return
    /**
     * Gated on whether Vite's own pass will actually *reach* these modules, not merely on whether
     * it has something to propagate from.
     *
     * `propagateUpdate` stops at the first self-accepting module and never walks its importers.
     * So when every module Vite matched for the changed file accepts itself — which is what React
     * Fast Refresh makes of any file exporting a component — the consumers that folded a value out
     * of it are hard-invalidated here and then never announced to anybody. The browser keeps
     * running the module it already has, with the class string compiled from the *previous*
     * contents, until something else forces a reload. Editing a component that a sibling folds
     * from is the ordinary way to meet that.
     *
     * A module that does not accept itself does propagate outward, and `addWatchFile` has made
     * each consumer a direct importer, so Vite sends the same update by itself; naming them again
     * is the duplication measured in the doc comment above. Hence `some` rather than `length`:
     * one non-self-accepting module is enough for the walk to arrive. An empty list keeps its old
     * meaning — nothing to duplicate, so this is the only announcement there will be.
     */
    if (modules.some((module) => !module.isSelfAccepting)) return
    return [...modules, ...added]
  }

  let ctx: Awaited<ReturnType<(typeof import('@bamboocss/node'))['loadConfigAndCreateContext']>> | undefined
  let foldSourceImpl: (typeof import('./fold'))['foldSource'] | undefined
  let runtimeCss: RuntimeCss | undefined
  let styleCompiler: StaticStyleSetCompiler | undefined
  let command: 'build' | 'serve' = 'build'
  let defaultEmitAssets = true

  /**
   * Expand semantic leaf reads through the Project's exact resolution paths.
   *
   * Most boxed values point at their final declaration, which the fold reports directly. An
   * evaluated imported helper is different: its returned box belongs to the local call node,
   * while ParserResult records the modules crossed during that evaluation. Seed from both so
   * neither form can leave compiled JavaScript stale. A re-export or barrel on either path can
   * change which declaration the same import selects and must be watched too. Supplying only
   * these semantic leaves back to Project keeps unrelated runtime-import branches out and walks
   * only the indexed closure rather than scanning the global ledger.
   */
  const withResolutionClosure = (
    filePath: string,
    result: FoldResult,
    parserDependencies: readonly string[] = [],
    previousDependencies: ReadonlySet<string> | undefined = undefined,
  ): FoldResult => {
    if (!ctx || !result.folded.length) return result

    const dependencies = new Set(result.dependencies)
    for (const dependency of parserDependencies) {
      if (!isGeneratedOutput(dependency, ctx)) dependencies.add(dependency)
    }

    const targets = new Set(dependencies)
    // A refold can populate the extractor's value cache immediately before Vite runs the real
    // transform. That parse still reports the directly crossed helper, but it may not revisit a
    // nested leaf. Only previously semantic targets from byte-identical importer source are
    // candidates (the caller enforces that digest guard); Project then retains solely those
    // which remain reachable in the current resolution graph.
    for (const dependency of previousDependencies ?? []) targets.add(dependency)
    if (!targets.size) return result

    const targetList = [...targets]
    const closureKey = command === 'serve' ? `${filePath}\0${targetList.slice().sort().join('|')}` : undefined
    let reachable = closureKey ? resolutionClosureMemo.get(closureKey) : undefined
    if (!reachable) {
      reachable = ctx.project.getDependencies(filePath, targetList)
      if (closureKey) resolutionClosureMemo.set(closureKey, reachable)
    }
    for (const dependency of reachable) {
      if (!isGeneratedOutput(dependency, ctx)) dependencies.add(dependency)
    }
    const expanded = [...dependencies]
    if (
      expanded.length === result.dependencies.length &&
      expanded.every((dependency, index) => dependency === result.dependencies[index])
    ) {
      return result
    }
    return { ...result, dependencies: expanded }
  }

  const loadContext = createRetryableLazy(async () => {
    const { loadConfigAndCreateContext } = await loadNodeModule()
    return loadConfigAndCreateContext({ configPath, cwd, dev: command === 'serve' })
  })
  const loadCompilerState = createLazyCompilerState(loadContext, loadFoldModule)
  const ensureContext = async () => {
    ctx = await loadContext()
  }
  const ensureCompilerState = async () => {
    const loaded = await loadCompilerState()
    // Published together only after config loading, chunk loading and both derived compilers
    // have succeeded. A rejected attempt leaves no half-compiler visible to HMR.
    ctx = loaded.context
    foldSourceImpl = loaded.foldSource
    runtimeCss = loaded.runtimeCss
    styleCompiler = loaded.styleCompiler
  }

  type OutputOptionsWithPlugins = { plugins?: unknown }
  type InputOptionsWithOutput = { output?: OutputOptionsWithPlugins | OutputOptionsWithPlugins[] }
  type TaggedOutputFinalizer = Plugin & {
    [OUTPUT_FINALIZER]: OutputIdentity
  }
  type TaggedOutputStartMarker = Plugin & {
    [OUTPUT_START_MARKER]: { environment: string; outputSlot: number }
  }

  const outputFinalizerTag = (value: unknown) => {
    if (!value || typeof value !== 'object') return undefined
    return (value as Partial<TaggedOutputFinalizer>)[OUTPUT_FINALIZER]
  }
  const outputStartMarkerTag = (value: unknown) => {
    if (!value || typeof value !== 'object') return undefined
    return (value as Partial<TaggedOutputStartMarker>)[OUTPUT_START_MARKER]
  }
  const findOutputFinalizer = (
    value: unknown,
    environment: string,
    outputSlot: number,
  ): TaggedOutputFinalizer | undefined => {
    if (Array.isArray(value)) {
      for (const entry of value) {
        const found = findOutputFinalizer(entry, environment, outputSlot)
        if (found) return found
      }
      return undefined
    }
    const identity = outputFinalizerTag(value)
    return identity?.environment === environment && identity.outputSlot === outputSlot
      ? (value as TaggedOutputFinalizer)
      : undefined
  }
  const findOutputStartMarker = (
    value: unknown,
    environment: string,
    outputSlot: number,
  ): TaggedOutputStartMarker | undefined => {
    if (Array.isArray(value)) {
      for (const entry of value) {
        const found = findOutputStartMarker(entry, environment, outputSlot)
        if (found) return found
      }
      return undefined
    }
    const identity = outputStartMarkerTag(value)
    return identity?.environment === environment && identity.outputSlot === outputSlot
      ? (value as TaggedOutputStartMarker)
      : undefined
  }
  const stripOutputLifecyclePlugins = (value: unknown): unknown[] => {
    if (Array.isArray(value)) return value.flatMap(stripOutputLifecyclePlugins)
    return value == null || outputFinalizerTag(value) || outputStartMarkerTag(value) ? [] : [value]
  }
  const createOutputStartMarker = (environment: string, outputSlot: number): TaggedOutputStartMarker => {
    return Object.assign(
      {
        name: `bamboocss:output-start:${environment}:${outputSlot}`,
        renderStart: {
          order: 'pre' as const,
          sequential: true,
          handler() {
            beginOutputCycle(environment, outputSlot)
          },
        },
      },
      { [OUTPUT_START_MARKER]: { environment, outputSlot } },
    ) as TaggedOutputStartMarker
  }
  const createOutputFinalizer = (environment: string, outputSlot: number): TaggedOutputFinalizer => {
    const outputToken = ++nextOutputToken
    return Object.assign(
      {
        name: `bamboocss:output-finalizer:${environment}:${outputSlot}`,
        generateBundle: {
          order: 'post' as const,
          handler(outputOptions: unknown, bundle: unknown, isWrite: boolean) {
            // Appended after every configured output plugin: this is both the last view of the
            // bundle and the point where one output has finished generating successfully.
            if (!bundle || typeof bundle !== 'object') return
            const identity = { environment, outputSlot, outputToken }
            outputIdentityByBundle.set(bundle, identity)
            if (outputOptions && typeof outputOptions === 'object') outputIdentityByOptions.set(outputOptions, identity)
            const generation = preparedGenerations.get(environment)
            const stage =
              outputStageByBundle.get(bundle) ??
              (outputOptions && typeof outputOptions === 'object' ? outputStageByOptions.get(outputOptions) : undefined)
            if (stage?.cssDigest && bambooCssDigest(bundle) !== stage.cssDigest) {
              throw new Error(
                `bamboocss: an output plugin changed or removed the generated stylesheet after Bamboo finalized ` +
                  `its reachability. The cached prune history would no longer describe the emitted CSS. Preserve ` +
                  `the Bamboo asset in later \`generateBundle\` hooks, or run that transformation before Bamboo.`,
              )
            }
            if (generation && stage) generation.stagedOutputs.set(outputToken, stage)
            if (!isWrite) publishPreparedOutput(environment, outputToken, outputSlot, false)
          },
        },
      },
      { [OUTPUT_FINALIZER]: { environment, outputSlot, outputToken } },
    ) as TaggedOutputFinalizer
  }

  const installOutputFinalizers = (inputOptions: InputOptionsWithOutput, environment: string) => {
    if (!inputOptions.output) {
      outputTokensByEnvironment.delete(environment)
      return
    }

    const outputs = Array.isArray(inputOptions.output) ? inputOptions.output : [inputOptions.output]
    const outputTokens = new Set<number>()
    const installed = outputs.map((output, outputSlot) => {
      const existing = findOutputFinalizer(output.plugins, environment, outputSlot)
      const existingStart = findOutputStartMarker(output.plugins, environment, outputSlot)
      if (existing && existingStart) {
        outputTokens.add(existing[OUTPUT_FINALIZER].outputToken)
        return output
      }

      // Mutate the nested output object deliberately. Rollup's watcher copies its top-level input
      // options before running this hook, while retaining the original output objects it later
      // passes to `write`; replacing only the copied top-level property would install a finalizer
      // which never runs. Vite resolves a distinct output object per environment.
      const finalizer = existing ?? createOutputFinalizer(environment, outputSlot)
      const startMarker = existingStart ?? createOutputStartMarker(environment, outputSlot)
      outputTokens.add(finalizer[OUTPUT_FINALIZER].outputToken)
      output.plugins = [startMarker, ...stripOutputLifecyclePlugins(output.plugins), finalizer]
      return output
    })

    inputOptions.output = Array.isArray(inputOptions.output) ? installed : installed[0]
    outputTokensByEnvironment.set(environment, outputTokens)
  }

  const compiler: Plugin = {
    name: 'bamboocss:compiler',
    enforce: 'pre',

    /** See the same declaration on the css plugin: one instance per build, not per environment. */
    sharedDuringBuild: true,

    options(inputOptions) {
      installOutputFinalizers(inputOptions as typeof inputOptions & InputOptionsWithOutput, environmentName(this))
      return inputOptions
    },

    configResolved(config) {
      command = config.command
      defaultEmitAssets = config.build?.emitAssets ?? (!config.build?.ssr || config.build?.ssrEmitAssets === true)
      // `closeBundle` has only pre/normal/post ordering. Another post-enforced user plugin may be
      // declared after Bamboo, so placing the committer last in Bamboo's own returned array would
      // not make it last globally. At this point Vite has assembled its complete input-plugin
      // list (including internal build plugins), while environment plugin lists are derived only
      // after this hook. Move the private committer to the actual tail so its post/sequential
      // close hook observes every earlier close hook succeeding in both Vite 7 and Vite 8.
      const plugins = config.plugins as Plugin[] | undefined
      if (plugins) {
        for (const finalizer of [outputWriteObserver, memoryOutputCommitter]) {
          const index = plugins.indexOf(finalizer)
          if (index !== -1) plugins.splice(index, 1)
        }
        // The filesystem observer must run before a peer pre/sequential write hook can reject;
        // the in-memory committer must run after every peer close hook has succeeded.
        plugins.unshift(outputWriteObserver)
        plugins.push(memoryOutputCommitter)
      }
    },

    async buildStart() {
      // Open a transactional generation for this environment only.
      //
      // Each Vite environment owns an independent watcher. A client edit can start another
      // client build without starting SSR at all; the SSR bundle and its cached class literals
      // remain live. Clearing every environment when the client name repeated therefore made
      // the next client stylesheet prune rules that the untouched SSR JavaScript still named.
      //
      // The replacement becomes the effective graph immediately, retracting stale facts while
      // fresh transforms and cached metadata replay fill it. Its last-good state remains aside:
      // untouched siblings still contribute, and a failed replacement can restore the output
      // the application is still running.
      //
      // Starting is not completing. Concurrent watcher rebuilds can both reach this hook before
      // either graph has loaded; the fast environment must not run whole-run guards while the
      // other is paused here with `cssLoaded: false`.
      const environment = environmentName(this)
      const state = beginEnvironmentGeneration(environment)

      // Normalized here too. `ensureContext` loads and evaluates the user's config file and
      // its hooks, so what it throws is entirely outside this plugin's control — and in dev
      // it reaches Vite's error middleware, which crashes on anything that is not an object.
      try {
        await ensureContext()
      } catch (error) {
        rollbackEnvironmentGeneration(environment, state)
        throw asError(error, 'failed to load the bamboo config')
      }
    },

    /**
     * Take a changed module out of the parser's hands before the rebuild reads it.
     *
     * `addWatchFile` below registers the modules a fold read, so editing one re-transforms
     * its consumers. That is only half of it. The consumer is transformed *before* the
     * module it imports — that is how a bundler discovers imports at all — so by the time
     * the changed module's own `transform` refreshes it in the ts-morph project, the fold
     * that reads it has already run against the previous contents and baked a stale class
     * into the bundle. Rollup calls this hook before any of that, which is the only point
     * where refreshing is early enough.
     *
     * Both entry points clear the box-node cache, which is the part that matters: a
     * resolution memoized against the old contents outlives the file itself.
     *
     * A created file is handled as an edit. `reloadSourceFile` cannot re-read one the
     * parser has never held, and does not need to — it clears the cache, and the extractor
     * adds a newly-reachable module from disk on next use. What the shared path *is* needed
     * for is an editor's atomic save, which arrives as a delete followed by a create while
     * the parser still holds the file.
     */
    watchChange(id, change) {
      // Ahead of both guards below. This is the one hook Vite calls for *every* file event, on
      // every version in the peer range, and it runs before the update hooks — which makes it
      // the only point that reliably brackets a content change. A verdict about what a consumer
      // folds to must not outlive one, whatever the changed file happened to be.
      // Vite dev calls this once by default, then `hotUpdate` once per environment. Bracket the
      // physical edit for every environment so none reuses a verdict from the previous event.
      foldMemoByContent.clear()
      resolutionClosureMemo.clear()
      for (const state of transformStateByEnvironment.values()) {
        state.unchangedFolds.clear()
        state.changedRun = 0
      }

      if (!ctx) return
      if (!shouldTransform(id)) return

      // Split the same way `transform` does. Nothing observed puts a query on a watch id,
      // but handing ts-morph a path the rest of the plugin spells differently is the kind
      // of asymmetry that only shows up as a fold that quietly stopped refreshing.
      const [filePath] = id.split('?')
      if (!filePath) return

      // Whole-map rather than this file's entry: a config is cached under the module that
      // *declares* it, and an edit here can change what any other module re-exports.
      for (const state of transformStateByEnvironment.values()) state.recipeConfigCache.clear()

      if (change.event === 'delete') {
        ctx.project.removeSourceFile(filePath)
        // Only as consumers. Their edges as a *dependency* are the other modules' to retract,
        // on the re-transform this deletion is about to cause. Every query variant owns its
        // own contribution even though all of them share this physical path.
        const deleted = normalizeFsPath(filePath)
        for (const state of transformStateByEnvironment.values()) {
          for (const [moduleId, moduleFile] of [...state.filesByModule]) {
            if (normalizeFsPath(moduleFile) !== deleted) continue
            recordFoldDependencies(state, moduleId, moduleFile, [])
            state.foldSignatures.delete(moduleId)
            state.transformArtifactsByModule.delete(moduleId)
            state.filesByModule.delete(moduleId)
          }
        }
        return
      }

      ctx.project.reloadSourceFile(filePath)
    },

    /**
     * Re-transform whatever folded a value out of the file that just changed.
     *
     * Dev only — `hotUpdate` does not run in a build, where Rollup's own invalidation already
     * covers this — and additive: the modules Vite matched are returned alongside, so this
     * decides nothing about them.
     *
     * `handleHotUpdate` below stands in on Vite 5, which has no `hotUpdate`. Not quite the
     * same thing: Vite 5 calls that hook for an update and not for a file appearing or being
     * deleted, so a recipe file *created* while the server runs leaves its consumers stale
     * there. Vite 6 and up call `hotUpdate` for all three, and never call `handleHotUpdate`
     * when a plugin has both — including its deprecation warning — so exactly one of the two
     * runs on any supported version.
     *
     * `environment` optional-chained for the same reason `addWatchFile` is in `transform`:
     * a harness driving the hook need not supply a full plugin context, and a `TypeError`
     * here is swallowed into an HMR error payload that a middleware-mode server sends
     * nowhere.
     */
    hotUpdate({ file, modules }) {
      const graph = this.environment?.moduleGraph
      if (!graph) return
      return foldDependentModules(environmentState(this), file, modules, graph)
    },

    handleHotUpdate({ file, modules, server }) {
      // Read through a cast because we compile against Vite 7's types, where a dev server
      // always has `environments`, so narrowing on its absence leaves `never`. The peer range
      // is `>=5`, so the Vite 5 shape this exists for does reach here.
      const legacy = server as unknown as {
        environments?: unknown
        moduleGraph: Parameters<typeof foldDependentModules<(typeof modules)[number]>>[3]
      }
      // Guarded rather than trusted: `server.moduleGraph` on Vite 6 and up is a compatibility
      // layer over the per-environment graphs, and this hook should not be the one touching it.
      if (legacy.environments) return
      return foldDependentModules(environmentState(this), file, modules, legacy.moduleGraph)
    },

    async transform(code, id) {
      if (!shouldTransform(id)) return null

      try {
        await ensureCompilerState()
      } catch (error) {
        throw asError(error, 'failed to initialize the bamboo compiler')
      }
      if (!ctx || !foldSourceImpl || !runtimeCss || !styleCompiler) return null

      const [filePath] = id.split('?')

      // The generated styled-system is bamboo's own runtime, not user code. It is not in
      // the project's `include`, so parsing it fails, and folding it would be meaningless
      // even if it did not.
      if (isGeneratedOutput(filePath, ctx)) return null

      const state = environmentState(this)
      state.transformedModulesThisRun.add(id)
      let inputDigest: string | undefined
      const previousSignature = state.foldSignatures.get(id)
      const previousDependencies =
        previousSignature && previousSignature.input === (inputDigest ??= digest(code))
          ? state.dependenciesByModule.get(id)
          : undefined

      let result: FoldResult
      try {
        const memoKey = command === 'serve' ? foldMemoKey(filePath, (inputDigest ??= digest(code))) : undefined
        const memoized = memoKey ? foldMemoByContent.get(memoKey) : undefined
        if (memoized?.reportedSurvivors) {
          // These exact bytes were already folded this change event — for the other
          // environment, or by a framework re-driving the same update. Only the resolution
          // closure is per-environment, so only it is recomputed.
          result = withResolutionClosure(filePath, memoized.result, memoized.parserDependencies, previousDependencies)
        } else {
          const sourceFile = ctx.project.addSourceFile(filePath, code)
          const parserResult = ctx.project.parseSourceFile(filePath)
          // An empty extraction result is not proof that the module has no Bamboo runtime
          // binding. The strict compiler also scans the source AST after planning rewrites.
          if (!parserResult) {
            state.transformArtifactsByModule.delete(id)
            recordFoldDependencies(state, id, filePath, [])
            state.foldSignatures.delete(id)
            return null
          }

          const folded = foldSourceImpl({
            ctx,
            code,
            parserResult,
            filePath,
            runtimeCss,
            styleCompiler,
            maxRecipeStates,
            // On demand rather than from a registry built at `buildStart`: a consumer is
            // transformed before the module it imports, so anything accumulated during the
            // build would make the fold depend on discovery order.
            parseModule: (path) => ctx?.project.parseSourceFile(path),
            recipeConfigCache: state.recipeConfigCache,
            reportSurvivors: true,
            sourceFile,
          })
          const parserDependencies = parserResult.getDependencies()
          if (memoKey) {
            foldMemoByContent.set(memoKey, { result: folded, parserDependencies, reportedSurvivors: true })
          }
          result = withResolutionClosure(filePath, folded, parserDependencies, previousDependencies)
        }
      } catch (error) {
        logger.caughtError('vite:transform', `Failed to compile ${filePath}`, error)

        // Fold dependencies are deliberately left as they were. A throw establishes nothing
        // about what this module reads, and keeping the last known edges is the recoverable
        // direction: fixing the *dependency* then re-transforms this module, which is how a
        // user gets out of the failure. Retracting would cost that, to save nothing.
        const previousDependencies = [...(state.dependenciesByModule.get(id) ?? [])]
        const failedArtifact = sealTransformArtifact(environmentName(this), {
          version: TRANSFORM_ARTIFACT_VERSION,
          moduleId: id,
          file: filePath,
          folded: 0,
          skipped: [['compile-failed', 1]],
          survivors: [{ line: 1, name: 'compiler', reason: 'compile-failed' }],
          transformedFile: false,
          classNames: [],
          dependencies: previousDependencies,
        })
        applyTransformArtifact(state, failedArtifact, id, environmentName(this))
        // The signature is not, for the reason the edges are. It is a claim about output this
        // pass did not produce, and acting on a stale one suppresses a real update.
        state.foldSignatures.delete(id)
        if (command === 'serve') {
          // Normalized, never rethrown as caught. `catch` binds `unknown`, and anything under
          // the fold — a config hook, a dependency, a bare `throw 'string'` — may throw a
          // primitive. Vite's dev error middleware puts what it is given into a `WeakSet` to
          // dedupe it, which throws `TypeError: Invalid value used in weak set` on anything
          // that is not an object. The real failure is then lost behind a message about weak
          // sets, in the one mode where the user is watching the terminal for it.
          throw asError(error, `failed to compile ${filePath}`)
        }
        return null
      }

      const skippedHere = new Map<SkipReason, number>()
      for (const entry of result.skipped) {
        skippedHere.set(entry.reason, (skippedHere.get(entry.reason) ?? 0) + 1)
      }

      const survivorsHere: Array<Omit<Survivor, 'file'>> = []
      for (const entry of result.skipped) {
        if (entry.reason === 'not-imported' || entry.reason === 'overlapping') {
          continue
        }
        // `cx` is the one intentional runtime surface: with unknown external inputs it is a
        // tiny class-string joiner, not a styling engine. Bamboo only promises semantic
        // StyleSet composition when every argument is analyzable; nested Bamboo calls are
        // still compiled independently before this runtime join.
        if (entry.name === 'cx' && entry.reason === 'dynamic') continue
        // Every skipped entry indexes the module being folded: each module reports only about
        // its own text, so there is no foreign offset to translate.
        survivorsHere.push({ line: lineAt(code, entry.start), name: entry.name, reason: entry.reason })
      }

      const artifact = sealTransformArtifact(environmentName(this), {
        version: TRANSFORM_ARTIFACT_VERSION,
        moduleId: id,
        file: filePath,
        folded: result.folded.length,
        skipped: [...skippedHere],
        survivors: survivorsHere,
        transformedFile: result.folded.some((entry) => entry.kind === 'class' || entry.kind === 'slots'),
        classNames: [...new Set(result.folded.flatMap((entry) => entry.classNames))],
        dependencies: [...result.dependencies],
        ...(result.dependencies.length
          ? { signature: { input: (inputDigest ??= digest(code)), output: digest(result.code), path: filePath } }
          : {}),
      })
      // Applied through the same serializable boundary a cached rebuild replays below. Keeping
      // one path for fresh and cached modules is what keeps new per-transform state from being
      // added to one and silently omitted from the other.
      applyTransformArtifact(state, artifact, id, environmentName(this))

      if (reportSkipped && result.skipped.length) {
        logger.info('vite:transform', formatSkipped(filePath, result.skipped))
      }

      // A folded literal can depend on a module this one only imports. Register the
      // edge so editing that module invalidates this one, instead of leaving a stale
      // class string behind. Optional-chained because not every harness that drives a
      // transform hook supplies the full Rollup plugin context.
      for (const dependency of result.dependencies) {
        this.addWatchFile?.(dependency)
      }

      if (command === 'serve' && artifact.survivors.length) {
        // Retracted rather than kept: this module is about to fail to load, so what the browser
        // ends up holding is an error and not the output just digested. Comparing against it on
        // a later edit would call a module unchanged that never landed to begin with.
        state.foldSignatures.delete(id)
        throw createSurvivorError(artifact.survivors.map((survivor) => ({ file: filePath, ...survivor })))
      }

      const meta = { [TRANSFORM_META_KEY]: artifact }
      if (!result.folded.length) {
        // A real bundler needs a transform result in order to retain metadata for this module,
        // including the zero-fold entry that makes coverage's file denominator accurate. Tiny
        // hook harnesses in this package deliberately omit the module graph and retain the old
        // `null` contract; they have nowhere that metadata could be replayed from.
        const hasModuleGraph = typeof (this as unknown as { getModuleInfo?: unknown }).getModuleInfo === 'function'
        return hasModuleGraph ? { code, map: null, meta } : null
      }

      logger.debug('vite:transform', `Compiled ${result.folded.length} call(s) in ${filePath}`)

      return { code: result.code, map: result.map, meta }
    },

    buildEnd(buildError) {
      const environment = environmentName(this)
      const state = environmentState(this)
      if (buildError) {
        rollbackEnvironmentGeneration(environment, state)
        return
      }

      try {
        replayCachedTransformArtifacts(this)

        let currentWillEmitCss = false
        if (typeof this.getModuleIds === 'function') {
          // `load` writes the shared flag, but only the finished module graph can attribute it to
          // an environment. Keep that ownership so a later partial rebuild can preserve a client
          // stylesheet while replacing SSR, or retract the client flag if its import disappears.
          state.cssLoaded = [...this.getModuleIds()].some((id) => id.split('?')[0] === `\0${VIRTUAL_CSS_ID}`)

          // A sheet this environment is about to emit supersedes its previous generation. Old
          // prune history must not make a newly reachable class fail before generateBundle can
          // restore its rule. An SSR graph may load CSS while Vite deliberately suppresses its
          // assets, so use Vite's resolved per-environment decision rather than the `ssr` flag.
          currentWillEmitCss = state.cssLoaded && (this.environment?.config?.build?.emitAssets ?? defaultEmitAssets)
        }

        // This candidate is complete enough to judge, but is not published until every
        // applicable guard below succeeds. Other environments contribute their last-good
        // generation even while a replacement for one of them is in flight.
        const states = contributionStates(environment, state)
        rebuildStaticTransformContributions(environment, state)

        const survivors = allSurvivors(states)
        if (survivors.length) {
          throw createSurvivorError(survivors)
        }

        // A class this environment compiled is already gone from a stylesheet another one
        // finalized.
        //
        // This is the safety net the prune gate in `css.ts` leans on. That gate prunes against
        // whatever the *emitting* environment compiled rather than waiting for the whole run,
        // because waiting meant never pruning in any SSR framework — the client emits the
        // stylesheet and finishes before the server environment starts. The cost of not waiting
        // is that a class only a later environment reaches can be pruned out from under it.
        //
        // Left alone that build is green, the markup carries real class names, and the elements
        // render unstyled — the one failure shape that survives every other check here. So it
        // fails instead, naming the classes.
        //
        // A styled component that renders only on the server is what trips this; anything the
        // client also renders is compiled in both environments and never lands here.
        //
        // `prunedClasses` is only ever filled by a prune that already ran, and a prune keeps
        // everything marked used, so an intersection can only mean a marker that arrived after.
        const lost = currentWillEmitCss
          ? []
          : [...staticSession.usedClasses].filter((className) => staticSession.prunedClasses.has(bare(className)))
        if (lost.length) {
          throw new Error(
            `bamboocss: ${lost.length} class(es) compiled in the ${JSON.stringify(environment)} environment were ` +
              `already pruned out of a stylesheet emitted by an earlier one. Elements carrying them would render ` +
              `unstyled.\n\n` +
              `${truncateList(
                lost.map((className) => `  ${className}`),
                { unit: 'class', separator: '\n' },
              )}\n\n` +
              `The stylesheet is finalized by the environment that imports it — the client, which builds first — so it ` +
              `is pruned against what that environment compiled. These classes are reached only from here, so no rule ` +
              `for them survived.\n\n` +
              `That usually means a styled component which renders only on the server. Either give the client a path ` +
              `to it, or set \`bamboocss({ pruneCss: false })\` to ship the whole extracted stylesheet.`,
          )
        }

        // The symbolic compiler names classes from Vite's live module graph, while CSS is
        // extracted from Bamboo's configured `include`. A strict build must prove those two
        // graphs agree: otherwise a perfectly folded class can have no rule behind it.
        // `getModuleInfo` distinguishes a real Rollup build from unit harnesses that call the
        // hook directly without the companion CSS plugin.
        //
        // Both are statements about the finished run rather than about one environment, and both
        // read state the environment that *serves* the stylesheet fills in: `cssLoaded` and
        // `extractedFiles` are written when the virtual module is loaded. Asked of an
        // environment that builds before that one, they are not merely early but wrong — a
        // framework building its server bundle first failed with "virtual:bamboo.css was not
        // imported" for a client bundle that imports it on the next line.
        const remaining = remainingEnvironments(staticSession, environment)
        if (typeof this.getModuleInfo === 'function' && !remaining.length) {
          if (!staticSession.cssLoaded) {
            throw new Error(
              `bamboocss: compiled class values were produced, but ${JSON.stringify(VIRTUAL_CSS_ID)} ` +
                `was not imported. Add \`import ${JSON.stringify(VIRTUAL_CSS_ID)}\` once, from a JavaScript or ` +
                `TypeScript module in the application entry graph.\n\n` +
                `It has to be a JS import. \`@import\` from a stylesheet does not reach it: the id names a virtual ` +
                `module resolved by this plugin, and Vite resolves CSS \`@import\` before plugin resolution, so it ` +
                `fails as an unresolvable path. A project that ships one preloaded stylesheet imports this from its ` +
                `entry module instead, and lets Vite emit the CSS asset.`,
            )
          }

          const outsideExtraction = [...staticSession.transformedFiles].filter(
            (file) => !staticSession.extractedFiles.has(file),
          )
          if (outsideExtraction.length) {
            throw new Error(
              `bamboocss: ${outsideExtraction.length} statically compiled module(s) are outside the CSS extraction graph:\n\n` +
                `${truncateList(
                  outsideExtraction.map((file) => `  ${file}`),
                  { unit: 'file', separator: '\n' },
                )}\n\n` +
                `Add them to \`include\` in bamboo.config, or no CSS rule can back their emitted classes.`,
            )
          }
        }

        // Once per run, not once per environment. Coverage describes the source, and a build
        // with a client and an SSR bundle would otherwise print a partial line and then a second
        // one superseding it — the same shape as the reachability judgements above, and gated on
        // the same condition.
        //
        // Builds only, which the judgements above do not have to say because `generateBundle`
        // never runs in dev. This does run there, on server close, and dev satisfies the gate's
        // premise in name only: a resolved config always lists both `client` and `ssr`
        // environments, so a project configuring `builder` announces two — while dev starts only
        // the client one, since `perEnvironmentStartEndDuringDev` is off by default. The
        // remaining environment is one that was never going to start, and gating on it stopped
        // the summary printing at all for exactly the framework projects this all exists for.
        if (reportSummary && (command !== 'build' || !remaining.length)) reportTransformCoverage(states)

        if (command === 'serve' || !outputTokensByEnvironment.get(environment)?.size) {
          // Dev has no output phase. The second branch preserves the direct hook-harness contract;
          // a real Vite build always supplies at least one resolved output to `options`.
          completeEnvironmentGeneration(environment, state)
        } else {
          prepareEnvironmentGeneration(environment, state)
        }
      } catch (error) {
        rollbackEnvironmentGeneration(environment, state)
        throw error
      }
    },

    renderError() {
      // Rendering fails before Bamboo's CSS hook and output finalizer. Unlike a later
      // `generateBundle` failure, both supported hosts do report this phase explicitly.
      const environment = environmentName(this)
      const state = transformStateByEnvironment.get(environment)
      if (state) rollbackEnvironmentGeneration(environment, state)
    },
  }

  const outputWriteObserver: Plugin = {
    name: 'bamboocss:output-write-observer',
    enforce: 'pre',
    sharedDuringBuild: true,
    buildStart: {
      order: 'pre',
      sequential: true,
      handler() {
        // Number the generation before any peer can abort its input buildStart. Rolldown may
        // continue with a later configured output after such an abort; the resulting serial gap
        // keeps that output from completing a pending cycle left by an earlier generation.
        observeEnvironmentBuildStart(environmentName(this))
      },
    },
    writeBundle: {
      order: 'pre',
      sequential: true,
      handler(outputOptions, bundle) {
        // Reaching any write hook proves the bundler has already replaced every file for this
        // output. Publish immediately: a later writeBundle rejection cannot put the old bytes
        // back, so retaining the old contribution would make Bamboo disagree with the disk in
        // the opposite direction. Generate/render failures never enter this phase.
        const identity = outputIdentityByBundle.get(bundle) ?? outputIdentityByOptions.get(outputOptions)
        if (identity?.environment === environmentName(this)) {
          publishPreparedOutput(identity.environment, identity.outputToken, identity.outputSlot, true)
        }
      },
    },
  }

  const memoryOutputCommitter: Plugin = {
    name: 'bamboocss:output-memory-committer',
    // Kept out of the compiler's `pre` bucket. A normal user plugin declared after Bamboo can
    // reject `closeBundle`; Vite orders this post plugin after it, and the sequential hook then
    // cannot publish an in-memory generation the caller never received.
    enforce: 'post',
    sharedDuringBuild: true,
    closeBundle: {
      order: 'post',
      sequential: true,
      handler() {
        // `closeBundle` belongs to the input plugin driver; Rollup and Rolldown do not invoke
        // it on configured output plugins. Vite closes a successful `write: false` result after
        // all configured outputs have generated. Running last and sequentially means an earlier
        // input close hook which rejects prevents publication, while a generate failure leaves
        // the token set incomplete and is therefore a no-op here.
        closePreparedMemoryOutputs(environmentName(this))
      },
    },
  }

  // The css plugin first: it owns the extraction the compiler's context reads from, and Vite
  // preserves array order within one `enforce` bucket.
  return [bamboocssCss({ configPath, cwd, session: staticSession, pruneCss }), compiler]
}
