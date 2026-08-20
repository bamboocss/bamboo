import type { SourceFile } from 'ts-morph'
import type { BambooContext } from './create-context'

/** One file, as it sits on disk and as the parser holds it. */
export interface SourceSnapshot {
  filePath: string
  /** The bytes the bundler will compile. Absent when the file could not be read. */
  onDisk: string | undefined
  /** The text the parser holds, which a `parser:before` transform may have rewritten. */
  parsed: string | undefined
  sourceFile: SourceFile | undefined
}

/**
 * Every file `include` covers, read once.
 *
 * The scans that decide what survives pruning — the token reference set, the reachability
 * gate, the strict accounting — all want the same two copies of the same files, and each used
 * to fetch them itself. A strict build therefore read every file three times over: once to
 * collect references, once to account, and once more for the gate whenever the accounting
 * declined. Yielding a snapshot lets one walk feed all of them.
 *
 * Both copies, because neither alone is complete and the text scans are safe when over-fed. A
 * file the parser transformed is stored rewritten (`parseSourceFile` calls `replaceWithText`),
 * and those transforms lose things the scans want: `svelteToTsx` and `vueToTsx` each swallow a
 * throw and return an empty string, and a Vue SFC with a render function and no `<template>`
 * becomes the literal `<template>undefined</template>`. Read only the parsed copy and a file
 * like that reports no tokens and no elements at all.
 *
 * The parsed copy still has to be read as well, because `parser:before` is the documented way
 * to teach bamboo a format it does not know. A template compiled to jsx by such a hook holds
 * nothing a scan of the raw file would recognise, and that is the hook working as intended.
 */
export function* sourceSnapshots(ctx: BambooContext): Generator<SourceSnapshot> {
  for (const file of ctx.getFiles()) {
    yield readSnapshot(ctx, ctx.runtime.path.abs(ctx.config.cwd, file))
  }
}

/** One file's snapshot, for a walk that decides per file whether it needs to read at all. */
export function readSnapshot(ctx: BambooContext, filePath: string): SourceSnapshot {
  let onDisk: string | undefined
  try {
    onDisk = ctx.runtime.fs.readFileSync(filePath)
  } catch {
    // Removed between the glob and this read, or never on disk at all. Not worth failing
    // a build over -- whatever the project holds still gets scanned.
    onDisk = undefined
  }

  const sourceFile = ctx.project.getSourceFile(filePath)

  return { filePath, onDisk, parsed: sourceFile?.getFullText(), sourceFile }
}

/**
 * The distinct texts a snapshot carries.
 *
 * One when the parser holds the file as written, two when a transform rewrote it. Every
 * textual scan wants both, and wants neither twice.
 */
export function* snapshotTexts(snapshot: SourceSnapshot): Generator<string> {
  const { onDisk, parsed } = snapshot

  if (onDisk != null) yield onDisk
  if (parsed != null && parsed !== onDisk) yield parsed
}
