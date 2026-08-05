import { resolve } from 'node:path'

import { logger } from '@bamboocss/logger'
import { loadConfigAndCreateContext } from '@bamboocss/node'
import type { Plugin } from 'vite'
import { foldSource, type SkippedCall } from './fold'
import { createRuntimeCss, type RuntimeCss } from './runtime-css'

export interface BambooVitePluginOptions {
  /**
   * Rewrite statically-resolvable `css()` and pattern calls into literal class
   * strings, so they cost nothing at runtime.
   *
   * Off by default, and build-only — see the "Source transformation" guide for why.
   *
   * @default false
   */
  transform?: boolean
  /**
   * Also collapse `styled.*` and pattern elements to the tag they render, rather than
   * folding call sites alone.
   *
   * On by default, and the larger of the two wins: the factory runs `splitProps`,
   * `css()` and `cx` for every element on every render, inside a `forwardRef` component.
   *
   * @default true
   */
  jsx?: boolean
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
 * This plugin does not emit CSS — keep your existing PostCSS setup for that. Its only
 * job is the optional build-time fold.
 *
 * It runs with `enforce: 'pre'` so it sees module source as close as possible to what
 * the CSS extractor reads off disk. A plugin that rewrites style calls before bamboo
 * sees them would otherwise make the two disagree, and a folded class could end up
 * with no matching rule.
 */
export const bamboocss = (options: BambooVitePluginOptions = {}): Plugin => {
  // `jsx` and `partial` are forwarded undefined rather than defaulted here, so `foldSource`
  // stays the one place their default is written down.
  const { transform = false, jsx, partial, configPath, cwd, reportSkipped = false, reportSummary = true } = options

  /** Totals across the build, for the summary. */
  const totals = { folded: 0, files: 0, filesWithFolds: 0, skipped: new Map<string, number>() }

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

  return {
    name: 'bamboocss',
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

      await ensureContext()
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
        ctx.project.addSourceFile(filePath, code)
        const parserResult = ctx.project.parseSourceFile(filePath)
        if (!parserResult || parserResult.isEmpty()) return null

        result = foldSource({ ctx, code, parserResult, filePath, runtimeCss, jsx, partial })
      } catch (error) {
        logger.caughtError('vite:transform', `Failed to fold ${filePath}`, error)
        return null
      }

      totals.files++
      totals.folded += result.folded.length
      if (result.folded.length) totals.filesWithFolds++
      for (const entry of result.skipped) {
        totals.skipped.set(entry.reason, (totals.skipped.get(entry.reason) ?? 0) + 1)
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
}
