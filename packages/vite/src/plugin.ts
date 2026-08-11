import { resolve } from 'node:path'

import { logger } from '@bamboocss/logger'
import { loadConfigAndCreateContext } from '@bamboocss/node'
import type { Plugin } from 'vite'
import { bamboocssCss } from './css'
import { foldSource, SURVIVES_TO_RUNTIME, type ForeignRecipes, type SkipReason, type SkippedCall } from './fold'
import { createRuntimeCss, type RuntimeCss } from './runtime-css'

export interface BambooVitePluginOptions {
  /**
   * Rewrite statically-resolvable `css()` and pattern calls into literal class
   * strings, so they cost nothing at runtime.
   *
   * On by default, and build-only — it never runs in `vite dev`, where the parse would land
   * on every hot update and a dev bundle gains nothing from pre-resolved calls.
   *
   * What it buys is per-call CPU, not bytes: the runtime still ships, because dropping it
   * needs *every* call site in the graph to fold. Bundle size moves slightly against you —
   * measured at -0.8% raw and +1.0% gzipped on `sandbox/runtime-perf`, since distinct class
   * literals compress worse than the repeated `css({ … })` calls they replace. Set it to
   * `false` if that trade is the wrong way round for you, or to keep builds faster: folding
   * re-parses each module with `ts-morph`, roughly 0.3ms for a small component and 3ms for a
   * 147-line file with 24 call sites.
   *
   * @default true
   */
  transform?: boolean
  /**
   * Split a call or element that is only partly static, so the resolvable half becomes a
   * literal and only the rest keeps its runtime call. On by default.
   *
   * Without it a single dynamic value declines the whole site.
   *
   * @default true
   */
  partial?: boolean
  /** Path to `bamboo.config.ts`. Resolved the same way the CLI resolves it. */
  configPath?: string
  cwd?: string
  /**
   * Report every call site that did *not* fold, and why, per file. Useful when a call
   * you expected to collapse still shows up in the bundle.
   *
   * @default false
   */
  reportSkipped?: boolean
  /**
   * Print a coverage summary when the build finishes: how much folded, and what the
   * remainder was declined for.
   *
   * On by default. Without it there is no signal that the transform did anything, and
   * no way to tell a project where everything folds from one where nothing does.
   *
   * @default true
   */
  reportSummary?: boolean
  /**
   * Fail the build when a `css()` or pattern call is left for the runtime.
   *
   * The fold's value is not the per-call CPU it saves — it is that a bundle where *every*
   * such call folded no longer imports `styled-system/css` at all, and the engine behind it
   * drops out. One survivor keeps the whole thing, so a coverage percentage cannot tell you
   * whether you got the prize. This can.
   *
   * Deliberately silent about `cva`/`sva`. A `cva(...)` definition returns a function and can
   * never collapse to a class string, so failing on it would make this unusable for anyone
   * writing recipes — and recipes keep their own much smaller runtime by design. What this
   * guarantees is narrower and checkable: nothing still calls `css()`.
   *
   * Named for what it checks. It was `strict`, which meant nothing in common with
   * `strictTokens` or a pattern's old `strict` — three unrelated options sharing a word, to
   * the point that comments in this repo used a bare "strict" for all three.
   *
   * @default false
   */
  failOnUnfolded?: boolean
}

const DEFAULT_EXTENSIONS = /\.(?:[cm]?[jt]sx?)$/
const NODE_MODULES = /node_modules/

