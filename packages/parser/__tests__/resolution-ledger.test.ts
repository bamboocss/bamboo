import { createContext } from '@bamboocss/fixture'
import { mkdirSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { Project } from '../src/project'
import { describe, expect, test, vi } from 'vitest'

const CSS_IMPORT = `import { css } from 'styled-system/css'`

const ledgerProject = (ctx: ReturnType<typeof createContext>) => ctx.project

const writeExcluded = (ctx: ReturnType<typeof createContext>, filePath: string, content: string) => {
  ctx.project.project.getFileSystem().writeFileSync(filePath, content)
}

const stylesOf = (ctx: ReturnType<typeof createContext>, filePath: string) =>
  [...(ctx.project.parseSourceFile(filePath)?.css ?? [])].flatMap((call: any) => call.data)

const factFor = (project: Project, importer: string, specifier: string) =>
  project.getResolutionLedger().find((fact) => fact.importer.endsWith(importer) && fact.specifier === specifier)

describe('Project resolution ledger', () => {
  test('loads an on-disk source inside the checkout but outside the initial inventory', () => {
    const root = mkdtempSync(join(tmpdir(), 'bamboo-resolution-ledger-'))
    try {
      const sourceDirectory = join(root, 'src')
      const app = join(sourceDirectory, 'app.ts')
      const styles = join(sourceDirectory, 'styles.ts')
      mkdirSync(sourceDirectory, { recursive: true })
      writeFileSync(styles, `export const base = { color: 'red.500' }`)
      writeFileSync(app, `${CSS_IMPORT}\nimport { base } from './styles'\nexport const value = css(base)`)

      const fixture = createContext()
      const project = new Project({
        getFiles: () => [app],
        hooks: {},
        parserOptions: {
          ...fixture.parserOptions,
          config: { ...fixture.parserOptions.config, cwd: root },
        },
        readFile: (filePath) => readFileSync(filePath, 'utf8'),
      })

      expect(project.getSourceFile(styles)).toBeUndefined()
      expect([...(project.parseSourceFile(app)?.css ?? [])].flatMap((call: any) => call.data)).toEqual([
        { color: 'red.500' },
      ])
      expect(project.getResolvedSourceFiles()).toEqual([styles])
    } finally {
      rmSync(root, { recursive: true, force: true })
    }
  })

  test('loads an excluded local style source on demand and makes its importer depend on it', () => {
    const ctx = createContext()
    const project = ledgerProject(ctx)
    writeExcluded(ctx, '/app/src/styles.ts', `export const base = { color: 'red.500' }`)
    ctx.project.addSourceFile(
      '/app/src/app.tsx',
      `${CSS_IMPORT}
       import { base } from './styles'
       export const App = () => <div className={css(base)} />`,
    )

    expect(ctx.project.getSourceFile('/app/src/styles.ts')).toBeUndefined()
    expect(stylesOf(ctx, '/app/src/app.tsx')).toEqual([{ color: 'red.500' }])

    expect(ctx.project.getSourceFile('/app/src/styles.ts')).toBeDefined()
    expect(project.getResolvedSourceFiles()).toEqual(['/app/src/styles.ts'])
    expect(factFor(project, '/app/src/app.tsx', './styles')).toEqual({
      importer: '/app/src/app.tsx',
      target: '/app/src/styles.ts',
      specifier: './styles',
      kind: 'import',
      ordinal: 1,
    })
    expect(ctx.project.getDependents('/app/src/styles.ts')).toEqual(['/app/src/app.tsx'])

    writeExcluded(ctx, '/app/src/styles.ts', `export const base = { color: 'blue.500' }`)
    ctx.project.reloadSourceFile('/app/src/styles.ts')
    expect(ctx.project.getDependents('/app/src/styles.ts')).toEqual(['/app/src/app.tsx'])
    expect(stylesOf(ctx, '/app/src/app.tsx')).toEqual([{ color: 'blue.500' }])
  })

  test('records renamed, star and nested helper/recipe closures through the same resolver', () => {
    const ctx = createContext()
    const project = ledgerProject(ctx)

    for (const [filePath, content] of Object.entries({
      '/app/src/styles.ts': `export const base = { color: 'red.500' }`,
      '/app/src/renamed.ts': `export { base as tone } from './styles'`,
      '/app/src/barrel.ts': `export * from './renamed'`,
      '/app/src/helper.ts': `import { tone } from './barrel'
        export const decorate = () => ({ ...tone, padding: '2' })`,
      '/app/src/recipe.ts': `import { cva } from 'styled-system/css'
        export const badge = cva({ base: { color: 'blue.500' } })`,
      '/app/src/recipe-renamed.ts': `export { badge as chip } from './recipe'`,
      '/app/src/recipe-barrel.ts': `export * from './recipe-renamed'`,
    })) {
      writeExcluded(ctx, filePath, content)
    }

    ctx.project.addSourceFile(
      '/app/src/app.tsx',
      `${CSS_IMPORT}
       import { decorate } from './helper'
       import { chip } from './recipe-barrel'
       export const a = css(decorate())
       export const b = chip({})`,
    )

    const result = ctx.project.parseSourceFile('/app/src/app.tsx')!
    expect([...result.css].flatMap((call: any) => call.data)).toEqual([{ color: 'red.500', padding: '2' }])
    expect(result.importedRecipes.get('chip')).toEqual({ filePath: '/app/src/recipe.ts', name: 'badge' })
    expect(result.getDependencies()).toEqual([
      '/app/src/barrel.ts',
      '/app/src/helper.ts',
      '/app/src/renamed.ts',
      '/app/src/styles.ts',
    ])
    expect(ctx.project.parseSourceFile('/app/src/app.tsx')!.getDependencies(), 'cache-hit read replay').toEqual([
      '/app/src/barrel.ts',
      '/app/src/helper.ts',
      '/app/src/renamed.ts',
      '/app/src/styles.ts',
    ])

    expect(factFor(project, '/app/src/helper.ts', './barrel')?.target).toBe('/app/src/barrel.ts')
    expect(factFor(project, '/app/src/barrel.ts', './renamed')?.target).toBe('/app/src/renamed.ts')
    expect(factFor(project, '/app/src/renamed.ts', './styles')?.target).toBe('/app/src/styles.ts')
    expect(factFor(project, '/app/src/recipe-barrel.ts', './recipe-renamed')?.target).toBe('/app/src/recipe-renamed.ts')
    expect(factFor(project, '/app/src/recipe-renamed.ts', './recipe')?.target).toBe('/app/src/recipe.ts')
    expect(ctx.project.getDependents('/app/src/styles.ts')).toEqual([
      '/app/src/app.tsx',
      '/app/src/barrel.ts',
      '/app/src/helper.ts',
      '/app/src/renamed.ts',
    ])
    expect(ctx.project.getDependencies('/app/src/app.tsx')).toEqual([
      '/app/src/barrel.ts',
      '/app/src/helper.ts',
      '/app/src/recipe-barrel.ts',
      '/app/src/recipe-renamed.ts',
      '/app/src/recipe.ts',
      '/app/src/renamed.ts',
      '/app/src/styles.ts',
    ])
    expect(ctx.project.getDependencies('/app/src/app.tsx', ['/app/src/styles.ts'])).toEqual([
      '/app/src/barrel.ts',
      '/app/src/helper.ts',
      '/app/src/renamed.ts',
      '/app/src/styles.ts',
    ])

    ctx.project.addSourceFile('/app/src/styles.ts', `export const base = { color: 'blue.500' }`)
    const updated = ctx.project.parseSourceFile('/app/src/app.tsx')!
    expect([...updated.css].flatMap((call: any) => call.data)).toEqual([{ color: 'blue.500', padding: '2' }])
    expect(updated.getDependencies(), 'source replacement records a fresh exact read set').toEqual([
      '/app/src/barrel.ts',
      '/app/src/helper.ts',
      '/app/src/renamed.ts',
      '/app/src/styles.ts',
    ])
  })

  test('uses the exact post-parser:before AST, including on the first transformed parse', () => {
    let includeImport = true
    const ctx = createContext({
      plugins: [
        {
          name: 'resolution-ledger-transform',
          hooks: {
            'parser:before': ({ filePath }) => {
              if (!filePath.endsWith('.custom')) return
              return includeImport
                ? `${CSS_IMPORT}\nimport { base } from './styles'\nexport const value = css(base)`
                : `${CSS_IMPORT}\nexport const value = css({ color: 'blue.500' })`
            },
          },
        },
      ],
    })
    const project = ledgerProject(ctx)
    writeExcluded(ctx, '/app/src/styles.ts', `export const base = { color: 'red.500' }`)
    ctx.project.addSourceFile('/app/src/view.custom', `<not-typescript />`)

    expect(stylesOf(ctx, '/app/src/view.custom')).toEqual([{ color: 'red.500' }])
    expect(factFor(project, '/app/src/view.custom', './styles')?.target).toBe('/app/src/styles.ts')

    includeImport = false
    ctx.project.addSourceFile('/app/src/view.custom', `import { base } from './styles'\nexport const stale = base`)
    expect(stylesOf(ctx, '/app/src/view.custom')).toEqual([{ color: 'blue.500' }])
    expect(factFor(project, '/app/src/view.custom', './styles')).toBeUndefined()
    expect(ctx.project.getDependents('/app/src/styles.ts')).toEqual([])
  })

  test('prepares a resolver-discovered dependency before reading it, independent of parse order', () => {
    const run = (dependencyFirst: boolean) => {
      let dependencyHookCalls = 0
      const ctx = createContext({
        plugins: [
          {
            name: 'resolution-ledger-dependency-transform',
            hooks: {
              'parser:before': ({ filePath }) => {
                if (filePath !== '/app/src/dependency.ts') return
                dependencyHookCalls++
                return `import { palette } from './palette'\nexport const base = palette`
              },
            },
          },
        ],
      })

      ctx.project.addSourceFile('/app/src/palette.ts', `export const palette = { color: 'blue.500' }`)
      ctx.project.addSourceFile('/app/src/dependency.ts', `export const base = { color: 'red.500' }`)
      ctx.project.addSourceFile(
        '/app/src/app.ts',
        `${CSS_IMPORT}\nimport { base } from './dependency'\nexport const value = css(base)`,
      )

      if (dependencyFirst) ctx.project.parseSourceFile('/app/src/dependency.ts')
      const css = stylesOf(ctx, '/app/src/app.ts')
      const dependencyFacts = ctx.project
        .getResolutionLedger()
        .filter((fact) => fact.importer === '/app/src/dependency.ts')
      // An explicit parse after consumer-first discovery must reuse the prepared revision,
      // not run the hook a second time against its own transformed output.
      ctx.project.parseSourceFile('/app/src/dependency.ts')

      return {
        css,
        dependencyFacts,
        dependencyHookCalls,
      }
    }

    const expected = {
      css: [{ color: 'blue.500' }],
      dependencyFacts: [
        {
          importer: '/app/src/dependency.ts',
          target: '/app/src/palette.ts',
          specifier: './palette',
          kind: 'import',
          ordinal: 0,
        },
      ],
      dependencyHookCalls: 1,
    }

    const dependencyFirst = run(true)
    const consumerFirst = run(false)
    expect.soft(dependencyFirst).toEqual(expected)
    expect.soft(consumerFirst).toEqual(expected)
  })

  test('retains resolver-time parser configuration for the dependency’s later explicit parse', () => {
    let dependencyHookCalls = 0
    const matchTag = (tag: string) => tag === 'PreparedComponent'
    const ctx = createContext({
      plugins: [
        {
          name: 'resolution-ledger-retained-configuration',
          hooks: {
            'parser:before': ({ filePath, configure }) => {
              if (filePath !== '/app/src/dependency.ts') return
              dependencyHookCalls++
              configure({ matchTag, matchTagMode: 'override' })
              return `export const base = { color: 'blue.500' }`
            },
          },
        },
      ],
    })
    ctx.project.addSourceFile('/app/src/dependency.ts', `export const base = { color: 'red.500' }`)
    ctx.project.addSourceFile(
      '/app/src/app.ts',
      `${CSS_IMPORT}\nimport { base } from './dependency'\nexport const value = css(base)`,
    )

    expect(stylesOf(ctx, '/app/src/app.ts')).toEqual([{ color: 'blue.500' }])

    const parser = ctx.project.parser
    let observedOptions: any
    ctx.project.parser = ((sourceFile, _encoder, options) => {
      if (sourceFile?.getFilePath() === '/app/src/dependency.ts') observedOptions = options
    }) as typeof parser

    ctx.project.parseSourceFile('/app/src/dependency.ts')
    expect(dependencyHookCalls).toBe(1)
    expect(observedOptions?.matchTagMode).toBe('override')
    expect(observedOptions?.matchTag('PreparedComponent', false)).toBe(true)
    expect(Object.isFrozen(observedOptions)).toBe(true)
  })

  test('prepares exactly once again after add, reload and remove revisions', () => {
    let dependencyHookCalls = 0
    const dependency = '/app/src/dependency.ts'
    const raw = (color: string) => `export const revision = '${color}'`
    const ctx = createContext({
      plugins: [
        {
          name: 'resolution-ledger-source-revisions',
          hooks: {
            'parser:before': ({ filePath, content }) => {
              if (filePath !== dependency) return
              dependencyHookCalls++
              const color = /revision = '([^']+)'/.exec(content)?.[1]
              return `export const base = { color: '${color}.500' }`
            },
          },
        },
      ],
    })
    writeExcluded(ctx, dependency, raw('red'))
    ctx.project.addSourceFile(dependency, raw('red'))
    ctx.project.addSourceFile(
      '/app/src/app.ts',
      `${CSS_IMPORT}\nimport { base } from './dependency'\nexport const value = css(base)`,
    )

    expect(stylesOf(ctx, '/app/src/app.ts')).toEqual([{ color: 'red.500' }])
    ctx.project.parseSourceFile(dependency)
    expect(dependencyHookCalls).toBe(1)

    ctx.project.addSourceFile(dependency, raw('blue'))
    expect(stylesOf(ctx, '/app/src/app.ts')).toEqual([{ color: 'blue.500' }])
    expect(dependencyHookCalls).toBe(2)

    writeExcluded(ctx, dependency, raw('green'))
    ctx.project.reloadSourceFile(dependency)
    expect(stylesOf(ctx, '/app/src/app.ts')).toEqual([{ color: 'green.500' }])
    expect(dependencyHookCalls).toBe(3)

    expect(ctx.project.removeSourceFile(dependency)).toBe(true)
    ctx.project.addSourceFile(dependency, raw('amber'))
    expect(stylesOf(ctx, '/app/src/app.ts')).toEqual([{ color: 'amber.500' }])
    expect(dependencyHookCalls).toBe(4)
  })

  test.each(['throw', 'reenter'] as const)('rolls back and retries a %s preparation', (failure) => {
    const fixture = createContext()
    let attempts = 0
    let reentrantError: unknown
    const dependency = '/app/src/dependency.ts'
    const original = `export const base = { color: 'red.500' }`

    let project: Project
    project = new Project({
      getFiles: () => [],
      hooks: {
        'parser:before': ({ filePath }) => {
          if (filePath !== dependency) return
          attempts++
          if (attempts === 1) {
            if (failure === 'throw') throw new Error('first preparation failed')
            try {
              project.parseSourceFile(dependency)
            } catch (error) {
              reentrantError = error
            }
          }
          return `import { palette } from './palette'\nexport const base = palette`
        },
      },
      parserOptions: fixture.parserOptions,
      readFile: () => '',
      useInMemoryFileSystem: true,
    })
    project.addSourceFile('/app/src/palette.ts', `export const palette = { color: 'blue.500' }`)
    project.addSourceFile(dependency, original)
    project.addSourceFile(
      '/app/src/app.ts',
      `${CSS_IMPORT}\nimport { base } from './dependency'\nexport const value = css(base)`,
    )
    const parseStyles = () =>
      [...(project.parseSourceFile('/app/src/app.ts')?.css ?? [])].flatMap((call: any) => call.data)

    expect(parseStyles).toThrow()
    expect(project.getSourceFile(dependency)?.getFullText()).toBe(original)
    expect(factFor(project, '/app/src/dependency.ts', './palette')).toBeUndefined()
    if (failure === 'reenter') expect(reentrantError).toEqual(expect.any(Error))

    expect(parseStyles()).toEqual([{ color: 'blue.500' }])
    expect(factFor(project, '/app/src/dependency.ts', './palette')?.target).toBe('/app/src/palette.ts')
    expect(attempts).toBe(2)
  })

  test('updates a missing relative target from null to a path and back on removal', () => {
    const ctx = createContext()
    const project = ledgerProject(ctx)
    ctx.project.addSourceFile(
      '/app/src/app.tsx',
      `${CSS_IMPORT}
       import { base } from './styles'
       export const value = css(base, { padding: '2' })`,
    )

    expect(stylesOf(ctx, '/app/src/app.tsx')).toEqual([{}, { padding: '2' }])
    expect(factFor(project, '/app/src/app.tsx', './styles')?.target).toBeNull()
    expect(ctx.project.getUnresolvedImporters()).toEqual(['/app/src/app.tsx'])

    ctx.project.addSourceFile('/app/src/styles.ts', `export const base = { color: 'red.500' }`)
    expect(stylesOf(ctx, '/app/src/app.tsx')).toEqual([{ color: 'red.500' }, { padding: '2' }])
    expect(factFor(project, '/app/src/app.tsx', './styles')?.target).toBe('/app/src/styles.ts')

    expect(ctx.project.removeSourceFile('/app/src/styles.ts')).toBe(true)
    expect(factFor(project, '/app/src/app.tsx', './styles')?.target).toBeNull()
    // The unlink caller can still ask who consumed the removed file before reparsing them.
    expect(ctx.project.getDependents('/app/src/styles.ts')).toEqual(['/app/src/app.tsx'])
    expect(stylesOf(ctx, '/app/src/app.tsx')).toEqual([{}, { padding: '2' }])

    // A later, unrelated tree change must not resurrect the explicitly removed source from
    // an in-memory host that still retains its bytes.
    ctx.project.addSourceFile('/app/src/unrelated.ts', `export const unrelated = true`)
    expect(stylesOf(ctx, '/app/src/app.tsx')).toEqual([{}, { padding: '2' }])

    ctx.project.addSourceFile('/app/src/styles.ts', `export const base = { color: 'blue.500' }`)
    expect(stylesOf(ctx, '/app/src/app.tsx')).toEqual([{ color: 'blue.500' }, { padding: '2' }])
  })

  test('terminates cycles and retains deterministic transitive dependents', () => {
    const ctx = createContext()
    const project = ledgerProject(ctx)
    writeExcluded(ctx, '/app/src/a.ts', `export * from './b'`)
    writeExcluded(ctx, '/app/src/b.ts', `export * from './a'`)
    ctx.project.addSourceFile(
      '/app/src/app.tsx',
      `${CSS_IMPORT}
       import { gone } from './a'
       export const value = css(gone, { padding: '2' })`,
    )

    expect(() => stylesOf(ctx, '/app/src/app.tsx')).not.toThrow()
    expect(factFor(project, '/app/src/a.ts', './b')?.target).toBe('/app/src/b.ts')
    expect(factFor(project, '/app/src/b.ts', './a')?.target).toBe('/app/src/a.ts')
    expect(ctx.project.getDependents('/app/src/a.ts')).toEqual(['/app/src/app.tsx', '/app/src/b.ts'])
  })

  test('reload/reparse retracts old edges and registers the edited AST in lexical order', () => {
    const ctx = createContext()
    const project = ledgerProject(ctx)
    for (const filePath of ['/app/src/a.ts', '/app/src/b.ts', '/app/src/c.ts']) {
      ctx.project.addSourceFile(filePath, `export const value = '${filePath}'`)
    }
    ctx.project.addSourceFile(
      '/app/src/app.ts',
      `import { value as a } from './a'
       export { value as b } from './b'
       import { value as c } from './c'
       export const all = [a, c]`,
    )
    ctx.project.parseSourceFile('/app/src/app.ts')

    expect(project.getResolutionLedger().filter((fact) => fact.importer === '/app/src/app.ts')).toEqual([
      { importer: '/app/src/app.ts', target: '/app/src/a.ts', specifier: './a', kind: 'import', ordinal: 0 },
      { importer: '/app/src/app.ts', target: '/app/src/b.ts', specifier: './b', kind: 'export', ordinal: 1 },
      { importer: '/app/src/app.ts', target: '/app/src/c.ts', specifier: './c', kind: 'import', ordinal: 2 },
    ])

    ctx.project.project
      .getFileSystem()
      .writeFileSync('/app/src/app.ts', `import { value } from './b'\nexport const all = [value]`)
    ctx.project.reloadSourceFile('/app/src/app.ts')
    ctx.project.parseSourceFile('/app/src/app.ts')

    expect(project.getResolutionLedger().filter((fact) => fact.importer === '/app/src/app.ts')).toEqual([
      { importer: '/app/src/app.ts', target: '/app/src/b.ts', specifier: './b', kind: 'import', ordinal: 0 },
    ])
    expect(ctx.project.getDependents('/app/src/a.ts')).toEqual([])
    expect(ctx.project.getDependents('/app/src/b.ts')).toEqual(['/app/src/app.ts'])
  })

  test('does no duplicate resolution, add or source-read work on an identical second parse', () => {
    const ctx = createContext()
    const project = ledgerProject(ctx)
    writeExcluded(ctx, '/app/src/a.ts', `export const a = 1`)
    writeExcluded(ctx, '/app/src/b.ts', `export const b = 2`)
    ctx.project.addSourceFile('/app/src/app.ts', `import { a } from './a'\nexport { b } from './b'`)

    ctx.project.parseSourceFile('/app/src/app.ts')
    const firstLedger = project.getResolutionLedger()
    const first = project.getResolutionWork()
    expect(first).toEqual({ moduleResolutionsAttempted: 2, sourceFilesAdded: 2, sourceFilesRead: 2 })
    expect(Object.isFrozen(firstLedger)).toBe(true)
    expect(firstLedger.every(Object.isFrozen)).toBe(true)

    ctx.project.parseSourceFile('/app/src/app.ts')
    expect(project.getResolutionWork()).toEqual(first)
    expect(project.getResolutionLedger()).toEqual(firstLedger)
  })

  test('loads a local tsconfig alias on demand and records a missing alias without treating it as a package', () => {
    const ctx = createContext({
      tsconfig: { compilerOptions: { baseUrl: '/', paths: { '~/*': ['./app/src/*'] } } },
    } as never)
    const project = ledgerProject(ctx)
    writeExcluded(ctx, '/node_modules/styled-system/package.json', `{ "name": "styled-system" }`)
    writeExcluded(ctx, '/node_modules/styled-system/css.d.ts', `export declare const css: (...args: any[]) => string`)
    writeExcluded(ctx, '/app/src/styles.ts', `export const base = { color: 'red.500' }`)
    ctx.project.addSourceFile(
      '/app/src/app.ts',
      `${CSS_IMPORT}
       import { base } from '~/styles'
       import { absent } from '~/absent'
       export const value = css(base, absent)`,
    )

    expect(stylesOf(ctx, '/app/src/app.ts')).toEqual([{ color: 'red.500' }, {}])
    expect(factFor(project, '/app/src/app.ts', '~/styles')?.target).toBe('/app/src/styles.ts')
    expect(factFor(project, '/app/src/app.ts', '~/absent')?.target).toBeNull()
    expect(factFor(project, '/app/src/app.ts', 'styled-system/css')).toBeUndefined()
    expect(project.getResolvedSourceFiles()).toEqual(['/app/src/styles.ts'])
    expect(project.getUnresolvedImporters()).toEqual(['/app/src/app.ts'])
  })

  test.each([
    {
      label: 'baseUrl',
      specifier: 'styles',
      target: '/app/src/styles.ts',
      tsconfig: { compilerOptions: { baseUrl: '/app/src' } },
    },
    {
      label: 'package imports',
      specifier: '#styles',
      target: '/app/src/imported-styles.ts',
      packageJson: {
        name: 'local-app',
        imports: { '#styles': './src/imported-styles.ts' },
      },
      tsconfig: {
        compilerOptions: { module: 'ESNext', moduleResolution: 'Bundler', resolvePackageJsonImports: true },
      },
    },
    {
      label: 'package self export',
      specifier: 'local-app/styles',
      target: '/app/src/self-styles.ts',
      packageJson: {
        name: 'local-app',
        exports: { './styles': './src/self-styles.ts' },
      },
      tsconfig: {
        compilerOptions: { module: 'ESNext', moduleResolution: 'Bundler', resolvePackageJsonExports: true },
      },
    },
  ])(
    'tracks a missing $label target through appearance and disappearance',
    ({ packageJson, specifier, target, tsconfig }) => {
      const ctx = createContext({ tsconfig } as never)
      const project = ledgerProject(ctx)
      writeExcluded(ctx, '/node_modules/styled-system/package.json', `{ "name": "styled-system" }`)
      writeExcluded(ctx, '/node_modules/styled-system/css.d.ts', `export declare const css: (...args: any[]) => string`)
      if (packageJson) writeExcluded(ctx, '/app/package.json', JSON.stringify(packageJson))
      ctx.project.addSourceFile(
        '/app/src/app.ts',
        `${CSS_IMPORT}\nimport { base } from '${specifier}'\nexport const value = css(base, { padding: '2' })`,
      )

      expect(stylesOf(ctx, '/app/src/app.ts')).toEqual([{}, { padding: '2' }])
      expect(factFor(project, '/app/src/app.ts', specifier)?.target).toBeNull()
      expect(project.getUnresolvedImporters()).toEqual(['/app/src/app.ts'])

      ctx.project.addSourceFile(target, `export const base = { color: 'blue.500' }`)
      expect(stylesOf(ctx, '/app/src/app.ts')).toEqual([{ color: 'blue.500' }, { padding: '2' }])
      expect(factFor(project, '/app/src/app.ts', specifier)?.target).toBe(target)
      expect(project.getUnresolvedImporters()).toEqual([])

      expect(ctx.project.removeSourceFile(target)).toBe(true)
      expect(factFor(project, '/app/src/app.ts', specifier)?.target).toBeNull()
      expect(project.getUnresolvedImporters()).toEqual(['/app/src/app.ts'])

      ctx.project.addSourceFile(target, `export const base = { color: 'green.500' }`)
      expect(stylesOf(ctx, '/app/src/app.ts')).toEqual([{ color: 'green.500' }, { padding: '2' }])
      expect(factFor(project, '/app/src/app.ts', specifier)?.target).toBe(target)
      expect(project.getUnresolvedImporters()).toEqual([])
    },
  )

  test.each([
    {
      label: 'relative extension',
      specifier: './relative-styles',
      primary: '/app/src/relative-styles.ts',
      fallback: '/app/src/relative-styles.tsx',
    },
    {
      label: 'paths alias',
      specifier: '@styles',
      primary: '/app/src/paths-primary.ts',
      fallback: '/app/src/paths-fallback.ts',
      tsconfig: {
        compilerOptions: {
          baseUrl: '/',
          paths: { '@styles': ['app/src/paths-primary', 'app/src/paths-fallback'] },
        },
      },
    },
    {
      label: 'baseUrl extension',
      specifier: 'base-url-styles',
      primary: '/app/src/base-url-styles.ts',
      fallback: '/app/src/base-url-styles.tsx',
      tsconfig: { compilerOptions: { baseUrl: '/app/src' } },
    },
    {
      label: 'package imports array',
      specifier: '#styles',
      primary: '/app/src/imports-primary.ts',
      fallback: '/app/src/imports-fallback.ts',
      packageJson: {
        name: 'local-app',
        imports: { '#styles': ['./src/imports-primary.ts', './src/imports-fallback.ts'] },
      },
      tsconfig: {
        compilerOptions: { module: 'ESNext', moduleResolution: 'Bundler', resolvePackageJsonImports: true },
      },
    },
    {
      label: 'package self export array',
      specifier: 'local-app/styles',
      primary: '/app/src/self-primary.ts',
      fallback: '/app/src/self-fallback.ts',
      packageJson: {
        name: 'local-app',
        exports: { './styles': ['./src/self-primary.ts', './src/self-fallback.ts'] },
      },
      tsconfig: {
        compilerOptions: { module: 'ESNext', moduleResolution: 'Bundler', resolvePackageJsonExports: true },
      },
    },
  ])(
    'keeps a successful $label fallback pending until its higher-priority target appears',
    ({ fallback, packageJson, primary, specifier, tsconfig }) => {
      const ctx = createContext({ tsconfig } as never)
      const project = ledgerProject(ctx)
      const app = '/app/src/app.ts'
      writeExcluded(ctx, '/node_modules/styled-system/package.json', `{ "name": "styled-system" }`)
      writeExcluded(ctx, '/node_modules/styled-system/css.d.ts', `export declare const css: (...args: any[]) => string`)
      if (packageJson) writeExcluded(ctx, '/app/package.json', JSON.stringify(packageJson))
      writeExcluded(ctx, fallback, `export const base = { color: 'blue.500' }`)
      ctx.project.addSourceFile(
        app,
        `${CSS_IMPORT}\nimport { base } from '${specifier}'\nexport const value = css(base)`,
      )

      expect(stylesOf(ctx, app)).toEqual([{ color: 'blue.500' }])
      expect(factFor(project, app, specifier)?.target).toBe(fallback)
      expect(project.getUnresolvedImporters()).toEqual([app])
      const initialReadSet = project.getResolutionReadSet(app, ctx.project.parseSourceFile(app)!.getDependencies())
      const initialConfigurationFiles = project.getResolutionConfigurationFiles(
        app,
        ctx.project.parseSourceFile(app)!.getDependencies(),
      )
      expect(initialReadSet.dependencies).toEqual([fallback])
      expect(initialReadSet.pendingCandidates).toContain(primary)
      expect(initialReadSet.pendingCandidates).toEqual([...initialReadSet.pendingCandidates].sort())
      expect(Object.isFrozen(initialReadSet)).toBe(true)
      expect(Object.isFrozen(initialReadSet.dependencies)).toBe(true)
      expect(Object.isFrozen(initialReadSet.pendingCandidates)).toBe(true)
      if (packageJson) expect(initialConfigurationFiles).toContain('/app/package.json')
      const initialLedger = project.getResolutionLedger()
      const initialWork = project.getResolutionWork()
      expect(stylesOf(ctx, app)).toEqual([{ color: 'blue.500' }])
      expect(project.getResolutionReadSet(app, ctx.project.parseSourceFile(app)!.getDependencies())).toEqual(
        initialReadSet,
      )
      expect(project.getResolutionLedger()).toEqual(initialLedger)
      expect(project.getResolutionWork()).toEqual(initialWork)

      ctx.project.addSourceFile(primary, `export const base = { color: 'blue.500' }`)
      const addRebuildSet = [primary, ...project.getDependents(primary), ...project.getUnresolvedImporters()]
      expect(addRebuildSet).toContain(app)
      for (const file of addRebuildSet) project.parseSourceFile(file)

      expect(factFor(project, app, specifier)?.target).toBe(primary)
      expect(project.getDependents(primary)).toEqual([app])
      expect(project.getDependents(fallback)).toEqual([])
      expect(project.getUnresolvedImporters()).toEqual([])
      expect(project.getResolutionReadSet(app, ctx.project.parseSourceFile(app)!.getDependencies())).toEqual({
        dependencies: [primary],
        pendingCandidates: [],
      })

      expect(project.removeSourceFile(primary)).toBe(true)
      const removeRebuildSet = [primary, ...project.getDependents(primary), ...project.getUnresolvedImporters()]
      expect(removeRebuildSet).toContain(app)
      for (const file of removeRebuildSet) project.parseSourceFile(file)

      expect(factFor(project, app, specifier)?.target).toBe(fallback)
      expect(project.getDependents(primary)).toEqual([])
      expect(project.getDependents(fallback)).toEqual([app])
      expect(project.getUnresolvedImporters()).toEqual([app])
      expect(
        project.getResolutionReadSet(app, ctx.project.parseSourceFile(app)!.getDependencies()).pendingCandidates,
      ).toContain(primary)

      const fallbackReadSet = project.getResolutionReadSet(app, ctx.project.parseSourceFile(app)!.getDependencies())
      expect(ctx.project.removeSourceFile(fallback)).toBe(true)
      const unresolved = ctx.project.parseSourceFile(app)!
      const unresolvedReadSet = project.getResolutionReadSet(app, unresolved.getDependencies(), fallbackReadSet)
      expect(unresolvedReadSet.dependencies).toEqual([])
      expect(unresolvedReadSet.pendingCandidates).toEqual(expect.arrayContaining([fallback, primary]))
      expect(unresolvedReadSet.pendingCandidates).toEqual([...unresolvedReadSet.pendingCandidates].sort())

      ctx.project.addSourceFile(primary, `export const base = { color: 'red.500' }`)
      const redirected = ctx.project.parseSourceFile(app)!
      expect(project.getResolutionReadSet(app, redirected.getDependencies(), unresolvedReadSet)).toEqual({
        dependencies: [primary],
        pendingCandidates: [],
      })
    },
  )

  test('redirects a paths alias deterministically as higher-priority targets appear and disappear', () => {
    const root = mkdtempSync(join(tmpdir(), 'bamboo-resolution-redirect-'))
    try {
      const sourceDirectory = join(root, 'src')
      const app = join(sourceDirectory, 'app.ts')
      const primary = join(sourceDirectory, 'primary.ts')
      const fallback = join(sourceDirectory, 'fallback.ts')
      mkdirSync(sourceDirectory, { recursive: true })
      writeFileSync(fallback, `export const base = { color: 'blue.500' }`)
      writeFileSync(app, `${CSS_IMPORT}\nimport { base } from '@styles'\nexport const value = css(base)`)

      const fixture = createContext()
      const project = new Project({
        compilerOptions: {
          baseUrl: root,
          paths: { '@styles': ['./src/primary', './src/fallback'] },
        },
        getFiles: () => [app],
        hooks: {},
        parserOptions: {
          ...fixture.parserOptions,
          config: { ...fixture.parserOptions.config, cwd: root },
        },
        readFile: (filePath) => readFileSync(filePath, 'utf8'),
      })

      expect([...(project.parseSourceFile(app)?.css ?? [])].flatMap((call: any) => call.data)).toEqual([
        { color: 'blue.500' },
      ])
      expect(factFor(project, '/src/app.ts', '@styles')?.target).toBe(fallback)

      writeFileSync(primary, `export const base = { color: 'blue.500' }`)
      project.createSourceFile(primary)
      const addRebuildSet = [primary, ...project.getDependents(primary), ...project.getUnresolvedImporters()]
      expect(addRebuildSet).toContain(app)
      for (const file of addRebuildSet) project.parseSourceFile(file)
      expect(factFor(project, '/src/app.ts', '@styles')?.target).toBe(primary)
      expect(project.getDependents(primary)).toEqual([app])
      expect(project.getDependents(fallback)).toEqual([])

      rmSync(primary)
      expect(project.removeSourceFile(primary)).toBe(true)
      project.parseSourceFile(app)
      expect(factFor(project, '/src/app.ts', '@styles')?.target).toBe(fallback)
      expect(project.getDependents(primary)).toEqual([])
      expect(project.getDependents(fallback)).toEqual([app])
    } finally {
      rmSync(root, { recursive: true, force: true })
    }
  })

  test('keeps symlink-spelled candidates through null, redirect, owner edit and removal', () => {
    const root = mkdtempSync(join(tmpdir(), 'bamboo-resolution-symlink-'))
    try {
      const actualRoot = join(root, 'actual')
      const spelledRoot = join(root, 'spelled')
      const actualSource = join(actualRoot, 'src')
      mkdirSync(actualSource, { recursive: true })
      symlinkSync(actualRoot, spelledRoot, process.platform === 'win32' ? 'junction' : 'dir')

      const app = join(spelledRoot, 'src/app.ts')
      const primary = join(spelledRoot, 'src/styles.ts')
      const fallback = join(spelledRoot, 'src/styles.tsx')
      writeFileSync(join(actualSource, 'styles.tsx'), `export const base = { color: 'blue.500' }`)
      writeFileSync(
        join(actualSource, 'app.ts'),
        `${CSS_IMPORT}\nimport { base } from './styles'\nexport const value = css(base)`,
      )

      const fixture = createContext()
      const project = new Project({
        getFiles: () => [app],
        hooks: {},
        parserOptions: {
          ...fixture.parserOptions,
          config: { ...fixture.parserOptions.config, cwd: spelledRoot },
        },
        readFile: (filePath) => readFileSync(filePath, 'utf8'),
      })

      const initial = project.parseSourceFile(app)!
      const fallbackReadSet = project.getResolutionReadSet(app, initial.getDependencies())
      expect(fallbackReadSet.dependencies).toEqual([fallback])
      expect(fallbackReadSet.pendingCandidates).toContain(primary)

      rmSync(join(actualSource, 'styles.tsx'))
      expect(project.removeSourceFile(fallback)).toBe(true)
      const unresolved = project.parseSourceFile(app)!
      const unresolvedReadSet = project.getResolutionReadSet(app, unresolved.getDependencies(), fallbackReadSet)
      expect(unresolvedReadSet.dependencies).toEqual([])
      expect(unresolvedReadSet.pendingCandidates).toEqual(expect.arrayContaining([fallback, primary]))

      writeFileSync(join(actualSource, 'styles.ts'), `export const base = { color: 'red.500' }`)
      project.createSourceFile(primary)
      const redirected = project.parseSourceFile(app)!
      expect(project.getResolutionReadSet(app, redirected.getDependencies(), unresolvedReadSet)).toEqual({
        dependencies: [primary],
        pendingCandidates: [],
      })

      project.addSourceFile(app, `${CSS_IMPORT}\nexport const value = css({ color: 'green.500' })`)
      const edited = project.parseSourceFile(app)!
      expect(project.getResolutionReadSet(app, edited.getDependencies())).toEqual({
        dependencies: [],
        pendingCandidates: [],
      })
      expect(project.removeSourceFile(app)).toBe(true)
      expect(project.getResolutionReadSet(app, [])).toEqual({ dependencies: [], pendingCandidates: [] })
    } finally {
      rmSync(root, { recursive: true, force: true })
    }
  })

  test('treats a CSS import directory probe as missing without making it semantic', () => {
    const root = mkdtempSync(join(tmpdir(), 'bamboo-resolution-css-probe-'))
    try {
      const sourceDirectory = join(root, 'src')
      const app = join(sourceDirectory, 'app.ts')
      const stylesheet = join(sourceDirectory, 'index.css')
      mkdirSync(sourceDirectory, { recursive: true })
      writeFileSync(stylesheet, `.ordinary { color: blue }`)
      writeFileSync(app, `${CSS_IMPORT}\nimport './index.css'\nexport const value = css({ color: 'red.500' })`)

      const fixture = createContext()
      const project = new Project({
        getFiles: () => [app],
        hooks: {},
        parserOptions: {
          ...fixture.parserOptions,
          config: { ...fixture.parserOptions.config, cwd: root },
        },
        readFile: (filePath) => readFileSync(filePath, 'utf8'),
      })

      const result = project.parseSourceFile(app)!
      expect([...result.css].flatMap((call: any) => call.data)).toEqual([{ color: 'red.500' }])
      expect(factFor(project, '/src/app.ts', './index.css')?.target).toBeNull()
      expect(project.getResolutionReadSet(app, result.getDependencies())).toEqual({
        dependencies: [],
        pendingCandidates: [],
      })
    } finally {
      rmSync(root, { recursive: true, force: true })
    }
  })

  test.each([
    { code: 'ENOENT', throws: false },
    { code: 'ENOTDIR', throws: false },
    { code: 'ELOOP', throws: false },
    { code: 'ENAMETOOLONG', throws: false },
    { code: 'EACCES', throws: true },
    { code: 'EIO', throws: true },
  ])('classifies a $code candidate realpath failure', ({ code, throws }) => {
    const root = mkdtempSync(join(tmpdir(), 'bamboo-resolution-candidate-error-'))
    let restore: (() => void) | undefined
    try {
      const sourceDirectory = join(root, 'src')
      const app = join(sourceDirectory, 'app.ts')
      mkdirSync(sourceDirectory, { recursive: true })
      writeFileSync(app, `${CSS_IMPORT}\nimport './missing'\nexport const value = css({ color: 'red.500' })`)

      const fixture = createContext()
      const project = new Project({
        getFiles: () => [app],
        hooks: {},
        parserOptions: {
          ...fixture.parserOptions,
          config: { ...fixture.parserOptions.config, cwd: root },
        },
        readFile: (filePath) => readFileSync(filePath, 'utf8'),
      })
      const fileSystem = project.project.getFileSystem()
      const realpath = fileSystem.realpathSync.bind(fileSystem)
      const spy = vi.spyOn(fileSystem, 'realpathSync').mockImplementation((filePath) => {
        if (filePath.replaceAll('\\', '/').endsWith('/src/missing.ts')) {
          throw Object.assign(new Error(`${code}: candidate realpath`), { code })
        }
        return realpath(filePath)
      })
      restore = () => spy.mockRestore()

      if (throws) {
        expect(() => project.parseSourceFile(app)).toThrow(`${code}: candidate realpath`)
      } else {
        const result = project.parseSourceFile(app)!
        expect([...result.css].flatMap((call: any) => call.data)).toEqual([{ color: 'red.500' }])
        expect(project.getResolutionReadSet(app, result.getDependencies())).toEqual({
          dependencies: [],
          pendingCandidates: [],
        })
      }
    } finally {
      restore?.()
      rmSync(root, { recursive: true, force: true })
    }
  })

  test('does not leave an arbitrary bare external pending', () => {
    const ctx = createContext()
    const app = '/app/src/app.ts'
    ctx.project.addSourceFile(
      app,
      `${CSS_IMPORT}\nimport { absent } from 'not-a-local-package'\nexport const value = css(absent)`,
    )

    expect(stylesOf(ctx, app)).toEqual([{}])
    expect(ctx.project.getResolutionLedger().some((fact) => fact.specifier === 'not-a-local-package')).toBe(false)
    expect(ctx.project.getUnresolvedImporters()).toEqual([])
    expect(ctx.project.getResolutionReadSet(app, ctx.project.parseSourceFile(app)!.getDependencies())).toEqual({
      dependencies: [],
      pendingCandidates: [],
    })
  })

  test('never adds an external dependency to Bamboo’s source graph', () => {
    const ctx = createContext({ tsconfig: { compilerOptions: { baseUrl: '/app/src' } } } as never)
    const project = ledgerProject(ctx)
    writeExcluded(ctx, '/node_modules/styled-system/package.json', `{ "name": "styled-system" }`)
    writeExcluded(ctx, '/node_modules/styled-system/css.d.ts', `export declare const css: (...args: any[]) => string`)
    writeExcluded(ctx, '/node_modules/vendor/package.json', `{ "name": "vendor", "types": "index.d.ts" }`)
    writeExcluded(ctx, '/node_modules/vendor/index.d.ts', `export declare const vendorStyles: () => any`)
    ctx.project.addSourceFile(
      '/app/src/app.ts',
      `${CSS_IMPORT}
       import { vendorStyles } from 'vendor'
       export const value = css({ ...vendorStyles(), color: 'red.500' })`,
    )

    expect(stylesOf(ctx, '/app/src/app.ts')).toEqual([{ color: 'red.500' }])
    expect(ctx.project.getSourceFile('/node_modules/vendor/index.d.ts')).toBeUndefined()
    expect(project.getResolvedSourceFiles()).toEqual([])
    expect(project.getResolutionLedger().some((fact) => fact.specifier === 'vendor')).toBe(false)
    expect(project.getUnresolvedImporters()).toEqual([])
  })
})
