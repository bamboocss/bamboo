import { logger } from '@bamboocss/logger'
import { esc, truncateList } from '@bamboocss/shared'
import type { Plugin, ViteDevServer } from 'vite'
import { createLazyBuilder, createRetryableLazy, loadConfigModule, loadCssOutputModule } from './lazy-modules'
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

interface CssOutputValidator {
  pruneStaticCss(css: string, session: StaticCompilationSession, options?: { prune?: boolean }): string
}

interface BambooCssPluginOptions {
  configPath?: string
  cwd?: string
  /** Injectable retryable dev-validation boundary for focused lifecycle tests. */
  loadCssOutput?: () => PromiseLike<CssOutputValidator>
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
  const { configPath, cwd, loadCssOutput = loadCssOutputModule, session, pruneCss = true } = options

  let builder: Awaited<ReturnType<ReturnType<typeof createLazyBuilder>>> | undefined
  const loadBuilder = createLazyBuilder()
  const ensureBuilder = async () => {
    const loaded = await loadBuilder()
    builder = loaded
    return loaded
  }
  let server: ViteDevServer | undefined
  let command: 'build' | 'serve' = 'build'
  /** The run's own `build` options, for a bundler with no per-environment config. */
  let ssrBuildOptions: { ssr?: boolean | string; ssrEmitAssets?: boolean } | undefined

  /** Included owners plus local modules their extraction actually resolved and read. */
  const extractedSourceFiles = () => {
    const activeBuilder = builder
    const context = activeBuilder?.context
    if (!context) return []
    return [
      ...new Set(
        [...context.getFiles(), ...activeBuilder.getResolutionReadFiles()].map((file) =>
          context.runtime.path.abs(context.config.cwd, file),
        ),
      ),
    ]
  }

  /**
   * Serialised, because both `load` and the watcher can reach it and `Builder` keeps one
   * context. Two overlapping passes would extract into the same encoder and emit the
   * stylesheet twice over.
   */
  let pending: Promise<string> | undefined

