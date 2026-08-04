import { readFileSync, rmSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { loadConfigAndCreateContext } from '@bamboocss/node'
import { foldSource } from '@bamboocss/vite'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { bench, describe } from 'vitest'

/**
 * What the fold is worth on a real React render, rather than per `css()` call.
 *
 * The per-call numbers that motivated this work (~66ns flat, ~437ns for a component with
 * a condition and a responsive value, ~3.1µs cold) say nothing about how much of a
 * render they add up to. This renders the same tree from source and from folded output
 * and compares.
 *
 * Reported, not asserted, like every other bench here.
 */
const here = dirname(fileURLToPath(import.meta.url))
const cwd = join(here, '..')
const source = join(here, '../src/parity/tree.tsx')
const foldedPath = join(here, '../src/parity/tree.bench.folded.tsx')

const ctx = await loadConfigAndCreateContext({ cwd })
const code = readFileSync(source, 'utf8')
ctx.project.addSourceFile(source, code)
const result = foldSource({ ctx, code, parserResult: ctx.project.parseSourceFile(source)!, filePath: source })
writeFileSync(foldedPath, result.code, 'utf8')

const original = await import(/* @vite-ignore */ source)
const folded = await import(/* @vite-ignore */ foldedPath)
rmSync(foldedPath, { force: true })

const props = { tone: 'red600', rest: { title: 'spread title' } }

/** Enough elements that per-render setup does not dominate the measurement. */
const TREES = 50

const renderMany = (Component: (p: typeof props) => unknown) =>
  renderToStaticMarkup(
    createElement(
      'div',
      null,
      Array.from({ length: TREES }, (_, key) => createElement(Component as never, { ...props, key })),
    ),
  )

/**
 * The first renders pay for React's lazy init and for filling the runtime's style memo,
 * which is exactly the cost the fold removes — so measuring them as steady state would
 * flatter the folded side. Warm both fully and compare the warm path, which is the
 * conservative reading.
 */
const OPTIONS = { warmupIterations: 20, time: 2000 }

describe(`react render, ${TREES} trees`, () => {
  bench(
    'source (factory at runtime)',
    () => {
      renderMany(original.Tree)
    },
    OPTIONS,
  )

  bench(
    'folded (intrinsic tags, literal classNames)',
    () => {
      renderMany(folded.Tree)
    },
    OPTIONS,
  )
})
