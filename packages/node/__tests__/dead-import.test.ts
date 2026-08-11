import { createContext } from '@bamboocss/fixture'
import { describe, expect, test } from 'vitest'
import type { BambooContext } from '../src/create-context'

/**
 * A call to a binding the pattern or recipe entrypoint no longer exports has to fail the build.
 *
 * Both entrypoints are generated from the config, so what they export moves when it does. The
 * import survives that as a binding to nothing: `matchFn` declines every call of it, the
 * extractor records nothing, and the class the component asks for has no rule behind it. That
 * is the outcome `assertExtracted` already fails on, arrived at from the other direction — and
 * left alone it is invisible, because the build still prints its ticks and exits 0. One removed
 * pattern took eleven selectors out of a release that way, found only by diffing selector sets.
 *
 * Gated on the *call* rather than the import throughout, which is what the type cases below are
 * about: both entrypoints export types beside their functions, and neither is a pattern or a
 * recipe.
 */
const withFile = (path: string, code: string) => {
  const ctx = createContext() as unknown as BambooContext
  const files: string[] = []

  const add = (at: string, source: string) => {
    const file = abs(ctx, at)
    const existing = ctx.project.getSourceFile(file)
    if (existing) existing.replaceWithText(source)
    else ctx.project.addSourceFile(file, source)
    if (!files.includes(file)) files.push(file)
  }

  // The fixture globs an empty `include`, and both asserts drop a finding for a file no longer
  // in scope — so without this every case would pass against a context holding no files at all.
  ctx.getFiles = () => files

  add(path, code)
  return { ctx, add, files }
}

const abs = (ctx: BambooContext, path: string) => ctx.runtime.path.abs(ctx.config.cwd, path)

describe('a call to a binding that does not exist', () => {
  test('fails the build, naming the file, the binding and the entrypoint', () => {
    const { ctx } = withFile(
      'src/modal.tsx',
      `
      import { stack } from 'styled-system/patterns'
      export const Modal = () => <div className={stack({ gap: '8' })} />
      `,
    )

    ctx.parseFile('src/modal.tsx')

    expect(() => ctx.assertNoDeadCalls()).toThrowError(/`stack` is not a pattern/)
    expect(() => ctx.assertNoDeadCalls()).toThrowError(/src\/modal\.tsx/)
    expect(() => ctx.assertNoDeadCalls()).toThrowError(/styled-system\/patterns/)
  })

  test('covers the recipe entrypoint too', () => {
    const { ctx } = withFile(
      'src/old.tsx',
      `
      import { oldButton } from 'styled-system/recipes'
      export const B = () => <button className={oldButton({ size: 'sm' })} />
      `,
    )

    ctx.parseFile('src/old.tsx')
    expect(() => ctx.assertNoDeadCalls()).toThrowError(/`oldButton` is not a recipe/)
  })

  test('names the imported binding when the call site renamed it', () => {
    const { ctx } = withFile(
      'src/aliased.tsx',
      `
      import { stack as row } from 'styled-system/patterns'
      export const R = () => <div className={row({ gap: '2' })} />
      `,
    )

    ctx.parseFile('src/aliased.tsx')
    // The imported name is what the entrypoint would have to export, and what a changelog is
    // searched for; the local name is what the reader has to find in the file.
    expect(() => ctx.assertNoDeadCalls()).toThrowError(/`stack` \(called as `row`\)/)
  })

  test('reports every file in one pass rather than the first', () => {
    const { ctx, add } = withFile(
      'src/a.tsx',
      `
      import { stack } from 'styled-system/patterns'
      export const A = () => <div className={stack({})} />
      `,
    )
    add(
      'src/b.tsx',
      `
      import { wrap } from 'styled-system/patterns'
      export const B = () => <div className={wrap({})} />
      `,
    )

    ctx.parseFile('src/a.tsx')
    ctx.parseFile('src/b.tsx')

    const error = (() => {
      try {
        ctx.assertNoDeadCalls()
      } catch (e) {
        return e as Error
      }
    })()

    expect(error?.message).toMatch(/src\/a\.tsx/)
    expect(error?.message).toMatch(/src\/b\.tsx/)
    expect(error?.message).toMatch(/^2 call\(s\)/)
  })

  /**
   * A binding dropped from a preset is called everywhere at once, so the useful unit of the
   * report is the binding rather than the file. Listed per file it was one sentence repeated
   * per call site — 400 files produced 1,221 lines of stderr carrying one line of information,
   * with the paragraph explaining the failure scrolled off the top.
   */
  test('groups by the binding, not by the file', () => {
    const { ctx, add } = withFile(
      'src/a.tsx',
      `
      import { stack } from 'styled-system/patterns'
      export const A = () => <div className={stack({})} />
      `,
    )
    for (const name of ['b', 'c', 'd', 'e', 'f', 'g']) {
      add(
        `src/${name}.tsx`,
        `
        import { stack } from 'styled-system/patterns'
        export const X = () => <div className={stack({})} />
        `,
      )
    }
    for (const file of ctx.getFiles()) ctx.parseFile(file)

    const message = (() => {
      try {
        ctx.assertNoDeadCalls()
      } catch (e) {
        return (e as Error).message
      }
      return ''
    })()

    // One sentence for the binding, once — not seven.
    expect(message.match(/is not a pattern/g)).toHaveLength(1)
    expect(message).toMatch(/^7 call\(s\)/)
    expect(message).toMatch(/7 file\(s\):/)
    // The first few named, the rest counted, so the list cannot outgrow the advice under it.
    expect(message).toMatch(/… and 2 more/)
    expect(message).toMatch(/absent from the stylesheet/)
  })

  test('two distinct bindings stay two findings', () => {
    // The other side of the grouping: `stack` and `wrap` are two things to fix, and collapsing
    // them because they share an entrypoint would hide one of them.
    const { ctx, add } = withFile(
      'src/a.tsx',
      `
      import { stack } from 'styled-system/patterns'
      export const A = () => <div className={stack({})} />
      `,
    )
    add(
      'src/b.tsx',
      `
      import { wrap } from 'styled-system/patterns'
      export const B = () => <div className={wrap({})} />
      `,
    )

    ctx.parseFile('src/a.tsx')
    ctx.parseFile('src/b.tsx')

    const message = (() => {
      try {
        ctx.assertNoDeadCalls()
      } catch (e) {
        return (e as Error).message
      }
      return ''
    })()

    expect(message.match(/is not a pattern/g)).toHaveLength(2)
    expect(message).toMatch(/`stack`/)
    expect(message).toMatch(/`wrap`/)
  })

  test('a live pattern is untouched', () => {
    const { ctx } = withFile(
      'src/ok.tsx',
      `
      import { flex } from 'styled-system/patterns'
      export const A = () => <div className={flex({ gap: '8' })} />
      `,
    )

    ctx.parseFile('src/ok.tsx')
    expect(() => ctx.assertNoDeadCalls()).not.toThrow()
  })
})

