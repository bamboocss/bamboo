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
   * generate into is never read, let alone emptied. It is bounded twice over, because the
   * cost of being wrong here is a deleted file rather than a stale one:
   *
   * - only a *complete* codegen may be swept, since a filtered artifact list cannot say what
   *   a directory should contain. That is the caller's to enforce;
   * - within a directory, only files carrying an extension this codegen actually wrote
   *   *there* are eligible. `patterns/` got `.mjs` and `.d.ts` files, so a leftover
   *   `stack.mjs` is stale; a `.gitignore`, a `README.md` or a `styles.css` is not the kind
   *   of thing we put there and is none of our business.
   *
   * The second bound replaces a list of known exceptions, which was the wrong shape: a
   * denylist has to name every file anyone might legitimately keep in an output directory,
   * and the failure mode when it misses one is silent deletion. It missed the `.gitignore`
   * that ships inside a generated directory, which is committed in this repo's own fixtures.
   * Reasoning from what we wrote needs no such list.
   *
   * Subdirectories are left alone; they are swept as themselves when their own artifacts
   * are written.
   */
  prune = (artifacts: Array<Artifact | undefined>) => {
    const produced = new Map<string, Set<string>>()
    /** Per directory, the file extensions this codegen wrote into it. */
    const kinds = new Map<string, Set<string>>()

    for (const artifact of artifacts) {
      if (!artifact) continue
      const dir = this.path.join(...(artifact.dir ?? this.paths.root))

      let files = produced.get(dir)
      if (!files) produced.set(dir, (files = new Set()))

      let extensions = kinds.get(dir)
      if (!extensions) kinds.set(dir, (extensions = new Set()))

      // An artifact whose `code` is undefined is not written, so it is not produced —
      // matching `write`, which skips it. Nothing else here may decide that separately.
      for (const { file, code } of artifact.files) {
        if (!code) continue
        files.add(file)
        extensions.add(this.path.extname(file))
      }
    }

    let removed = 0

    for (const [dir, files] of produced) {
      if (!this.fs.existsSync(dir)) continue

      // An empty set removes nothing, so a directory whose artifacts all declined to write
      // is left exactly as it stands rather than emptied.
      const extensions = kinds.get(dir)!

      for (const entry of this.fs.readDirSync(dir)) {
        if (files.has(entry)) continue

        // `extname` gives `''` for a dotfile, which is what keeps `.gitignore` — nothing we
        // write is extensionless, so the set can never contain `''`.
        if (!extensions.has(this.path.extname(entry))) continue

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
