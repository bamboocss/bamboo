import { Builder } from '@bamboocss/node'
import { logger } from '@bamboocss/logger'
import { toHash } from '@bamboocss/shared'
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
    output.referencedFiles = output.referencedFiles.map(replace)

    // Vite's HTML, manifest, preload, and SSR-manifest passes consume this metadata. It is
    // deliberately not in Rollup's public type.
    const importedCss = (output as typeof output & { viteMetadata?: { importedCss?: Set<string> } }).viteMetadata
      ?.importedCss
    if (importedCss?.delete(previous)) importedCss.add(next)
  }
}

/**
 * Prune and rename compiler-owned CSS, then give changed assets a hash of their final bytes.
 *
 * Rollup has already expanded `[hash]` when `generateBundle` runs. Mutating only `source`
 * would therefore leave two different reachable subsets under one CDN key. The extra final
 * hash is not cosmetic: it makes late graph reachability cache-safe.
 */
export const optimizeStaticCssAssets = (bundle: Rollup.OutputBundle, session: StaticCompilationSession) => {
  for (const [bundleName, output] of Object.entries(bundle)) {
    if (output.type !== 'asset') continue
    const source = typeof output.source === 'string' ? output.source : Buffer.from(output.source).toString()
    if (!source.includes('--made-with-bamboo')) continue

    const optimized = pruneStaticCss(source, session)
    output.source = optimized
    if (optimized === source) continue

    const nextName = output.fileName.replace(/\.css$/, `.b-${toHash(optimized)}.css`)
    if (nextName === output.fileName) continue
    if (bundle[nextName] && bundle[nextName] !== output) {
      throw new Error(`bamboocss: final CSS asset name collision at ${JSON.stringify(nextName)}.`)
    }

    const previous = output.fileName
    output.fileName = nextName
    replaceAssetReferences(bundle, previous, nextName, session.sourcemap)
    delete bundle[bundleName]
    bundle[nextName] = output
  }
}

export interface BambooCssPluginOptions {
  configPath?: string
  cwd?: string
  /** Emit recipe declarations as shared atoms and omit the legacy recipe layers. */
  staticComposition?: boolean
  /** Internal state supplied by `bamboocss()` when the fold and CSS emitter are paired. */
  session?: StaticCompilationSession
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
export const bamboocssCss = (options: BambooCssPluginOptions = {}): Plugin => {
  const { configPath, cwd, staticComposition = false, session } = options

  const builder = new Builder()
  let server: ViteDevServer | undefined
  // The companion fold is build-only. Dev must keep the legacy recipe sheet because the
  // source still calls the generated recipe runtime there.
  let compileStatically = false

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

    if (compileStatically && builder.context?.config.polyfill) {
      throw new Error(
        'bamboocss: `staticComposition` cannot currently be combined with the cascade-layer polyfill. ' +
          'The polyfill removes the utility-layer boundary required for safe atom reachability and renaming.',
      )
    }

    if (session && builder.context) {
      session.cssLoaded = true
      session.utilityLayer = builder.context.config.layers?.utilities ?? 'utilities'
      session.extractedFiles.clear()
      for (const file of builder.context.getFiles()) {
        session.extractedFiles.add(builder.context.runtime.path.abs(builder.context.config.cwd, file))
      }
    }

    let graphAtomHashes: Set<string> | undefined
    if (compileStatically && builder.context) {
      builder.context.encoder.atomizeObservedRecipes()
      // Captured before baseline/staticCss generation. Graph atoms can be removed when no
      // transformed module emits them; explicit staticCss atoms remain outside this set and
      // continue to act as a safelist.
      graphAtomHashes = new Set(builder.context.encoder.atomic)
    }

    // The whole stylesheet, so it carries the `@layer` order statement itself.
    const css = builder.toCss({ layerParams: true, includeRecipes: !compileStatically })

    if (session && graphAtomHashes && builder.context) {
      const decoder = builder.context.decoder.collect(builder.context.encoder)
      for (const atom of decoder.atomic) {
        if (graphAtomHashes.has(atom.hash)) session.prunableClasses.add(atom.className)
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

  return {
    name: 'bamboocss:css',

    // Both `serve` and `build`. The fold beside this is build-only; emitting css is not
    // optional in either.

    configResolved(config) {
      compileStatically = staticComposition && config.command === 'build'
      if (session) session.sourcemap = config.build.sourcemap
    },

    resolveId(id) {
      if (id === VIRTUAL_CSS_ID) return RESOLVED_ID
      return null
    },

    async load(id) {
      if (id !== RESOLVED_ID) return null

      const css = await generate()

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
        // Vite reloads a css module from `load` on the next request, so the invalidation is
        // the whole update. Asking for a full reload here would throw away component state
        // on every style edit.
        server?.ws.send({ type: 'update', updates: [] })
        logger.debug('vite', `styles invalidated by ${file}`)
      }

      devServer.watcher.on('change', invalidate)
      devServer.watcher.on('add', invalidate)
      devServer.watcher.on('unlink', invalidate)
    },

    generateBundle: session
      ? {
          order: 'post',
          handler(_, bundle) {
            optimizeStaticCssAssets(bundle, session)
          },
        }
      : undefined,
  }
}
