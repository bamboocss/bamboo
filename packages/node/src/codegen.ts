import type { ArtifactId } from '@bamboocss/types'
import type { BambooContext } from './create-context'

export async function codegen(ctx: BambooContext, ids?: ArtifactId[]) {
  const { default: pLimit } = await import('p-limit')
  const limit = pLimit(20)
  if (ctx.config.clean) ctx.output.empty()

  let artifacts = ctx.getArtifacts(ids)
  if (ctx.hooks['codegen:prepare']) {
    const results = await ctx.hooks['codegen:prepare']?.({ changed: ids, artifacts })
    if (results) artifacts = results
  }

  // limit concurrency since we might output a lot of files
  const promises = artifacts.map((artifact) => limit(() => ctx.output.write(artifact)))
  await Promise.allSettled(promises)

  // After the artifacts, because `css.mjs` imports it and a fresh project needs the file to
  // exist for that import to resolve. Preserves a populated one rather than blanking it —
  // nothing has been extracted in this pass. See `writeGroupRegistry`.
  await ctx.writeGroupRegistry()

  await ctx.hooks['codegen:done']?.({ changed: ids })

  return {
    box: ctx.initMessage(),
    msg: ctx.messages.artifactsGenerated(),
  }
}