const shouldTransform = (id: string) => {
  // Rollup marks a virtual module by prefixing its id with a NUL. Those have no file
  // on disk, so the CSS extractor never reads them and a class folded here could have
  // no rule behind it — besides which, the id is not a path ts-morph should be given.
  if (id.startsWith('\0')) return false

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
 * and nothing styles without it. The second is the optional build-time fold.
 *
 * The fold runs with `enforce: 'pre'` so it sees module source as close as possible to what
 * the CSS extractor reads off disk. A plugin that rewrites style calls before bamboo
 * sees them would otherwise make the two disagree, and a folded class could end up
 * with no matching rule.
 */
export const bamboocss = (options: BambooVitePluginOptions = {}): Plugin[] => {
  // `partial` is forwarded undefined rather than defaulted here, so `foldSource` stays the
  // one place its default is written down.
  const {
    transform = true,
    partial,
    configPath,
    cwd,
    reportSkipped = false,
    reportSummary = true,
    failOnUnfolded = false,
  } = options

  /** Totals across the build, for the summary. */
  const totals = { folded: 0, files: 0, filesWithFolds: 0, skipped: new Map<string, number>() }

  /** Under `failOnUnfolded`, every call that would still reach the runtime. */
  const survivors: Array<{ file: string; line: number; name: string; reason: SkipReason }> = []

  /**
   * Recipe configs read out of modules other than the one being transformed.
   *
   * Per build rather than per module: a recipe declared once and imported by fifty components
   * would otherwise re-parse its module fifty times, which is the transform path.
   */
  const recipeConfigCache = new Map<string, ForeignRecipes>()

  let ctx: Awaited<ReturnType<typeof loadConfigAndCreateContext>> | undefined
  let runtimeCss: RuntimeCss | undefined
  let setup: Promise<void> | undefined

  const ensureContext = async () => {
    if (!setup) {
      setup = loadConfigAndCreateContext({ configPath, cwd }).then((loaded) => {
        ctx = loaded
        runtimeCss = createRuntimeCss(loaded)
      })
    }
    await setup
  }

  const fold: Plugin = {
    name: 'bamboocss:fold',
    enforce: 'pre',

    // Build only. The fold re-parses each module through ts-morph, which is priced
    // for a build pass and not for an interactive edit loop.
    apply: 'build',

    async buildStart() {
      if (!transform) return

      // `vite build --watch` runs this hook once per rebuild against the same plugin
      // instance, so without a reset the summary reports every build since the first
      // and the percentage stops describing the bundle that was just written.
      totals.folded = 0
      totals.files = 0
      totals.filesWithFolds = 0
      totals.skipped.clear()
      survivors.length = 0
      recipeConfigCache.clear()

      await ensureContext()
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
      if (!transform || !ctx) return
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
        return
      }

      ctx.project.reloadSourceFile(filePath)
    },

    async transform(code, id) {
      if (!transform) return null
      if (!shouldTransform(id)) return null

      await ensureContext()
      if (!ctx || !runtimeCss) return null

      const [filePath] = id.split('?')

      // The generated styled-system is bamboo's own runtime, not user code. It is not in
      // the project's `include`, so parsing it fails, and folding it would be meaningless
      // even if it did not.
      if (isGeneratedOutput(filePath, ctx)) return null

      let result: ReturnType<typeof foldSource>
      try {
        const sourceFile = ctx.project.addSourceFile(filePath, code)
        const parserResult = ctx.project.parseSourceFile(filePath)
        // Under `failOnUnfolded` an empty result is not proof of nothing to say: a module whose only
        // bamboo usage is a shape the parser does not recognise produces exactly that, and
        // skipping it here is what let those modules pass a build they should have failed.
        if (!parserResult || (parserResult.isEmpty() && !failOnUnfolded)) return null

        result = foldSource({
          ctx,
          code,
          parserResult,
          filePath,
          runtimeCss,
          partial,
          // On demand rather than from a registry built at `buildStart`: a consumer is
          // transformed before the module it imports, so anything accumulated during the
          // build would make the fold depend on discovery order.
          parseModule: (path) => ctx?.project.parseSourceFile(path),
          recipeConfigCache,
          // Only `failOnUnfolded` acts on it, and it costs an identifier walk.
          reportSurvivors: failOnUnfolded,
          sourceFile,
        })
      } catch (error) {
        logger.caughtError('vite:transform', `Failed to fold ${filePath}`, error)

        // Not a build failure on its own: an unfolded module keeps its runtime `css()` call,
        // which still works. What it is not is *silence* — the module was neither folded nor
        // declined, so it landed in neither column, the summary reported 100% over the files
        // that did not throw, and `failOnUnfolded` passed a build with a module nobody
        // checked. Counted here so both of those describe the build that actually ran.
        totals.files++
        totals.skipped.set('fold-failed', (totals.skipped.get('fold-failed') ?? 0) + 1)

        if (failOnUnfolded) {
          survivors.push({ file: filePath, line: 1, name: 'fold', reason: 'fold-failed' })
        }

        return null
      }

      totals.files++
      totals.folded += result.folded.length
      if (result.folded.length) totals.filesWithFolds++
      for (const entry of result.skipped) {
        totals.skipped.set(entry.reason, (totals.skipped.get(entry.reason) ?? 0) + 1)
      }

      if (failOnUnfolded) {
        for (const entry of result.skipped) {
          if (!SURVIVES_TO_RUNTIME.has(entry.reason)) continue
          survivors.push({ file: filePath, line: lineAt(code, entry.start), name: entry.name, reason: entry.reason })
        }

        // A lowered leaf counts too, and this is the shape that would otherwise slip
        // through: `css({ color: tone })` *folds*, to `cssLeaf("c_", "color", tone)`, so it
        // reports no skip at all. But `cssLeaf` falls back to `css({ [prop]: value })` for a
        // value that is not a scalar -- a responsive array, a condition object -- which the
        // build cannot rule out. So it imports the engine, and the bundle keeps it.
        if (result.code.includes('cssLeaf(')) {
          survivors.push({
            file: filePath,
            line: lineAt(result.code, result.code.indexOf('cssLeaf(')),
            name: 'cssLeaf',
            reason: 'lowered-leaf' as SkipReason,
          })
        }
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

      if (!result.folded.length) return null

      logger.debug('vite:transform', `Folded ${result.folded.length} call(s) in ${filePath}`)

      return { code: result.code, map: result.map }
    },

    buildEnd() {
      if (failOnUnfolded && survivors.length) {
        // Grouped by file, because the fix is usually per-module: one component taking a
        // prop keeps the engine for the whole bundle.
        const byFile = new Map<string, typeof survivors>()
        for (const entry of survivors) {
          const list = byFile.get(entry.file) ?? []
          list.push(entry)
          byFile.set(entry.file, list)
        }

        // `runtime-binding` is a binding rather than a call, and `fold-failed` is the whole
        // module, so neither takes the call parens the rest read better with.
        const named = (e: (typeof survivors)[number]) =>
          e.reason === 'runtime-binding' || e.reason === 'fold-failed' ? e.name : `${e.name}()`

        const detail = Array.from(byFile.entries())
          .map(([file, entries]) =>
            [`  ${file}`, ...entries.map((e) => `    ${e.line}: ${named(e)} — ${e.reason}`)].join('\n'),
          )
          .join('\n')

        // The advice below is about call sites, and does not apply to a module that threw —
        // there the error above this one is the thing to fix.
        const threw = survivors.some((entry) => entry.reason === 'fold-failed')

        throw new Error(
          `bamboocss: ${survivors.length} call(s) could not be folded, and \`failOnUnfolded\` is on.\n\n` +
            `${detail}\n\n` +
            (threw
              ? `\`fold-failed\` is a module the fold threw on — see the error logged for it above. ` +
                `Nothing was established about its calls either way, so it cannot support the ` +
                `guarantee this option makes.\n\n`
              : '') +
            `Each one keeps \`styled-system/css\` in the bundle, so the engine cannot be dropped ` +
            `however many other calls folded. Make the values static, move the variation into a ` +
            `\`cva\` variant, or generate them with \`staticCss\` — or set \`failOnUnfolded: false\` to ` +
            `accept the runtime.`,
        )
      }

      if (!transform || !reportSummary) return

      const declined = Array.from(totals.skipped.values()).reduce((sum, count) => sum + count, 0)
      const total = totals.folded + declined
      if (!total) return

      const share = Math.round((totals.folded / total) * 100)
      const reasons = Array.from(totals.skipped.entries())
        .sort((a, b) => b[1] - a[1])
        .map(([reason, count]) => `${reason}=${count}`)
        .join(' ')

      logger.info(
        'vite:transform',
        `Folded ${totals.folded}/${total} (${share}%) across ${totals.filesWithFolds}/${totals.files} files` +
          (reasons ? ` — declined: ${reasons}` : ''),
      )
    },
  }

  // The css plugin first: it owns the extraction the fold's context reads from, and vite
  // preserves array order within one `enforce` bucket.
  return [bamboocssCss({ configPath, cwd }), fold]
}
