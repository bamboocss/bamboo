import { findConfig, getConfigDependencies } from '@bamboocss/config'
import { Builder } from '@bamboocss/node'
import { logger } from '@bamboocss/logger'
import { esc, toHash, truncateList } from '@bamboocss/shared'
import remapping from '@ampproject/remapping'
import MagicString from 'magic-string'
import type { Plugin, Rollup, ViteDevServer } from 'vite'
import { pruneStaticCss } from './prune-static-css'
import { remainingEnvironments, type StaticCompilationSession } from './static-session'

/**
 * What a project imports to get the stylesheet.
 *
 * Spelled with a `.css` extension because that is how vite decides what a module is: the
 * id is all it has for a module with no file behind it, so `virtual:bamboo` would be
 * bundled as javascript and injected as a script.
 */
export const VIRTUAL_CSS_ID = 'virtual:bamboo.css'

/**
 * Rollup's convention for a module with no file: a leading NUL tells every other plugin
 * not to try reading it off disk.
 */
const RESOLVED_ID = `\0${VIRTUAL_CSS_ID}`

/**
 * The queries Vite appends to a CSS module — `?url`, `?raw`, `?inline`, and the
 * `?transform-only` that its own `?url` handling rewrites to.
 *
 * None of them resolved here, so asking the stylesheet for its URL failed as an unresolvable
 * path. Rather than answering each one, the query is carried onto the resolved id and the CSS
 * is served for whatever it is: Vite's CSS pipeline already knows what each means, and
 * answering them here would be a second, worse copy of it.
 *
 * `?url` in particular makes the sheet an asset of its own rather than part of whatever
 * stylesheet the importer belongs to. That is what `?url` means rather than a shortcoming, but
 * it is not what a project concatenating Bamboo's CSS into one global stylesheet wants.
 */
const queryOf = (id: string) => {
  const at = id.indexOf('?')
  return at === -1 ? '' : id.slice(at)
}

/**
 * A thrown value Vite can actually report.
 *
 * `catch` binds `unknown`, and anything under compilation — a dependency, a config hook, a
 * bare `throw 'string'` — may throw a primitive. Vite's dev error middleware puts what it is
 * handed into a `WeakSet` to deduplicate it, which throws `TypeError: Invalid value used in
 * weak set` for anything that is not an object, and the real failure is lost behind that.
 *
 * Shared by every hook that can throw while the dev server is serving, so the two cannot
 * drift: a request for the stylesheet reaches `load`, and a request for a module reaches
 * `transform`, and both are answered by the same middleware.
 */
export const asError = (error: unknown, context: string): Error =>
  error instanceof Error ? error : new Error(`bamboocss: ${context}: ${String(error)}`, { cause: error })

const INLINE_SOURCE_MAP = /\n?\/\/# sourceMappingURL=data:application\/json[^\n]*$/

/** Rewrite one generated chunk without invalidating all mappings after the changed string. */
const replaceChunkReference = (
  chunk: Rollup.OutputChunk,
  bundle: Rollup.OutputBundle,
  previous: string,
  next: string,
  sourcemap: StaticCompilationSession['sourcemap'],
) => {
  if (!chunk.code.includes(previous)) return

  const magic = new MagicString(chunk.code)
  let index = chunk.code.indexOf(previous)
  while (index !== -1) {
    magic.overwrite(index, index + previous.length, next)
    index = chunk.code.indexOf(previous, index + previous.length)
  }
  chunk.code = magic.toString()

  if (!chunk.map) return
  const file = chunk.map.file
  const debugId = (chunk.map as Rollup.SourceMap & { debugId?: string }).debugId
  const combined = remapping(
    [magic.generateMap({ source: chunk.fileName, hires: 'boundary' }), chunk.map] as never,
    () => null,
  )
  if (file) combined.file = file
  if (debugId) (combined as typeof combined & { debugId?: string }).debugId = debugId
  const rollupMap = combined as unknown as Rollup.SourceMap
  rollupMap.toUrl = () =>
    `data:application/json;charset=utf-8;base64,${Buffer.from(combined.toString()).toString('base64')}`
  chunk.map = rollupMap

  if (sourcemap === 'inline') {
    chunk.code = chunk.code.replace(INLINE_SOURCE_MAP, '')
    chunk.code += `\n//# sourceMappingURL=data:application/json;charset=utf-8;base64,${Buffer.from(combined.toString()).toString('base64')}`
    return
  }

  const mapAsset = bundle[`${chunk.fileName}.map`]
  if (mapAsset?.type === 'asset') mapAsset.source = combined.toString()
}

