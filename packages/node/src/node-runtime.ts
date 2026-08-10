import { logger } from '@bamboocss/logger'
import type { Runtime } from '@bamboocss/types'
import chokidar from 'chokidar'
import glob from 'fast-glob'
import fsExtra from 'fs-extra'
import { dirname, extname, isAbsolute, join, relative, resolve, sep } from 'path'
import picomatch from 'picomatch'
import { globDirname } from './glob-dirname'

/**
 * What the source glob ignores.
 *
 * `**\/*.d.ts` is unconditional. It used to be a *default* that a user's own `exclude`
 * replaced, so declaration files were scanned by whether the project happened to set that
 * option at all — excluded for `exclude: []`, included for `exclude: ['**\/*.stories.tsx']`.
 * Nothing chose that; the default was simply appended when nothing else was there.
 *
 * A declaration file carries no runtime code and can emit no styles. It is still read by the
 * reference scans, which are deliberately over-inclusive, so scanning one could keep a token
 * named in a doc comment or a reset rule for an element named in a JSDoc example. Those are
 * spurious keeps rather than a guarantee anyone relied on — and they were never available to
 * the projects on the other side of the same condition.
 *
 * Copied rather than appended to. `opts.exclude` is `ctx.config.exclude` itself, so pushing
 * onto it edited the user's resolved config in place, and the next call then saw a list it had
 * mutated.
 */
export const globIgnore = (exclude: string[] | undefined) => ['**/*.d.ts', ...(exclude ?? [])]

export const nodeRuntime: Runtime = {
  cwd() {
    return process.cwd()
  },
  env(name: string) {
    return process.env[name]
  },
  path: {
    join,
    relative,
    dirname,
    extname,
    isAbsolute,
    sep,
    resolve,
    abs(cwd: string, str: string) {
      return isAbsolute(str) ? str : join(cwd, str)
    },
  },
  fs: {
    existsSync: fsExtra.existsSync,
    readFileSync(filePath: string) {
      return fsExtra.readFileSync(filePath, 'utf8')
    },
    glob(opts) {
      if (!opts.include) return []

      return glob.sync(opts.include, { cwd: opts.cwd, ignore: globIgnore(opts.exclude), absolute: true })
    },
    writeFile: fsExtra.writeFile,
    writeFileSync: fsExtra.writeFileSync,
    readDirSync: fsExtra.readdirSync,
    rmDirSync: fsExtra.emptyDirSync,
    rmFileSync: fsExtra.removeSync,
    ensureDirSync(path: string) {
      return fsExtra.ensureDirSync(path)
    },
    watch(options) {
      const { include, exclude, cwd, poll } = options
      const coalesce = poll || process.platform === 'win32'

      const dirnames = globDirname(include)
      const isValidPath = picomatch(include, { cwd, ignore: exclude })
      const workingDir = cwd || process.cwd()

      const watcher = chokidar.watch(dirnames, {
        usePolling: poll,
        cwd,
        ignored(path, stats) {
          const relativePath = relative(workingDir, path)
          return !!stats?.isFile() && !isValidPath(relativePath)
        },
        ignoreInitial: true,
        ignorePermissionErrors: true,
        awaitWriteFinish: coalesce ? { stabilityThreshold: 50, pollInterval: 10 } : false,
      })

      logger.debug('watch:file', `Watching [ ${dirnames.join(', ')} ]`)

      process.once('SIGINT', async () => {
        await watcher.close()
      })

      return watcher
    },
  },
}

process.setMaxListeners(Infinity)

process.on('unhandledRejection', (reason) => {
  logger.caughtError('process', 'Unhandled rejection', reason)
})

process.on('uncaughtException', (error) => {
  logger.caughtError('process', 'Uncaught exception', error)
})
