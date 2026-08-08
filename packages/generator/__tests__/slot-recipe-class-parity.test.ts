import { createGeneratorContext } from '@bamboocss/fixture'
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { pathToFileURL } from 'node:url'
import { afterAll, describe, expect, test } from 'vitest'

/**
 * The class a slot recipe hands the DOM has to be a class the stylesheet emits a rule for.
 *
 * `createRecipe` routes its `name` through `createCss`, which applies `hash.className` and
 * `prefix.className` itself. A recipe with no anchors passed the *already formatted* slot key
 * in, so both were applied twice while `cssgen` applied them once. Six recipes rendered
 * completely unstyled.
 *
 * It is invisible only when neither `hash` nor `prefix` is set, where both applications are
 * identities — which is why the matrix below varies both rather than just `hash`.
 *
 * The runtime class is read by importing the generated artifact and calling it, not by
 * recomputing the name here. Recomputing only asserts that `cssgen` agrees with itself, which
 * it did throughout while every one of these slots was unstyled.
 */

const RECIPES = {
  /** No `root` slot, so `getScopeRoots` returns [] — the branch that was broken. */
  menu: {
    className: 'menu',
    slots: ['trigger', 'positioner', 'content'],
    base: { trigger: { display: 'flex' }, positioner: { zIndex: '1' }, content: { color: 'red.300' } },
  },
  /** Declares `root`, so it anchors — the branch that was already correct. */
  combobox: {
    className: 'combobox',
    slots: ['root', 'control', 'content'],
    base: { root: { display: 'flex' }, control: { color: 'red.300' }, content: { padding: '2' } },
  },
} as const

const build = (options: { hash?: boolean; prefix?: string }) =>
  createGeneratorContext({
    ...options,
    preflight: false,
    theme: { extend: { slotRecipes: RECIPES } },
    staticCss: { recipes: { menu: ['*'], combobox: ['*'] } },
  } as any) as any

/**
 * Every class the emitted stylesheet carries a rule for.
 *
 * A class cannot begin with an unescaped digit, so requiring that of the first character is
 * what stops `0.5rem` inside a declaration being read as a class called `5rem`.
 */
const CLASS_SELECTOR = /\.((?:\\.|[a-zA-Z_-])(?:\\.|[\w-])*)/g

const emittedClasses = (ctx: any) => {
  const sheet = ctx.createSheet()
  ctx.appendLayerParams(sheet)
  ctx.appendCssOfType('static', sheet)
  const css = ctx.getCss(sheet)
  return new Set([...css.matchAll(CLASS_SELECTOR)].map((m) => m[1].replaceAll('\\', '')))
}

/**
 * Write the generated system to disk and import it, so the runtime answers for itself.
 *
 * Artifacts carry their own `dir`, already including the outdir; the few without one — the
 * helpers the recipes import as `../helpers` — belong at its root.
 */
const written: string[] = []

const loadRuntime = async (ctx: any) => {
  // Inside the project: vitest resolves a dynamic import through vite, which will not load a
  // file outside the root however it is spelled.
  const root = mkdtempSync(join(process.cwd(), 'node_modules', '.bamboo-parity-'))
  written.push(root)
  for (const artifact of ctx.getArtifacts() ?? []) {
    for (const file of artifact.files ?? []) {
      if (!file.code) continue
      const path = join(root, ...(artifact.dir ?? ['styled-system']), file.file)
      mkdirSync(dirname(path), { recursive: true })
      writeFileSync(path, file.code)
    }
  }
  // @vite-ignore: the path is a temp dir, so vitest must not try to resolve it at transform time
  return import(/* @vite-ignore */ pathToFileURL(join(root, 'styled-system', 'recipes', 'index.mjs')).href)
}

afterAll(() => written.forEach((dir) => rmSync(dir, { recursive: true, force: true })))

const MATRIX: [string, { hash?: boolean; prefix?: string }][] = [
  ['plain', {}],
  ['hashed', { hash: true }],
  ['prefixed', { prefix: 'bam' }],
  ['hashed and prefixed', { hash: true, prefix: 'bam' }],
]

describe('slot recipe class parity', () => {
  /**
   * The invariant, with the runtime as its own oracle: every class the generated recipe
   * returns has to be a class the stylesheet emits.
   */
  test.each(MATRIX)('every slot class a %s build returns has a rule', async (_label, options) => {
    const ctx = build(options)
    const emitted = emittedClasses(ctx)
    const runtime = await loadRuntime(ctx)

    const missing: string[] = []
    for (const name of Object.keys(RECIPES)) {
      const result = runtime[name]?.({})
      for (const [slot, className] of Object.entries(result ?? {})) {
        // A slot's value can carry variant classes the stylesheet need not have a rule for;
        // the base class is the one that must always resolve.
        const base = String(className).split(' ')[0]
        if (!emitted.has(base)) missing.push(`${name}.${slot} -> ${base}`)
      }
    }

    expect(missing).toEqual([])
  })

  /** `classNameMap` is public API and built from the same array the fix re-destructures. */
  test.each(MATRIX)('classNameMap agrees with the stylesheet in a %s build', async (_label, options) => {
    const ctx = build(options)
    const emitted = emittedClasses(ctx)
    const runtime = await loadRuntime(ctx)

    const missing: string[] = []
    for (const name of Object.keys(RECIPES)) {
      for (const [slot, className] of Object.entries(runtime[name]?.classNameMap ?? {})) {
        if (!emitted.has(String(className))) missing.push(`${name}.${slot} -> ${className}`)
      }
    }

    expect(missing).toEqual([])
  })
})
