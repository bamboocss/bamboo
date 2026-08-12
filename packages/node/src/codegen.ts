import type { ArtifactId } from '@bamboocss/types'
import type { BambooContext } from './create-context'

export async function codegen(ctx: BambooContext, ids?: ArtifactId[]) {
  const { default: pLimit } = await import('p-limit')
  const limit = pLimit(20)
  if (ctx.config.clean) ctx.output.empty()

  let artifacts = ctx.getArtifacts(ids)

  // Whether anything has filtered the list in a way this cannot see through. `ids` is fine —
  // it names what to *write*, and the complete list is still recoverable below. A hook is not.
  let hookFiltered = false

  if (ctx.hooks['codegen:prepare']) {
    const results = await ctx.hooks['codegen:prepare']?.({ changed: ids, artifacts })
    if (results) {
      artifacts = results
      // A hook may add artifacts, and may equally return a subset. Nothing distinguishes
      // the two from here, and reading a filtered list as the whole truth would delete
      // every artifact the hook held back.
      hookFiltered = true
    }
  }

  // limit concurrency since we might output a lot of files
  const promises = artifacts.map((artifact) => limit(() => ctx.output.write(artifact)))
  await Promise.allSettled(promises)

  // After the writes, so a file that is both stale under its old name and produced under a
  // new one is never removed after being written.
  //
  // Pruned against the *complete* list rather than the one just written. A filtered run —
  // which is what every watch rebuild is — writes only what changed, and reading that as the
  // whole truth would delete everything it did not touch. Recomputing the full list instead
  // means a file whose source is gone is swept on the rebuild that removed it, rather than
  // surviving until someone runs a cold codegen: a pattern dropped from the config left its
  // generated module behind, resolving and returning class names for rules that no longer
  // exist.
  if (!hookFiltered) ctx.output.prune(ids ? ctx.getArtifacts() : artifacts)

  await ctx.hooks['codegen:done']?.({ changed: ids })

  return {
    box: ctx.initMessage(),
    msg: ctx.messages.artifactsGenerated(),
  }
}
