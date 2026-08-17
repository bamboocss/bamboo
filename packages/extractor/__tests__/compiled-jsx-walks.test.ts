import { Node, Project } from 'ts-morph'
import { describe, expect, test } from 'vitest'
import { createCompiledJsxContext } from '../src/compiled-jsx'

/**
 * How many times building the compiled-jsx context reads a module's whole AST.
 *
 * Two of its walks hunt for *bundler output* — Parcel's module registry, and Vue/Solid/Preact
 * runtime helpers a bundler inlined — and `extract` builds this context for every module it
 * processes. Hand-written source matches neither, so on an ordinary component both walks read the
 * entire tree, wrap every call and every function declaration in it, and find nothing.
 *
 * Counted rather than timed: wall-clock is machine-dependent and excluded from CI, while a
 * reintroduced walk is a number that fails anywhere. `extract.test.ts` holds the other half of
 * this — 158 fixtures of real bundler output across react, preact, vue and solid — so a guard that
 * skipped too much fails there rather than here.
 */
const project = new Project({ useInMemoryFileSystem: true, compilerOptions: { jsx: 2 } })

let counter = 0
const walksFor = (code: string) => {
  const sourceFile = project.createSourceFile(`walks-${counter++}.tsx`, code, { overwrite: true })

  let walks = 0
  const proto = Node.prototype as unknown as Record<string, (...args: never[]) => unknown>
  const original = proto.getDescendantsOfKind

  proto.getDescendantsOfKind = function patched(...args: never[]) {
    walks++
    return original.apply(this, args)
  }

  try {
    createCompiledJsxContext(sourceFile)
    return walks
  } finally {
    proto.getDescendantsOfKind = original
  }
}

/** What a person writes. Neither walk can match it. */
const HAND_WRITTEN = `
import { css } from 'styled-system/css'

export const Card = ({ tone, children }) => (
  <div className={css({ color: tone, padding: '4' })}>
    <span className={css({ fontWeight: 'bold' })}>{children}</span>
  </div>
)

export function helper(a, b) {
  return { ...a, ...b }
}
`

/** The shape the second walk exists for: Solid's `mergeProps`, inlined by a bundler. */
const BUNDLED_SOLID = `
function mergeProps(...sources) {
  const resolveSource = (s) => typeof s === 'function' ? s() : s
  return new Proxy({}, { get(_, k) { for (let i = sources.length - 1; i >= 0; i--) {} } })
}
export { mergeProps }
`

/** The shape the first walk exists for. */
const BUNDLED_PARCEL = `
parcelRegister("abc12", function(module, exports) {
  module.exports = { "Fragment": 1, "jsx": 2, "jsxs": 3 }
})
`

describe('the compiled-jsx context reads a module only when it could be bundler output', () => {
  test('hand-written source is not walked at all', () => {
    expect(walksFor(HAND_WRITTEN)).toBe(0)
  })

  test.each([
    ['inlined solid helper', BUNDLED_SOLID],
    ['parcel registry', BUNDLED_PARCEL],
  ])('%s is still walked', (_label, code) => {
    expect(walksFor(code)).toBeGreaterThan(0)
  })

  /**
   * The Parcel callee is compared through `getText()`, which resolves an identifier as the compiler
   * reads it — so the plain name appears nowhere in this source and the walk still matches it. The
   * guard has to let an escape through for the same reason `fold.ts` does.
   */
  test('an escaped `parcelRegister` is still walked', () => {
    expect(walksFor(`\\u0070arcelRegister("a", function (module, exports) { module.exports = {} })`)).toBeGreaterThan(0)
  })
})
