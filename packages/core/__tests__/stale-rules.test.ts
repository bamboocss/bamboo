import { createContext } from '@bamboocss/fixture'
import type { Config } from '@bamboocss/types'
import { describe, expect, test } from 'vitest'

/**
 * A rule leaves the sheet when the last thing that wanted it stops.
 *
 * The encoder only ever added. It is built once with the context and a context outlives
 * rebuilds, so every long-lived integration accumulated: each save of an edited file put its
 * new atoms in and left the previous version's behind, for the life of the process. A dev
 * server's stylesheet therefore grew monotonically, and nothing about the CSS looked wrong —
 * the orphan rules were valid, just unreachable.
 *
 * Every case here is written as an *edit*: read a file, read it again with different styles,
 * and ask what the stylesheet says. That is the shape the defect takes, and the shape that
 * distinguishes a fix from a fix that also drops rules something still needs — which is why
 * each test carries a control that has to survive the same pass.
 */

const context = (userConfig?: Config) => createContext(userConfig)

type Context = ReturnType<typeof context>

/** The stylesheet an extraction pass would emit from everything encoded so far. */
const stylesheet = (ctx: Context) => {
  const sheet = ctx.createSheet()
  ctx.appendParserCss(sheet)
  return sheet.toCss()
}

/** Read a file, as a bundler transform does — see `Project.parseSourceFile`. */
const read = (ctx: Context, file: string, code: string) => {
  ctx.project.addSourceFile(file, code)
  return ctx.project.parseSourceFile(file)
}

const IMPORTS = `
  import { css, cva, sva, viewTransition } from 'styled-system/css'
  import { buttonStyle, badge } from 'styled-system/recipes'
`

describe('an edited file', () => {
  test('loses the classes its previous version produced', () => {
    const ctx = context()

    read(
      ctx,
      'src/a.tsx',
      `${IMPORTS} export const A = () => <div className={css({ color: 'red', display: 'flex' })} />`,
    )
    // The control, and the whole difficulty: `b.tsx` wants `display: flex` too, and the atom
    // is shared. A fix that dropped everything the edited file had encoded would take it.
    read(ctx, 'src/b.tsx', `${IMPORTS} export const B = () => <div className={css({ display: 'flex' })} />`)

    expect(stylesheet(ctx)).toContain('color: red')

    read(
      ctx,
      'src/a.tsx',
      `${IMPORTS} export const A = () => <div className={css({ color: 'blue', display: 'flex' })} />`,
    )

    const css = stylesheet(ctx)
    expect(css).not.toContain('color: red')
    expect(css).toContain('color: blue')
    expect(css).toContain('display: flex')
  })

  test('loses the recipe variants it no longer selects', () => {
    const ctx = context()

    read(ctx, 'src/a.tsx', `${IMPORTS} export const A = () => <button className={buttonStyle({ size: 'sm' })} />`)
    read(ctx, 'src/b.tsx', `${IMPORTS} export const B = () => <button className={buttonStyle({ size: 'md' })} />`)

    expect(stylesheet(ctx)).toContain('buttonStyle--size_sm')

    read(ctx, 'src/a.tsx', `${IMPORTS} export const A = () => <button className={buttonStyle({ size: 'md' })} />`)

    const css = stylesheet(ctx)
    expect(css).not.toContain('buttonStyle--size_sm')
    // Still selected by `b.tsx`, and by `a.tsx` now. The base is shared the same way.
    expect(css).toContain('buttonStyle--size_md')
    expect(css).toContain('.buttonStyle ')
  })

  test('loses the base of an inline recipe it no longer declares', () => {
    const ctx = context()

    read(
      ctx,
      'src/a.tsx',
      `${IMPORTS} export const a = cva({ base: { color: 'red' }, variants: { tone: { loud: { fontSize: '3xl' } } } })`,
    )

    const before = stylesheet(ctx)
    expect(before).toContain('color: red')
    expect(before).toContain('font-size: var(--font-sizes-3xl)')

    read(
      ctx,
      'src/a.tsx',
      `${IMPORTS} export const a = cva({ base: { color: 'blue' }, variants: { tone: { loud: { fontSize: '3xl' } } } })`,
    )

    const css = stylesheet(ctx)
    // A `cva` with no `className` is named by a digest of its styles, so an edit renames it —
    // base, variants and all. Every rule of the old name is an orphan.
    expect(css).not.toContain('color: red')
    expect(css).toContain('color: blue')
    expect(css.match(/--tone_loud/g)?.length).toBe(1)
  })

  test('loses the compound-variant rules of a recipe it no longer uses', () => {
    const ctx = context()

    read(
      ctx,
      'src/a.tsx',
      `${IMPORTS} export const A = () => <div className={badge({ size: 'sm', raised: true }).title} />`,
    )
    expect(stylesheet(ctx)).toContain('ButtonHighlight')

    read(ctx, 'src/a.tsx', `${IMPORTS} export const A = () => <div className={css({ color: 'blue' })} />`)

    const css = stylesheet(ctx)
    // The compound's own rule is what this is about. It carries no class of its own — it
    // selects on the variant classes the element already has — so nothing else would notice
    // it had been left behind.
    expect(css).not.toContain('ButtonHighlight')
    expect(css).not.toContain('badge')
  })

  test('loses the view transitions it no longer declares', () => {
    const ctx = context()

    read(ctx, 'src/a.tsx', `${IMPORTS} export const slide = viewTransition({ old: { opacity: '0' } })`)
    expect(stylesheet(ctx)).toContain('view-transition-old')

    read(ctx, 'src/a.tsx', `${IMPORTS} export const slide = viewTransition({ new: { opacity: '1' } })`)

    const css = stylesheet(ctx)
    expect(css).not.toContain('view-transition-old')
    expect(css).toContain('view-transition-new')
  })
})

