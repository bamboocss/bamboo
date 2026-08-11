import { TraceMap, originalPositionFor } from '@jridgewell/trace-mapping'
import { describe, expect, test } from 'vitest'
import { createFoldFixture, FILE_PATH } from './fixture'

/**
 * A fold rewrites spans inside a module, so anything downstream that maps a generated
 * position back to source — a stack trace, a breakpoint, a coverage report — depends
 * on the map being right. Position-level assertions rather than a snapshot, because a
 * snapshot of base64 VLQ tells you nothing when it breaks.
 */
const lineOf = (code: string, needle: string) => {
  const index = code.indexOf(needle)
  if (index === -1) throw new Error(`not found: ${needle}`)
  return code.slice(0, index).split('\n').length
}

describe('source maps', () => {
  test('no map is produced when nothing folds', () => {
    const { fold } = createFoldFixture()

    // A condition object, since a bare `color: tone` lowers to the leaf helper now.
    const result = fold(`
      import { css } from 'styled-system/css'
      export const make = (tone, other) => css({ color: { base: tone, md: other } })
    `)

    expect(result.map).toBeNull()
  })

  test('a map is produced when something folds', () => {
    const { fold } = createFoldFixture()

    const result = fold(`
      import { css } from 'styled-system/css'
      export const cls = css({ color: 'red.300' })
    `)

    expect(result.map).not.toBeNull()
    expect(result.map!.version).toBe(3)
    expect(result.map!.mappings.length).toBeGreaterThan(0)
  })

  test('the map names the file it transformed and carries its content', () => {
    const { fold } = createFoldFixture()

    const result = fold(`
      import { css } from 'styled-system/css'
      export const cls = css({ color: 'red.300' })
    `)

    expect(result.map!.sources).toEqual([FILE_PATH])
    expect(result.map!.sourcesContent?.[0]).toContain(`css({ color: 'red.300' })`)
  })

  test('lines after a fold still map back to their original line', () => {
    const { fold } = createFoldFixture()

    const code = [
      `import { css } from 'styled-system/css'`,
      ``,
      `export const first = css({`,
      `  color: 'red.300',`,
      `  padding: '4',`,
      `})`,
      ``,
      `export const marker = 'after'`,
      ``,
    ].join('\n')

    const result = fold(code)
    expect(result.folded).toHaveLength(1)

    // The fold collapses a 4-line call onto one line, so the trailing statement
    // shifts up. Its mapped original position must still be where it was authored.
    const generatedLine = lineOf(result.code, `export const marker`)
    const originalLine = lineOf(code, `export const marker`)
    expect(generatedLine).toBeLessThan(originalLine)

    const tracer = new TraceMap(result.map as never)
    const mapped = originalPositionFor(tracer, {
      line: generatedLine,
      column: result.code.split('\n')[generatedLine - 1]!.indexOf('export'),
    })

    expect(mapped.line).toBe(originalLine)
  })

  test('the folded literal maps back to the original call', () => {
    const { fold } = createFoldFixture()

    const code = [
      `import { css } from 'styled-system/css'`,
      ``,
      `export const cls = css({ color: 'red.300' })`,
      ``,
    ].join('\n')

    const result = fold(code)

    const generatedLine = lineOf(result.code, `"c_red.300"`)
    const column = result.code.split('\n')[generatedLine - 1]!.indexOf('"c_red.300"')

    const tracer = new TraceMap(result.map as never)
    const mapped = originalPositionFor(tracer, { line: generatedLine, column })

    expect(mapped.line).toBe(lineOf(code, 'css({'))
  })

  test('multiple folds in one module keep later positions mappable', () => {
    const { fold } = createFoldFixture()

    const code = [
      `import { css } from 'styled-system/css'`,
      `export const a = css({`,
      `  color: 'red.300',`,
      `})`,
      `export const b = css({`,
      `  display: 'flex',`,
      `})`,
      `export const tail = 'end'`,
      ``,
    ].join('\n')

    const result = fold(code)
    expect(result.folded).toHaveLength(2)

    const generatedLine = lineOf(result.code, `export const tail`)
    const tracer = new TraceMap(result.map as never)
    const mapped = originalPositionFor(tracer, {
      line: generatedLine,
      column: result.code.split('\n')[generatedLine - 1]!.indexOf('export'),
    })

    expect(mapped.line).toBe(lineOf(code, `export const tail`))
  })
})
