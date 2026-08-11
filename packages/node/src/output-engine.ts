import type { Generator } from '@bamboocss/generator'
import { logger } from '@bamboocss/logger'
import type { Artifact, BambooHooks, Runtime } from '@bamboocss/types'

interface OutputEngineOptions extends Generator {
  runtime: Runtime
  hooks: Partial<BambooHooks>
}

export class OutputEngine {
  private paths: Generator['paths']
  private fs: Runtime['fs']
  private path: Runtime['path']

  constructor(options: OutputEngineOptions) {
    const { paths, runtime } = options

    this.paths = paths
    this.fs = runtime.fs
    this.path = runtime.path
  }

  empty = () => {
    this.fs.rmDirSync(this.path.join(...this.paths.root))
  }

  ensure = (file: string, cwd: string) => {
    const outPath = this.path.resolve(cwd, file)
    const dirname = this.path.dirname(outPath)
    this.fs.ensureDirSync(dirname)
    return outPath
  }

  /**
   * Delete files in the generated directories that this codegen no longer produces.
   *
   * Codegen was write-only, so an artifact that stopped being generated stayed on disk
   * forever. Dropping a pattern from the config rewrote `patterns/index.js` without it and
   * left `patterns/stack.js` sitting beside it — importing through the barrel then failed
   * loudly, which is fine, but a deep import resolved, ran, returned a class name and
   * emitted no css. A stale artifact is worse than a missing one: it answers.
   *
   * Scoped to the directories this call actually wrote to, so a directory bamboo does not
   * generate into is never read, let alone emptied. Within them the produced file list is
   * exhaustive by construction — that is what makes the question decidable without keeping
   * a manifest around, and it is why the caller must only run a *complete* codegen through
   * here. Subdirectories are left alone; they are swept as themselves when their own
   * artifacts are written.
   */
  prune = (artifacts: Array<Artifact | undefined>) => {
    const produced = new Map<string, Set<string>>()

    for (const artifact of artifacts) {
      if (!artifact) continue
      const dir = this.path.join(...(artifact.dir ?? this.paths.root))
      let files = produced.get(dir)
      if (!files) produced.set(dir, (files = new Set()))
      // An artifact whose `code` is undefined is not written, so it is not produced —
      // matching `write`, which skips it. Nothing else here may decide that separately.
      for (const { file, code } of artifact.files) if (code) files.add(file)
    }

    let removed = 0

    for (const [dir, files] of produced) {
      if (!this.fs.existsSync(dir)) continue

      for (const entry of this.fs.readDirSync(dir)) {
        if (files.has(entry) || this.isNotOurs(dir, entry)) continue

        const absPath = this.path.join(dir, entry)
        if (this.fs.isDirSync(absPath)) continue

        logger.debug('write:stale', `removing ${entry}`)
        this.fs.rmFileSync(absPath)
        removed++
      }
    }

    if (removed) logger.debug('write:stale', `Removed ${removed} artifact(s) no longer generated`)

    return { removed }
  }

  /**
   * Files in the output root that codegen does not own, and so cannot call stale.
   *
   * `styles.css` is written by `writeCss`/`writeSplitCss` rather than as an artifact, so it
   * is absent from every artifact list and would be deleted on sight. `package.json` is
   * co-owned — see `writePackageJson` — and a consumer's edits to it outlive us.
   */
  private isNotOurs = (dir: string, entry: string) =>
    dir === this.path.join(...this.paths.root) && (entry === 'styles.css' || entry === 'package.json')

  write = (output: Artifact | undefined) => {
    if (!output) return

    const { dir = this.paths.root, files } = output
    this.fs.ensureDirSync(this.path.join(...dir))

    return Promise.allSettled(
      files.map(async (artifact) => {
        if (!artifact?.code) return

        const { file, code } = artifact
        const absPath = this.path.join(...dir, file)

        logger.debug('write:file', dir.slice(-1).concat(file).join('/'))

        if (file === 'package.json') {
          return this.writePackageJson(absPath, code)
        }

        return this.fs.writeFile(absPath, code)
      }),
    )
  }

  /**
   * Unlike the rest of the output, `package.json` is not exclusively ours: `emit-pkg`
   * writes entrypoints to the same path, and consumers hand-edit it. Overwriting would
   * drop that, so only keys that are absent get filled in — anything already declared,
   * including a deliberate `sideEffects`, is left as it stands.
   */
  private writePackageJson = (absPath: string, code: string) => {
    if (!this.fs.existsSync(absPath)) {
      return this.fs.writeFile(absPath, code)
    }

    let existing: Record<string, unknown>

    try {
      existing = JSON.parse(this.fs.readFileSync(absPath))
    } catch {
      // Replacing it would discard whatever the consumer still has in there.
      logger.warn('write:file', `Skipped ${absPath}: could not be parsed as JSON`)
      return
    }

    const missing = Object.entries(JSON.parse(code)).filter(([key]) => existing[key] === undefined)
    if (!missing.length) return

    return this.fs.writeFile(absPath, JSON.stringify({ ...existing, ...Object.fromEntries(missing) }, null, 2) + '\n')
  }
}