describe('what an edit may not take', () => {
  test('a declaration another file still writes', () => {
    const ctx = context()

    read(ctx, 'src/a.tsx', `${IMPORTS} export const A = () => <div className={css({ color: 'red' })} />`)
    read(ctx, 'src/b.tsx', `${IMPORTS} export const B = () => <div className={css({ color: 'red' })} />`)
    read(ctx, 'src/a.tsx', `${IMPORTS} export const A = () => <div className={css({ color: 'blue' })} />`)

    expect(stylesheet(ctx)).toContain('color: red')
  })

  test('a declaration `staticCss` safelists', () => {
    const ctx = context({ staticCss: { css: [{ properties: { color: ['red'] } }] } })

    read(ctx, 'src/a.tsx', `${IMPORTS} export const A = () => <div className={css({ color: 'red' })} />`)

    // The safelist reaches the encoder through `StaticCss.process`, with no file to answer to.
    const sheet = ctx.createSheet()
    ctx.appendBaselineCss(sheet)

    read(ctx, 'src/a.tsx', `${IMPORTS} export const A = () => <div className={css({ color: 'blue' })} />`)

    // Asserted on the encoder rather than on the emitted sheet: `appendBaselineCss` re-runs the
    // safelist on every pass, so a sheet built after this would hold the atom whether or not it
    // had been wrongly removed.
    expect(Array.from(ctx.encoder.atomic).some((hash) => hash.startsWith('color]___[value:red'))).toBe(true)
  })

  test('a reading of the same file another entry point has not refreshed', () => {
    const ctx = context()

    // A Vite dev server reads a module twice, and the two readings can legitimately differ —
    // an SFC's sub-modules, a plugin that transformed the source first. Each holds its own
    // record, so one going stale cannot take rules the other still accounts for.
    ctx.encoder.withOwner('extract', 'src/a.tsx', () => ctx.encoder.processAtomic({ color: 'red' }))
    ctx.encoder.withOwner('parse', 'src/a.tsx', () => ctx.encoder.processAtomic({ color: 'red' }))

    ctx.encoder.withOwner('parse', 'src/a.tsx', () => ctx.encoder.processAtomic({ color: 'blue' }))
    expect(Array.from(ctx.encoder.atomic).some((hash) => hash.startsWith('color]___[value:red'))).toBe(true)

    ctx.encoder.withOwner('extract', 'src/a.tsx', () => ctx.encoder.processAtomic({ color: 'blue' }))
    expect(Array.from(ctx.encoder.atomic).some((hash) => hash.startsWith('color]___[value:red'))).toBe(false)
  })
})

describe('a deleted file', () => {
  test('takes its rules with it', () => {
    const ctx = context()

    read(
      ctx,
      'src/a.tsx',
      `${IMPORTS} export const A = () => <div className={css({ color: 'red', display: 'flex' })} />`,
    )
    read(ctx, 'src/b.tsx', `${IMPORTS} export const B = () => <div className={css({ display: 'flex' })} />`)

    ctx.project.removeSourceFile('src/a.tsx')

    const css = stylesheet(ctx)
    // Nothing re-parses a file that is gone, so without the removal side its rules would
    // outlive it for as long as the context does.
    expect(css).not.toContain('color: red')
    expect(css).toContain('display: flex')
  })
})

describe('the compiled path', () => {
  test('drops the atoms it interned for a recipe nothing declares any more', () => {
    const ctx = context()

    read(ctx, 'src/a.tsx', `${IMPORTS} export const a = cva({ base: { color: 'red' } })`)
    read(ctx, 'src/b.tsx', `${IMPORTS} export const B = () => <div className={css({ display: 'flex' })} />`)

    // What a static build does after extraction: lower every observed recipe's declarations
    // into the ordinary atomic pool, so a folded call site has rules behind it.
    ctx.encoder.atomizeObservedRecipes()
    expect(stylesheet(ctx)).toContain('.c_red')

    read(ctx, 'src/a.tsx', `${IMPORTS} export const a = cva({ base: { color: 'blue' } })`)
    ctx.encoder.atomizeObservedRecipes()

    const css = stylesheet(ctx)
    expect(css).not.toContain('.c_red')
    expect(css).toContain('.c_blue')
    expect(css).toContain('.d_flex')
  })
})

