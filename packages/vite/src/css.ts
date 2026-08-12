import { Builder } from '@bamboocss/node'
import { logger } from '@bamboocss/logger'
import { esc, toHash } from '@bamboocss/shared'
import remapping from '@ampproject/remapping'
import MagicString from 'magic-string'
import type { Plugin, Rollup, ViteDevServer } from 'vite'
import { pruneStaticCss } from './prune-static-css'
import type { StaticCompilationSession } from './static-session'

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
 * Prune and rename compiler-owned CSS, then give changed assets a hash of their final bytes.
 *
 * Rollup has already expanded `[hash]` when `generateBundle` runs. Mutating only `source`
 * would therefore leave two different reachable subsets under one CDN key. The extra final
 * hash is not cosmetic: it makes late graph reachability cache-safe.
 */
export const optimizeStaticCssAssets = (
  bundle: Rollup.OutputBundle,
  session: StaticCompilationSession,
  options: { rename?: boolean } = {},
) => {
  const { rename = true } = options

  for (const output of Object.values(bundle)) {
    if (!carriesGeneratedCss(output)) continue
    const source = typeof output.source === 'string' ? output.source : Buffer.from(output.source).toString()
    if (!source.includes('--made-with-bamboo')) continue

    const optimized = pruneStaticCss(source, session)
    output.source = optimized
    if (optimized === source) continue

    // Renaming and pruning are one operation, never half of one. `[hash]` is expanded before
    // this runs, so pruned bytes under the original name is the worst outcome available: a
    // change to *reachability alone* — which is what a Bamboo upgrade is — leaves identical
    // source CSS under an identical name with different content, and a CDN holding that key
    // serves the old stylesheet past the deploy. One user hit that twice and worked around it
    // by versioning the filename themselves. So when the name cannot move, the bytes do not
    // either.
    if (!rename) {
      output.source = source
      continue
    }

    const nextName = output.fileName.replace(/\.css$/, `.b-${toHash(optimized)}.css`)
    if (nextName === output.fileName) continue
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
    replaceAssetReferences(bundle, previous, nextName, session.sourcemap)
  }
}

interface BambooCssPluginOptions {
  configPath?: string
  cwd?: string
  /** Internal state supplied by `bamboocss()`; the CSS emitter is not a standalone mode. */
  session: StaticCompilationSession
  /** See `BambooVitePluginOptions.renameCssAsset`. @default true */
  renameCssAsset?: boolean
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
  const { configPath, cwd, session, renameCssAsset = true } = options

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

    configResolved(config) {
      command = config.command
      session.sourcemap = config.build.sourcemap
    },

    resolveId(id) {
      if (id === VIRTUAL_CSS_ID) return RESOLVED_ID
      return null
    },

    async load(id) {
      if (id !== RESOLVED_ID) return null

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

      // The extractor's own file list decides what matters, rather than a second glob that
      // could disagree with it. `include` is resolved against the config's cwd.
      const invalidate = (file: string) => {
        const ctx = builder.context
        if (!ctx) return
        if (!ctx.getFiles().some((f) => ctx.runtime.path.abs(ctx.config.cwd, f) === file)) return

        const mod = server?.moduleGraph.getModuleById(RESOLVED_ID)
        if (!mod) return

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
        optimizeStaticCssAssets(bundle, session, { rename: renameCssAsset })

        // A stylesheet that vanishes between here and disk is the worst shape a failure takes:
        // the build is green, every class in the markup is real, and nothing is styled. The
        // compiler knows it produced classes, so it can also insist something carries them —
        // in the same spirit as the unimported-`virtual:bamboo.css` check, which catches the
        // other way to end up with classes and no rules.
        // Only the environment that served the stylesheet answers for it.
        if (!servedEnvironments.has((this as { environment?: { name?: string } }).environment?.name ?? 'default')) {
          return
        }
        if (!session.transformedFiles.size) return

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