/** Replace an emitted filename wherever Vite or Rollup has already recorded it. */
const replaceAssetReferences = (
  bundle: Rollup.OutputBundle,
  previous: string,
  next: string,
  sourcemap: StaticCompilationSession['sourcemap'],
) => {
  const replace = (value: string) => value.replaceAll(previous, next)

  for (const output of Object.values(bundle)) {
    if (output.type === 'asset') {
      if (typeof output.source === 'string') output.source = replace(output.source)
      continue
    }

    replaceChunkReference(output, bundle, previous, next, sourcemap)

    // Rollup's type declares this as required, so the guard reads as redundant and is not.
    // Our peer range is `vite: ">=5"`, which covers a Rollup-compatible bundler driving the
    // build, and a plugin may also put a chunk-shaped entry in the bundle without it. A
    // client hit exactly that and shipped a patched `dist`.
    //
    // Skipping is correct rather than a workaround: the list mirrors references the chunk's
    // own code already carries, and `replaceChunkReference` above rewrote those. An absent
    // list means there is no second copy to keep in step.
    const referencedFiles = (output as typeof output & { referencedFiles?: string[] }).referencedFiles
    if (referencedFiles) output.referencedFiles = referencedFiles.map(replace)

    // Vite's HTML, manifest, preload, and SSR-manifest passes consume this metadata. It is
    // deliberately not in Rollup's public type.
    const importedCss = (output as typeof output & { viteMetadata?: { importedCss?: Set<string> } }).viteMetadata
      ?.importedCss
    if (importedCss?.delete(previous)) importedCss.add(next)
  }
}

/**
 * Could this bundle entry be the generated stylesheet?
 *
 * The filename is checked before the bytes because the alternative decodes every asset in the
 * bundle to a UTF-8 string in order to search it — fonts, images and sourcemaps included. On an
 * app with a large asset graph that is seconds of decode and a lot of garbage, twice over, to
 * answer a question the extension already answers. The marker is a CSS custom property, so it
 * cannot occur anywhere but CSS.
 */
const carriesGeneratedCss = (output: Rollup.OutputBundle[string]): output is Rollup.OutputAsset =>
  output.type === 'asset' && output.fileName.endsWith('.css')

/**
 * Prune compiler-owned CSS, then give any sheet whose bytes changed a hash of those bytes.
 *
 * Rollup has already expanded `[hash]` when `generateBundle` runs. Mutating only `source`
 * would therefore leave two different reachable subsets under one CDN key. The extra final
 * hash is not cosmetic: it makes late graph reachability cache-safe.
 *
 * Renaming is therefore not a choice this takes. Pruned bytes under the unpruned sheet's name
 * is the one outcome that must never be reachable, and a sheet nothing was removed from keeps
 * its name because its bytes are unchanged — so "rename" is a consequence of "the bytes moved",
 * not a second option. `prune` is the only knob.
 */
export const optimizeStaticCssAssets = (
  bundle: Rollup.OutputBundle,
  session: StaticCompilationSession,
  options: { prune?: boolean; sourcemap?: StaticCompilationSession['sourcemap'] } = {},
) => {
  const { prune = true, sourcemap = session.sourcemap } = options
  /** Assets in this bundle that carry the generated stylesheet, pruned or not. */
  let sheets = 0

  for (const output of Object.values(bundle)) {
    if (!carriesGeneratedCss(output)) continue
    const source = typeof output.source === 'string' ? output.source : Buffer.from(output.source).toString()
    if (!source.includes('--made-with-bamboo')) continue
    sheets++

    // Left byte-identical rather than run through the pass with pruning disabled. That path
    // still reprints the sheet through postcss, and a differing string is what triggers the
    // rename below — a new asset name for a stylesheet whose reachable set never changed.
    if (!prune) continue

    const optimized = pruneStaticCss(source, session)
    output.source = optimized
    if (optimized === source) continue

    // Unconditional from here. `[hash]` is expanded before this runs, so pruned bytes under
    // the original name is the worst outcome available: a change to *reachability alone* —
    // which is what a Bamboo upgrade is — leaves identical source CSS under an identical name
    // with different content, and a CDN holding that key serves the old stylesheet past the
    // deploy. One user hit that twice and worked around it by versioning the filename
    // themselves. A caller that cannot accept the rename declines the prune instead, above.
    // No "did the name actually change" guard, deliberately. `carriesGeneratedCss` has already
    // established the `.css` ending and `toHash` never returns empty, so the replacement always
    // lengthens the name — such a guard would be dead, and dead in the one place where becoming
    // live would ship the unsafe state: `source` is assigned above, so skipping the rename here
    // is exactly pruned bytes under the unpruned name.
    const nextName = output.fileName.replace(/\.css$/, `.b-${toHash(optimized)}.css`)
    if (bundle[nextName] && bundle[nextName] !== output) {
      throw new Error(`bamboocss: final CSS asset name collision at ${JSON.stringify(nextName)}.`)
    }

    // `fileName` is mutated in place rather than by re-keying `bundle`. Replacing an entry is
    // what Rolldown refuses — it logs that the assignment is ignored and drops the asset, so
    // the build shipped no stylesheet at all — while the rename itself is fine there. Rollup
    // and Rolldown both write an asset to its `fileName`, and `replaceAssetReferences` carries
    // the recorded references across, so nothing needs the key to move.
    const previous = output.fileName
    output.fileName = nextName
    replaceAssetReferences(bundle, previous, nextName, sourcemap)
  }

  return { sheets }
}

