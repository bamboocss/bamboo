import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

import { logger } from '@bamboocss/logger'
import { truncateList } from '@bamboocss/shared'
import { loadConfigAndCreateContext, markStaticCompilerActive } from '@bamboocss/node'
import type { Plugin } from 'vite'
import { asError, bamboocssCss, VIRTUAL_CSS_ID } from './css'
import { foldSource, type ForeignRecipes, type SkipReason, type SkippedCall } from './fold'
import { bare } from './prune-static-css'
import { createRuntimeCss, type RuntimeCss } from './runtime-css'
import { createStaticStyleSetCompiler, type StaticStyleSetCompiler } from './style-set'
import { createStaticCompilationSession, remainingEnvironments, resetStaticCompilationSession } from './static-session'

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
   * ones nothing reaches. Larger, and never wrong *by pruning* — it also stands down the
   * assertion that every compiled class has a rule, since that check exists to catch this pass
   * removing too much. So this is a true escape hatch: it cannot fail a build over reachability.
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

  /**
   * What each file's transform found, for the summary. Keyed by file rather than summed as it
   * goes, because a build has more than one environment and they share most of their modules.
   *
   * Running totals double-counted every shared module once per environment — a two-environment
   * build of one shared file and one entry each reported "2/2 across 2/4 files" for three
   * source modules. Coverage is a property of the source, not of how many times a bundler
   * handed the same file over. It also grew without bound in dev, where every HMR
   * re-transform of a file counted as another file.
   *
   * A second pass over a file replaces its entry rather than adding to it. Both environments
   * are assumed to compute the same answer for the same module — true of this compiler, though
   * not something the plugin can enforce, since another `pre` plugin may hand each environment
   * different code. Where they disagree the last one wins, which is a cosmetic number either
   * way.
   */
  const perFile = new Map<string, { folded: number; skipped?: Map<string, number> }>()
  const staticSession = createStaticCompilationSession()

  type Survivor = { file: string; line: number; name: string; reason: SkipReason }
  /**
   * Indexed by file, because the only bulk operation on it is "forget this one's".
   *
   * A flat array meant every transform scanned every survivor and then rebuilt the dedupe key
   * set from scratch — O(modules x survivors) across a build, and worst exactly when a build is
   * already failing and the user is iterating on it. One project had 736 of them across 9,461
   * modules, which is seven million string builds to discard.
   */
  const survivorsByFile = new Map<string, Survivor[]>()
  const allSurvivors = () => [...survivorsByFile.values()].flat()
  const addSurvivor = (entry: Survivor) => {
    const forFile = survivorsByFile.get(entry.file) ?? []
    // Deduped within the file rather than globally: the key is file-scoped anyway, and a
    // per-file list is short enough that scanning it beats maintaining a second index.
    if (forFile.some((seen) => seen.line === entry.line && seen.name === entry.name && seen.reason === entry.reason)) {
      return
    }
    forFile.push(entry)
    survivorsByFile.set(entry.file, forFile)
  }
  const clearSurvivorsFor = (file: string) => {
    survivorsByFile.delete(file)
  }
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
   * Recipe configs read out of modules other than the one being transformed.
   *
   * Per build rather than per module: a recipe declared once and imported by fifty components
   * would otherwise re-parse its module fifty times, which is the transform path.
   */
  const recipeConfigCache = new Map<string, ForeignRecipes>()

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
  const dependentsByDependency = new Map<string, Set<string>>()
  const dependenciesByFile = new Map<string, Set<string>>()

  const recordFoldDependencies = (file: string, dependencies: readonly string[]) => {
    const next = new Set(dependencies.map(normalizeFsPath).filter((dependency) => dependency !== file))
    const previous = dependenciesByFile.get(file)

    for (const dependency of previous ?? []) {
      if (next.has(dependency)) continue
      const dependents = dependentsByDependency.get(dependency)
      if (!dependents?.delete(file)) continue
      if (!dependents.size) dependentsByDependency.delete(dependency)
    }

    if (!next.size) {
      dependenciesByFile.delete(file)
      return
    }
    dependenciesByFile.set(file, next)
    for (const dependency of next) {
      const dependents = dependentsByDependency.get(dependency)
      if (dependents) dependents.add(file)
      else dependentsByDependency.set(dependency, new Set([file]))
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
   * `dependenciesByFile` is — an entry exists only while a module's fold actually reads another
   * file, which most modules never do — so a project that folds nothing across a boundary pays
   * neither the bytes nor the hashing.
   *
   * The *input* digest is what makes the output digest safe to act on. The check below re-folds
   * a consumer from disk, and disk is the right text only if that is what the last transform was
   * handed: a module built by another plugin's `load`, or one edited in the same save, fails
   * that comparison and is treated as changed. `path` is the spelling `transform` used, because
   * ts-morph and the fold both key on it and Windows spells it more than one way.
   */
  const foldSignatures = new Map<string, { input: string; output: string; path: string }>()

  const digest = (text: string) => createHash('sha256').update(text).digest('base64')

  /**
   * Consumers this edit cannot move, resolved once per watcher event.
   *
   * `hotUpdate` runs once per environment — client and ssr both — and the answer is a property
   * of the files, not of which environment is asking. Cleared in `watchChange`, which every Vite
   * in the peer range calls for every file event, before either update hook.
   */
  const unchangedFolds = new Map<string, boolean>()

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
  let changedRun = 0

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
  const foldOutputUnchanged = (dependent: string) => {
    const memoized = unchangedFolds.get(dependent)
    if (memoized !== undefined) return memoized

    // Memoized like any other verdict, not merely returned. The second environment's pass has to
    // reach the same answer as the first, and it would re-derive a *different* one if it started
    // its own run counter.
    const unchanged = changedRun < CHANGED_RUN_LIMIT && refoldMatchesSignature(dependent)
    changedRun = unchanged ? 0 : changedRun + 1
    unchangedFolds.set(dependent, unchanged)
    return unchanged
  }

  const refoldMatchesSignature = (dependent: string) => {
    const signature = foldSignatures.get(dependent)
    if (!signature || !ctx || !runtimeCss || !styleCompiler) return false

    try {
      const code = readFileSync(signature.path, 'utf8')
      if (digest(code) !== signature.input) return false

      // `addSourceFile` returns the tree it already holds when the text matches, which it does
      // here by the line above — so this is a parse and a fold, not a re-parse of the module.
      const sourceFile = ctx.project.addSourceFile(signature.path, code)
      const parserResult = ctx.project.parseSourceFile(signature.path)
      if (!parserResult) return false

      const result = foldSource({
        ctx,
        code,
        parserResult,
        filePath: signature.path,
        runtimeCss,
        styleCompiler,
        maxRecipeStates,
        parseModule: (path) => ctx?.project.parseSourceFile(path),
        recipeConfigCache,
        // Reaches only `skipped`, and `code` is what is being compared. Left off because the
        // scan it enables wraps every identifier in the module to build a report nothing here
        // reads.
        reportSurvivors: false,
        sourceFile,
      })

      const unchanged = digest(result.code) === signature.output

      /**
       * Edges re-recorded on the way to suppressing a module, and never on the way to
       * invalidating one.
       *
       * The first is necessary: *which* files a module folds from can move while the bytes it
       * emits do not — a value now re-exported through a different module, say — and suppressing
       * the announcement means no transform will run to notice. Leaving the old edges would make
       * the next edit to the new dependency reach nobody.
       *
       * The second would be a bug, and is the reason this is a branch rather than an
       * unconditional write. `hotUpdate` runs once per environment, client then ssr, against one
       * shared map. A fold that now yields nothing — an export renamed, a call commented out, any
       * ordinary mid-edit state — returns `dependencies: []`, so writing it here would retract the
       * consumer's edge during the *client* pass and leave the *ssr* pass finding an empty set and
       * returning without invalidating anything: the stale compiled class kept in the SSR cache,
       * with the client half correctly updated. That is the shape of the bug the self-accepting
       * fix was about, one environment over. `transform` performs the same retraction, but only
       * after every environment has already invalidated, which is why it is safe there.
       *
       * Confining the write to the unchanged branch removes the hazard rather than sequencing
       * around it, because a retraction cannot reach that branch: `dependencies` is empty only
       * when `folded.length === 0`, and a fold that folds nothing returns the module's own source,
       * which cannot equal an output digest recorded from a pass that replaced a call with a
       * literal. And where an unchanged verdict *does* narrow the edges, both passes agree anyway
       * — neither invalidates a module it has just called unchanged.
       */
      if (unchanged) recordFoldDependencies(dependent, result.dependencies)

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
    file: string,
    modules: readonly Module[],
    graph: {
      getModulesByFile: (file: string) => Set<Module> | undefined
      invalidateModule: (module: Module) => void
    },
  ) => {
    const dependents = dependentsByDependency.get(normalizeFsPath(file))
    if (!dependents?.size) return

    const added: Module[] = []
    // Copied before it is walked. Re-folding a dependent below can re-record its edges, which
    // writes to this very set — deleting the entry being visited and, when the dependency is
    // still among its edges, appending it again for the walk to revisit. The verdict memo makes
    // that revisit harmless today, so the copy is insurance rather than the fix; the fix for
    // writes crossing between the per-environment passes is in `refoldMatchesSignature`.
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
      if (foldOutputUnchanged(dependent)) continue
      for (const module of graph.getModulesByFile(dependent) ?? []) {
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

  let ctx: Awaited<ReturnType<typeof loadConfigAndCreateContext>> | undefined
  let runtimeCss: RuntimeCss | undefined
  let styleCompiler: StaticStyleSetCompiler | undefined
  let command: 'build' | 'serve' = 'build'
  let setup: Promise<void> | undefined

  const ensureContext = async () => {
    if (!setup) {
      setup = loadConfigAndCreateContext({ configPath, cwd, dev: command === 'serve' }).then((loaded) => {
        ctx = loaded
        const semanticCss = createRuntimeCss(loaded)
        runtimeCss = semanticCss
        styleCompiler = createStaticStyleSetCompiler(loaded, runtimeCss)
      })
    }
    await setup
  }

  const compiler: Plugin = {
    name: 'bamboocss:compiler',
    enforce: 'pre',

    /** See the same declaration on the css plugin: one instance per build, not per environment. */
    sharedDuringBuild: true,

    configResolved(config) {
      command = config.command
    },

    async buildStart() {
      // Reset per *run*, not per environment.
      //
      // `buildStart` fires once per environment, and a framework that builds a client and an
      // SSR bundle — react-router among them — runs both against this one plugin instance.
      // Resetting on each meant the second environment discarded everything the first
      // established: `cssLoaded` went false, so an SSR bundle that legitimately never imports
      // the stylesheet failed the "not imported" check, and the reachability sets that
      // pruning consults were emptied halfway through.
      //
      // Environments of one run each fire this once, in sequence, so seeing the *same* one
      // twice is what distinguishes a new run — a `vite build --watch` rebuild — from another
      // environment of the run in progress.
      const environment = (this as { environment?: { name?: string } }).environment?.name ?? 'default'
      if (staticSession.startedEnvironments.has(environment)) {
        perFile.clear()
        survivorsByFile.clear()
        recipeConfigCache.clear()
        dependentsByDependency.clear()
        dependenciesByFile.clear()
        foldSignatures.clear()
        unchangedFolds.clear()
        changedRun = 0
        // Clears `startedEnvironments` too, so the `add` below opens the new run's list.
        resetStaticCompilationSession(staticSession)
      }
      staticSession.startedEnvironments.add(environment)

      // Normalized here too. `ensureContext` loads and evaluates the user's config file and
      // its hooks, so what it throws is entirely outside this plugin's control — and in dev
      // it reaches Vite's error middleware, which crashes on anything that is not an object.
      try {
        await ensureContext()
      } catch (error) {
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
      unchangedFolds.clear()
      changedRun = 0

      if (!ctx) return
      if (!shouldTransform(id)) return

      // Split the same way `transform` does. Nothing observed puts a query on a watch id,
      // but handing ts-morph a path the rest of the plugin spells differently is the kind
      // of asymmetry that only shows up as a fold that quietly stopped refreshing.
      const [filePath] = id.split('?')
      if (!filePath) return

      // Whole-map rather than this file's entry: a config is cached under the module that
      // *declares* it, and an edit here can change what any other module re-exports.
      recipeConfigCache.clear()

      if (change.event === 'delete') {
        ctx.project.removeSourceFile(filePath)
        // Only as a consumer. Its edges as a *dependency* are the other modules' to retract,
        // on the re-transform this deletion is about to cause.
        recordFoldDependencies(normalizeFsPath(filePath), [])
        foldSignatures.delete(normalizeFsPath(filePath))
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
      return foldDependentModules(file, modules, graph)
    },

    handleHotUpdate({ file, modules, server }) {
      // Read through a cast because we compile against Vite 7's types, where a dev server
      // always has `environments`, so narrowing on its absence leaves `never`. The peer range
      // is `>=5`, so the Vite 5 shape this exists for does reach here.
      const legacy = server as unknown as {
        environments?: unknown
        moduleGraph: Parameters<typeof foldDependentModules<(typeof modules)[number]>>[2]
      }
      // Guarded rather than trusted: `server.moduleGraph` on Vite 6 and up is a compatibility
      // layer over the per-environment graphs, and this hook should not be the one touching it.
      if (legacy.environments) return
      return foldDependentModules(file, modules, legacy.moduleGraph)
    },

    async transform(code, id) {
      if (!shouldTransform(id)) return null

      try {
        await ensureContext()
      } catch (error) {
        throw asError(error, 'failed to load the bamboo config')
      }
      if (!ctx || !runtimeCss || !styleCompiler) return null

      const [filePath] = id.split('?')
      clearSurvivorsFor(filePath)

      // The generated styled-system is bamboo's own runtime, not user code. It is not in
      // the project's `include`, so parsing it fails, and folding it would be meaningless
      // even if it did not.
      if (isGeneratedOutput(filePath, ctx)) return null

      let result: ReturnType<typeof foldSource>
      try {
        const sourceFile = ctx.project.addSourceFile(filePath, code)
        const parserResult = ctx.project.parseSourceFile(filePath)
        // An empty extraction result is not proof that the module has no Bamboo runtime
        // binding. The strict compiler also scans the source AST after planning rewrites.
        if (!parserResult) return null

        result = foldSource({
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
          recipeConfigCache,
          reportSurvivors: true,
          sourceFile,
        })
      } catch (error) {
        logger.caughtError('vite:transform', `Failed to compile ${filePath}`, error)

        // Fold dependencies are deliberately left as they were. A throw establishes nothing
        // about what this module reads, and keeping the last known edges is the recoverable
        // direction: fixing the *dependency* then re-transforms this module, which is how a
        // user gets out of the failure. Retracting would cost that, to save nothing.
        perFile.set(filePath, { folded: 0, skipped: new Map([['compile-failed', 1]]) })
        // The signature is not, for the reason the edges are. It is a claim about output this
        // pass did not produce, and acting on a stale one suppresses a real update.
        foldSignatures.delete(normalizeFsPath(filePath))
        addSurvivor({ file: filePath, line: 1, name: 'compiler', reason: 'compile-failed' })
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

      // Left undefined when nothing was declined, which is the common case and this is the
      // per-module path: a project of ten thousand files would otherwise retain ten thousand
      // empty maps for the length of the build to say nothing.
      let skippedHere: Map<string, number> | undefined
      for (const entry of result.skipped) {
        skippedHere ??= new Map()
        skippedHere.set(entry.reason, (skippedHere.get(entry.reason) ?? 0) + 1)
      }
      // Replaces rather than adds to any earlier entry for this file. A second environment
      // transforming the same module recomputes the same answer, and a watch rebuild's answer
      // supersedes the one before it.
      perFile.set(filePath, { folded: result.folded.length, skipped: skippedHere })

      if (result.folded.some((entry) => entry.kind === 'class' || entry.kind === 'slots')) {
        staticSession.transformedFiles.add(resolve(filePath))
      }
      for (const entry of result.folded) {
        for (const className of entry.classNames) staticSession.markClassUsed(className)
      }

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
        addSurvivor({ file: filePath, line: lineAt(code, entry.start), name: entry.name, reason: entry.reason })
      }

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
      // The same edges, kept where `hotUpdate` can read them. `addWatchFile` alone does not
      // reach the dev server's soft invalidation — see `dependentsByDependency`.
      const dependentKey = normalizeFsPath(filePath)
      recordFoldDependencies(dependentKey, result.dependencies)

      // In lockstep with those edges. A signature is only ever consulted for a module that
      // folded across a file boundary, and only meaningful while the edges still say it does.
      if (result.dependencies.length) {
        foldSignatures.set(dependentKey, { input: digest(code), output: digest(result.code), path: filePath })
      } else {
        foldSignatures.delete(dependentKey)
      }

      const forFile = survivorsByFile.get(filePath)
      if (command === 'serve' && forFile?.length) {
        // Retracted rather than kept: this module is about to fail to load, so what the browser
        // ends up holding is an error and not the output just digested. Comparing against it on
        // a later edit would call a module unchanged that never landed to begin with.
        foldSignatures.delete(dependentKey)
        throw createSurvivorError(forFile)
      }

      if (!result.folded.length) return null

      logger.debug('vite:transform', `Compiled ${result.folded.length} call(s) in ${filePath}`)

      return { code: result.code, map: result.map }
    },

    buildEnd() {
      const survivors = allSurvivors()
      if (survivors.length) {
        throw createSurvivorError(survivors)
      }

      // A class this environment compiled is already gone from a stylesheet another one
      // finalized.
      //
      // The prune gate in `css.ts` holds pruning back until every environment of the run has
      // contributed, so reaching this means the run never announced how many that would be —
      // it drove `builder.build(environment)` itself rather than going through `vite build` or
      // `builder.buildApp()`, and configured no `builder`. Left alone the build is green, the
      // markup carries real class names, and the elements render unstyled; that is the exact
      // failure this whole change is about, so it fails here instead.
      //
      // `prunedClasses` is only ever filled by a prune that already ran, and a prune keeps
      // everything marked used, so an intersection can only mean a marker that arrived after.
      const lost = [...staticSession.usedClasses].filter((className) =>
        staticSession.prunedClasses.has(bare(className)),
      )
      if (lost.length) {
        const environment = (this as { environment?: { name?: string } }).environment?.name ?? 'default'
        throw new Error(
          `bamboocss: ${lost.length} class(es) compiled in the ${JSON.stringify(environment)} environment were ` +
            `already pruned out of a stylesheet emitted by an earlier one. Elements carrying them would render ` +
            `unstyled.\n\n` +
            `${truncateList(
              lost.map((className) => `  ${className}`),
              { unit: 'class', separator: '\n' },
            )}\n\n` +
            `The stylesheet is finalized by the environment that imports it, so pruning it is only safe once every ` +
            `environment has been compiled. This build did not say how many there would be: it called ` +
            `\`builder.build(environment)\` directly. Run it through \`vite build\`, call \`builder.buildApp()\`, or ` +
            `set \`builder: {}\` in the Vite config so the environments are known before the first one builds. ` +
            `\`bamboocss({ pruneCss: false })\` also turns pruning off entirely.`,
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
      if (typeof this.getModuleInfo === 'function' && !remainingEnvironments(staticSession).length) {
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

      if (!reportSummary) return

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
      if (command === 'build' && remainingEnvironments(staticSession).length) return

      let folded = 0
      let filesWithFolds = 0
      const skipped = new Map<string, number>()
      for (const entry of perFile.values()) {
        folded += entry.folded
        if (entry.folded) filesWithFolds++
        for (const [reason, count] of entry.skipped ?? []) {
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
    },
  }

  // The css plugin first: it owns the extraction the compiler's context reads from, and Vite
  // preserves array order within one `enforce` bucket.
  return [bamboocssCss({ configPath, cwd, session: staticSession, pruneCss }), compiler]
}
