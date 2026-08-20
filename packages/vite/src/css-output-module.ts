import remapping from '@ampproject/remapping'
import { toHash } from '@bamboocss/shared'
import MagicString from 'magic-string'
import type { Rollup } from 'vite'
import { pruneStaticCss } from './prune-static-css'
import type { StaticCompilationSession } from './static-session'

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
const isCssAsset = (output: Rollup.OutputBundle[string]): output is Rollup.OutputAsset =>
  output.type === 'asset' && output.fileName.endsWith('.css')

/** Decode a generated Bamboo stylesheet, or decline any other bundle entry. */
const generatedCssSource = (output: Rollup.OutputBundle[string]) => {
  if (!isCssAsset(output)) return undefined
  const source = typeof output.source === 'string' ? output.source : Buffer.from(output.source).toString()
  return source.includes('--made-with-bamboo') ? source : undefined
}

/** Whether this bundle replaces a previously generated Bamboo stylesheet. */
export const containsGeneratedCssAsset = (bundle: Rollup.OutputBundle) =>
  Object.values(bundle).some((output) => generatedCssSource(output) !== undefined)

/**
 * Prune compiler-owned CSS, then give any sheet whose bytes changed a hash of those bytes.
 *
 * Rollup has already expanded `[hash]` when `generateBundle` runs. Mutating only `source`
 * would therefore leave two different reachable subsets under one CDN key. The extra final
 * hash is not cosmetic: it makes late graph reachability cache-safe.
 *
 * Renaming is therefore not a choice this takes. Pruned bytes under the unpruned sheet's name
 * is the one outcome that must never be reachable, and a sheet nothing was removed from keeps
 * its name because its bytes are unchanged — so "rename" is a consequence of "the bytes moved",
 * not a second option. `prune` is the only knob.
 */
export const optimizeStaticCssAssets = (
  bundle: Rollup.OutputBundle,
  session: StaticCompilationSession,
  options: {
    environment?: string
    prune?: boolean
    requiredClasses?: ReadonlySet<string>
    sourcemap?: StaticCompilationSession['sourcemap']
  } = {},
) => {
  const { environment, prune = true, requiredClasses, sourcemap = session.sourcemap } = options
  /** Assets in this bundle that carry the generated stylesheet, pruned or not. */
  let sheets = 0

  for (const output of Object.values(bundle)) {
    const source = generatedCssSource(output)
    if (source === undefined) continue
    sheets++

    // Validation always runs: disabling reachability pruning cannot make a live class with no
    // extracted rule safe. The unpruned asset remains byte-identical because the parsed result
    // is used only when pruning is enabled.
    const optimized = pruneStaticCss(source, session, { environment, prune, requiredClasses })
    if (!prune) continue
    ;(output as Rollup.OutputAsset).source = optimized
    if (optimized === source) continue

    // Unconditional from here. `[hash]` is expanded before this runs, so pruned bytes under
    // the original name is the worst outcome available: a change to *reachability alone* —
    // which is what a Bamboo upgrade is — leaves identical source CSS under an identical name
    // with different content, and a CDN holding that key serves the old stylesheet past the
    // deploy. One user hit that twice and worked around it by versioning the filename
    // themselves. A caller that cannot accept the rename declines the prune instead, above.
    // No "did the name actually change" guard, deliberately. `generatedCssSource` has already
    // established the `.css` ending and `toHash` never returns empty, so the replacement always
    // lengthens the name — such a guard would be dead, and dead in the one place where becoming
    // live would ship the unsafe state: `source` is assigned above, so skipping the rename here
    // is exactly pruned bytes under the unpruned name.
    const nextName = output.fileName.replace(/\.css$/, `.b-${toHash(optimized)}.css`)
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
    replaceAssetReferences(bundle, previous, nextName, sourcemap)
  }

  return { sheets }
}

export { pruneStaticCss } from './prune-static-css'
