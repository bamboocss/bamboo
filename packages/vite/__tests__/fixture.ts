import { createContext } from '@bamboocss/fixture'
import { esc } from '@bamboocss/shared'
import type { Config } from '@bamboocss/types'
import { foldSource, type FoldResult } from '../src/fold'
import { createRuntimeCss } from '../src/runtime-css'

export const FILE_PATH = 'app/src/test.tsx'

export const createFoldFixture = (userConfig?: Parameters<typeof createContext>[0]) => {
  const ctx = createContext(userConfig)
  const runtimeCss = createRuntimeCss(ctx)

  const fold = (code: string, filePath = FILE_PATH): FoldResult => {
    ctx.project.addSourceFile(filePath, code)
    const parserResult = ctx.project.parseSourceFile(filePath)
    if (!parserResult) return { code, map: null, folded: [], skipped: [], dependencies: [] }
    return foldSource({ ctx, code, parserResult, filePath, runtimeCss })
  }

  /** Add the modules an entry imports before folding it. */
  const addFiles = (files: Record<string, string>) => {
    for (const [path, source] of Object.entries(files)) {
      ctx.project.addSourceFile(path, source)
      ctx.project.parseSourceFile(path)
    }
  }

  /** CSS for everything parsed through this fixture so far. */
  const getCss = () => {
    const sheet = ctx.createSheet()
    ctx.appendParserCss(sheet)
    return ctx.getCss(sheet)
  }

  return { ctx, fold, addFiles, getCss, runtimeCss }
}

/**
 * The class names a folded call resolved to.
 *
 * A fold emits the attribute form (`c_red.300`); the stylesheet emits the escaped
 * selector form (`.c_red\.300`). `esc` is the forward transform the decoder applies,
 * so applying it here compares the two without needing a fragile inverse.
 */
export const selectorsFor = (className: string) =>
  className
    .split(' ')
    .filter(Boolean)
    .map((name) => `.${esc(name)}`)

export const foldCode = (code: string, userConfig?: Config) => createFoldFixture(userConfig).fold(code).code
