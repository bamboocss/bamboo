import type { ArtifactId } from '@bamboocss/types'
import type { BambooContext } from './create-context'

export async function codegen(ctx: BambooContext, ids?: ArtifactId[]) {
  const { default: pLimit } = await import('p-limit')
  const limit = pLimit(20)
  if (ctx.config.clean) ctx.output.empty()

  let artifacts = ctx.getArtifacts(ids)

  // Whether the artifact list is still the complete one this config produces, which is what
  // `prune` needs in order to read "absent from the list" as "no longer generated".
  let complete = !ids

  if (ctx.hooks['codegen:prepare']) {
    const results = await ctx.hooks['codegen:prepare']?.({ changed: ids, artifacts })
    if (results) {
      artifacts = results
      // A hook may add artifacts, and may equally return a subset. Nothing distinguishes
      // the two from here, and reading a filtered list as the whole truth would delete
      // every artifact the hook held back.
      complete = false
    }
  }

  // limit concurrency since we might output a lot of files
  const promises = artifacts.map((artifact) => limit(() => ctx.output.write(artifact)))
  await Promise.allSettled(promises)

  // After the writes, so a file that is both stale under its old name and produced under a
  // new one is never removed after being written.
  if (complete) ctx.output.prune(artifacts)

  await ctx.hooks['codegen:done']?.({ changed: ids })

  return {
    box: ctx.initMessage(),
    msg: ctx.messages.artifactsGenerated(),
  }
}
