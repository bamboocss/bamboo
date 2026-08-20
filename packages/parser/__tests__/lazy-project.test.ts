import { createContext } from '@bamboocss/fixture'
import { Project as TsProject } from 'ts-morph'
import { afterEach, describe, expect, test, vi } from 'vitest'
import { Project } from '../src/project'

afterEach(() => {
  vi.restoreAllMocks()
})

const projectFixture = (deferInitialSourceFiles: boolean, initialFiles = ['app/a.ts', 'app/b.ts']) => {
  const contents: Record<string, string> = {
    'app/a.ts': 'export const a = 1',
    'app/b.ts': 'export const b = 2',
  }
  const getFiles = vi.fn(() => [...initialFiles])
  const readFile = vi.fn((file: string) => {
    const content = contents[file]
    if (content === undefined) throw Object.assign(new Error(`missing ${file}`), { code: 'ENOENT' })
    return content
  })
  const parserOptions = createContext().parserOptions
  const project = new Project({
    deferInitialSourceFiles,
    getFiles,
    hooks: {},
    parserOptions,
    readFile,
    useInMemoryFileSystem: true,
  })

  return { contents, getFiles, parserOptions, project, readFile }
}

describe('Project deferred initial sources', () => {
  test('standalone Projects remain eager by default', () => {
    const createSourceFile = vi.spyOn(TsProject.prototype, 'createSourceFile')
    const contents = {
      'app/a.ts': 'export const a = 1',
      'app/b.ts': 'export const b = 2',
    }
    const getFiles = vi.fn(() => Object.keys(contents))
    const readFile = vi.fn((file: string) => contents[file as keyof typeof contents])
    const parserOptions = createContext().parserOptions

    const project = new Project({
      getFiles,
      hooks: {},
      parserOptions,
      readFile,
      useInMemoryFileSystem: true,
    })

    expect(getFiles).toHaveBeenCalledTimes(1)
    expect(readFile).toHaveBeenCalledTimes(2)
    expect(createSourceFile).toHaveBeenCalledTimes(2)
    expect(project.getSourceFile('app/a.ts')).toBeDefined()
    expect(readFile).toHaveBeenCalledTimes(2)
    expect(createSourceFile).toHaveBeenCalledTimes(2)

    const descriptor = Object.getOwnPropertyDescriptor(project, 'project')
    expect(descriptor).toEqual({
      configurable: true,
      enumerable: true,
      value: project.project,
      writable: true,
    })

    const replacement = new TsProject({ useInMemoryFileSystem: true })
    project.project = replacement
    expect(project.project).toBe(replacement)
  })

  test('the opt-in snapshots inventory but defers reads and ASTs until a graph operation', () => {
    const createSourceFile = vi.spyOn(TsProject.prototype, 'createSourceFile')
    const { getFiles, project, readFile } = projectFixture(true)

    expect(getFiles).toHaveBeenCalledTimes(1)
    expect(readFile).not.toHaveBeenCalled()
    expect(createSourceFile).not.toHaveBeenCalled()
    expect(Object.getOwnPropertyDescriptor(project, 'project')).toMatchObject({
      configurable: false,
      enumerable: true,
      get: expect.any(Function),
      set: expect.any(Function),
    })

    expect(project.files).toEqual(['app/a.ts', 'app/b.ts'])
    expect(project.getUnresolvedImporters()).toEqual([])
    expect(project.transformFile('app/a.ts', 'source')).toBe('source')
    expect(project.classify(new Map())).toBeDefined()
    expect(readFile).not.toHaveBeenCalled()
    expect(createSourceFile).not.toHaveBeenCalled()

    const first = project.getSourceFile('app/a.ts')
    expect(first).toBeDefined()
    expect(readFile).toHaveBeenCalledTimes(2)
    expect(createSourceFile).toHaveBeenCalledTimes(2)
    expect(project.getSourceFile('app/a.ts')).toBe(first)
    expect(readFile).toHaveBeenCalledTimes(2)
    expect(createSourceFile).toHaveBeenCalledTimes(2)
  })

  test('JSON parsing is graph-independent; direct ts-morph access is not', () => {
    const createSourceFile = vi.spyOn(TsProject.prototype, 'createSourceFile')
    const { contents, parserOptions, project, readFile } = projectFixture(true, ['app/a.ts'])
    contents['cache.json'] = JSON.stringify(parserOptions.encoder.toJSON())

    expect(project.parseSourceFile('cache.json')?.filePath).toBe('cache.json')
    expect(readFile).toHaveBeenCalledTimes(1)
    expect(createSourceFile).not.toHaveBeenCalled()

    expect(project.project.getSourceFiles()).toHaveLength(1)
    expect(readFile).toHaveBeenCalledTimes(2)
    expect(createSourceFile).toHaveBeenCalledTimes(1)
  })

  test('freezing the deferred wrapper does not freeze its private loading state', () => {
    const createSourceFile = vi.spyOn(TsProject.prototype, 'createSourceFile')
    const { project, readFile } = projectFixture(true)

    Object.freeze(project)

    expect(readFile).not.toHaveBeenCalled()
    expect(createSourceFile).not.toHaveBeenCalled()
    const first = project.getSourceFile('app/a.ts')
    expect(first).toBeDefined()
    expect(readFile).toHaveBeenCalledTimes(2)
    expect(createSourceFile).toHaveBeenCalledTimes(2)
    expect(project.getSourceFile('app/a.ts')).toBe(first)
    expect(readFile).toHaveBeenCalledTimes(2)
    expect(createSourceFile).toHaveBeenCalledTimes(2)
  })

  test('a frozen deferred wrapper does not mutate an alternate assignment receiver', () => {
    const { project, readFile } = projectFixture(true)
    const replacement = new TsProject({ useInMemoryFileSystem: true })
    const receiver = {}

    Object.freeze(project)

    // An accessor setter cannot propagate the inner rejection as `false`, but it must not
    // mutate the receiver where the former frozen data property would have rejected the set.
    expect(Reflect.set(project, 'project', replacement, receiver)).toBe(true)
    expect(Object.hasOwn(receiver, 'project')).toBe(false)
    expect(readFile).not.toHaveBeenCalled()
  })

  test('alternate-receiver raw-project assignment leaves the deferred wrapper untouched', () => {
    const createSourceFile = vi.spyOn(TsProject.prototype, 'createSourceFile')
    const { project, readFile } = projectFixture(true)
    const replacement = new TsProject({ useInMemoryFileSystem: true })
    const receiver = {}
    const before = Object.getOwnPropertyDescriptor(project, 'project')

    expect(Reflect.set(project, 'project', replacement, receiver)).toBe(true)
    expect(Object.getOwnPropertyDescriptor(receiver, 'project')).toEqual({
      configurable: true,
      enumerable: true,
      value: replacement,
      writable: true,
    })
    expect(Object.getOwnPropertyDescriptor(project, 'project')).toEqual(before)
    expect(readFile).not.toHaveBeenCalled()
    expect(createSourceFile).not.toHaveBeenCalled()

    expect(project.getSourceFile('app/a.ts')).toBeDefined()
    expect(readFile).toHaveBeenCalledTimes(2)
    expect(createSourceFile).toHaveBeenCalledTimes(2)
  })

  test('raw project replacement cannot observe or overwrite an in-flight preload', () => {
    const replacement = new TsProject({ useInMemoryFileSystem: true })
    let replaceDuringRead = true
    let project!: Project
    const readFile = vi.fn((file: string) => {
      if (replaceDuringRead) {
        replaceDuringRead = false
        project.project = replacement
      }
      return file.endsWith('a.ts') ? 'export const a = 1' : 'export const b = 2'
    })

    project = new Project({
      deferInitialSourceFiles: true,
      getFiles: () => ['app/a.ts', 'app/b.ts'],
      hooks: {},
      parserOptions: createContext().parserOptions,
      readFile,
      useInMemoryFileSystem: true,
    })

    expect(() => project.getSourceFile('app/a.ts')).toThrow(/re-entered or mutated/i)
    expect(project.getSourceFile('app/a.ts')).toBeDefined()
    expect(project.project).not.toBe(replacement)
    expect(project.project.getSourceFiles()).toHaveLength(2)
    expect(readFile).toHaveBeenCalledTimes(3)
  })

  test('a restored raw-project descriptor cannot hide reentrant parse side effects', () => {
    const parserOptions = createContext().parserOptions
    const encoderBefore = JSON.stringify(parserOptions.encoder.toJSON())
    const replacement = new TsProject({ useInMemoryFileSystem: true })
    const dependency = replacement.createSourceFile('ghost/dependency.ts', 'export const dependency = true')
    const importer = replacement.createSourceFile(
      'ghost/importer.ts',
      [
        "import { css } from '@bamboocss/css'",
        "import { dependency } from './dependency'",
        "export const ghost = css({ color: 'red' })",
        'void dependency',
      ].join('\n'),
    )
    let attack = true
    let project!: Project
    const readFile = vi.fn(() => {
      if (attack) {
        attack = false
        const deferred = Object.getOwnPropertyDescriptor(project, 'project')!
        Object.defineProperty(project, 'project', {
          configurable: true,
          enumerable: true,
          value: replacement,
          writable: true,
        })
        project.parseSourceFile(importer.getFilePath())
        Object.defineProperty(project, 'project', deferred)
      }
      return 'export const candidate = true'
    })

    project = new Project({
      deferInitialSourceFiles: true,
      getFiles: () => ['app/candidate.ts'],
      hooks: {},
      parserOptions,
      readFile,
      useInMemoryFileSystem: true,
    })

    let error: unknown
    let escaped
    try {
      escaped = project.getSourceFile('app/candidate.ts')
    } catch (caught) {
      error = caught
    }

    expect(error).toBeInstanceOf(TypeError)
    expect(escaped).toBeUndefined()
    expect(JSON.stringify(parserOptions.encoder.toJSON())).toBe(encoderBefore)
    expect(project.getUnresolvedImporters()).toEqual([])
    expect(project.getDependents(dependency.getFilePath())).not.toContain(importer.getFilePath())
    expect(project.project.getSourceFile(importer.getFilePath())).toBeUndefined()
    expect(readFile).toHaveBeenCalledTimes(2)
  })

  test('parserOptions cannot expose the live encoder during a deferred preload', () => {
    const parserOptions = createContext().parserOptions
    const encoderBefore = JSON.stringify(parserOptions.encoder.toJSON())
    let attack = true
    let project!: Project
    const readFile = vi.fn(() => {
      if (attack) {
        attack = false
        project.parserOptions.encoder.processAtomic({ color: 'red' })
      }
      return 'export const candidate = true'
    })

    project = new Project({
      deferInitialSourceFiles: true,
      getFiles: () => ['app/candidate.ts'],
      hooks: {},
      parserOptions,
      readFile,
      useInMemoryFileSystem: true,
    })

    let error: unknown
    let escaped
    try {
      escaped = project.getSourceFile('app/candidate.ts')
    } catch (caught) {
      error = caught
    }

    expect(error).toBeInstanceOf(Error)
    expect(escaped).toBeUndefined()
    expect(JSON.stringify(parserOptions.encoder.toJSON())).toBe(encoderBefore)
    expect(project.getSourceFile('app/candidate.ts')).toBeDefined()
    expect(readFile).toHaveBeenCalledTimes(2)
  })

  test('cache invalidation cannot re-enter after the final preload revision check', () => {
    const { project, readFile } = projectFixture(true, ['app/a.ts'])
    const createSourceFile = vi.spyOn(TsProject.prototype, 'createSourceFile')
    const originalClear = Map.prototype.clear
    let attack = true
    let reentryError: unknown
    const clear = vi.spyOn(Map.prototype, 'clear').mockImplementation(function (this: Map<unknown, unknown>) {
      if (attack && new Error().stack?.includes('clearImportedRecipeCache')) {
        attack = false
        try {
          project.parserOptions
        } catch (caught) {
          reentryError = caught
        }
      }
      return originalClear.call(this)
    })

    let error: unknown
    let escaped
    try {
      escaped = project.getSourceFile('app/a.ts')
    } catch (caught) {
      error = caught
    } finally {
      clear.mockRestore()
    }

    expect(reentryError).toBeInstanceOf(Error)
    expect(error).toBeInstanceOf(Error)
    expect(escaped).toBeUndefined()
    expect(createSourceFile).toHaveBeenCalledTimes(1)
    expect(project.getUnresolvedImporters()).toEqual([])

    expect(project.getSourceFile('app/a.ts')).toBeDefined()
    expect(createSourceFile).toHaveBeenCalledTimes(2)
    expect(readFile).toHaveBeenCalledTimes(2)
  })

  test.each<
    [
      string,
      (
        project: Project,
        resources: {
          capturedParser: Project['parser']
          importer: ReturnType<TsProject['createSourceFile']>
          replacement: TsProject
        },
      ) => unknown,
    ]
  >([
    ['raw project access', (project) => project.project],
    ['raw project assignment', (project, { replacement }) => (project.project = replacement)],
    [
      'alternate-receiver raw project assignment',
      (project, { replacement }) => Reflect.set(project, 'project', replacement, {}),
    ],
    ['parser access', (project) => project.parser],
    ['parser assignment', (project, { capturedParser }) => (project.parser = capturedParser)],
    ['parser invocation', (project, { importer }) => project.parser(importer)],
    ['captured parser invocation', (_project, { capturedParser, importer }) => capturedParser(importer)],
    ['parserOptions', (project) => project.parserOptions],
    ['files', (project) => project.files],
    ['readFile', (project) => project.readFile],
    ['getFiles', (project) => project.getFiles],
    ['getUnresolvedImporters', (project) => project.getUnresolvedImporters()],
    ['getSourceFile', (project) => project.getSourceFile('app/candidate.ts')],
    ['getDependents', (project) => project.getDependents('ghost/dependency.ts')],
    ['createSourceFile', (project) => project.createSourceFile('ghost/created.ts')],
    ['createSourceFiles', (project) => project.createSourceFiles()],
    ['addSourceFile', (project) => project.addSourceFile('ghost/added.ts', 'export const added = true')],
    ['removeSourceFile', (project) => project.removeSourceFile('ghost/removed.ts')],
    ['reloadSourceFile', (project) => project.reloadSourceFile('ghost/reloaded.ts')],
    ['reloadSourceFiles', (project) => project.reloadSourceFiles()],
    ['parseJson', (project) => project.parseJson('ghost/cache.json')],
    ['JSON parseSourceFile', (project) => project.parseSourceFile('ghost/cache.json')],
    ['source parseSourceFile', (project, { importer }) => project.parseSourceFile(importer.getFilePath())],
    ['transformFile', (project) => project.transformFile('ghost/source.ts', 'source')],
    ['classify', (project) => project.classify(new Map())],
  ])('a caught %s access invalidates loading before exposing wrapper state', (_name, invoke) => {
    const parserOptions = createContext().parserOptions
    const encoderBefore = JSON.stringify(parserOptions.encoder.toJSON())
    const replacement = new TsProject({ useInMemoryFileSystem: true })
    replacement.createSourceFile('ghost/dependency.ts', 'export const dependency = true')
    const importer = replacement.createSourceFile(
      'ghost/importer.ts',
      [
        "import { css } from '@bamboocss/css'",
        "import { dependency } from './dependency'",
        "export const ghost = css({ color: 'red' })",
        'void dependency',
      ].join('\n'),
    )
    let attack = true
    let innerError: unknown
    let project!: Project
    let capturedParser!: Project['parser']
    const readFile = vi.fn((file: string) => {
      if (file === 'ghost/cache.json') return encoderBefore
      if (attack) {
        attack = false
        try {
          invoke(project, { capturedParser, importer, replacement })
        } catch (caught) {
          innerError = caught
        }
      }
      return 'export const candidate = true'
    })

    project = new Project({
      deferInitialSourceFiles: true,
      getFiles: () => ['app/candidate.ts'],
      hooks: {},
      parserOptions,
      readFile,
      useInMemoryFileSystem: true,
    })
    capturedParser = project.parser
    const createSourceFile = vi.spyOn(TsProject.prototype, 'createSourceFile')

    let escaped
    expect(() => {
      escaped = project.getSourceFile('app/candidate.ts')
    }).toThrow(/already being initialized/i)
    expect(innerError).toBeInstanceOf(Error)
    expect(escaped).toBeUndefined()
    expect(createSourceFile).not.toHaveBeenCalled()
    expect(JSON.stringify(parserOptions.encoder.toJSON())).toBe(encoderBefore)
    expect(project.getUnresolvedImporters()).toEqual([])

    expect(project.getSourceFile('app/candidate.ts')).toBeDefined()
    expect(createSourceFile).toHaveBeenCalledTimes(1)
    expect(project.getDependents('ghost/dependency.ts')).toEqual([])
    expect(project.project).not.toBe(replacement)
    expect(project.project.getSourceFile(importer.getFilePath())).toBeUndefined()
    expect(readFile).toHaveBeenCalledTimes(2)
  })

  test('the deferred raw-project boundary is non-configurable while assignment stays authoritative', () => {
    const { project, readFile } = projectFixture(true, ['app/a.ts'])
    const deferred = Object.getOwnPropertyDescriptor(project, 'project')!
    const replacement = new TsProject({ useInMemoryFileSystem: true })

    expect(deferred).toMatchObject({ configurable: false, enumerable: true })
    expect(() => {
      Object.defineProperty(project, 'project', {
        configurable: true,
        enumerable: true,
        value: replacement,
        writable: true,
      })
    }).toThrow(TypeError)
    expect(Reflect.deleteProperty(project, 'project')).toBe(false)
    expect(Object.getOwnPropertyDescriptor(project, 'project')).toEqual(deferred)
    expect(readFile).not.toHaveBeenCalled()

    project.project = replacement

    expect(project.project).toBe(replacement)
    expect(readFile).not.toHaveBeenCalled()
  })

  test.each(['assignment', 'source parse', 'JSON parse', 'parser'] as const)(
    'a caught reentrant %s attempt invalidates the preload transaction without side effects',
    (operation) => {
      const parserOptions = createContext().parserOptions
      const encoderBefore = JSON.stringify(parserOptions.encoder.toJSON())
      const replacement = new TsProject({ useInMemoryFileSystem: true })
      const dependency = replacement.createSourceFile('ghost/dependency.ts', 'export const dependency = true')
      const importer = replacement.createSourceFile(
        'ghost/importer.ts',
        [
          "import { css } from '@bamboocss/css'",
          "import { dependency } from './dependency'",
          "export const ghost = css({ color: 'red' })",
          'void dependency',
        ].join('\n'),
      )
      let attack = true
      let project!: Project
      const readFile = vi.fn((file: string) => {
        if (file === 'ghost/cache.json') return encoderBefore
        if (attack) {
          attack = false
          try {
            if (operation === 'assignment') project.project = replacement
            if (operation === 'source parse') project.parseSourceFile(importer.getFilePath())
            if (operation === 'JSON parse') project.parseSourceFile('ghost/cache.json')
            if (operation === 'parser') project.parser(importer)
          } catch {
            // The callback deliberately swallows the inner guard. The monotonic revision must
            // still make the outer preload fail rather than publish its candidate.
          }
        }
        return 'export const candidate = true'
      })

      project = new Project({
        deferInitialSourceFiles: true,
        getFiles: () => ['app/candidate.ts'],
        hooks: {},
        parserOptions,
        readFile,
        useInMemoryFileSystem: true,
      })

      expect(() => project.getSourceFile('app/candidate.ts')).toThrow(/re-entered or mutated/i)
      expect(JSON.stringify(parserOptions.encoder.toJSON())).toBe(encoderBefore)
      expect(project.getUnresolvedImporters()).toEqual([])

      expect(project.getSourceFile('app/candidate.ts')).toBeDefined()
      expect(project.getDependents(dependency.getFilePath())).not.toContain(importer.getFilePath())
      expect(project.project.getSourceFile(importer.getFilePath())).toBeUndefined()
      expect(readFile).toHaveBeenCalledTimes(2)
    },
  )
})
