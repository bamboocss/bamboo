import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createContext } from '@bamboocss/fixture'
import { Node } from 'ts-morph'
import { describe, expect, test } from 'vitest'
import { foldSource } from '../src/fold'
import { createRuntimeCss } from '../src/runtime-css'
import { createStaticStyleSetCompiler } from '../src/style-set'

/**
 * How many times the fold reads a module's whole AST.
 *
 * `fold.bench.ts` reports what a module costs in wall-clock, which is machine-dependent and
 * excluded from CI for exactly that reason. This counts the work instead, which is not — and the
 * work is what dominates: profiling a dev server over 24 real edits put ts-morph at 87ms per edit
 * against 2.4ms of extraction, with half the ts-morph time inside descendant iterators.
 *
 * Every `getDescendantsOfKind` and every `forEachDescendant` visits each node in the file, so
 * these counts are "how many times did we read the whole tree". The property worth holding is
 * that the number tracks the questions a module actually *answers*, not the questions it could
 * have been asked: a module with no `cx`, no `splitVariantProps` and no runtime binding should
 * not be walked for any of them.
 *
 * A count is not a stopwatch, and the two do not scale together: the pair of walks merged below
 * traded two cheap kind-filtered iterations for one `forEachDescendant`, which wraps every node
 * it visits rather than only matches, and measures ~0.8x on a cold parse rather than the 0.67x
 * a 3-to-2 count implies. What the count buys is a floor that CI can hold without a stopwatch —
 * a walk reintroduced here fails, whatever the machine is doing. `fold.bench.ts` still owns the
 * question of whether a change is faster.
 *
 * Pinned as exact numbers rather than bounds. A bound drifts upward one walk at a time with
 * nothing failing, which is how these accumulated: before the guards below, every styled module
 * paid two whole-tree reads and every reported one paid five, whatever it contained.
 *
 * What this cannot see is a walk over raw compiler nodes — `identifierIndex` is one, deliberately,
 * and costs about a hundredth of a wrapped walk. So a zero here means "nothing wraps the tree",
 * not "nothing reads it". That is the right thing to hold: wrapping is the cost.
 */
const here = dirname(fileURLToPath(import.meta.url))

const ctx = createContext()
const runtimeCss = createRuntimeCss(ctx)
const styleCompiler = createStaticStyleSetCompiler(ctx, runtimeCss)

let counter = 0

/** Counts full-tree reads across one fold, whichever API performs them. */
const foldWithCount = (code: string, extra: Record<string, unknown> = {}) => {
  const filePath = `app/src/traversal-${counter++}.tsx`
  ctx.project.addSourceFile(filePath, code)
  const parserResult = ctx.project.parseSourceFile(filePath)
  if (!parserResult) throw new Error('fixture did not parse')

  let walks = 0
  // `Node.prototype`, not `SourceFile.prototype`: both methods are own properties of `Node`, so
  // patching the subclass installs a shadow that counts only walks whose receiver is the source
  // file. Every walk on this path happens to have one today, which is exactly why patching the
  // subclass would pass while a regression walking from any inner node went uncounted.
  const proto = Node.prototype as unknown as Record<string, (...args: never[]) => unknown>
  const originals = { getDescendantsOfKind: proto.getDescendantsOfKind, forEachDescendant: proto.forEachDescendant }

  proto.getDescendantsOfKind = function patched(...args: never[]) {
    walks++
    return originals.getDescendantsOfKind.apply(this, args)
  }
  proto.forEachDescendant = function patched(...args: never[]) {
    walks++
    return originals.forEachDescendant.apply(this, args)
  }

  try {
    // `sourceFile` because `plugin.ts` always passes it, and it is the only thing that reaches
    // `reportRuntimeBindings` on the no-candidate path — the shape survivor reporting exists for.
    const result = foldSource({
      ctx,
      code,
      parserResult,
      filePath,
      runtimeCss,
      styleCompiler,
      sourceFile: ctx.project.getSourceFile(filePath),
      ...extra,
    } as never)
    return { walks, result }
  } finally {
    proto.getDescendantsOfKind = originals.getDescendantsOfKind
    proto.forEachDescendant = originals.forEachDescendant
  }
}

