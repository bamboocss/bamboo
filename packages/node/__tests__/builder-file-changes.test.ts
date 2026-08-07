import { mkdtempSync, rmSync, utimesSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterAll, describe, expect, test } from 'vitest'
import { Builder } from '../src/builder'

/**
 * What decides whether a file is extracted again.
 *
 * Every build reaches this — the PostCSS plugin walks files through `extractFile`, and
 * `setup` uses the same comparison for the config's explicit dependencies. A file wrongly
 * reported unchanged is not re-parsed, so its styles keep whatever the last build gave them:
 * the stale-artifact failure `CLAUDE.md` records running into repeatedly, and one that looks
 * like a bug in the source rather than in the cache.
 *
 * The mtime cache is module-global rather than per instance, so each test uses its own file
 * name. That is a property of the code and not of the test: two `Builder`s in one process
 * share it, which is why they are given distinct paths here rather than a reset between
 * tests — there is no way to clear it from outside.
 */
const dir = mkdtempSync(join(tmpdir(), 'bamboo-builder-'))
let counter = 0

/** A file with a name no other test uses, given the shared cache. */
const makeFile = (contents = 'a') => {
  const file = join(dir, `file-${counter++}.tsx`)
  writeFileSync(file, contents)
  return file
}

/** Extraction, which is what records a file's mtime. `parseFile` is the only thing used. */
const extract = (builder: Builder, file: string) => builder.extractFile({ parseFile: () => undefined } as never, file)

afterAll(() => rmSync(dir, { force: true, recursive: true }))

describe('file change detection', () => {
  test('a file that was never extracted counts as changed', () => {
    expect(new Builder().getFileMeta(makeFile()).isUnchanged).toBe(false)
  })

  test('a file is unchanged once it has been extracted', () => {
    const builder = new Builder()
    const file = makeFile()

    extract(builder, file)
    expect(builder.getFileMeta(file).isUnchanged).toBe(true)
  })

  test('rewriting a file makes it changed again', () => {
    const builder = new Builder()
    const file = makeFile()
    extract(builder, file)

    // Set the time explicitly rather than rewriting and hoping the clock moved: the
    // comparison is on mtime, and a filesystem with coarse granularity would otherwise make
    // this pass or fail depending on how fast the test ran.
    const later = new Date(Date.now() + 10_000)
    utimesSync(file, later, later)

    expect(builder.getFileMeta(file).isUnchanged).toBe(false)
  })

  test('a file that no longer exists reports no mtime and counts as changed', () => {
    const builder = new Builder()
    const file = makeFile()
    extract(builder, file)
    rmSync(file)

    const meta = builder.getFileMeta(file)
    expect(meta.mtime).toBe(-Infinity)
    // It was extracted under a real mtime, so its disappearance has to register as a change
    // — otherwise its styles would survive in the stylesheet after the file was deleted.
    expect(meta.isUnchanged).toBe(false)
  })

  test('a file that never existed reports no mtime', () => {
    expect(new Builder().getFileMeta(join(dir, 'never-written.tsx')).mtime).toBe(-Infinity)
  })

  test('a deleted file settles rather than being reported changed forever', () => {
    // Once the absence is recorded, it matches on the next pass. Without this the file would
    // be re-parsed on every rebuild for the rest of the process.
    const builder = new Builder()
    const file = makeFile()
    extract(builder, file)
    rmSync(file)

    extract(builder, file)
    expect(builder.getFileMeta(file).isUnchanged).toBe(true)
  })

  test('the mtime cache is shared between instances', () => {
    // Documented rather than endorsed. `fileModifiedMap` is module-global, so a second
    // `Builder` inherits what the first extracted and will skip it. Pinning it means a change
    // to per-instance state is a deliberate one.
    const file = makeFile()
    extract(new Builder(), file)

    expect(new Builder().getFileMeta(file).isUnchanged).toBe(true)
  })
})

describe('checkFilesChanged', () => {
  test('reports a change when any one file changed', () => {
    const builder = new Builder()
    const unchanged = makeFile()
    extract(builder, unchanged)

    const result = builder.checkFilesChanged([unchanged, makeFile()])
    expect(result.hasFilesChanged).toBe(true)
    expect(result.changes.size).toBe(2)
  })

  test('reports no change when every file is unchanged', () => {
    const builder = new Builder()
    const files = [makeFile(), makeFile()]
    files.forEach((file) => extract(builder, file))

    expect(builder.checkFilesChanged(files).hasFilesChanged).toBe(false)
  })

  test('an empty list is not a change', () => {
    // `extract` skips the whole pass when nothing changed, so this deciding otherwise would
    // re-extract on every rebuild of a project that matched no files.
    const result = new Builder().checkFilesChanged([])
    expect(result.hasFilesChanged).toBe(false)
    expect(result.changes.size).toBe(0)
  })

  test('every file gets an entry, changed or not', () => {
    const builder = new Builder()
    const files = [makeFile(), makeFile(), makeFile()]
    extract(builder, files[1]!)

    const { changes } = builder.checkFilesChanged(files)
    expect(Array.from(changes.keys()).sort()).toEqual(files.slice().sort())
  })
})
