import { createContext } from '@bamboocss/fixture'
import { describe, expect, test } from 'vitest'

/**
 * A config recipe called with a variant the build cannot read, from the source side.
 *
 * This is where the bug reached users, and the parser is the only place that can see it:
 * `buttonStyle({ size })` and `buttonStyle()` both unbox to `{}`, so the encoder cannot tell
 * "you named an axis I could not resolve" from "you named nothing" — and the difference decides
 * whether a class it emits has a rule behind it. `ParserResult.setRecipe` reads the box, where
 * the key is present carrying an `unresolvable`, and tells the encoder.
 *
 * Driven through a real parse rather than by reconstructing that read, because reconstructing
 * it would pass with the wiring deleted.
 */
const FILE = 'app/src/app.tsx'

const cssFor = (code: string) => {
  const ctx = createContext()

  ctx.project.addSourceFile(FILE, code)
  ctx.project.parseSourceFile(FILE)

  const sheet = ctx.createSheet()
  ctx.appendParserCss(sheet)

  return ctx.getCss(sheet)
}

const imports = "import { buttonStyle } from '../styled-system/recipes'\n"

describe('a config recipe with a dynamic variant', () => {
  test('emits every value that axis can take, so no class is left unbacked', () => {
    const css = cssFor(`${imports}export const a = (size) => buttonStyle({ size })`)

    expect(css).toContain('buttonStyle--size_sm')
    expect(css).toContain('buttonStyle--size_md')
  })

  test('a literal variant emits only what it selected', () => {
    const css = cssFor(`${imports}export const a = buttonStyle({ size: 'sm' })`)

    expect(css).toContain('buttonStyle--size_sm')
    expect(css).not.toContain('buttonStyle--size_md')
  })

  /** No argument at all is not a dynamic axis, and must not enumerate one. */
  test('no argument emits only the default', () => {
    const css = cssFor(`${imports}export const a = buttonStyle()`)

    expect(css).not.toContain('buttonStyle--size_sm')
  })

  test('only the dynamic axis is enumerated, not every axis', () => {
    const css = cssFor(`${imports}export const a = (v) => buttonStyle({ size: 'sm', visual: v })`)

    expect(css).toContain('buttonStyle--size_sm')
    expect(css).not.toContain('buttonStyle--size_md')
  })
})
