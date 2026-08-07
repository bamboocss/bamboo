import { Identifier } from 'ts-morph'
import { afterEach, expect, test, vi } from 'vitest'
import { createProject, getTestExtract } from './create-project'

/**
 * Extraction must not issue a language-service query.
 *
 * `getDefinitions` and its neighbours go through `synchronizeHostData`, which builds a
 * full `ts.Program`: every import resolved transitively, every reachable `.d.ts` parsed
 * and bound. That cost scales with the dependency graph rather than the user's source,
 * and inside a bundler it is paid in the same heap as the module graph — one such call
 * on the extraction path turned a 3s build into 24s and then an OOM.
 *
 * Counted rather than timed, because the harness below has no dependency graph for a
 * program to walk: the call is nearly free here and ruinous in a real project, so a
 * wall-clock assertion would report green on exactly the regression it exists to catch.
 */
const spy = vi.spyOn(Identifier.prototype, 'getDefinitions')

afterEach(() => {
  spy.mockClear()
})

const project = createProject()

const extract = (code: string) =>
  getTestExtract(project, code, { functionNameList: ['css'], tagNameList: ['ColorBox'] })

test('a callee declared in the same file resolves without one', () => {
  extract(`
    const css = (styles: Record<string, string>) => styles
    export const cls = css({ color: 'red.300' })
  `)

  expect(spy).not.toHaveBeenCalled()
})

test('a callee aliased through another local declaration resolves without one', () => {
  extract(`
    import { jsx } from 'react/jsx-runtime'
    const _jsx = jsx
    const alias = _jsx
    export const el = alias('div', { color: 'blue.300' })
  `)

  expect(spy).not.toHaveBeenCalled()
})

test('an unresolvable callee gives up without one', () => {
  extract(`
    export const el = someGlobalNobodyDeclared('div', { color: 'green.300' })
  `)

  expect(spy).not.toHaveBeenCalled()
})

test('compiled jsx output still extracts, and still without one', () => {
  const result = extract(`
    import { jsx as _jsx } from 'react/jsx-runtime'
    export const App = () => _jsx(ColorBox, { css: { color: 'red.200' } })
  `)

  expect(spy).not.toHaveBeenCalled()
  expect(result.has('ColorBox')).toBe(true)
})

test('a bundled runtime helper declared in the file still extracts, and still without one', () => {
  const result = extract(`
    const createComponent = (Comp, props) => untrack(() => Comp(props || {}))
    export const App = () => createComponent(ColorBox, { css: { color: 'red.200' } })
  `)

  expect(spy).not.toHaveBeenCalled()
  expect(result.has('ColorBox')).toBe(true)
})
