import { logger } from '@bamboocss/logger'
import type { Runtime } from '@bamboocss/types'
import chokidar from 'chokidar'
import glob from 'fast-glob'
import fsExtra from 'fs-extra'
import { dirname, extname, isAbsolute, join, relative, resolve, sep } from 'path'
import picomatch from 'picomatch'
import { globDirname } from './glob-dirname'

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

      // Copied, never appended to. `opts.exclude` is `ctx.config.exclude` itself, so pushing
      // onto it edited the user's resolved config in place — and since the push was gated on
      // the list being empty, the second call saw a non-empty one and behaved differently
      // from the first. `exclude: []`, which the sandboxes here all write, is the shape that
      // hit it.
      //
      // `**/*.d.ts` remains a *default* rather than an always-on ignore: a declaration file
      // carries no runtime code, but it is still read by the reference scans, so dropping it
      // for projects that do set `exclude` would change which tokens and reset rules survive.
      // That is a css-output decision, not a cleanup.
      const ignore = opts.exclude?.length ? [...opts.exclude] : ['**/*.d.ts']

      return glob.sync(opts.include, { cwd: opts.cwd, ignore, absolute: true })
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