/** The common shape: styles, no `cx`, no `splitVariantProps`, no runtime binding. */
const PLAIN = `
import { css } from 'styled-system/css'

export const a = css({ color: 'red.300', padding: '4' })
export const View = () => <div className={css({ display: 'flex' })}>x</div>
`

/** The same module, plus the one import that gives the `cx` walk something to match. */
const WITH_CX = `
import { css, cx } from 'styled-system/css'

export const a = css({ color: 'red.300', padding: '4' })
export const View = () => <div className={cx(css({ display: 'flex' }), 'extra')}>x</div>
`

/** A module the sandbox actually ships, rather than one written to be walked. */
const SANDBOX = (() => {
  try {
    return readFileSync(join(here, '../../../sandbox/vite-ts/src/App.tsx'), 'utf8')
  } catch {
    return null
  }
})()

describe('the fold reads a module as often as it has questions to answer', () => {
  test('a module answering none of them is not read at all', () => {
    expect(foldWithCount(PLAIN).walks).toBe(0)
  })

  test('importing `cx` buys exactly the `cx` walk', () => {
    expect(foldWithCount(WITH_CX).walks).toBe(1)
  })

  /**
   * Survivor reporting adds the runtime-binding scan, and that is now the whole of it: the call
   * and import-equals shapes share one traversal, and the identifier index no longer appears here
   * at all because it walks compiler nodes directly and wraps only the buckets it is asked for.
   * HEAD paid five reads for both of these shapes.
   */
  test('reporting survivors adds the binding scan, and nothing else', () => {
    expect(foldWithCount(PLAIN, { reportSurvivors: true }).walks).toBe(1)
    expect(foldWithCount(WITH_CX, { reportSurvivors: true }).walks).toBe(2)
  })

  /**
   * A module with no candidates at all, which is the shape survivor reporting exists to catch.
   * It reaches `reportRuntimeBindings` only through the `sourceFile` the plugin always passes, so
   * this is the one case that covers the merged traversal on that branch.
   */
  test('a module holding only a runtime binding is read once, and reports it', () => {
    const { walks, result } = foldWithCount(
      `const { css } = require('styled-system/css')\nexport const a = css({})\n`,
      {
        reportSurvivors: true,
      },
    )

    expect(walks).toBe(1)
    expect(result?.skipped?.some((entry: { reason: string }) => entry.reason === 'runtime-binding')).toBe(true)
  })

  /**
   * The guard on that walk reads text while the loop reads `access.getName()`, which resolves
   * unicode escapes — so a name spelled `splitVariantProps` matches the loop and appears
   * nowhere in the source. Guarding on the literal alone left this call unlowered against an
   * erased binding, which a review caught and this pins.
   */
  test('an escaped `splitVariantProps` is still lowered', () => {
    const escaped = [
      `import { cva } from 'styled-system/css'`,
      `const badge = cva({ base: { display: 'flex' }, variants: { tone: { info: { color: 'blue.500' } } } })`,
      `export const B = (p) => { const [v, r] = badge.\\u0073plitVariantProps(p); return [badge(v), r] }`,
    ].join('\n')

    const { result } = foldWithCount(escaped)

    expect(result?.code).toContain('splitProps')
    expect(result?.code).not.toContain('\\u0073plitVariantProps')
  })

  /**
   * `sandbox/vite-ts/src/App.tsx` imports `cx`, so it earns that one walk and no others. Asserted
   * rather than skipped when missing: a `runIf` that silently stops running is the same as not
   * having written it.
   */
  test('a real sandbox module is read once, for the `cx` it uses', () => {
    expect(SANDBOX, 'sandbox/vite-ts/src/App.tsx moved — repoint this fixture').not.toBeNull()
    expect(foldWithCount(SANDBOX!).walks).toBe(1)
  })

  /** The guards must change how often the tree is read, and nothing else. */
  test('folding is unchanged by how often the tree is read', () => {
    const plain = foldWithCount(PLAIN)
    const withCx = foldWithCount(WITH_CX)

    expect(plain.result?.code).not.toContain('css({')
    expect(withCx.result?.code).toContain('extra')
    expect(withCx.result?.code).not.toContain('css({')
  })
})
