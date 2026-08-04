import { readFileSync, rmSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { loadConfigAndCreateContext } from '@bamboocss/node'
import { foldSource } from '@bamboocss/vite'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { afterAll, beforeAll, describe, expect, test } from 'vitest'

/**
 * The end-to-end check the rest of the suite cannot make.
 *
 * Every other assertion about the fold compares class strings, or looks for a rule in
 * the emitted css. Neither shows what a browser would receive. This renders the same
 * tree twice — once from source, once from the folded output — and compares the markup.
 *
 * That is the property that actually matters for a transform that rewrites JSX: a wrong
 * fold does not throw, it renders something subtly different, and nothing downstream
 * notices.
 */
const here = dirname(fileURLToPath(import.meta.url))
const cwd = join(here, '..')
const source = join(here, '../src/parity/tree.tsx')
const foldedPath = join(here, '../src/parity/tree.folded.tsx')

let foldedCode = ''
let foldedCount = 0
let skippedCount = 0

beforeAll(async () => {
  const ctx = await loadConfigAndCreateContext({ cwd })
  const code = readFileSync(source, 'utf8')

  ctx.project.addSourceFile(source, code)
  const parserResult = ctx.project.parseSourceFile(source)!

  const result = foldSource({ ctx, code, parserResult, filePath: source })
  foldedCode = result.code
  foldedCount = result.folded.length
  skippedCount = result.skipped.length

  // Written beside the original so its relative imports resolve identically.
  writeFileSync(foldedPath, foldedCode, 'utf8')
})

afterAll(() => {
  rmSync(foldedPath, { force: true })
})

const props = { tone: 'red600', rest: { title: 'spread title' } }

/** Markup with the tokens inside every `class` attribute sorted. */
const sortClasses = (html: string) =>
  html.replaceAll(/class="([^"]*)"/g, (_, value: string) => `class="${value.split(' ').sort().join(' ')}"`)

describe('render parity', () => {
  test('the fixture actually exercises the fold', () => {
    // Guards against this passing because nothing was rewritten.
    expect(foldedCount).toBeGreaterThan(5)
    expect(skippedCount).toBeGreaterThan(0)
  })

  test('the folded module no longer goes through the factory for folded elements', () => {
    expect(foldedCode).toContain('className={"')
    // A static `as` names the folded tag rather than blocking the fold.
    expect(foldedCode).toContain('<section className={')
    // The declining shapes must still be there.
    expect(foldedCode).toContain('{...rest}')
    expect(foldedCode).toContain('css={{')
  })

  test('renders byte-identical markup with and without the transform', async () => {
    const original = await import(/* @vite-ignore */ source)
    const folded = await import(/* @vite-ignore */ foldedPath)

    const before = renderToStaticMarkup(createElement(original.Tree, props))
    const after = renderToStaticMarkup(createElement(folded.Tree, props))

    // The two modules have to be genuinely different, or this compares a thing to
    // itself and proves nothing.
    expect(foldedCode).not.toBe(readFileSync(source, 'utf8'))

    // And the markup has to be substantial enough for a difference to show up in.
    expect(before.length).toBeGreaterThan(400)
    expect(before).toContain('class=')
    expect(before).toContain('spread title')
    expect(before).toContain('<section')

    // Class *order* is allowed to differ, and only class order. A partial fold emits the
    // static half before the runtime half, so a prop written last can surface second.
    // Attribute order carries no cascade meaning for atomic classes, and `collides()`
    // guarantees the two halves never produce a class for the same property — the browser
    // check computing identical styles is what actually confirms that. Everything else
    // here, tags, attributes and text, still has to match byte for byte.
    // Sorting cannot hide a dropped class, which is the bug class every defect in this
    // feature has belonged to: removing one changes the sorted string too. What it
    // tolerates is only a permutation.
    expect(sortClasses(after)).toBe(sortClasses(before))
  })

  test('a deliberately broken fold would be caught', async () => {
    // Confidence in the assertion above depends on the comparison being able to fail.
    const original = await import(/* @vite-ignore */ source)
    const before = renderToStaticMarkup(createElement(original.Tree, props))

    const brokenPath = join(here, '../src/parity/tree.broken.tsx')
    writeFileSync(brokenPath, foldedCode.replace('className={"', 'className={"x '), 'utf8')

    try {
      const broken = await import(/* @vite-ignore */ brokenPath)

      // Compared the same way the assertion above compares, so this demonstrates that
      // *that* comparison can fail — a raw `toBe` would pass here while telling you
      // nothing about the relaxed one, and would keep passing if it were relaxed further.
      expect(sortClasses(renderToStaticMarkup(createElement(broken.Tree, props)))).not.toBe(sortClasses(before))
    } finally {
      rmSync(brokenPath, { force: true })
    }
  })
})