describe('what it must not report', () => {
  /**
   * The reason the check is gated on a call at all. `styled-system/patterns` exports
   * `FlexProperties` beside `flex`, and `styled-system/recipes` exports `ButtonVariantProps`
   * beside `button` — neither is a pattern or a recipe, so an import-only test reports every
   * file that types a prop.
   */
  test('a type imported from the same entrypoint', () => {
    const { ctx } = withFile(
      'src/typed.tsx',
      `
      import { flex, type FlexProperties } from 'styled-system/patterns'
      export const A = (props: FlexProperties) => <div className={flex(props)} />
      `,
    )

    ctx.parseFile('src/typed.tsx')
    expect(() => ctx.assertNoDeadCalls()).not.toThrow()
  })

  /**
   * TypeScript lets a type be imported without the `type` keyword, and it is elided at emit
   * either way — so the keyword is not a filter the check can rely on. Being called is.
   */
  test('a type imported without the `type` keyword', () => {
    const { ctx } = withFile(
      'src/untyped.tsx',
      `
      import { flex, FlexProperties } from 'styled-system/patterns'
      export type Props = FlexProperties
      export const A = () => <div className={flex({})} />
      `,
    )

    ctx.parseFile('src/untyped.tsx')
    expect(() => ctx.assertNoDeadCalls()).not.toThrow()
  })

  test('a binding nobody calls', () => {
    const { ctx } = withFile(
      'src/unused.tsx',
      `
      import { stack } from 'styled-system/patterns'
      export const name = typeof stack
      `,
    )

    ctx.parseFile('src/unused.tsx')
    // No call, so nothing asked for a class and no rule is missing. Unused-import lint is a
    // different tool's job, and reporting it here would fail builds over dead code.
    expect(() => ctx.assertNoDeadCalls()).not.toThrow()
  })

  test('a same-named helper from somewhere else', () => {
    const { ctx } = withFile(
      'src/other.tsx',
      `
      import { stack } from './my-layout'
      export const A = () => <div className={stack({ gap: '8' })} />
      `,
    )

    ctx.parseFile('src/other.tsx')
    expect(() => ctx.assertNoDeadCalls()).not.toThrow()
  })
})

describe('across rebuilds', () => {
  /**
   * The lifecycle `assertExtracted` documents, for the same reasons. A context outlives
   * rebuilds, so a finding has to survive a pass that skipped its file — or a no-op rebuild
   * launders a broken build into a green one — and has to be dropped once the file is fixed,
   * or the fix can never take and the dev server stays wedged until it is restarted.
   */
  test('survives a pass that did not re-parse the file', () => {
    const { ctx } = withFile(
      'src/modal.tsx',
      `
      import { stack } from 'styled-system/patterns'
      export const M = () => <div className={stack({})} />
      `,
    )

    ctx.parseFile('src/modal.tsx')
    expect(() => ctx.assertNoDeadCalls()).toThrow()

    // Nothing re-parsed, exactly as an incremental pass over unchanged source would do.
    expect(() => ctx.assertNoDeadCalls()).toThrow()
  })

  test('clears once the call is fixed', () => {
    const { ctx, add } = withFile(
      'src/modal.tsx',
      `
      import { stack } from 'styled-system/patterns'
      export const M = () => <div className={stack({ gap: '8' })} />
      `,
    )

    ctx.parseFile('src/modal.tsx')
    expect(() => ctx.assertNoDeadCalls()).toThrow()

    add(
      'src/modal.tsx',
      `
      import { flex } from 'styled-system/patterns'
      export const M = () => <div className={flex({ direction: 'column', gap: '8' })} />
      `,
    )
    ctx.parseFile('src/modal.tsx')

    expect(() => ctx.assertNoDeadCalls()).not.toThrow()
  })

  test('clears once the file leaves scope', () => {
    const { ctx, files } = withFile(
      'src/modal.tsx',
      `
      import { stack } from 'styled-system/patterns'
      export const M = () => <div className={stack({})} />
      `,
    )

    ctx.parseFile('src/modal.tsx')
    expect(() => ctx.assertNoDeadCalls()).toThrow()

    // Deleted, or taken out of `include`. Both are fixes, and an entry naming a path that no
    // longer exists would fail every later build.
    files.length = 0
    expect(() => ctx.assertNoDeadCalls()).not.toThrow()
  })
})
