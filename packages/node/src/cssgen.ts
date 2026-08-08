import { logger } from '@bamboocss/logger'
import type { CssArtifactType } from '@bamboocss/types'
import type { BambooContext } from './create-context'
import {
  collectKeyframeReferences,
  collectRenderedElements,
  collectTokenReferences,
  keyframeNames,
  tokensReachableFromJs,
} from './token-references'

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

    // The token and keyframe passes cannot run here: both decide reachability by reading
    // the finished stylesheet, and this branch emits one artifact, so everything would look
    // unreachable. `prunePreflight` reads the source instead of the sheet, so a partial one
    // costs it nothing -- and without this the `reset.css` from `cssgen preflight` differs
    // from the one `cssgen --splitting` writes for the same project.
    //
    // Note this branch never calls `parseFiles`, which `collectRenderedElements` does not
    // need: it reads the files itself rather than anything parsing leaves behind.
    if (type === 'preflight' && ctx.config.prunePreflight) {
      ctx.prunePreflight(sheet, collectRenderedElements(ctx))
    }

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
    // references reads every source file, so each stays behind its own flag.
    // Opting out still prunes the `@property` registrations; see `generate.ts`.
    if (!minimal && ctx.config.pruneUnusedTokens) {
      ctx.pruneTokens(sheet, collectTokenReferences(ctx, results), tokensReachableFromJs(ctx))
    } else if (!minimal) {
      ctx.pruneTokens(sheet)
    }

    if (!minimal && ctx.config.prunePreflight) {
      ctx.prunePreflight(sheet, collectRenderedElements(ctx))
    }

    if (!minimal && ctx.config.pruneUnusedKeyframes) {
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
