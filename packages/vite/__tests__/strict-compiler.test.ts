import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, test } from 'vitest'
import { bamboocss } from '../src/plugin'

/**
 * The compiler has no runtime styling fallback. These cases pin the diagnostics for every
 * source shape that cannot be represented by the finite StyleSet model.
 */
const cwd = join(dirname(fileURLToPath(import.meta.url)), '../../../sandbox/codegen')

const hookOf = <T>(hook: T | { handler: T } | undefined): T | undefined =>
  typeof hook === 'function' ? hook : (hook as { handler: T } | undefined)?.handler

const run = async (code: string, file: string) => {
  const plugin = bamboocss({ cwd, reportSummary: false }).find((p) => p.name === 'bamboocss:compiler')!

  await hookOf(plugin.buildStart)?.call({} as never, {} as never)
  await hookOf(plugin.transform)?.call({ addWatchFile: () => {} } as never, code, join(cwd, file), {} as never)
  return () => hookOf(plugin.buildEnd)?.call({} as never, undefined as never)
}

const src = (body: string) => `import { css } from 'styled-system/css'\n${body}\n`

describe('strict compiler', () => {
  test('fails on a call the build could not resolve', async () => {
    const end = await run(src(`export const f = (p) => css({ ...p, color: 'red.300' })`), 'src/strict-spread.tsx')

    // The message has to name the file and the line, because the fix is at a call site and
    // a count alone leaves the user grepping for it.
    expect(end).toThrow(/could not be compiled/)
    expect(end).toThrow(/strict-spread\.tsx/)
    expect(end).toThrow(/dynamic/)
  }, 60_000)

  test('fails on css.raw, which returns a style object rather than a class', async () => {
    const end = await run(src(`export const r = css.raw({ color: 'red.300' })`), 'src/strict-raw.tsx')

    expect(end).toThrow(/raw-call/)
  }, 60_000)

  test('fails on a runtime style leaf', async () => {
    const end = await run(src(`export const f = (tone) => css({ color: tone })`), 'src/strict-leaf.tsx')
    expect(end).toThrow(/dynamic|runtime-binding/)
  }, 60_000)

  test('says nothing when every call folded', async () => {
    const end = await run(src(`export const cls = css({ color: 'red.300' })`), 'src/strict-static.tsx')

    expect(end).not.toThrow()
  }, 60_000)

  test('accepts a compile-time cva definition', async () => {
    const end = await run(
      `import { cva } from 'styled-system/css'\nexport const b = cva({ base: { color: 'red.300' } })\n`,
      'src/strict-cva.tsx',
    )

    expect(end).not.toThrow()
  }, 60_000)

  test('compiles static and finite dynamic calls of an inline recipe', async () => {
    const end = await run(
      `import { cva } from 'styled-system/css'\n` +
        `const badge = cva({ base: { color: 'red.300' }, variants: { tone: { a: { color: 'blue.300' } } } })\n` +
        `export const cls = badge({ tone: 'a' })\n` +
        `export const make = (tone) => badge({ tone })\n`,
      'src/strict-cva-call.tsx',
    )

    expect(end).not.toThrow()
  }, 60_000)

  describe('a wrapper whose variants arrive as props', () => {
    test('compiles a config recipe and keeps an unknown external class as a cx join', async () => {
      const end = await run(
        `import { cx } from 'styled-system/css'
import { button } from 'styled-system/recipes'
export const B = (props) => {
  const [variantProps, rest] = button.splitVariantProps(props)
  return <button className={cx(button(variantProps), rest.className)} />
}
`,
        'src/strict-config-recipe-wrapper.tsx',
      )

      expect(end).not.toThrow()
    }, 60_000)

    test('passes when a config recipe is the complete class expression', async () => {
      const end = await run(
        `import { button } from 'styled-system/recipes'
export const B = (props) => {
  const [variantProps, rest] = button.splitVariantProps(props)
  return <button {...rest} className={button(variantProps)} />
}
`,
        'src/strict-config-recipe-compiled.tsx',
      )

      expect(end).not.toThrow()
    }, 60_000)

    test('compiles an inline recipe composed with an unknown external class', async () => {
      const end = await run(
        `import { cva, cx } from 'styled-system/css'
const button = cva({ base: { color: 'red.300' }, variants: { visual: { solid: { bg: 'blue.300' } } } })
export const B = (props) => {
  const [variantProps, rest] = button.splitVariantProps(props)
  return <button className={cx(button(variantProps), rest.className)} />
}
`,
        'src/strict-inline-recipe-wrapper.tsx',
      )

      expect(end).not.toThrow()
    }, 60_000)

    /** Unaffected: a config recipe call whose selection resolves folds like anything else. */
    test('passes for a config recipe call the build can resolve', async () => {
      const end = await run(
        `import { button } from 'styled-system/recipes'\nexport const cls = button({ visual: 'solid' })\n`,
        'src/strict-config-recipe-static.tsx',
      )

      expect(end).not.toThrow()
    }, 60_000)
  })

  /**
   * The ledger only holds calls something recognised, so a guarantee built on it is worth
   * what the recogniser is — and these are the shapes nothing recognises. Each folds nothing,
   * reports nothing, and keeps the module live unless the final binding scan rejects it.
   */
  describe('a binding the rewrite left behind', () => {
    /**
     * A module whose only bamboo usage is a bare reference. Nothing records it, so the ledger
     * is empty and so is the parser result — which meant the module was skipped before the
     * fold ever saw it before the final binding scan existed.
     */
    test('a binding passed on rather than called', async () => {
      const end = await run(
        `import { css } from 'styled-system/css'
export const pass = css
`,
        'src/strict-reexport.tsx',
      )

      expect(end).toThrow(/could not be compiled/)
      expect(end).toThrow(/runtime-binding/)
      expect(end).toThrow(/strict-reexport\.tsx/)
    }, 60_000)

    test('a binding handed to something the build cannot follow', async () => {
      const end = await run(
        `import { css } from 'styled-system/css'
const apply = (fn, v) => fn(v)
export const f = (p) => apply(css, p)
`,
        'src/strict-indirect.tsx',
      )

      expect(end).toThrow(/runtime-binding/)
    }, 60_000)

    /** Compiler-added helpers must not be mistaken for retained styling bindings. */
    test('is not reported for the helpers the fold itself adds', async () => {
      const end = await run(
        `import { css } from 'styled-system/css'
export const f = (p) => css({ color: 'red.300' }, p)
`,
        'src/strict-helpers.tsx',
      )

      // The call is still dynamic. What must not appear is a second complaint about a
      // compiler helper.
      expect(end).toThrow(/dynamic/)
      expect(end).not.toThrow(/runtime-binding/)
    }, 60_000)
  })

  /**
   * The module the fold threw on — the blind spot the ledger cannot see by construction.
   *
   * A throw in `transform` was caught, logged, and returned `null`, so the module contributed
   * to neither the folded column nor the skipped one and the survivor check saw a file that did
   * not exist. That is the same silence this option was added to close, one level up: a build
   * whose whole point is "nothing still calls `css()`" cannot make that claim about a module
   * nobody checked. A retired token spelling inside a `cva` is what reaches it — a recipe's
   * styles are resolved while the file is parsed, so the throw lands inside the fold.
   */
  describe('a module the fold threw on', () => {
    const BROKEN =
      `import { cva } from 'styled-system/css'\n` +
      `export const t = cva({ base: { boxShadow: '0 0 0 2px {colors.red.300/35}' } })\n`

    test('counts as a survivor rather than as nothing', async () => {
      const end = await run(BROKEN, 'src/strict-threw.tsx')

      expect(end).toThrow(/could not be compiled/)
      expect(end).toThrow(/compile-failed/)
      expect(end).toThrow(/strict-threw\.tsx/)
    }, 60_000)

    /** The advice for a declined call site does not apply, so the message says where to look. */
    test('points at the error that was logged for it', async () => {
      const end = await run(BROKEN, 'src/strict-threw-why.tsx')

      expect(end).toThrow(/see the error logged for it above/)
    }, 60_000)
  })
})

