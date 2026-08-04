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
