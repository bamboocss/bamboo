import { createContext } from '@bamboocss/fixture'
import { describe, expect, test } from 'vitest'

const CSS_IMPORT = `import { css } from '../../styled-system/css'`

/**
 * Exercises the contract watch mode depends on: after a shared style file is
 * edited, re-parsing the changed file *and the files `getDependents` reports* must
 * produce consumers' CSS from the new values.
 *
 * This drives the same sequence `generate.ts` runs on a `change` event, without
 * standing up a real file watcher.
 */
function createProject(files: Record<string, string>) {
  const ctx = createContext({})
  for (const [path, code] of Object.entries(files)) ctx.project.addSourceFile(path, code)
  for (const path of Object.keys(files)) ctx.project.parseSourceFile(path)
  return ctx
}

/** Collects the style objects a file currently extracts. */
const stylesOf = (ctx: any, path: string) =>
  [...(ctx.project.parseSourceFile(path)?.css ?? [])].flatMap((c: any) => c.data)

/** What a watcher does for one `change` event. */
function onChange(ctx: any, path: string, nextContent: string) {
  ctx.project.addSourceFile(path, nextContent)
  const touched = [path, ...ctx.project.getDependents(path)]
  return touched.map((file) => ({ file, styles: stylesOf(ctx, file) }))
}

