import { createContext } from '@bamboocss/fixture'
import { describe, expect, test, vi } from 'vitest'
import type { ImportResult } from '../src/file-matcher'

/**
 * `FileMatcher` is built once per parsed file, and its constructor is the per-file floor
 * of extraction. The expensive part is `createMatch`, which filters every import in the
 * file — so what matters is not how long one takes but how many are built.
 *
 * Counting rather than timing, for the reason this repo keeps benchmarks out of CI: a
 * wall-clock reading cannot tell a regression from a busy machine, and one added pass over
 * every import of every file is exactly the size of cost that hides inside that noise.
 * This runs in CI.
 *
 * `createMatch` ends in `memo`, and so does every memoized method, so counting `memo`
 * counts both — the budgets below are stated as a breakdown rather than a bare number so
 * that a change to either is a deliberate edit rather than a bumped constant.
 */
const memoCalls = vi.hoisted(() => ({ count: 0 }))

vi.mock('@bamboocss/shared', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@bamboocss/shared')>()
  return {
    ...actual,
    memo: (fn: (...args: never[]) => unknown) => {
      memoCalls.count++
      return actual.memo(fn as never)
    },
  }
})

const cssImport = (name: string, alias = name): ImportResult => ({
  name,
  alias,
  mod: '../styled-system/css',
  kind: 'named',
})

/** Memoized instance methods, built once per file whatever the imports are. */
const MEMOIZED_METHODS = 6
/**
 * Matchers built while assigning aliases: the css barrel and tokens eagerly, plus recipes
 * and patterns, which are lazy but which the alias loop always reaches on its first
 * import. `viewTransition` deliberately adds none of these.
 */
const MATCHERS_ON_CONSTRUCT = 4

const count = async (imports: ImportResult[], run?: (file: any) => void) => {
  const { FileMatcher } = await import('../src/file-matcher')
  const ctx = createContext()

  memoCalls.count = 0
  const file = new FileMatcher(ctx as never, { importMap: ctx.imports.value, value: imports })
  const onConstruct = memoCalls.count

  memoCalls.count = 0
  run?.(file)

  return { onConstruct, onRun: memoCalls.count }
}

describe('file matcher per-file cost', () => {
  /**
   * `viewTransition` rides the matcher the css barrel already builds rather than adding
   * one of its own. A second `createMatch` over the same entrypoint would be one extra
   * pass over every import of every file, for a feature most files never use.
   */
  test('the css barrel costs one matcher, whatever it exports', async () => {
    const { onConstruct } = await count([cssImport('css'), cssImport('viewTransition')])

    expect(onConstruct).toBe(MEMOIZED_METHODS + MATCHERS_ON_CONSTRUCT)
  })

  /**
   * Dispatch is scoped to the css module, which costs a matcher of its own — so it is
   * built lazily, and a file that never calls `viewTransition` never pays for it.
   */
  test('the viewTransition dispatch matcher is not built for a file that does not use it', async () => {
    const { onRun } = await count([cssImport('css')], (file) => file.matchFn('css'))

    expect(onRun).toBe(0)
  })

  test('and is built at most once for a file that does', async () => {
    const { onRun } = await count([cssImport('viewTransition')], (file) => {
      file.isViewTransitionFn('viewTransition')
      file.isViewTransitionFn('viewTransition')
      file.isViewTransitionFn('somethingElse')
    })

    expect(onRun).toBe(1)
  })
})