/**
 * A `token()` call inside a recipe config is not folded, and the diagnostic does not say so.
 *
 * The same expression inside `css()` compiles to the variable reference. Inside `cva`/`sva` it
 * leaves the recipe config unresolved, so the declaration is never erased, so the `cva` import
 * is still read at runtime — and what the user is shown is `cva — runtime-binding` at the
 * declaration, with advice about aliases, `.raw()` and re-exports, none of which they wrote.
 *
 * Pinned rather than fixed here, because three installation guides now send people to the
 * compiler and this is the trap they will hit; the string form `'token(colors.x)'` compiles and
 * is what the docs point at. If the fold learns to resolve a `token()` call in a recipe config,
 * this test is the one to delete.
 */
describe('token() inside a recipe config', () => {
  const withToken = (body: string) =>
    `import { cva } from 'styled-system/css'\nimport { token } from 'styled-system/tokens'\n${body}\n`

  test('is not compiled, and reports the recipe rather than the call', async () => {
    const end = await run(
      withToken(`const badge = cva({ base: { color: token('colors.red.300') } })\nexport const cls = badge()`),
      'src/strict-recipe-token.tsx',
    )

    expect(end).toThrow(/could not be compiled/)
    expect(end).toThrow(/cva — runtime-binding/)
  }, 60_000)

  test('the string form compiles, which is what the docs recommend', async () => {
    const end = await run(
      withToken(`const badge = cva({ base: { color: 'token(colors.red.300)' } })\nexport const cls = badge()`),
      'src/strict-recipe-token-string.tsx',
    )

    expect(end).not.toThrow()
  }, 60_000)
})
