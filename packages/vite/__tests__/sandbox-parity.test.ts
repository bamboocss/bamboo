import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createContext } from '@bamboocss/fixture'
import { describe, expect, test } from 'vitest'
import { foldSource } from '../src/fold'
import { createRuntimeCss } from '../src/runtime-css'
import { createStaticStyleSetCompiler } from '../src/style-set'
import { selectorsFor } from './fixture'

/**
 * Parity against real application source, not hand-written fixtures.
 *
 * The compiler intentionally changes recipe class strings and the stylesheet representation:
 * selected declarations become globally shared utility atoms and the recipe layer disappears.
 * This fixture therefore verifies the invariant that matters after that change: every emitted
 * class is a well-formed attribute token backed by a rule in the atomized stylesheet.
 */
const here = dirname(fileURLToPath(import.meta.url))
const sandboxSrc = join(here, '../../../sandbox/vite-ts/src')

const SOURCES = ['App.tsx', 'Card.tsx', 'Badge.tsx', 'Button.tsx']
  .map((file) => {
    try {
      return { file, code: readFileSync(join(sandboxSrc, file), 'utf8') }
    } catch {
      return null
    }
  })
  .filter((entry): entry is { file: string; code: string } => entry != null)

const parseAll = (fold: boolean) => {
  const ctx = createContext()
  const runtimeCss = createRuntimeCss(ctx)
  const styleCompiler = createStaticStyleSetCompiler(ctx, runtimeCss)
  const results = []

  for (const { file, code } of SOURCES) {
    const filePath = `sandbox/vite-ts/src/${file}`
    ctx.project.addSourceFile(filePath, code)
    const parserResult = ctx.project.parseSourceFile(filePath)
    if (!parserResult) continue

    if (fold) {
      results.push({
        file,
        code,
        result: foldSource({ ctx, code, parserResult, filePath, runtimeCss, styleCompiler }),
      })
    }
  }

  if (fold) ctx.encoder.atomizeObservedRecipes()

  const sheet = ctx.createSheet()
  ctx.appendParserCss(sheet)

  return { css: ctx.getCss(sheet), results, ctx, runtimeCss }
}

describe('sandbox/vite-ts parity', () => {
  test('the sandbox sources were found', () => {
    // Guards against this whole suite silently passing on an empty list.
    expect(SOURCES.length).toBeGreaterThan(0)
  })

  test('compilation materializes the shared atoms selected from recipe declarations', () => {
    const withoutFold = parseAll(false)
    const withFold = parseAll(true)

    expect(withFold.css.length).toBeGreaterThanOrEqual(withoutFold.css.length)
    expect(withFold.css).toContain('.bg_gray\\.500')
  })

  test('the sandbox actually exercises the fold', () => {
    const { results } = parseAll(true)
    const total = results.reduce((sum, entry) => sum + entry.result.folded.length, 0)

    expect(total).toBeGreaterThan(0)
  })

  test('folded literals are well-formed class attribute values', () => {
    const { results } = parseAll(true)

    for (const { file, result } of results) {
      for (const call of result.folded) {
        const where = `${file} @ ${call.start}`

        // A call whose every property lowered to a ternary resolves no class outright, and
        // its branches are in `classNames` instead. One that lowered every property to a
        // leaf resolves no literal at all — its class is built at runtime — so an empty
        // list is legitimate there and only there: the planner declines a fold with
        // neither a class nor a lowered property, so empty implies a leaf.

        // The decoder escapes class names for CSS selectors (`.c_red\.300`); a class
        // attribute must carry the unescaped form. A stray backslash here is the
        // signature of folding the selector form by mistake.
        expect(call.className, `${where} leaked a selector escape`).not.toContain('\\')

        // No empty segments, no leading or trailing space in the joined string. An empty
        // `className` is its own case rather than a malformed one: a fold whose classes
        // are all built at runtime resolves no literal at all.
        expect(call.className, where).toBe(call.className.trim())
        if (call.className) {
          expect(
            call.className.split(' ').filter((part) => part === ''),
            where,
          ).toHaveLength(0)
        }

        for (const name of call.classNames) {
          expect(name, `${where} produced an empty class`).not.toBe('')
          expect(name, `${where} leaked a selector escape`).not.toContain('\\')
        }
      }
    }
  })

  test('folded literals appear in the rewritten source', () => {
    const { results } = parseAll(true)

    for (const { file, result } of results) {
      for (const call of result.folded) {
        // Each literal separately: a lowered ternary writes its arms as two strings, so
        // there is no single literal holding them both.
        for (const name of call.classNames) {
          expect(result.code, `${file}: ${name} missing from output`).toContain(name)
        }
      }
    }
  })

  test('re-folding already-folded sandbox source is a no-op', () => {
    const ctx = createContext()
    const runtimeCss = createRuntimeCss(ctx)
    const styleCompiler = createStaticStyleSetCompiler(ctx, runtimeCss)

    for (const { file, code } of SOURCES) {
      const first = `sandbox/first/${file}`
      ctx.project.addSourceFile(first, code)
      const firstResult = foldSource({
        ctx,
        code,
        parserResult: ctx.project.parseSourceFile(first)!,
        filePath: first,
        runtimeCss,
        styleCompiler,
      })

      const second = `sandbox/second/${file}`
      ctx.project.addSourceFile(second, firstResult.code)
      const secondResult = foldSource({
        ctx,
        code: firstResult.code,
        parserResult:
          ctx.project.parseSourceFile(second) ??
          ({
            toArray: () => [],
            isEmpty: () => true,
          } as never),
        filePath: second,
        runtimeCss,
        styleCompiler,
      })

      expect(secondResult.code, file).toBe(firstResult.code)
    }
  })

  test('every folded class is backed by a rule in the emitted CSS', () => {
    const { css, results } = parseAll(true)

    for (const { file, result } of results) {
      for (const call of result.folded) {
        for (const selector of selectorsFor(call.classNames.join(' '))) {
          expect(css, `${file}: ${selector} has no rule`).toContain(selector)
        }
      }
    }
  })
})
