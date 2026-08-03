import { logger } from '@bamboocss/logger'
import type { ArtifactId, Config } from '@bamboocss/types'
import { codegen } from './codegen'
import { loadConfigAndCreateContext } from './config'
import { BambooContext } from './create-context'

async function build(ctx: BambooContext, artifactIds?: ArtifactId[]) {
  await codegen(ctx, artifactIds)

  if (ctx.config.emitTokensOnly) {
    return logger.info('css:emit', 'Successfully rebuilt the css variables and js function to query your tokens ✨')
  }

  const done = logger.time.info('')

  const sheet = ctx.createSheet()
  ctx.appendLayerParams(sheet)
  ctx.appendBaselineCss(sheet)
  const parsed = ctx.parseFiles()
  ctx.appendParserCss(sheet)

  await ctx.writeCss(sheet)
  done(ctx.messages.buildComplete(parsed.files.length))
}

export async function generate(config: Config, configPath?: string) {
  let ctx = await loadConfigAndCreateContext({ config, configPath })
  await build(ctx)

  const { cwd, watch, poll } = ctx.config

  if (watch) {
    //
    ctx.watchConfig(
      async () => {
        const affecteds = await ctx.diff.reloadConfigAndRefreshContext((conf) => {
          ctx = new BambooContext(conf)
        })

        logger.info('ctx:updated', 'config rebuilt ✅')
        await ctx.hooks['config:change']?.({ config: ctx.config, changes: affecteds })
        return build(ctx, Array.from(affecteds.artifacts))
      },
      { cwd, poll },
    )

    /**
     * Re-parses every affected file, then builds and writes the stylesheet once.
     *
     * One edit can affect many files — a shared style file is folded into all of
     * its importers — and the sheet is rebuilt from the whole parser result, not
     * per file. Writing per file would run the optimize pipeline and hit the disk
     * once per importer for a single keystroke.
     */
    const bundleStyles = async (ctx: BambooContext, changedFilePaths: string[]) => {
      let parsed = 0
      for (const filePath of changedFilePaths) {
        if (ctx.project.parseSourceFile(filePath)) parsed++
      }

      if (parsed === 0) return

      const outfile = ctx.runtime.path.join(...ctx.paths.root, 'styles.css')
      const done = logger.time.info(ctx.messages.buildComplete(parsed))
      const sheet = ctx.createSheet()
      ctx.appendLayerParams(sheet)
      ctx.appendBaselineCss(sheet)
      ctx.appendParserCss(sheet)
      const css = ctx.getCss(sheet)
      await ctx.runtime.fs.writeFile(outfile, css)
      done()
    }

    ctx.watchFiles(async (event, file) => {
      const filePath = ctx.runtime.path.abs(cwd, file)
      if (event === 'unlink') {
        // Consumers folded this file's styles into their own output, so they have
        // to be rebuilt to stop emitting them.
        const dependents = ctx.project.getDependents(filePath)
        ctx.project.removeSourceFile(filePath)
        await bundleStyles(ctx, dependents)
      } else if (event === 'change') {
        // Absolute, like every other call here: a relative specifier is not
        // guaranteed to match the file the project holds, and a reload that
        // silently matched nothing would leave the edit unread.
        ctx.project.reloadSourceFile(filePath)
        // Styles imported from this file are folded into its consumers' output, so
        // they have to be re-parsed too or they keep emitting the previous values.
        await bundleStyles(ctx, [filePath, ...ctx.project.getDependents(filePath)])
      } else if (event === 'add') {
        ctx.project.createSourceFile(filePath)
        // A new file can satisfy an import that previously resolved to nothing.
        // Those importers have no edge to this path yet — the specifier resolved to
        // nowhere when they were parsed — so they are tracked separately.
        await bundleStyles(ctx, [
          filePath,
          ...ctx.project.getDependents(filePath),
          ...ctx.project.getUnresolvedImporters(),
        ])
      }
    })
  }
}
