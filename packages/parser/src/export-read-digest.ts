import { getExportedVarDeclarationWithName, maybeBoxNode, unbox, type BoxContext } from '@bamboocss/extractor'
import { createHash } from 'node:crypto'
import type { SourceFile } from 'ts-morph'

/**
 * A digest of what one exported name resolves to right now, or `undefined` when the answer
 * cannot be pinned down.
 *
 * This is the witness the read-verification protocol compares: a dependent records the digest
 * of every cross-file value it folded, and an edit to the exporting file is verified by
 * recomputing the same digest through the same resolution path. The two sides must therefore
 * be the *same function* -- recorded at parse time, recomputed at verification time -- or
 * equal values would compare unequal and every edit would fall back to a full re-fold.
 *
 * `undefined` is the conservative verdict, and everything unusual maps to it: a missing
 * initializer, an evaluation the bare context cannot resolve (a value built through the
 * parser's evaluation environment, say), a conditional value, a non-serializable result, a
 * throw. An export that stopped existing is *not* unknown -- it digests to a distinct
 * sentinel, so its consumers read as changed rather than unverifiable.
 *
 * Serialized with insertion order preserved: property order is part of a style value's
 * meaning, so reordering keys must read as a change. `undefined` leaves inside the value are
 * kept visible through a sentinel, since `JSON.stringify` would otherwise erase the
 * difference between an unresolvable member and an absent one.
 */
export const digestExportValue = (
  sourceFile: SourceFile | undefined,
  exportedName: string,
  resolveModule: BoxContext['resolveModule'],
  onCrossing?: (filePath: string) => void,
): string | undefined => {
  if (!sourceFile) return 'bamboo:module-missing'

  // The crossings this resolution performs are the *current* route to the value. A verifier
  // needs them because a value can keep its bytes while moving files — a declaration becoming
  // a re-export — and the pass that declines to re-fold is the only one positioned to record
  // the new edge.
  const boxCtx: BoxContext = { flags: { skipTraverseFiles: false }, resolveModule, recordDependency: onCrossing }

  try {
    const declaration = getExportedVarDeclarationWithName(exportedName, sourceFile, [], boxCtx)
    if (!declaration) return 'bamboo:export-missing'

    const initializer = declaration.getInitializer?.()
    if (!initializer) return undefined

    const box = maybeBoxNode(initializer, [], boxCtx)
    if (!box || Array.isArray(box)) return undefined

    const unboxed = unbox(box)
    if (unboxed.conditions.length || unboxed.spreadConditions.length) return undefined

    const json = JSON.stringify(unboxed.raw, (_key, value) => (value === undefined ? 'bamboo:undefined' : value))
    if (json === undefined) return undefined
    return createHash('sha256').update(json).digest('base64')
  } catch {
    return undefined
  }
}