describe('watch invalidation', () => {
  test('editing a shared style file regenerates CSS in its consumers', () => {
    const ctx = createProject({
      'app/src/styles.ts': `${CSS_IMPORT}
       export const button = css.raw({ color: 'red.500' })`,
      'app/src/app.tsx': `${CSS_IMPORT}
       import { button } from './styles'
       export const App = () => <div className={css(button, { margin: '2' })} />`,
    })

    expect(stylesOf(ctx, 'app/src/app.tsx')).toEqual([{ color: 'red.500' }, { margin: '2' }])

    const rebuilt = onChange(
      ctx,
      'app/src/styles.ts',
      `${CSS_IMPORT}
       export const button = css.raw({ color: 'blue.700', padding: '8' })`,
    )

    // The consumer must be in the rebuild set...
    expect(rebuilt.map((r) => r.file)).toContain(
      rebuilt.find((r) => r.file.endsWith('app.tsx'))?.file ?? 'app.tsx MISSING',
    )

    // ...and must now emit the edited values, not the originals.
    expect(stylesOf(ctx, 'app/src/app.tsx')).toEqual([{ color: 'blue.700', padding: '8' }, { margin: '2' }])
  })

  test('an edited declaration in the same file is not answered from the previous revision', () => {
    // The extractor indexes each scope's declaration names so it does not re-walk the scope
    // per identifier. That index is keyed on the compiler node rather than the ts-morph
    // wrapper, because a re-parse keeps the wrapper and swaps the compiler node underneath
    // it — a wrapper-keyed index would answer this rebuild with the previous revision's
    // declaration, which is a wrong stylesheet rather than a slow one.
    const ctx = createProject({
      'app/src/local.tsx': `${CSS_IMPORT}
       const shade = 'red.500'
       export const App = () => <div className={css({ color: shade, borderColor: shade })} />`,
    })

    expect(stylesOf(ctx, 'app/src/local.tsx')).toEqual([{ color: 'red.500', borderColor: 'red.500' }])

    onChange(
      ctx,
      'app/src/local.tsx',
      `${CSS_IMPORT}
       const shade = 'blue.700'
       export const App = () => <div className={css({ color: shade, borderColor: shade })} />`,
    )

    expect(stylesOf(ctx, 'app/src/local.tsx')).toEqual([{ color: 'blue.700', borderColor: 'blue.700' }])
  })

  test('regenerates through a re-export barrel', () => {
    const ctx = createProject({
      'app/src/tokens.ts': `export const base = { color: 'red.500' }`,
      'app/src/index.ts': `export { base } from './tokens'`,
      'app/src/app.tsx': `${CSS_IMPORT}
       import { base } from './index'
       export const App = () => <div className={css(base)} />`,
    })

    expect(stylesOf(ctx, 'app/src/app.tsx')).toEqual([{ color: 'red.500' }])

    const rebuilt = onChange(ctx, 'app/src/tokens.ts', `export const base = { color: 'green.300' }`)

    expect(rebuilt.some((r) => r.file.endsWith('app.tsx'))).toBe(true)
    expect(stylesOf(ctx, 'app/src/app.tsx')).toEqual([{ color: 'green.300' }])
  })

  test('an unrelated file is not dragged into the rebuild', () => {
    const ctx = createProject({
      'app/src/styles.ts': `export const base = { color: 'red.500' }`,
      'app/src/app.tsx': `${CSS_IMPORT}
       import { base } from './styles'
       export const App = () => <div className={css(base)} />`,
      'app/src/other.tsx': `${CSS_IMPORT}
       export const Other = () => <div className={css({ margin: '2' })} />`,
    })

    const rebuilt = onChange(ctx, 'app/src/styles.ts', `export const base = { color: 'blue.700' }`)

    expect(rebuilt.some((r) => r.file.endsWith('other.tsx'))).toBe(false)
  })

  test('consumers are still reachable at the moment a shared file is deleted', () => {
    const ctx = createProject({
      'app/src/styles.ts': `export const base = { color: 'red.500' }`,
      'app/src/app.tsx': `${CSS_IMPORT}
       import { base } from './styles'
       export const App = () => <div className={css(base)} />`,
    })

    const before = ctx.project.getDependents('app/src/styles.ts')
    expect(before.some((f: string) => f.endsWith('app.tsx'))).toBe(true)

    ctx.project.removeSourceFile('app/src/styles.ts')

    // Still answerable once the file is gone, so a caller that removes first is
    // not silently left with an empty rebuild set.
    const after = ctx.project.getDependents('app/src/styles.ts')
    expect(after.some((f: string) => f.endsWith('app.tsx'))).toBe(true)
    expect(() => stylesOf(ctx, 'app/src/app.tsx')).not.toThrow()

    // The import no longer resolves, so the deleted file's styles must stop being
    // emitted rather than being served from the value memoized before deletion.
    expect(stylesOf(ctx, 'app/src/app.tsx')).not.toContainEqual({ color: 'red.500' })
  })

  test('a file appearing satisfies an import that previously resolved to nothing', () => {
    const ctx = createProject({
      'app/src/app.tsx': `${CSS_IMPORT}
       import { base } from './styles'
       export const App = () => <div className={css(base, { margin: '2' })} />`,
    })

    // `./styles` does not exist yet, so only the inline half extracts.
    expect(stylesOf(ctx, 'app/src/app.tsx')).toEqual([{}, { margin: '2' }])

    // The watcher has no dependency edge to follow here — the specifier resolved to
    // nothing when app.tsx was parsed — so it must find the importer another way.
    expect(ctx.project.getUnresolvedImporters().some((f: string) => f.endsWith('app.tsx'))).toBe(true)

    ctx.project.addSourceFile('app/src/styles.ts', `export const base = { color: 'red.500' }`)

    const rebuildSet = [
      'app/src/styles.ts',
      ...ctx.project.getDependents('app/src/styles.ts'),
      ...ctx.project.getUnresolvedImporters(),
    ]
    expect(rebuildSet.some((f) => f.endsWith('app.tsx'))).toBe(true)

    for (const file of rebuildSet) ctx.project.parseSourceFile(file)
    expect(stylesOf(ctx, 'app/src/app.tsx')).toEqual([{ color: 'red.500' }, { margin: '2' }])
  })

  test('the Node add-event rebuild set reparses a consumer waiting on a paths alias', () => {
    const ctx = createContext({
      tsconfig: { compilerOptions: { baseUrl: '/', paths: { '~/*': ['app/src/*'] } } },
    } as never)
    const app = '/app/src/app.tsx'
    const styles = '/app/src/styles.ts'
    ctx.project.project
      .getFileSystem()
      .writeFileSync('/node_modules/styled-system/package.json', `{ "name": "styled-system" }`)
    ctx.project.project
      .getFileSystem()
      .writeFileSync('/node_modules/styled-system/css.d.ts', `export declare const css: (...args: any[]) => string`)
    ctx.project.addSourceFile(
      app,
      `import { css } from 'styled-system/css'
       import { base } from '~/styles'
       export const App = () => <div className={css(base, { margin: '2' })} />`,
    )

    expect(stylesOf(ctx, app)).toEqual([{}, { margin: '2' }])
    expect(ctx.project.getUnresolvedImporters()).toEqual([app])

    ctx.project.addSourceFile(styles, `export const base = { color: 'blue.500' }`)
    const rebuildSet = [styles, ...ctx.project.getDependents(styles), ...ctx.project.getUnresolvedImporters()]
    expect(rebuildSet).toContain(app)

    for (const file of rebuildSet) ctx.project.parseSourceFile(file)
    expect(stylesOf(ctx, app)).toEqual([{ color: 'blue.500' }, { margin: '2' }])
    expect(ctx.project.getUnresolvedImporters()).toEqual([])
  })

  test('the Node add-event rebuild set reparses a consumer whose paths fallback already resolved', () => {
    const ctx = createContext({
      tsconfig: {
        compilerOptions: {
          baseUrl: '/',
          paths: { '@styles': ['app/src/primary', 'app/src/fallback'] },
        },
      },
    } as never)
    const app = '/app/src/app.tsx'
    const primary = '/app/src/primary.ts'
    const fallback = '/app/src/fallback.ts'
    const unrelated = '/app/src/unrelated.ts'
    ctx.project.project
      .getFileSystem()
      .writeFileSync('/node_modules/styled-system/package.json', `{ "name": "styled-system" }`)
    ctx.project.project
      .getFileSystem()
      .writeFileSync('/node_modules/styled-system/css.d.ts', `export declare const css: (...args: any[]) => string`)
    ctx.project.project.getFileSystem().writeFileSync(fallback, `export const base = { color: 'blue.500' }`)
    ctx.project.addSourceFile(unrelated, `export const untouched = true`)
    ctx.project.parseSourceFile(unrelated)
    ctx.project.addSourceFile(
      app,
      `import { css } from 'styled-system/css'
       import { base } from '@styles'
       export const App = () => <div className={css(base)} />`,
    )

    expect(stylesOf(ctx, app)).toEqual([{ color: 'blue.500' }])
    expect(ctx.project.getResolutionLedger().find((fact) => fact.specifier === '@styles')?.target).toBe(fallback)

    ctx.project.addSourceFile(primary, `export const base = { color: 'blue.500' }`)
    const rebuildSet = [primary, ...ctx.project.getDependents(primary), ...ctx.project.getUnresolvedImporters()]
    expect(rebuildSet).toContain(app)
    expect(rebuildSet).not.toContain(unrelated)
    for (const file of rebuildSet) ctx.project.parseSourceFile(file)

    expect(ctx.project.getResolutionLedger().find((fact) => fact.specifier === '@styles')?.target).toBe(primary)
    expect(ctx.project.getUnresolvedImporters()).toEqual([])
  })

  test('an importer whose specifiers all resolve is not left pending', () => {
    const ctx = createProject({
      'app/src/styles.ts': `export const base = { color: 'red.500' }`,
      'app/src/app.tsx': `import { base } from './styles'
       export const value = base`,
    })

    expect(ctx.project.getUnresolvedImporters()).toEqual([])
  })
})

