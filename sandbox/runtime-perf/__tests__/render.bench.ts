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

/**
 * The same treatment for a module of nothing but runtime-valued style props.
 *
 * `tree.tsx` folds most of its elements away, so it measures the factory disappearing.
 * This one keeps a runtime path either way — the fold can only change what that path
 * costs, by lowering each prop to a class prefix plus its value instead of a `css()`
 * call. Without it, the surface that change touches is one prop out of a whole tree.
 */
const dynamicSource = join(here, '../src/parity/dynamic.tsx')
const dynamicFoldedPath = join(here, '../src/parity/dynamic.bench.folded.tsx')

const dynamicCode = readFileSync(dynamicSource, 'utf8')
ctx.project.addSourceFile(dynamicSource, dynamicCode)
const dynamicResult = foldSource({
  ctx,
  code: dynamicCode,
  parserResult: ctx.project.parseSourceFile(dynamicSource)!,
  filePath: dynamicSource,
})
writeFileSync(dynamicFoldedPath, dynamicResult.code, 'utf8')

const dynamicOriginal = await import(/* @vite-ignore */ dynamicSource)
const dynamicFolded = await import(/* @vite-ignore */ dynamicFoldedPath)
rmSync(dynamicFoldedPath, { force: true })

const props = { tone: 'red600', rest: { title: 'spread title' }, flag: true }

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

const dynamicProps = { tone: 'red600', size: 'body', gap: 'md' }

const renderDynamic = (Component: (p: typeof dynamicProps) => unknown) =>
  renderToStaticMarkup(
    createElement(
      'div',
      null,
      Array.from({ length: TREES }, (_, key) => createElement(Component as never, { ...dynamicProps, key })),
    ),
  )

describe(`react render, ${TREES} trees of runtime-valued props`, () => {
  bench('source (css() per prop)', () => void renderDynamic(dynamicOriginal.Dynamic), OPTIONS)
  bench('folded (prefix plus value)', () => void renderDynamic(dynamicFolded.Dynamic), OPTIONS)
})
