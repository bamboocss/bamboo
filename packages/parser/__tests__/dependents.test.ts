import { createContext } from '@bamboocss/fixture'
import { describe, expect, test } from 'vitest'

const CSS_IMPORT = `import { css } from '../../styled-system/css'`

function seed(files: Record<string, string>) {
  const ctx = createContext({})
  for (const [path, code] of Object.entries(files)) ctx.project.addSourceFile(path, code)
  // The graph is built while parsing, which is what a watcher does on startup.
  for (const path of Object.keys(files)) ctx.project.parseSourceFile(path)
  return ctx
}

const basename = (paths: string[]) => paths.map((p) => p.split('/').pop()).sort()

describe('reverse dependency graph', () => {
  test('reports the files importing an edited style file', () => {
    const ctx = seed({
      'app/src/styles.ts': `${CSS_IMPORT}
       export const button = css.raw({ color: 'red.500' })`,
      'app/src/a.tsx': `${CSS_IMPORT}
       import { button } from './styles'
       export const A = () => <div className={css(button)} />`,
      'app/src/b.tsx': `${CSS_IMPORT}
       import { button } from './styles'
       export const B = () => <div className={css(button)} />`,
      'app/src/unrelated.tsx': `${CSS_IMPORT}
       export const C = () => <div className={css({ margin: '2' })} />`,
    })

    expect(basename(ctx.project.getDependents('app/src/styles.ts'))).toEqual(['a.tsx', 'b.tsx'])
  })

  test('follows transitive imports', () => {
    const ctx = seed({
      'app/src/tokens.ts': `export const base = { color: 'red.500' }`,
      'app/src/styles.ts': `export { base } from './tokens'`,
      'app/src/app.tsx': `${CSS_IMPORT}
       import { base } from './styles'
       export const App = () => <div className={css(base)} />`,
    })

    expect(basename(ctx.project.getDependents('app/src/tokens.ts'))).toEqual(['app.tsx', 'styles.ts'])
  })

  test('a file with no importers has no dependents', () => {
    const ctx = seed({
      'app/src/app.tsx': `${CSS_IMPORT}
       export const App = () => <div className={css({ margin: '2' })} />`,
    })

    expect(ctx.project.getDependents('app/src/app.tsx')).toEqual([])
  })

  test('a removed import stops forcing a rebuild', () => {
    const ctx = seed({
      'app/src/styles.ts': `export const base = { color: 'red.500' }`,
      'app/src/app.tsx': `${CSS_IMPORT}
       import { base } from './styles'
       export const App = () => <div className={css(base)} />`,
    })
    expect(basename(ctx.project.getDependents('app/src/styles.ts'))).toEqual(['app.tsx'])

    // Edit app.tsx to drop the import, as a watcher would then re-parse it.
    ctx.project.addSourceFile(
      'app/src/app.tsx',
      `${CSS_IMPORT}
       export const App = () => <div className={css({ margin: '2' })} />`,
    )
    ctx.project.parseSourceFile('app/src/app.tsx')

    expect(ctx.project.getDependents('app/src/styles.ts')).toEqual([])
  })

  test('a cyclic import graph terminates', () => {
    const ctx = seed({
      'app/src/a.ts': `import { b } from './b'
       export const a = { ...b }`,
      'app/src/b.ts': `import { a } from './a'
       export const b = { ...a }`,
    })

    expect(() => ctx.project.getDependents('app/src/a.ts')).not.toThrow()
    expect(basename(ctx.project.getDependents('app/src/a.ts'))).toEqual(['b.ts'])
  })
})
