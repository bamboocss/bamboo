import { resolve } from 'node:path'

import { logger } from '@bamboocss/logger'
import { truncateList } from '@bamboocss/shared'
import { loadConfigAndCreateContext } from '@bamboocss/node'
import type { Plugin } from 'vite'
import { bamboocssCss, VIRTUAL_CSS_ID } from './css'
import { foldSource, type ForeignRecipes, type SkipReason, type SkippedCall } from './fold'
import { createRuntimeCss, type RuntimeCss } from './runtime-css'
import { createStaticStyleSetCompiler, type StaticStyleSetCompiler } from './style-set'
import {
  createStaticCompilationSession,
  resetStaticCompilationSession,
  type DenseClassNameMode,
} from './static-session'

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
   * Compact atom names. `true`/`stable` is deterministic across
   * client and SSR builds. `local` uses the shortest names and is safe only when one build
   * produces both HTML and CSS. @default true
   */
  denseClassNames?: DenseClassNameMode
  /**
   * Maximum complete selections compiled for one runtime `cva`/`sva` call. This bounds
   * build time and memory for the exact compound-variant decision table. @default 65536
   */
  maxRecipeStates?: number
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
 * and nothing styles without it. The second compiles every Bamboo source call in both dev
 * and build; there is no runtime styling fallback.
 *
 * The compiler runs with `enforce: 'pre'` so it sees module source as close as possible to what
 * the CSS extractor reads off disk. A plugin that rewrites style calls before bamboo
 * sees them would otherwise make the two disagree, and a folded class could end up
 * with no matching rule.
 */
export const bamboocss = (options: BambooVitePluginOptions = {}): Plugin[] => {
  const {
    configPath,
    cwd,
    reportSkipped = false,
    reportSummary = true,
    denseClassNames = true,
    maxRecipeStates,
  } = options

  if (maxRecipeStates !== undefined && (!Number.isSafeInteger(maxRecipeStates) || maxRecipeStates < 1)) {
    throw new Error('bamboocss: `maxRecipeStates` must be a positive safe integer.')
  }

  /** Totals across the build, for the summary. */
  const totals = { folded: 0, files: 0, filesWithFolds: 0, skipped: new Map<string, number>() }
  const staticSession = createStaticCompilationSession(denseClassNames)

  type Survivor = { file: string; line: number; name: string; reason: SkipReason }
  const survivors: Survivor[] = []
  const survivorKeys = new Set<string>()
  const addSurvivor = (entry: (typeof survivors)[number]) => {
    const key = `${entry.file}:${entry.line}:${entry.name}:${entry.reason}`
    if (survivorKeys.has(key)) return
    survivorKeys.add(key)
    survivors.push(entry)
  }
  const clearSurvivorsFor = (file: string) => {
    for (let index = survivors.length - 1; index >= 0; index--) {
      if (survivors[index]?.file === file) survivors.splice(index, 1)
    }
    survivorKeys.clear()
    for (const entry of survivors) {
      survivorKeys.add(`${entry.file}:${entry.line}:${entry.name}:${entry.reason}`)
    }
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
        `Bamboo emits no runtime styling fallback or recipe layer. Make the values finite and statically ` +
        `analyzable, move variation into declared recipe variants, or safelist intentional dynamic classes ` +
        `with \`staticCss\`.`,
    )
  }

  /**
   * Recipe configs read out of modules other than the one being transformed.
   *
   * Per build rather than per module: a recipe declared once and imported by fifty components
   * would otherwise re-parse its module fifty times, which is the transform path.
   */
  const recipeConfigCache = new Map<string, ForeignRecipes>()

  let ctx: Awaited<ReturnType<typeof loadConfigAndCreateContext>> | undefined
  let runtimeCss: RuntimeCss | undefined
  let styleCompiler: StaticStyleSetCompiler | undefined
  let command: 'build' | 'serve' = 'build'
  let setup: Promise<void> | undefined

  const ensureContext = async () => {
    if (!setup) {
      setup = loadConfigAndCreateContext({ configPath, cwd }).then((loaded) => {
        ctx = loaded
        const semanticCss = createRuntimeCss(loaded)
        runtimeCss = (...styles: Parameters<RuntimeCss>) => staticSession.allocateClassString(semanticCss(...styles))
        styleCompiler = createStaticStyleSetCompiler(loaded, runtimeCss, staticSession.allocateClassString)
      })
    }
    await setup
  }

  const compiler: Plugin = {
    name: 'bamboocss:compiler',
    enforce: 'pre',

    configResolved(config) {
      command = config.command
    },

    async buildStart() {
      // `vite build --watch` runs this hook once per rebuild against the same plugin
      // instance, so without a reset the summary reports every build since the first
      // and the percentage stops describing the bundle that was just written.
      totals.folded = 0
      totals.files = 0
      totals.filesWithFolds = 0
      totals.skipped.clear()
      survivors.length = 0
      survivorKeys.clear()
      recipeConfigCache.clear()
      resetStaticCompilationSession(staticSession)

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
        return
      }

      ctx.project.reloadSourceFile(filePath)
    },

    async transform(code, id) {
      if (!shouldTransform(id)) return null

      await ensureContext()
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

        totals.files++
        totals.skipped.set('compile-failed', (totals.skipped.get('compile-failed') ?? 0) + 1)
        addSurvivor({ file: filePath, line: 1, name: 'compiler', reason: 'compile-failed' })
        if (command === 'serve') throw error
        return null
      }

      totals.files++
      totals.folded += result.folded.length
      if (result.folded.length) totals.filesWithFolds++
      for (const entry of result.skipped) {
        totals.skipped.set(entry.reason, (totals.skipped.get(entry.reason) ?? 0) + 1)
      }

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

      if (command === 'serve' && survivors.some((entry) => entry.file === filePath)) {
        throw createSurvivorError(survivors.filter((entry) => entry.file === filePath))
      }

      if (!result.folded.length) return null

      logger.debug('vite:transform', `Compiled ${result.folded.length} call(s) in ${filePath}`)

      return { code: result.code, map: result.map }
    },

    buildEnd() {
      if (survivors.length) {
        throw createSurvivorError(survivors)
      }

      // The symbolic compiler names classes from Vite's live module graph, while CSS is
      // extracted from Bamboo's configured `include`. A strict build must prove those two
      // graphs agree: otherwise a perfectly folded class can have no rule behind it.
      // `getModuleInfo` distinguishes a real Rollup build from unit harnesses that call the
      // hook directly without the companion CSS plugin.
      if (typeof this.getModuleInfo === 'function') {
        if (!staticSession.cssLoaded) {
          throw new Error(
            `bamboocss: compiled class values were produced, but ${JSON.stringify(VIRTUAL_CSS_ID)} ` +
              `was not imported. Import it once from the application entry so the compiled rules are emitted.`,
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
        `Compiled ${totals.folded}/${total} (${share}%) across ${totals.filesWithFolds}/${totals.files} files` +
          (reasons ? ` — declined: ${reasons}` : ''),
      )
    },
  }

  // The css plugin first: it owns the extraction the compiler's context reads from, and Vite
  // preserves array order within one `enforce` bucket.
  return [bamboocssCss({ configPath, cwd, session: staticSession }), compiler]
}
