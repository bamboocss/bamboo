import { createContext as createFixtureContext } from '@bamboocss/fixture'
import { logger } from '@bamboocss/logger'
import { describe, expect, test, vi } from 'vitest'
import type { BambooContext } from '../src/create-context'

/**
 * Nothing under `outdir` is the author's to rewrite, so nothing under `outdir` is reported.
 *
 * `include` conventionally covers a source tree that `outdir` sits inside — `./src/**` and
 * `src/styled-system` — so the build routinely parses its own output. A generated helper can
 * contain a computed style key that is unenumerable by construction. There is no authored edit
 * that can silence a diagnostic in a file Bamboo regenerates.
 *
 * That is worse than noise. It sits in the same channel as the losses that do matter and
 * have fixes — an unresolvable value, a recipe whose hash the browser will not agree with —
 * and a line that is always there teaches everyone reading the log to skip the channel. One
 * real diagnostic went unread for months underneath it.
 *
 * Suppressed at the report rather than by dropping the file from the scan, because that
 * overlap is load-bearing elsewhere: the token and keyframe reference scans read whatever
 * `include` covers.
 */
const GENERATED = `export const generated = (prop, value) => css({ [prop]: value })`

const AUTHORED = `
  import { css } from '../styled-system/css'
  export const App = (props) => css({ ...props.styles })
`

const warningsFor = (file: string, source: string) => {
  const ctx = createFixtureContext({ outdir: 'styled-system' }) as unknown as BambooContext
  const warn = vi.spyOn(logger, 'warn').mockImplementation(() => undefined)

  try {
    const absolute = ctx.runtime.path.abs(ctx.config.cwd, file)
    ctx.project.addSourceFile(absolute, source)
    ctx.parseFile(absolute)

    return warn.mock.calls.filter(([channel]) => channel === 'css' || channel === 'recipe')
  } finally {
    warn.mockRestore()
  }
}

describe('diagnostics for generated files', () => {
  test('says nothing about a call in the output directory', () => {
    expect(warningsFor('styled-system/css/css.mjs', GENERATED)).toHaveLength(0)
  })

  test('still reports the same shape in authored source', () => {
    // The control, and the half that must not be lost: an unresolvable spread in a file the
    // author owns is a real loss with a real fix, and it is reported exactly as before.
    const warnings = warningsFor('src/app.tsx', AUTHORED)

    expect(warnings.length).toBeGreaterThan(0)
    expect(warnings[0][1]).toContain('object spread or computed key')
  })

  test('a directory merely starting with the same name is not the output directory', () => {
    // `styled-system-legacy` is not inside `styled-system`, and a prefix test says it is.
    const warnings = warningsFor('styled-system-legacy/css.mjs', AUTHORED)

    expect(warnings.length).toBeGreaterThan(0)
  })
})