interface BambooCssPluginOptions {
  configPath?: string
  cwd?: string
  /** Internal state supplied by `bamboocss()`; the CSS emitter is not a standalone mode. */
  session: StaticCompilationSession
  /** See `BambooVitePluginOptions.pruneCss`. @default true */
  pruneCss?: boolean
}

/**
 * Serve bamboo's stylesheet as a virtual module, in dev and in build.
 *
 * This is the integration itself, not an optimisation: without it nothing emits css and
 * the generated `styled-system` runtime names classes no rule exists for.
 *
 * A virtual module rather than a file written to disk, because vite already owns the two
 * things a file would have to reimplement. In dev it injects css over the websocket and
 * replaces it in place, so an edit repaints without reloading; in build it hashes the
 * content into the asset graph and lets the bundler decide where it lands. Writing
 * `styles.css` and asking the project to import it means the build reads a file the same
 * process just wrote, which is a race on any watch rebuild.
 */
export const bamboocssCss = (options: BambooCssPluginOptions): Plugin => {
  const { configPath, cwd, session, pruneCss = true } = options

  /**
   * Environments whose `load` served the virtual stylesheet.
   *
   * The lost-sheet guard below is about an asset that existed and then went missing, so it
   * can only be asked of an environment that asked for one. An SSR bundle never imports the
   * stylesheet — the client build emits it — and firing there turned a correct two-environment
   * build into a hard failure.
   */
  const servedEnvironments = new Set<string>()

  const builder = new Builder()
  let server: ViteDevServer | undefined
  let command: 'build' | 'serve' = 'build'
  /** The run's own `build` options, for a bundler with no per-environment config. */
  let ssrBuildOptions: { ssr?: boolean | string; ssrEmitAssets?: boolean } | undefined

  /**
   * Serialised, because both `load` and the watcher can reach it and `Builder` keeps one
   * context. Two overlapping passes would extract into the same encoder and emit the
   * stylesheet twice over.
   */
  let pending: Promise<string> | undefined

  const build = async () => {
    await builder.setup({ configPath, cwd })

    // Writes the `styled-system` artifacts. It has to happen here rather than being left
    // to the CLI: the project imports `styled-system/css`, so a fresh clone has to get
    // those files from the first `vite dev` or the import fails before any css matters.
    await builder.emit()

    builder.extract()

    if (builder.context?.config.polyfill) {
      throw new Error(
        'bamboocss: the cascade-layer polyfill is incompatible with compiled atomic styles. ' +
          'The polyfill removes the utility-layer boundary required for safe atom reachability and renaming.',
      )
    }

    if (builder.context) {
      session.cssLoaded = true
      session.utilityLayer = builder.context.config.layers?.utilities ?? 'utilities'
      session.extractedFiles.clear()
      for (const file of builder.context.getFiles()) {
        session.extractedFiles.add(builder.context.runtime.path.abs(builder.context.config.cwd, file))
      }
    }

    let graphAtomHashes: Set<string> | undefined
    if (builder.context) {
      builder.context.encoder.atomizeObservedRecipes()
      // Captured before baseline/staticCss generation. Graph atoms can be removed when no
      // transformed module emits them; explicit staticCss atoms remain outside this set and
      // continue to act as a safelist.
      graphAtomHashes = new Set(builder.context.encoder.atomic)
    }

    // The whole stylesheet, so it carries the `@layer` order statement itself.
    const css = builder.toCss({ layerParams: true, includeRecipes: false })

    session.prunableClasses.clear()
    session.viewTransitionClasses.clear()
    if (graphAtomHashes && builder.context) {
      const decoder = builder.context.decoder.collect(builder.context.encoder)
      for (const atom of decoder.atomic) {
        if (graphAtomHashes.has(atom.hash)) session.prunableClasses.add(atom.className)
      }
      for (const transition of decoder.view_transitions) {
        session.viewTransitionClasses.add(transition.className)
        session.prunableClasses.add(esc(transition.className))
      }
    }

    // Development cannot tree-shake against a complete Rollup graph because modules arrive
    // lazily. It still uses the exact same global atom names and omits every recipe rule;
    // only the final production reachability removal waits for `generateBundle`.
    return command === 'serve' ? pruneStaticCss(css, session, { prune: false }) : css
  }

  const generate = () => {
    pending = Promise.resolve(pending)
      .catch(() => undefined)
      .then(build)
    return pending
  }

  return {
    name: 'bamboocss:css',

    // Both `serve` and `build`: source compilation and virtual CSS use one representation in
    // both commands.

    /**
     * One instance for every environment of a build, rather than one per environment.
     *
     * Vite re-reads the config file once per environment, so a project that lists this plugin
     * in `vite.config.ts` — every project — got a *fresh* instance per environment, each with
     * its own compilation session, context and ts-morph project. Nothing an environment
     * established could then be seen by the next one, which is the premise the reachability
     * accounting below is built on, and it also meant the whole config load and extraction
     * happened once per environment.
     */
    sharedDuringBuild: true,

    configResolved(config) {
      command = config.command
      session.sourcemap = config.build.sourcemap
      ssrBuildOptions = { ssr: config.build.ssr, ssrEmitAssets: config.build.ssrEmitAssets }

      /**
       * Tell Vite that `bamboo.config.ts` is a config file, so editing one restarts the server.
       *
       * Tokens live there, and they are what a designer iterates on most — "restart the dev
       * server to see a colour change" is the wrong instruction for the file most likely to be
       * edited all afternoon. Nothing watched it: `watch` is the CLI's own watcher, and a
       * project running `vite dev` never reaches it.
       *
       * A restart rather than re-emitting the stylesheet, because this plugin and the compiler
       * hold *separate* contexts and only this one reloads its config. A token *value* edit
       * came out right on the next source change, and an edit that changes what compiles —
       * adding a token, a condition, a utility — left the compiler naming classes from the old
       * config against a sheet emitted from the new one. Half-updated is worse than stale.
       *
       * Through Vite's own list rather than a watcher of ours. Vite adds these paths to the
       * files it watches, which is what reaches a config *outside* `root` — a monorepo with one
       * config above `apps/web`, or a preset resolved into `node_modules`, neither of which the
       * project watcher covers. It also means the restart is Vite's, with its own concurrency
       * guard and its own error reporting, rather than a second implementation of both.
       *
       * The config's own import graph is resolved the way `Builder` resolves it, minus the
       * tsconfig paths it has not loaded yet at this point. `dependencies` globs are not
       * expanded here: they are declared as an escape hatch for a *config reload*, and turning
       * every file matching one into a full server restart is not what a project asking for
       * that meant.
       */
      // Scoped rather than returned early: everything below this runs in a build, and the
      // environment accounting it sets up is what keeps a two-environment build from pruning
      // a stylesheet the second one still contributes to.
      if (config.command === 'serve') {
        try {
          const configFile = findConfig({ cwd: cwd ?? config.root, file: configPath })
          const { deps } = getConfigDependencies(configFile)
          config.configFileDependencies.push(...deps)
        } catch {
          // No config to watch. `load` reports that properly, with the message the CLI uses.
        }
      }

      // `builder` is defined only when the run drives Vite's environment builder — `vite build
      // --app`, or any framework that sets it, which is how react-router, Nuxt and SvelteKit
      // produce a client and an SSR bundle. Absent, exactly one environment is set up and
      // whatever it reaches is the whole build.
      //
      // Read here rather than from the `buildApp` hook alone because a framework builds its
      // environments from inside its own `buildApp`, and hook order between plugins is not
      // ours to rely on. This is known before any of that runs.
      if (config.builder && config.environments) {
        session.expectedEnvironments = new Set(Object.keys(config.environments))
      }
    },

    /**
     * The definitive environment list, for a run that reaches `builder.buildApp()` without
     * configuring `builder` — the shape `vite build` itself takes, where exactly one
     * environment is set up and pruning is therefore safe.
     */
    buildApp: {
      order: 'pre',
      async handler(builder) {
        session.expectedEnvironments = new Set(Object.keys(builder.environments))
      },
    },

    resolveId(id) {
      const query = queryOf(id)
      const base = id.slice(0, id.length - query.length)
      // Both spellings. Vite's own `?url` handling re-imports the *resolved* id with a
      // different query, so declining that leaves it unresolvable and the build fails naming
      // an import nobody wrote.
      if (base !== VIRTUAL_CSS_ID && base !== RESOLVED_ID) return null
      return `${RESOLVED_ID}${query}`
    },

    async load(id) {
      const query = queryOf(id)
      if (id.slice(0, id.length - query.length) !== RESOLVED_ID) return null

      servedEnvironments.add((this as { environment?: { name?: string } }).environment?.name ?? 'default')

      let css: string
      try {
        css = await generate()
      } catch (error) {
        throw asError(error, `failed to generate ${VIRTUAL_CSS_ID}`)
      }

      // Every file the extractor reads is a source for this module, so editing one has to
      // invalidate it. In build this is what makes `vite build --watch` correct; in dev the
      // watcher below does the same job earlier.
      if (this.addWatchFile) {
        for (const file of builder.context?.getFiles() ?? []) {
          this.addWatchFile(builder.context!.runtime.path.abs(builder.context!.config.cwd, file))
        }
      }

      return css
    },

    configureServer(devServer) {
      server = devServer

      /**
       * The graph the stylesheet's own module lives in, which is the one that has to reach it.
       *
       * `load` registers every extracted file with `addWatchFile`, and `vite:css-analysis`
       * turns those into real importer edges — the virtual module ends up a direct importer of
       * each file the extractor read. So an edit to any of them propagates to the stylesheet on
       * Vite's own pass, in whichever environment holds that edge.
       *
       * The client one, because CSS is a client concern: an ssr environment never applies a
       * stylesheet update, and asking whether *any* environment matched would skip the forced
       * reload below for a server-only module whose styles the client still has to be told
       * about. Vite 5 has one graph and no `environments`, where the question is exact.
       */
      const clientGraph: { getModulesByFile: (file: string) => { size: number } | undefined } =
        devServer.environments?.client?.moduleGraph ?? devServer.moduleGraph

      // The extractor's own file list decides what matters, rather than a second glob that
      // could disagree with it. `include` is resolved against the config's cwd.
      const invalidate = (file: string) => {
        const ctx = builder.context
        if (!ctx) return
        if (!ctx.getFiles().some((f) => ctx.runtime.path.abs(ctx.config.cwd, f) === file)) return

        const mod = server?.moduleGraph.getModuleById(RESOLVED_ID)
        if (!mod) return

        // Already Vite's job. Forcing it as well does not merge with that pass — it is a second
        // `updateModules`, so the browser is told twice and refetches the whole stylesheet
        // twice, 36 kB a copy on the app this was measured on. What is left for this watcher is
        // the case it exists for: a file the extractor reads that never became a module, where
        // Vite matches nothing and nothing would repaint at all.
        if (clientGraph.getModulesByFile(file)?.size) return

        server?.moduleGraph.invalidateModule(mod)
        void server?.reloadModule(mod)
        logger.debug('vite', `styles invalidated by ${file}`)
      }

      devServer.watcher.on('change', invalidate)
      devServer.watcher.on('add', invalidate)
      devServer.watcher.on('unlink', invalidate)
    },

    generateBundle: {
      order: 'post',
      handler(_, bundle) {
        const environment = (
          this as {
            environment?: {
              name?: string
              config?: {
                build?: {
                  sourcemap?: StaticCompilationSession['sourcemap']
                  ssr?: boolean | string
                  ssrEmitAssets?: boolean
                }
              }
            }
          }
        ).environment

        /**
         * Every environment of this run has already had its modules compiled.
         *
         * Reachability is what pruning removes rules against, and it is only complete once
         * nothing is left to contribute to it. The stylesheet is emitted and finalized by the
         * environment that *imports* it, which in an SSR app is the client — and the client
         * builds first, before the server environment has transformed a single module. Pruning
         * there deletes every rule for a class only the server graph reaches, and the pages
         * link the pruned copy: one project lost 39% of its atoms that way, presenting as
         * rarely-used classes such as `md:{display:inline-block}` silently not applying.
         *
         * So the full extracted stylesheet ships instead, which is what `pruneCss: false` asks
         * for by hand. Being the last environment is not the common case — frameworks build the
         * client first — but it is the only one where the answer is knowable, and a framework
         * that builds its server bundle first does get pruned output.
         */
        const pending = remainingEnvironments(session)

        const { sheets } = optimizeStaticCssAssets(bundle, session, {
          prune: pruneCss && pending.length === 0,
          // Per environment rather than from the session, which one `configResolved` per
          // environment leaves holding whichever resolved last.
          sourcemap: environment?.config?.build?.sourcemap,
        })

        // Said out loud, both ways. Pruning is the difference between the sheet a project
        // measures and the one it extracted, and it used to go missing in silence — a build
        // that quietly stopped pruning looked exactly like one that had nothing to prune.
        if (sheets && !pruneCss) {
          logger.info('vite', 'Reachability pruning is off (`pruneCss: false`). The full extracted stylesheet ships.')
        } else if (sheets && pending.length) {
          // Named rather than counted, and phrased as "not compiled" rather than "builds
          // later": an environment this run declares but never builds also lands here, and
          // saying it comes next would be wrong about the one case a reader cannot check.
          logger.info(
            'vite',
            `Reachability pruning skipped: the stylesheet is emitted by the ${JSON.stringify(
              environment?.name ?? 'default',
            )} environment, and ${truncateList(pending, { unit: 'environment', separator: ', ' })} ` +
              `${pending.length === 1 ? 'has' : 'have'} not been compiled in this run. The full extracted ` +
              `stylesheet ships — nothing is missing from it.`,
          )
        }

        // A stylesheet that vanishes between here and disk is the worst shape a failure takes:
        // the build is green, every class in the markup is real, and nothing is styled. The
        // compiler knows it produced classes, so it can also insist something carries them —
        // in the same spirit as the unimported-`virtual:bamboo.css` check, which catches the
        // other way to end up with classes and no rules.
        // Only the environment that served the stylesheet answers for it.
        if (!servedEnvironments.has(environment?.name ?? 'default')) {
          return
        }
        if (!session.transformedFiles.size) return

        /**
         * An SSR bundle emits no CSS assets, and is not supposed to.
         *
         * `build.ssrEmitAssets` is off by default, so Vite discards them: the client build is
         * what carries the stylesheet, and a server bundle that imports `virtual:bamboo.css`
         * from shared code — a root component, a layout — still asks this plugin to load it.
         * Which means the environment *served* the sheet and then emitted nothing, and the
         * check below read that as the failure it exists to catch.
         *
         * It fails a build that is entirely correct. Qwik's `vite build --ssr` is the shape
         * that showed it: 7/7 calls compiled, the client bundle carrying the stylesheet, and
         * the server bundle refusing to finish. React Router does not hit it only because its
         * plugin turns `ssrEmitAssets` on.
         *
         * Read per environment where that exists, falling back to the run's own config, so
         * Vite 5's single-config builds are answered by the same question.
         */
        const buildOptions = environment?.config?.build ?? ssrBuildOptions
        if (buildOptions?.ssr && !buildOptions.ssrEmitAssets) return

        const emitsMarkerAsset = Object.values(bundle).some((output) => {
          if (!carriesGeneratedCss(output)) return false
          const source = typeof output.source === 'string' ? output.source : Buffer.from(output.source).toString()
          return source.includes('--made-with-bamboo')
        })

        if (!emitsMarkerAsset) {
          throw new Error(
            `bamboocss: ${session.transformedFiles.size} module(s) were compiled to Bamboo class values, but no ` +
              `emitted asset carries the generated stylesheet. The build would ship unstyled.\n\n` +
              `This happens when another plugin, or the bundler itself, drops or replaces the CSS asset after it is ` +
              `emitted. If you are on Rolldown, report this — the rename that used to cause it is already disabled ` +
              `there. Otherwise look for a plugin running in \`generateBundle\` that rewrites CSS assets.`,
          )
        }
      },
    },
  }
}