  const build = async () => {
    const builder = await ensureBuilder()
    // `hash: 'auto'` reads this, and nothing else does — a class name may differ between dev
    // and production, the CSS may not.
    await builder.setup({ configPath, cwd, dev: command === 'serve' })

    // Writes the `styled-system` artifacts, which is what lets this plugin be a project's only
    // codegen. On the first pass it writes all of them; afterwards only what a config change
    // affected. `buildStart` below is what makes the first pass early enough to count.
    await builder.emit()

    builder.extract()

    if (builder.context?.config.polyfill) {
      throw new Error(
        'bamboocss: the cascade-layer polyfill is incompatible with compiled atomic styles. ' +
          'The polyfill removes the utility-layer boundary required for safe atom reachability and renaming.',
      )
    }

    if (builder.context) {
      session.utilityLayer = builder.context.config.layers?.utilities ?? 'utilities'
      session.extractedFiles.clear()
      for (const file of extractedSourceFiles()) session.extractedFiles.add(file)
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

    return css
  }

  const generate = () => {
    pending = Promise.resolve(pending)
      .catch(() => undefined)
      .then(build)
    return pending
  }

  /**
   * The pass that runs before Rollup resolves anything, and the sheet it produced.
   *
   * `emit` writes `styled-system/`, and reaching it through `load` is too late to be what a
   * fresh clone needs: `load` runs when the *virtual module* is requested, and a module's
   * imports are all resolved before any of them is loaded. So `app/root.tsx` importing both
   * `styled-system/css` and `virtual:bamboo.css` has the first resolved while the directory is
   * still absent — the client build carried on and externalised it, the ssr build failed with
   * "Rolldown failed to resolve import", and `vite dev` served an error overlay. `buildStart` is
   * the first hook Rollup calls, and it precedes all of that.
   *
   * Memoised, and consumed by the first `load` rather than regenerated for it. `buildStart` runs
   * once per environment against this one shared instance, and nothing can have invalidated the
   * result in between — the modules that would invalidate it have not been transformed yet.
   * Regenerating would mean a second full extraction on every cold start, to produce the same
   * bytes.
   */
  let prebuilt: Promise<string> | undefined
  let prebuildStarted = false
  const prebuild = async () => {
    // Once per shared plugin instance, not once per environment. `buildStart` fires for each of
    // them against this one instance, so every caller joins the first one's generation. Once it
    // settles the artifacts are already on disk, which is the whole point of running here. A
    // `vite build --watch` rebuild is covered for the same reason, and `emit` re-writes what a
    // config change affected either way.
    if (!prebuildStarted) {
      prebuildStarted = true
      prebuilt = generate()
    }
    // After the cold sheet is consumed, a later load owns generation through `pending`. A
    // concurrent environment's buildStart must join that work as well: resolving imports while
    // `builder.emit()` is still updating generated artifacts races the files this hook exists to
    // put on disk first.
    const attempt = prebuilt ?? pending
    if (!attempt) return
    try {
      await attempt
    } catch (error) {
      // A failed watch generation must be retryable. Guard the reset by identity: several
      // environments can observe the same rejection, and a late observer must not clear a newer
      // attempt another generation has already started.
      if (prebuilt === attempt || (prebuilt === undefined && pending === attempt)) {
        prebuildStarted = false
        prebuilt = undefined
      }
      throw error
    }
  }

  /**
   * The dev config graph is independent of Builder setup and is needed one hook earlier. Keep
   * its module load and graph walk single-flight as well: shared plugins may be resolved for
   * client and SSR concurrently, but both describe the same Vite config.
   */
  const configDependencyLoaders = new Map<string, () => Promise<Set<string>>>()
  const discoverConfigDependencies = (root: string) => {
    const projectRoot = cwd ?? root
    let discover = configDependencyLoaders.get(projectRoot)
    if (!discover) {
      const created = createRetryableLazy(async () => {
        const { findConfig, getConfigDependencies } = await loadConfigModule()
        const configFile = findConfig({ cwd: projectRoot, file: configPath })
        return getConfigDependencies(configFile).deps
      })
      configDependencyLoaders.set(projectRoot, created)
      discover = created
    }
    return discover()
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

    async configResolved(config) {
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
          const deps = await discoverConfigDependencies(config.root)
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

    /**
     * Put `styled-system/` on disk before anything resolves an import of it.
     *
     * Normalized rather than rethrown as caught, for the reason the compiler's `buildStart`
     * gives: this evaluates the user's config and its hooks, and in dev anything that is not an
     * object crashes Vite's error middleware instead of being reported.
     */
    async buildStart() {
      try {
        await prebuild()
      } catch (error) {
        throw asError(error, `failed to generate ${VIRTUAL_CSS_ID}`)
      }
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

      // Here rather than in `build`, which is no longer only reached by a load: `buildStart`
      // generates the sheet whether or not anything imports it. The flag means the virtual
      // module was asked for, and `buildEnd` fails a build that compiled classes without it.
      session.cssLoaded = true

      let css: string
      try {
        // Resolve the dev validator before taking a generation. Once the generation promise
        // settles, validation must remain in the same continuation with no intervening await:
        // Builder serializes its work through `pending`, but the shared session inventory is
        // replaced on every pass. Waiting for the chunk between those two steps would let a
        // concurrent environment validate old bytes against a newer rule inventory. A rejected
        // chunk attempt leaves `prebuilt` untouched for the next request to retry.
        const validateDevCss = command === 'serve' ? (await loadCssOutput()).pruneStaticCss : undefined

        // The `buildStart` pass, the first time. Cleared as it is taken, so a reload in dev —
        // which is what an invalidation ends in — regenerates rather than replaying it.
        const first = prebuilt
        prebuilt = undefined
        css = await (first ?? generate())

        // Development cannot tree-shake against a complete Rollup graph because modules arrive
        // lazily. It still performs the complete rule-inventory validation before serving the
        // sheet, uses the exact same global atom names, and omits every recipe rule. Keeping the
        // parser here means an unimported prebuild never pays for the CSS-output closure; the
        // final production reachability removal remains in `generateBundle`.
        if (validateDevCss) css = validateDevCss(css, session, { prune: false })
      } catch (error) {
        throw asError(error, `failed to generate ${VIRTUAL_CSS_ID}`)
      }

      // Every file the extractor reads is a source for this module, so editing one has to
      // invalidate it. In build this is what makes `vite build --watch` correct; in dev the
      // watcher below does the same job earlier.
      if (this.addWatchFile) {
        for (const file of extractedSourceFiles()) this.addWatchFile(file)
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

      // The extractor's exact read-set decides what matters, rather than a second glob that
      // misses resolver-loaded values outside `include`.
      const invalidate = (file: string) => {
        const ctx = builder?.context
        if (!ctx) return
        const absoluteFile = ctx.runtime.path.abs(ctx.config.cwd, file)
        if (!session.extractedFiles.has(absoluteFile)) return

        // The `buildStart` pass predates this edit, so it can no longer stand in for a first
        // load. Before the early return below, which is taken when the stylesheet has never been
        // requested — exactly the state in which that pass is still waiting to be handed over.
        prebuilt = undefined

        const mod = server?.moduleGraph.getModuleById(RESOLVED_ID)
        if (!mod) return

        // Already Vite's job. Forcing it as well does not merge with that pass — it is a second
        // `updateModules`, so the browser is told twice and refetches the whole stylesheet
        // twice, 36 kB a copy on the app this was measured on. What is left for this watcher is
        // the case it exists for: a file the extractor reads that never became a module, where
        // Vite matches nothing and nothing would repaint at all.
        if (clientGraph.getModulesByFile(absoluteFile)?.size) return

        server?.moduleGraph.invalidateModule(mod)
        void server?.reloadModule(mod)
        logger.debug('vite', `styles invalidated by ${absoluteFile}`)
      }

      devServer.watcher.on('change', invalidate)
      devServer.watcher.on('add', invalidate)
      devServer.watcher.on('unlink', invalidate)
    },

    generateBundle: {
      order: 'post',
      async handler(outputOptions, bundle) {
        // Load the complete parser/remapping closure before opening the output projection. A
        // rejected chunk load therefore publishes no partial reachability or prune state, and
        // the process-wide retryable loader lets a later rebuild recover.
        const { containsGeneratedCssAsset, optimizeStaticCssAssets } = await loadCssOutputModule()
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

        const environmentName = environment?.name ?? 'default'
        const replacesGeneratedStylesheet = containsGeneratedCssAsset(bundle)
        const outputProjection = session.beginOutputProjection(
          environmentName,
          outputOptions,
          bundle,
          replacesGeneratedStylesheet,
        )
        try {
          /**
           * Pruned against what this environment compiled, without waiting for the rest.
           *
           * The stylesheet is emitted and finalized by the environment that *imports* it, which
           * in an SSR app is the client — and the client builds first, before the server
           * environment has transformed a single module. Waiting for a complete answer therefore
           * meant never pruning at all in any SSR framework: react-router, Remix, Nuxt, SvelteKit
           * and Qwik all build the client first, and the client's output is on disk before the
           * server environment starts. That is most production apps, and the feature was inert in
           * every one of them — silently, since a build with nothing to prune looks identical.
           *
           * The reason for waiting was real: a class only the server graph reaches is not in this
           * environment's reachability set, so pruning here removes rules the server-rendered
           * markup still names. What makes it safe to prune anyway is that the mistake is
           * *detectable* rather than silent — `buildEnd` in `plugin.ts` intersects every later
           * environment's compiled classes against `prunedClasses` and fails the build naming
           * them. A styled component that only ever renders on the server is the shape that
           * trips it, and `pruneCss: false` is the answer when it does.
           *
           * So the trade is deliberate: a loud build failure in the rare case, in exchange for
           * the feature working at all in the common one. It is the same reasoning as the
           * unimported-`virtual:bamboo.css` check — a class with no rule behind it must never
           * leave the build quietly.
           */
          const pending = remainingEnvironments(session)
          if (pending.length) {
            logger.debug(
              'vite',
              `Pruning against the ${JSON.stringify(environment?.name ?? 'default')} environment with ` +
                `${truncateList(pending, { unit: 'environment', separator: ', ' })} still to compile. A class ` +
                `only those reach fails the build rather than shipping without its rule.`,
            )
          }

          // This bundle now replaces the previously emitted stylesheet, so its prune result also
          // replaces that sheet's loss history. Clear only once an actual Bamboo asset exists:
          // doing it earlier would forget the still-live client sheet when an SSR environment
          // loads the virtual module but Vite suppresses its assets, or when a rebuild fails before
          // generateBundle. `optimizeStaticCssAssets` repopulates the set from this generation.
          const { sheets } = optimizeStaticCssAssets(bundle, session, {
            environment: environmentName,
            prune: pruneCss,
            requiredClasses: outputProjection.requiredClasses,
            // Per environment rather than from the session, which one `configResolved` per
            // environment leaves holding whichever resolved last.
            sourcemap: environment?.config?.build?.sourcemap,
          })

          // Said out loud, both ways. Pruning is the difference between the sheet a project
          // measures and the one it extracted, and it used to go missing in silence — a build
          // that quietly stopped pruning looked exactly like one that had nothing to prune.
          if (sheets && !pruneCss) {
            logger.info('vite', 'Reachability pruning is off (`pruneCss: false`). The full extracted stylesheet ships.')
          }

          // A stylesheet that vanishes between here and disk is the worst shape a failure takes:
          // the build is green, every class in the markup is real, and nothing is styled. The
          // compiler knows it produced classes, so it can also insist something carries them —
          // in the same spirit as the unimported-`virtual:bamboo.css` check, which catches the
          // other way to end up with classes and no rules.
          // Only the environment that served the stylesheet answers for it.
          if (!outputProjection.cssLoaded) return
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

          if (!replacesGeneratedStylesheet) {
            throw new Error(
              `bamboocss: ${session.transformedFiles.size} module(s) were compiled to Bamboo class values, but no ` +
                `emitted asset carries the generated stylesheet. The build would ship unstyled.\n\n` +
                `This happens when another plugin, or the bundler itself, drops or replaces the CSS asset after it is ` +
                `emitted. If you are on Rolldown, report this — the rename that used to cause it is already disabled ` +
                `there. Otherwise look for a plugin running in \`generateBundle\` that rewrites CSS assets.`,
            )
          }
        } finally {
          outputProjection.restore()
        }
      },
    },
  }
}
