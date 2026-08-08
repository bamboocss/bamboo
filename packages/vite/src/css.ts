import { Builder } from '@bamboocss/node'
import { logger } from '@bamboocss/logger'
import type { Plugin, ViteDevServer } from 'vite'

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

export interface BambooCssPluginOptions {
  configPath?: string
  cwd?: string
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
  const { configPath, cwd } = options

  const builder = new Builder()
  let server: ViteDevServer | undefined

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

    // The whole stylesheet, so it carries the `@layer` order statement itself.
    return builder.toCss({ layerParams: true })
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
  }
}
