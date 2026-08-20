import { mkdirSync, mkdtempSync, rmSync, utimesSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { basename, dirname, join } from 'node:path'
import { afterEach, describe, expect, test, vi } from 'vitest'
import { Builder } from '../src/builder'

const roots: string[] = []

const project = (files: Record<string, string>) => {
  const root = mkdtempSync(join(tmpdir(), 'bamboo-builder-resolution-'))
  roots.push(root)

  for (const [file, contents] of Object.entries({
    'bamboo.config.mjs': `export default {
      include: ['src/**/*.{ts,tsx}'],
      outdir: 'styled-system',
      preflight: false,
    }`,
    'styled-system/css.ts': `export const css = (..._args: any[]) => ''`,
    ...files,
  })) {
    const target = join(root, file)
    mkdirSync(dirname(target), { recursive: true })
    writeFileSync(target, contents)
  }

  return {
    configPath: join(root, 'bamboo.config.mjs'),
    file: (name: string) => join(root, 'src', name),
    root,
  }
}

const setup = async (fixture: ReturnType<typeof project>) => {
  const builder = new Builder()
  await builder.setup({ configPath: fixture.configPath, cwd: fixture.root })
  builder.extract()
  return builder
}

afterEach(() => {
  vi.restoreAllMocks()
  for (const root of roots.splice(0)) rmSync(root, { force: true, recursive: true })
})

describe('Builder resolution-ledger invalidation', () => {
  test('a runtime-only package import cannot seed manifest provenance for a semantic relative import', async () => {
    const manifest = (target: string) =>
      JSON.stringify({ imports: { '#runtime': `./src/${target}.ts` }, type: 'module' })
    const fixture = project({
      'package.json': manifest('runtime-blue'),
      'tsconfig.json': JSON.stringify({
        compilerOptions: { module: 'ESNext', moduleResolution: 'Bundler', resolvePackageJsonImports: true },
      }),
      'src/runtime-blue.ts': `export const runtime = 'blue'`,
      'src/runtime-red.ts': `export const runtime = 'red'`,
      'src/styles.ts': `export const decoration = { color: 'blue' }`,
      'src/app.tsx': `import { css } from '../styled-system/css'
        import { runtime } from '#runtime'
        import { decoration } from './styles'
        void runtime
        export const className = css(decoration)`,
    })
    writeFileSync(
      fixture.configPath,
      `export default { include: ['src/app.tsx'], outdir: 'styled-system', preflight: false }`,
    )

    const builder = await setup(fixture)
    const context = builder.getContextOrThrow()
    const parse = vi.spyOn(context, 'parseFile')
    const packagePath = join(fixture.root, 'package.json')
    const initial = builder.toCss({ layerParams: true })

    expect(initial).toContain('blue')
    expect(builder.getResolutionConfigurationFiles()).not.toContain(packagePath)

    writeFileSync(packagePath, manifest('runtime-red'))
    const later = new Date(Date.now() + 10_000)
    utimesSync(packagePath, later, later)
    await builder.setup({ configPath: fixture.configPath, cwd: fixture.root })
    builder.extract()

    expect(parse).not.toHaveBeenCalled()
    expect(builder.toCss({ layerParams: true })).toBe(initial)
    expect(builder.toCss({ layerParams: true })).toBe((await setup(fixture)).toCss({ layerParams: true }))
  })

  test('package imports retarget and removal invalidate an unchanged included owner', async () => {
    const manifest = (target: string) =>
      JSON.stringify({ imports: { '#decoration': `./src/${target}.ts` }, type: 'module' })
    const fixture = project({
      'package.json': manifest('blue'),
      'tsconfig.json': JSON.stringify({
        compilerOptions: { module: 'ESNext', moduleResolution: 'Bundler', resolvePackageJsonImports: true },
      }),
      'src/blue.ts': `export const decoration = { color: 'blue' }`,
      'src/red.ts': `export const decoration = { color: 'red' }`,
      'src/app.tsx': `import { css } from '../styled-system/css'
        import { decoration } from '#decoration'
        export const className = css(decoration)`,
    })
    writeFileSync(
      fixture.configPath,
      `export default { include: ['src/app.tsx'], outdir: 'styled-system', preflight: false }`,
    )

    const builder = await setup(fixture)
    const context = builder.getContextOrThrow()
    const parse = vi.spyOn(context, 'parseFile')
    const packagePath = join(fixture.root, 'package.json')
    const cleanCss = async () => (await setup(fixture)).toCss({ layerParams: true })
    expect(builder.toCss({ layerParams: true })).toContain('blue')

    writeFileSync(packagePath, manifest('red'))
    const later = new Date(Date.now() + 10_000)
    utimesSync(packagePath, later, later)
    await builder.setup({ configPath: fixture.configPath, cwd: fixture.root })
    builder.extract()

    expect(parse.mock.calls.map(([file]) => basename(file))).toEqual(['app.tsx'])
    const redirected = builder.toCss({ layerParams: true })
    expect(redirected).toContain('red')
    expect(redirected).not.toContain('blue')
    expect(redirected).toBe(await cleanCss())

    parse.mockClear()
    rmSync(packagePath)
    await builder.setup({ configPath: fixture.configPath, cwd: fixture.root })
    builder.extract()

    expect(parse.mock.calls.map(([file]) => basename(file))).toEqual(['app.tsx'])
    expect(builder.toCss({ layerParams: true })).not.toContain('red')
    expect(builder.toCss({ layerParams: true })).toBe(await cleanCss())
  })

  test('tsconfig paths retarget and removal invalidate an unchanged included owner', async () => {
    const fixture = project({
      'tsconfig.json': '{}',
      'src/blue.ts': `export const decoration = { color: 'blue' }`,
      'src/red.ts': `export const decoration = { color: 'red' }`,
      'src/app.tsx': `import { css } from '../styled-system/css'
        import { decoration } from '@decoration'
        export const className = css(decoration)`,
    })
    writeFileSync(
      fixture.configPath,
      `export default { include: ['src/app.tsx'], outdir: 'styled-system', preflight: false }`,
    )
    const tsconfigPath = join(fixture.root, 'tsconfig.json')
    const tsconfig = (target: string) =>
      JSON.stringify({
        compilerOptions: {
          module: 'ESNext',
          moduleResolution: 'Bundler',
          paths: { '@decoration': [fixture.file(`${target}.ts`)] },
        },
      })
    writeFileSync(tsconfigPath, tsconfig('blue'))

    const builder = await setup(fixture)
    const context = builder.getContextOrThrow()
    const parse = vi.spyOn(context, 'parseFile')
    const cleanCss = async () => (await setup(fixture)).toCss({ layerParams: true })
    expect(builder.toCss({ layerParams: true })).toContain('blue')

    writeFileSync(tsconfigPath, tsconfig('red'))
    const later = new Date(Date.now() + 10_000)
    utimesSync(tsconfigPath, later, later)
    await builder.setup({ configPath: fixture.configPath, cwd: fixture.root })
    builder.extract()

    expect(parse.mock.calls.map(([file]) => basename(file))).toEqual(['app.tsx'])
    const redirected = builder.toCss({ layerParams: true })
    expect(redirected).toContain('red')
    expect(redirected).not.toContain('blue')
    expect(redirected).toBe(await cleanCss())

    parse.mockClear()
    rmSync(tsconfigPath)
    await builder.setup({ configPath: fixture.configPath, cwd: fixture.root })
    builder.extract()

    expect(parse.mock.calls.map(([file]) => basename(file))).toEqual(['app.tsx'])
    expect(builder.toCss({ layerParams: true })).not.toContain('red')
    expect(builder.toCss({ layerParams: true })).toBe(await cleanCss())
  })

  test('keeps primary and fallback alias candidates through fallback deletion until redirect', async () => {
    const fixture = project({
      'package.json': JSON.stringify({
        imports: {
          '#decoration': ['./src/primary.ts', './src/fallback.ts'],
          '#runtime': ['./src/runtime-primary.ts', './src/runtime-fallback.ts'],
        },
        type: 'module',
      }),
      'tsconfig.json': JSON.stringify({
        compilerOptions: { module: 'ESNext', moduleResolution: 'Bundler', resolvePackageJsonImports: true },
      }),
      'src/fallback.ts': `export const decoration = { color: 'blue' }`,
      'src/runtime-fallback.ts': `export const runtime = true`,
      'src/app.tsx': `import { css } from '../styled-system/css'
        import { decoration } from '#decoration'
        import { runtime } from '#runtime'
        void runtime
        export const className = css(decoration)`,
    })
    writeFileSync(
      fixture.configPath,
      `export default {
        include: ['src/app.tsx'],
        outdir: 'styled-system',
        preflight: false,
      }`,
    )

    const builder = await setup(fixture)
    const context = builder.getContextOrThrow()
    const parse = vi.spyOn(context, 'parseFile')
    const primary = fixture.file('primary.ts')
    const fallback = fixture.file('fallback.ts')
    const runtimeFallback = fixture.file('runtime-fallback.ts')

    expect(builder.toCss({ layerParams: true })).toContain('blue')
    expect(builder.getResolutionReadFiles()).toEqual([fallback, primary].sort())

    rmSync(fallback)
    rmSync(runtimeFallback)
    await builder.setup({ configPath: fixture.configPath, cwd: fixture.root })
    builder.extract()

    expect(parse.mock.calls.map(([file]) => basename(file))).toEqual(['app.tsx'])
    expect.soft(builder.getResolutionReadFiles()).toEqual([fallback, primary].sort())
    expect(builder.toCss({ layerParams: true })).not.toContain('blue')

    parse.mockClear()
    writeFileSync(primary, `export const decoration = { color: 'red' }`)
    await builder.setup({ configPath: fixture.configPath, cwd: fixture.root })
    builder.extract()

    expect(parse.mock.calls.map(([file]) => basename(file))).toEqual(['app.tsx'])
    expect(builder.getResolutionReadFiles()).toEqual([primary])
    const incremental = builder.toCss({ layerParams: true })
    expect(incremental).toContain('red')
    expect(incremental).not.toContain('blue')
    expect(incremental).toBe((await setup(fixture)).toCss({ layerParams: true }))
  })

  test('a missing higher-priority alias target redirects an included owner when added', async () => {
    const fixture = project({
      'package.json': JSON.stringify({
        imports: {
          '#decoration': ['./src/primary.ts', './src/fallback.ts'],
          '#runtime': ['./src/runtime-primary.ts', './src/runtime-fallback.ts'],
        },
        type: 'module',
      }),
      'tsconfig.json': JSON.stringify({
        compilerOptions: { module: 'ESNext', moduleResolution: 'Bundler', resolvePackageJsonImports: true },
      }),
      'src/fallback.ts': `export const decoration = { color: 'blue' }`,
      'src/runtime-fallback.ts': `export const runtime = true`,
      'src/app.tsx': `import { css } from '../styled-system/css'
        import { decoration } from '#decoration'
        import { runtime } from '#runtime'
        void runtime
        export const className = css(decoration)`,
    })
    writeFileSync(
      fixture.configPath,
      `export default {
        include: ['src/app.tsx'],
        outdir: 'styled-system',
        preflight: false,
      }`,
    )

    const builder = await setup(fixture)
    const context = builder.getContextOrThrow()
    const parse = vi.spyOn(context, 'parseFile')
    const primary = fixture.file('primary.ts')
    const fallback = fixture.file('fallback.ts')

    expect(builder.toCss({ layerParams: true })).toContain('blue')
    expect(builder.getResolutionReadFiles()).toEqual([fallback, primary].sort())

    writeFileSync(primary, `export const decoration = { color: 'red' }`)
    await builder.setup({ configPath: fixture.configPath, cwd: fixture.root })
    builder.extract()

    expect(parse.mock.calls.map(([file]) => basename(file))).toEqual(['app.tsx'])
    expect(builder.getResolutionReadFiles()).toEqual([primary])
    const incremental = builder.toCss({ layerParams: true })
    expect(incremental).toContain('red')
    expect(incremental).not.toContain('blue')
    expect(incremental).toBe((await setup(fixture)).toCss({ layerParams: true }))

    parse.mockClear()
    rmSync(primary)
    await builder.setup({ configPath: fixture.configPath, cwd: fixture.root })
    builder.extract()
    expect(builder.getResolutionReadFiles()).toEqual([fallback, primary].sort())

    writeFileSync(
      fixture.file('app.tsx'),
      `import { css } from '../styled-system/css'
       export const className = css({ color: 'green' })`,
    )
    const later = new Date(Date.now() + 10_000)
    utimesSync(fixture.file('app.tsx'), later, later)
    await builder.setup({ configPath: fixture.configPath, cwd: fixture.root })
    builder.extract()
    expect(builder.getResolutionReadFiles()).toEqual([])

    parse.mockClear()
    writeFileSync(primary, `export const decoration = { color: 'purple' }`)
    await builder.setup({ configPath: fixture.configPath, cwd: fixture.root })
    builder.extract()
    expect(parse).not.toHaveBeenCalled()
    expect(builder.toCss({ layerParams: true })).not.toContain('purple')
    expect(builder.toCss({ layerParams: true })).toBe((await setup(fixture)).toCss({ layerParams: true }))
  })

  test.each([
    { label: 'relative import', specifier: './dependency' },
    {
      label: 'package-import alias',
      packageJson: JSON.stringify({ imports: { '#dependency': './src/dependency.ts' }, type: 'module' }),
      specifier: '#dependency',
      tsconfig: JSON.stringify({
        compilerOptions: { module: 'ESNext', moduleResolution: 'Bundler', resolvePackageJsonImports: true },
      }),
    },
  ])(
    '$label: recreated excluded semantic dependency reparses its included owner and matches a clean build',
    async ({ packageJson, specifier, tsconfig }) => {
      const fixture = project({
        ...(packageJson ? { 'package.json': packageJson } : {}),
        ...(tsconfig ? { 'tsconfig.json': tsconfig } : {}),
        'src/dependency.ts': `export const decoration = { color: 'blue' }`,
        'src/app.tsx': `import { css } from '../styled-system/css'
        import { decoration } from '${specifier}'
        export const className = css(decoration)`,
      })
      writeFileSync(
        fixture.configPath,
        `export default {
        include: ['src/app.tsx'],
        outdir: 'styled-system',
        preflight: false,
      }`,
      )

      const builder = await setup(fixture)
      const context = builder.getContextOrThrow()
      const parse = vi.spyOn(context, 'parseFile')
      const dependency = fixture.file('dependency.ts')
      const cleanCss = async () => (await setup(fixture)).toCss({ layerParams: true })

      expect(builder.toCss({ layerParams: true })).toContain('blue')
      expect(builder.getResolutionReadFiles()).toEqual([dependency])

      rmSync(dependency)
      await builder.setup({ configPath: fixture.configPath, cwd: fixture.root })
      builder.extract()

      expect(parse.mock.calls.map(([file]) => basename(file))).toEqual(['app.tsx'])
      expect(builder.toCss({ layerParams: true })).not.toContain('blue')
      expect(builder.toCss({ layerParams: true })).toBe(await cleanCss())
      const missingReads = builder.getResolutionReadFiles()
      expect(missingReads).toContain(dependency)
      expect(missingReads).toEqual([...missingReads].sort())

      parse.mockClear()
      writeFileSync(dependency, `export const decoration = { color: 'red' }`)
      await builder.setup({ configPath: fixture.configPath, cwd: fixture.root })
      builder.extract()

      expect(parse.mock.calls.map(([file]) => basename(file))).toEqual(['app.tsx'])
      const incremental = builder.toCss({ layerParams: true })
      expect(incremental).toContain('red')
      expect(incremental).not.toContain('blue')
      expect(incremental).toBe(await cleanCss())

      parse.mockClear()
      rmSync(dependency)
      await builder.setup({ configPath: fixture.configPath, cwd: fixture.root })
      builder.extract()
      expect(builder.getResolutionReadFiles()).toContain(dependency)

      writeFileSync(
        fixture.file('app.tsx'),
        `import { css } from '../styled-system/css'
       export const className = css({ color: 'green' })`,
      )
      const later = new Date(Date.now() + 10_000)
      utimesSync(fixture.file('app.tsx'), later, later)
      await builder.setup({ configPath: fixture.configPath, cwd: fixture.root })
      builder.extract()

      expect(builder.getResolutionReadFiles()).toEqual([])
      expect(builder.toCss({ layerParams: true })).toContain('green')

      parse.mockClear()
      writeFileSync(dependency, `export const decoration = { color: 'purple' }`)
      await builder.setup({ configPath: fixture.configPath, cwd: fixture.root })
      builder.extract()

      expect(parse).not.toHaveBeenCalled()
      expect(builder.toCss({ layerParams: true })).not.toContain('purple')
      expect(builder.toCss({ layerParams: true })).toBe(await cleanCss())
    },
  )

  test('repeated setup reparses a changed plain-object dependency and only its transitive consumers', async () => {
    const fixture = project({
      'src/dependency.ts': `export const base = { color: 'blue' }`,
      'src/bridge.ts': `import { base } from './dependency'
        export const bridged = { ...base, padding: '1px' }`,
      'src/app.ts': `import { css } from '../styled-system/css'
        import { bridged } from './bridge'
        export const className = css(bridged)`,
      'src/unrelated.ts': `import { css } from '../styled-system/css'
        export const unrelated = css({ borderColor: 'green' })`,
    })
    const builder = await setup(fixture)
    const context = builder.getContextOrThrow()
    const parse = vi.spyOn(context, 'parseFile')

    const dependency = fixture.file('dependency.ts')
    writeFileSync(dependency, `export const base = { color: 'red' }`)
    const later = new Date(Date.now() + 10_000)
    utimesSync(dependency, later, later)

    await builder.setup({ configPath: fixture.configPath, cwd: fixture.root })
    builder.extract()

    expect(builder.getContextOrThrow()).toBe(context)
    // `bridge.ts` is selected as a dependent but verified instead of re-parsed: it makes no
    // bamboo calls, so its recorded read set is empty and its extraction output cannot move.
    // `app.ts` re-parses because its recorded read of `bridged` re-digests differently, which
    // is the read-verification contract doing the selecting at value granularity.
    expect(parse.mock.calls.map(([file]) => basename(file))).toEqual(['dependency.ts', 'app.ts'])

    const incremental = builder.toCss({ layerParams: true })
    expect(incremental).toContain('red')
    expect(incremental).not.toContain('blue')
    expect(incremental).toContain('green')

    const clean = await setup(fixture)
    expect(incremental).toBe(clean.toCss({ layerParams: true }))
  })

  test('add, delete, and recreate preserve clean-build inventory order and bytes', async () => {
    const fixture = project({
      'src/01-first.ts': `import { css } from '../styled-system/css'
        export const first = css({ color: 'red' })`,
      'src/03-last.ts': `import { css } from '../styled-system/css'
        export const last = css({ color: 'green' })`,
    })
    const builder = await setup(fixture)
    const context = builder.getContextOrThrow()
    const parse = vi.spyOn(context, 'parseFile')
    const middle = fixture.file('02-middle.ts')
    const cleanCss = async () => (await setup(fixture)).toCss({ layerParams: true })

    writeFileSync(
      middle,
      `import { css } from '../styled-system/css'
       export const middle = css({ color: 'blue' })`,
    )
    await builder.setup({ configPath: fixture.configPath, cwd: fixture.root })
    builder.extract()

    expect(parse.mock.calls.map(([file]) => basename(file))).toEqual(['02-middle.ts'])
    expect(builder.toCss({ layerParams: true })).toBe(await cleanCss())

    parse.mockClear()
    rmSync(middle)
    await builder.setup({ configPath: fixture.configPath, cwd: fixture.root })
    builder.extract()

    expect(parse).not.toHaveBeenCalled()
    expect(builder.toCss({ layerParams: true })).not.toContain('blue')
    expect(builder.toCss({ layerParams: true })).toBe(await cleanCss())

    parse.mockClear()
    writeFileSync(
      middle,
      `import { css } from '../styled-system/css'
       export const middle = css({ color: 'purple' })`,
    )
    await builder.setup({ configPath: fixture.configPath, cwd: fixture.root })
    builder.extract()

    expect(parse.mock.calls.map(([file]) => basename(file))).toEqual(['02-middle.ts'])
    expect(builder.toCss({ layerParams: true })).toBe(await cleanCss())
  })
})
