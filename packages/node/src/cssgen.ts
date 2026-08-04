import { logger } from '@bamboocss/logger'
import type { CssArtifactType } from '@bamboocss/types'
import type { BambooContext } from './create-context'
import { collectKeyframeReferences, collectTokenReferences, keyframeNames } from './token-references'

export interface CssGenOptions {
  cwd: string
  outfile?: string
  type?: CssArtifactType
  minimal?: boolean
  splitting?: boolean
}

export const cssgen = async (ctx: BambooContext, options: CssGenOptions) => {
  const { outfile, type, minimal, splitting } = options

  const sheet = ctx.createSheet()

  if (type) {
    const done = logger.time.info(ctx.messages.cssArtifactComplete(type))

    ctx.appendCssOfType(type, sheet)

    if (outfile) {
      const css = ctx.getCss(sheet)
      logger.info('css', ctx.runtime.path.resolve(outfile))
      await ctx.runtime.fs.writeFile(outfile, css)
    } else {
      await ctx.writeCss(sheet)
    }

    done()
  } else {
    const { files, results } = ctx.parseFiles()

    const done = logger.time.info(ctx.messages.buildComplete(files.length))
    if (!minimal) {
      ctx.appendLayerParams(sheet)
      ctx.appendBaselineCss(sheet)
    }

    ctx.appendParserCss(sheet)

    // Only now does the sheet hold everything that could reference a token. `minimal`
    // omits the token layer altogether, so there is nothing to prune. Gathering the
    // references reads every source file, so it stays behind the flag.
    if (!minimal && ctx.config.pruneUnusedTokens) {
      ctx.pruneTokens(sheet, collectTokenReferences(ctx, results))
      ctx.pruneKeyframes(sheet, collectKeyframeReferences(ctx, keyframeNames(ctx)))
    }

    if (splitting) {
      await ctx.writeSplitCss(sheet)
    } else if (outfile) {
      const css = ctx.getCss(sheet)
      logger.info('css', ctx.runtime.path.resolve(outfile))
      await ctx.runtime.fs.writeFile(outfile, css)
    } else {
      await ctx.writeCss(sheet)
    }

    done()
  }
}
