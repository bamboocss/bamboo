import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createContext } from '@bamboocss/fixture'
import { bench, describe } from 'vitest'
import { foldSource } from '../src/fold'
import { createRuntimeCss } from '../src/runtime-css'

/**
 * What a build pays per module to fold it.
 *
 * This is the number that decides whether the transform can run in dev. In a CLI pass
 * the ts-morph parse amortizes across a whole build; in a bundler `transform` hook it
 * lands on every module, and again on every HMR update. `Project.addSourceFile` also
 * clears the box-node cache, because a changed file invalidates resolutions memoized
 * against it — so the per-module cost is a cold parse, not a warm one.
 *
 * Reported, not asserted, like the rest of the benches here: wall-clock is
 * machine-dependent, and a threshold would fail on a busy runner rather than on a
 * regression.
 */
const here = dirname(fileURLToPath(import.meta.url))
const sandbox = join(here, '../../../sandbox/vite-ts/src')

const readSandbox = (file: string) => {
  try {
    return readFileSync(join(sandbox, file), 'utf8')
  } catch {
    return null
  }
}

const SANDBOX_FILES = ['App.tsx', 'Card.tsx', 'Badge.tsx', 'Button.tsx']
  .map((file) => ({ file, code: readSandbox(file) }))
  .filter((entry): entry is { file: string; code: string } => entry.code != null)

const SYNTHETIC = `
import { css } from 'styled-system/css'
import { stack } from 'styled-system/patterns'

export const a = css({ color: 'red.300', padding: '4' })
export const b = css({ display: 'flex', _hover: { color: 'blue.500' } })
export const c = css({ fontSize: { base: 'sm', md: 'lg' } })
export const d = stack({ gap: '4', align: 'center' })
export function dynamic(tone: string) {
  return css({ color: tone })
}
`

const ctx = createContext()
const runtimeCss = createRuntimeCss(ctx)

let counter = 0
/** A fresh path per iteration, so nothing is served from a per-file cache. */
const nextPath = () => `app/src/bench-${counter++}.tsx`

const parseOnly = (code: string) => {
  const filePath = nextPath()
  ctx.project.addSourceFile(filePath, code)
  return ctx.project.parseSourceFile(filePath)
}

const parseAndFold = (code: string) => {
  const filePath = nextPath()
  ctx.project.addSourceFile(filePath, code)
  const parserResult = ctx.project.parseSourceFile(filePath)
  if (!parserResult) return null
  return foldSource({ ctx, code, parserResult, filePath, runtimeCss })
}

describe('per-module transform cost', () => {
  bench('parse only (synthetic module)', () => {
    parseOnly(SYNTHETIC)
  })

  bench('parse + fold (synthetic module)', () => {
    parseAndFold(SYNTHETIC)
  })

  for (const { file, code } of SANDBOX_FILES) {
    bench(`parse + fold (sandbox/vite-ts ${file})`, () => {
      parseAndFold(code)
    })
  }
})