/**
 * Every case above that keeps a declaration across an edit has a *second* file holding it, so
 * its refcount never passes through zero. That is the cheap half of the problem. The dangerous
 * half is one file keeping a declaration across its own edit: the count goes 1 -> 2 -> 1 and
 * the order of the two halves is what stops it touching zero on the way.
 *
 * Inverting `retainScope` and `releaseScope` in `withOwnerKey` is invisible to every other test
 * in this file and drops `display: flex` from the sheet here. An invariant the suite cannot see
 * violated is one the next edit is free to break, and for this design the risk concentrates
 * exactly on transitions through zero — so each collection gets a case.
 */
describe('a declaration a file still writes after its own edit', () => {
  test('survives with no other file holding it', () => {
    const ctx = context()

    read(
      ctx,
      'src/a.tsx',
      `${IMPORTS} export const A = () => <div className={css({ color: 'red', display: 'flex' })} />`,
    )
    read(
      ctx,
      'src/a.tsx',
      `${IMPORTS} export const A = () => <div className={css({ color: 'blue', display: 'flex' })} />`,
    )

    const css = stylesheet(ctx)
    expect(css).toContain('display: flex')
    expect(css).toContain('color: blue')
    expect(css).not.toContain('color: red')
  })

  test('survives for a recipe selection, its base and its compound variants', () => {
    const ctx = context()

    // The edited declaration is a `z-index`, not a colour: `badge`'s own `size: sm` variant
    // emits `color: red` for its body slot, so a colour could not tell a surviving rule from
    // the recipe's.
    const source = (zIndex: string) => `${IMPORTS}
      export const A = () => <button className={buttonStyle({ size: 'sm' })} />
      export const B = () => <div className={badge({ size: 'sm', raised: true }).title} />
      export const C = () => <div className={css({ zIndex: '${zIndex}' })} />
    `

    read(ctx, 'src/a.tsx', source('42'))
    read(ctx, 'src/a.tsx', source('43'))

    const css = stylesheet(ctx)
    expect(css).toContain('buttonStyle--size_sm')
    expect(css).toContain('.buttonStyle ')
    expect(css).toContain('badge__title')
    // The compound's rule, which carries no class of its own.
    expect(css).toContain('ButtonHighlight')
    expect(css).toContain('z-index: 43')
    expect(css).not.toContain('z-index: 42')
  })

  test('survives for a view transition', () => {
    const ctx = context()

    const source = (color: string) => `${IMPORTS}
      export const slide = viewTransition({ old: { opacity: '0' } })
      export const A = () => <div className={css({ color: '${color}' })} />
    `

    read(ctx, 'src/a.tsx', source('red'))
    read(ctx, 'src/a.tsx', source('blue'))

    const css = stylesheet(ctx)
    expect(css).toContain('view-transition-old')
    expect(css).toContain('color: blue')
    expect(css).not.toContain('color: red')
  })
})

/**
 * A `.json` file in `include` carrying an encoder dump, which `parseJson` restores whole.
 *
 * It answers to no file, so nothing may release it — and until a local file happened to encode
 * the same thing, nothing could: an untracked key is one `Refs.release` declines. Encoding it
 * from source is what starts counting it, and from there the file's own next reading takes the
 * count to zero. Pinning on restore is what keeps the two from meeting.
 */
describe('a restored encoder dump', () => {
  test('survives a local file that declared the same styles dropping them', () => {
    const donor = context()
    read(
      donor,
      'src/donor.tsx',
      `${IMPORTS}
        export const slide = viewTransition({ old: { opacity: '0' } })
        export const A = () => <div className={css({ color: 'red' })} />
        export const B = () => <button className={buttonStyle({ size: 'sm' })} />
      `,
    )

    const ctx = context()
    ctx.encoder.fromJSON(donor.encoder.toJSON())

    read(
      ctx,
      'src/a.tsx',
      `${IMPORTS}
        export const slide = viewTransition({ old: { opacity: '0' } })
        export const A = () => <div className={css({ color: 'red' })} />
        export const B = () => <button className={buttonStyle({ size: 'sm' })} />
      `,
    )
    read(ctx, 'src/a.tsx', `${IMPORTS} export const A = () => <div className={css({ color: 'blue' })} />`)

    const css = stylesheet(ctx)
    expect(css).toContain('view-transition-old')
    expect(css).toContain('color: red')
    expect(css).toContain('buttonStyle--size_sm')
  })
})