/**
 * A bundler adds every module before parsing it, handing back the text the extractor
 * already read off disk — so a re-add that changes nothing is the whole transform path,
 * once per module. What it must not do is behave like an edit.
 */
describe('re-adding a file the text it already holds', () => {
  test('keeps the file, so a node taken before the re-add is still readable', () => {
    const source = `export const base = { color: 'red.500' }`
    const ctx = createProject({ 'app/src/styles.ts': source })

    const before = ctx.project.getSourceFile('app/src/styles.ts')!
    const statement = before.getStatements()[0]!

    const after = ctx.project.addSourceFile('app/src/styles.ts', source)

    expect(after).toBe(before)
    // Overwriting forgets a file's whole tree, and callers hold its nodes across a build.
    expect(() => statement.getText()).not.toThrow()
  })

  test('a changed file is still overwritten, however small the change', () => {
    const ctx = createProject({
      'app/src/styles.ts': `${CSS_IMPORT}
       export const base = css.raw({ color: 'red.500' })`,
      'app/src/app.tsx': `${CSS_IMPORT}
       import { base } from './styles'
       export const App = () => <div className={css(base, { margin: '2' })} />`,
    })

    // Whitespace only: the comparison is textual, so this still has to invalidate. A
    // semantic one would be free to conclude nothing changed and serve the old value.
    ctx.project.addSourceFile(
      'app/src/styles.ts',
      `${CSS_IMPORT}
       export const base = css.raw({ color: 'blue.500' })
      `,
    )

    expect(stylesOf(ctx, 'app/src/app.tsx')).toEqual([{ color: 'blue.500' }, { margin: '2' }])
  })

  /**
   * Counted rather than timed, so it runs in CI.
   *
   * Resolving a specifier is what walking a barrel is made of, and the walk is memoized per
   * target precisely so a barrel imported by two hundred modules is walked once. It was not:
   * the memo is dropped whenever a file is invalidated, and every module went through that on
   * its way to being parsed — 3.7M resolutions on a 6,307-file build, against 98k.
   */
  test('a second consumer of a barrel reads the walk rather than repeating it', () => {
    const consumer = `import { badge } from './barrel'
     export const c = badge()`
    const ctx = createContext({})
    const files: Record<string, string> = {
      'app/src/design/recipes.ts': `import { cva } from '../../styled-system/css'
       export const badge = cva({ base: { color: 'red.500' } })`,
      'app/src/design/index.ts': `export * from './recipes'`,
      'app/src/barrel.ts': `export * from './design/index'`,
      'app/src/a.tsx': consumer,
      'app/src/b.tsx': consumer,
    }
    for (const [path, code] of Object.entries(files)) ctx.project.addSourceFile(path, code)

    const project = (ctx.project as unknown as { project: { getSourceFile: (...args: never[]) => unknown } }).project
    const lookUp = project.getSourceFile.bind(project)
    let lookups = 0
    project.getSourceFile = ((...args: never[]) => {
      lookups++
      return lookUp(...args)
    }) as typeof project.getSourceFile

    /** One module's turn through the transform hook. */
    const transform = (path: string) => {
      ctx.project.addSourceFile(path, consumer)
      lookups = 0
      ctx.project.parseSourceFile(path)
      return lookups
    }

    const first = transform('app/src/a.tsx')
    const second = transform('app/src/b.tsx')

    expect(first).toBeGreaterThan(0)
    expect(second).toBeLessThan(first)
  })
})
