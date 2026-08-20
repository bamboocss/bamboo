import { mergeHooks } from '@bamboocss/config'
import { fixtureDefaults } from '@bamboocss/fixture'
import type { Project as BambooProject } from '@bamboocss/parser'
import { pluginSvelte } from '@bamboocss/plugin-svelte'
import { pluginVue } from '@bamboocss/plugin-vue'
import type { BambooHooks, LoadConfigResult, TSConfig } from '@bamboocss/types'
import { mkdirSync, mkdtempSync, rmSync, unlinkSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { Project as TsProject, ts } from 'ts-morph'
import { afterEach, describe, expect, test, vi } from 'vitest'
import { codegen } from '../src/codegen'
import { BambooContext } from '../src/create-context'
import { nodeRuntime } from '../src/node-runtime'

const temporaryDirectories = new Set<string>()

afterEach(() => {
  vi.restoreAllMocks()
  for (const directory of temporaryDirectories) rmSync(directory, { force: true, recursive: true })
  temporaryDirectories.clear()
})

const createFiles = (files: Record<string, string>) => {
  const directory = mkdtempSync(path.join(tmpdir(), 'bamboo-lazy-project-'))
  temporaryDirectories.add(directory)

  for (const [file, content] of Object.entries(files)) {
    const absolute = path.join(directory, file)
    mkdirSync(path.dirname(absolute), { recursive: true })
    writeFileSync(absolute, content)
  }

  return directory
}

const createConfig = (
  directory: string,
  options: {
    hooks?: Partial<BambooHooks>
    include?: string[]
    tsconfig?: TSConfig
  } = {},
): LoadConfigResult => ({
  ...fixtureDefaults,
  config: {
    ...fixtureDefaults.config,
    cwd: directory,
    include: options.include ?? ['src/**/*'],
    outdir: 'styled-system',
  },
  hooks: options.hooks ?? {},
  tsconfig: options.tsconfig,
})

const contextFor = (
  files: Record<string, string>,
  options?: Parameters<typeof createConfig>[1],
): { context: BambooContext; directory: string } => {
  const directory = createFiles(files)
  return { context: new BambooContext(createConfig(directory, options)), directory }
}

const sourceStyles = (context: BambooContext, file: string) =>
  Array.from(context.project.parseSourceFile(file)?.css ?? []).flatMap((entry) => entry.data)

describe('BambooContext.project materialization', () => {
  test('project starts as the legacy native data property', () => {
    const read = vi.spyOn(nodeRuntime.fs, 'readFileSync')
    const createSourceFile = vi.spyOn(TsProject.prototype, 'createSourceFile')
    const { context } = contextFor({ 'src/a.ts': 'export const a = 1' })
    const descriptor = Object.getOwnPropertyDescriptor(context, 'project')!

    expect(descriptor).toMatchObject({
      configurable: true,
      enumerable: true,
      writable: true,
    })
    expect('value' in descriptor).toBe(true)
    expect('get' in descriptor).toBe(false)
    expect('set' in descriptor).toBe(false)
    expect(read).not.toHaveBeenCalled()
    expect(createSourceFile).not.toHaveBeenCalled()
  })

  test('reads the real wrapper for free, then loads the full graph on its first source operation', () => {
    const read = vi.spyOn(nodeRuntime.fs, 'readFileSync')
    const createSourceFile = vi.spyOn(TsProject.prototype, 'createSourceFile')
    const { context, directory } = contextFor({
      'src/a.ts': 'export const a = 1',
      'src/b.tsx': 'export const b = <div />',
      'src/c.js': 'export const c = 3',
    })
    const project = context.project

    expect(Object.hasOwn(context, 'project')).toBe(true)
    expect(Object.keys(context)).toContain('project')
    const initialDescriptor = Object.getOwnPropertyDescriptor(context, 'project')!
    expect(initialDescriptor).toMatchObject({
      configurable: true,
      enumerable: true,
      writable: true,
    })
    expect(initialDescriptor.value).toBe(project)
    expect(read).not.toHaveBeenCalled()
    expect(createSourceFile).not.toHaveBeenCalled()
    expect(context.project).toBe(project)
    expect(read).not.toHaveBeenCalled()
    expect(createSourceFile).not.toHaveBeenCalled()

    expect(project.getSourceFile(path.join(directory, 'src/a.ts'))).toBeDefined()

    expect(read).toHaveBeenCalledTimes(3)
    expect(createSourceFile).toHaveBeenCalledTimes(3)
    expect(project.getSourceFile(path.join(directory, 'src/b.tsx'))).toBeDefined()
    expect(read).toHaveBeenCalledTimes(3)
    expect(createSourceFile).toHaveBeenCalledTimes(3)
    const loadedDescriptor = Object.getOwnPropertyDescriptor(context, 'project')!
    expect(loadedDescriptor).toMatchObject({
      configurable: true,
      enumerable: true,
      writable: true,
    })
    expect(loadedDescriptor.value).toBe(project)

    const replacement = {} as BambooProject
    context.project = replacement
    expect(context.project).toBe(replacement)
  })

  test('direct ts-morph project access is a materializing source operation', () => {
    const read = vi.spyOn(nodeRuntime.fs, 'readFileSync')
    const createSourceFile = vi.spyOn(TsProject.prototype, 'createSourceFile')
    const { context } = contextFor({
      'src/a.ts': 'export const a = 1',
      'src/b.ts': 'export const b = 2',
    })
    const wrapper = context.project

    expect(read).not.toHaveBeenCalled()
    expect(wrapper.project.getSourceFiles()).toHaveLength(2)
    expect(read).toHaveBeenCalledTimes(2)
    expect(createSourceFile).toHaveBeenCalledTimes(2)
    expect(wrapper.project.getSourceFiles()).toHaveLength(2)
    expect(read).toHaveBeenCalledTimes(2)
    expect(createSourceFile).toHaveBeenCalledTimes(2)
  })

  test('an injected project prevents construction', () => {
    const read = vi.spyOn(nodeRuntime.fs, 'readFileSync')
    const createSourceFile = vi.spyOn(TsProject.prototype, 'createSourceFile')
    const { context } = contextFor({ 'src/a.ts': 'export const a = 1' })
    const injected = { files: ['injected'] } as unknown as BambooProject

    context.project = injected

    expect(context.project).toBe(injected)
    expect(read).not.toHaveBeenCalled()
    expect(createSourceFile).not.toHaveBeenCalled()
    expect(Object.getOwnPropertyDescriptor(context, 'project')).toMatchObject({ value: injected, writable: true })
  })

  test('preventExtensions preserves native writes, deletion, and failed re-addition', () => {
    const read = vi.spyOn(nodeRuntime.fs, 'readFileSync')
    const createSourceFile = vi.spyOn(TsProject.prototype, 'createSourceFile')
    const { context } = contextFor({ 'src/a.ts': 'export const a = 1' })
    const replacement = {} as BambooProject

    Object.preventExtensions(context)
    context.project = replacement
    expect(context.project).toBe(replacement)
    expect(Reflect.deleteProperty(context, 'project')).toBe(true)
    expect(Object.hasOwn(context, 'project')).toBe(false)
    expect(Reflect.set(context, 'project', replacement)).toBe(false)
    expect(read).not.toHaveBeenCalled()
    expect(createSourceFile).not.toHaveBeenCalled()
  })

  test('delete and redefine use ordinary data-property descriptors without source work', () => {
    const read = vi.spyOn(nodeRuntime.fs, 'readFileSync')
    const createSourceFile = vi.spyOn(TsProject.prototype, 'createSourceFile')
    const { context } = contextFor({ 'src/a.ts': 'export const a = 1' })
    const replacement = {} as BambooProject

    expect(Reflect.deleteProperty(context, 'project')).toBe(true)
    Object.defineProperty(context, 'project', {
      configurable: true,
      enumerable: false,
      value: replacement,
      writable: false,
    })

    expect(Object.getOwnPropertyDescriptor(context, 'project')).toEqual({
      configurable: true,
      enumerable: false,
      value: replacement,
      writable: false,
    })
    expect(read).not.toHaveBeenCalled()
    expect(createSourceFile).not.toHaveBeenCalled()
  })

  test('alternate-receiver assignment leaves the lazy context untouched', () => {
    const read = vi.spyOn(nodeRuntime.fs, 'readFileSync')
    const createSourceFile = vi.spyOn(TsProject.prototype, 'createSourceFile')
    const { context } = contextFor({ 'src/a.ts': 'export const a = 1' })
    const injected = {} as BambooProject
    const receiver = {}
    const before = Object.getOwnPropertyDescriptor(context, 'project')

    expect(Reflect.set(context, 'project', injected, receiver)).toBe(true)
    expect(Object.getOwnPropertyDescriptor(receiver, 'project')).toEqual({
      configurable: true,
      enumerable: true,
      value: injected,
      writable: true,
    })
    expect(Object.getOwnPropertyDescriptor(context, 'project')).toEqual(before)
    expect(read).not.toHaveBeenCalled()
    expect(createSourceFile).not.toHaveBeenCalled()
  })

  test('alternate-receiver assignment updates writable data and inherited receivers', () => {
    const read = vi.spyOn(nodeRuntime.fs, 'readFileSync')
    const createSourceFile = vi.spyOn(TsProject.prototype, 'createSourceFile')
    const { context } = contextFor({ 'src/a.ts': 'export const a = 1' })
    const before = Object.getOwnPropertyDescriptor(context, 'project')
    const writableReceiver = {}
    const first = {} as BambooProject
    Object.defineProperty(writableReceiver, 'project', {
      configurable: false,
      enumerable: false,
      value: null,
      writable: true,
    })

    expect(Reflect.set(context, 'project', first, writableReceiver)).toBe(true)
    expect(Object.getOwnPropertyDescriptor(writableReceiver, 'project')).toEqual({
      configurable: false,
      enumerable: false,
      value: first,
      writable: true,
    })

    const inheritedReceiver = Object.create(context) as Record<string, unknown>
    const second = {} as BambooProject

    expect(Reflect.set(context, 'project', second, inheritedReceiver)).toBe(true)
    expect(Object.getOwnPropertyDescriptor(inheritedReceiver, 'project')).toEqual({
      configurable: true,
      enumerable: true,
      value: second,
      writable: true,
    })
    expect(Object.getOwnPropertyDescriptor(context, 'project')).toEqual(before)
    expect(read).not.toHaveBeenCalled()
    expect(createSourceFile).not.toHaveBeenCalled()
  })

  test('rejected alternate receivers remain unchanged without materializing the context', () => {
    const read = vi.spyOn(nodeRuntime.fs, 'readFileSync')
    const createSourceFile = vi.spyOn(TsProject.prototype, 'createSourceFile')
    const { context } = contextFor({ 'src/a.ts': 'export const a = 1' })
    const before = Object.getOwnPropertyDescriptor(context, 'project')
    const injected = {} as BambooProject
    const nonWritable = {}
    Object.defineProperty(nonWritable, 'project', {
      configurable: false,
      enumerable: false,
      value: 'original',
      writable: false,
    })
    const receiverSetter = vi.fn()
    const accessor = {}
    Object.defineProperty(accessor, 'project', {
      configurable: true,
      enumerable: false,
      get: () => 'original',
      set: receiverSetter,
    })
    const getterOnly = {}
    const receiverGetter = vi.fn(() => 'original')
    Object.defineProperty(getterOnly, 'project', {
      configurable: true,
      enumerable: false,
      get: receiverGetter,
    })
    const nonExtensible = Object.preventExtensions({})

    expect(Reflect.set(context, 'project', injected, nonWritable)).toBe(false)
    expect(Reflect.set(context, 'project', injected, accessor)).toBe(false)
    expect(Reflect.set(context, 'project', injected, getterOnly)).toBe(false)
    expect(Reflect.set(context, 'project', injected, nonExtensible)).toBe(false)

    expect(Object.getOwnPropertyDescriptor(nonWritable, 'project')).toEqual({
      configurable: false,
      enumerable: false,
      value: 'original',
      writable: false,
    })
    expect(receiverSetter).not.toHaveBeenCalled()
    expect(Object.getOwnPropertyDescriptor(accessor, 'project')).toMatchObject({
      configurable: true,
      enumerable: false,
      get: expect.any(Function),
      set: receiverSetter,
    })
    expect(receiverGetter).not.toHaveBeenCalled()
    expect(Object.getOwnPropertyDescriptor(getterOnly, 'project')).toMatchObject({
      configurable: true,
      enumerable: false,
      get: receiverGetter,
      set: undefined,
    })
    expect(Object.hasOwn(nonExtensible, 'project')).toBe(false)
    expect(Object.getOwnPropertyDescriptor(context, 'project')).toEqual(before)
    expect(read).not.toHaveBeenCalled()
    expect(createSourceFile).not.toHaveBeenCalled()
  })

  test('a context frozen before source access keeps native read-only data semantics', () => {
    const read = vi.spyOn(nodeRuntime.fs, 'readFileSync')
    const createSourceFile = vi.spyOn(TsProject.prototype, 'createSourceFile')
    const { context, directory } = contextFor({ 'src/a.ts': 'export const a = 1' })
    const project = context.project
    Object.freeze(context)

    const frozenDescriptor = Object.getOwnPropertyDescriptor(context, 'project')!
    expect(frozenDescriptor).toMatchObject({
      configurable: false,
      enumerable: true,
      writable: false,
    })
    expect(frozenDescriptor.value).toBe(project)

    const alternateReceiver = {}
    expect(Reflect.set(context, 'project', {} as BambooProject, alternateReceiver)).toBe(false)
    expect(Object.hasOwn(alternateReceiver, 'project')).toBe(false)
    expect(read).not.toHaveBeenCalled()
    expect(createSourceFile).not.toHaveBeenCalled()

    expect(context.project).toBe(project)
    expect(read).not.toHaveBeenCalled()
    expect(project.getSourceFile(path.join(directory, 'src/a.ts'))).toBeDefined()
    expect(read).toHaveBeenCalledTimes(1)
    expect(createSourceFile).toHaveBeenCalledTimes(1)
    const loadedFrozenDescriptor = Object.getOwnPropertyDescriptor(context, 'project')!
    expect(loadedFrozenDescriptor).toMatchObject({
      configurable: false,
      enumerable: true,
      writable: false,
    })
    expect(loadedFrozenDescriptor.value).toBe(project)
    expect(() => {
      context.project = {} as BambooProject
    }).toThrow(TypeError)
    expect(context.project).toBe(project)
  })

  test('a context sealed before source access keeps native writable data semantics', () => {
    const read = vi.spyOn(nodeRuntime.fs, 'readFileSync')
    const createSourceFile = vi.spyOn(TsProject.prototype, 'createSourceFile')
    const { context, directory } = contextFor({ 'src/a.ts': 'export const a = 1' })
    const project = context.project
    Object.seal(context)

    expect(context.project).toBe(project)
    expect(read).not.toHaveBeenCalled()
    expect(project.getSourceFile(path.join(directory, 'src/a.ts'))).toBeDefined()
    expect(read).toHaveBeenCalledTimes(1)
    expect(createSourceFile).toHaveBeenCalledTimes(1)
    expect(Object.isSealed(context)).toBe(true)
    expect(Object.isFrozen(context)).toBe(false)
    expect(Object.getOwnPropertyDescriptor(context, 'project')).toMatchObject({
      configurable: false,
      enumerable: true,
      value: project,
      writable: true,
    })

    const replacement = {} as BambooProject
    context.project = replacement
    expect(context.project).toBe(replacement)
    expect(read).toHaveBeenCalledTimes(1)
    expect(createSourceFile).toHaveBeenCalledTimes(1)
  })

  test('a deferred Project wrapper frozen before source access still loads once', () => {
    const read = vi.spyOn(nodeRuntime.fs, 'readFileSync')
    const createSourceFile = vi.spyOn(TsProject.prototype, 'createSourceFile')
    const { context, directory } = contextFor({
      'src/a.ts': 'export const a = 1',
      'src/b.ts': 'export const b = 2',
    })
    const project = context.project

    Object.freeze(project)

    expect(read).not.toHaveBeenCalled()
    expect(createSourceFile).not.toHaveBeenCalled()
    const first = project.getSourceFile(path.join(directory, 'src/a.ts'))
    expect(first).toBeDefined()
    expect(read).toHaveBeenCalledTimes(2)
    expect(createSourceFile).toHaveBeenCalledTimes(2)
    expect(project.getSourceFile(path.join(directory, 'src/a.ts'))).toBe(first)
    expect(read).toHaveBeenCalledTimes(2)
    expect(createSourceFile).toHaveBeenCalledTimes(2)
    expect(() => {
      project.project = new TsProject()
    }).toThrow(TypeError)
  })

  test('a project injected before freezing still prevents construction', () => {
    const read = vi.spyOn(nodeRuntime.fs, 'readFileSync')
    const createSourceFile = vi.spyOn(TsProject.prototype, 'createSourceFile')
    const { context } = contextFor({ 'src/a.ts': 'export const a = 1' })
    const injected = {} as BambooProject

    context.project = injected
    Object.freeze(context)

    expect(context.project).toBe(injected)
    expect(read).not.toHaveBeenCalled()
    expect(createSourceFile).not.toHaveBeenCalled()
    expect(Object.getOwnPropertyDescriptor(context, 'project')).toMatchObject({
      configurable: false,
      enumerable: true,
      value: injected,
      writable: false,
    })
    expect(() => {
      context.project = {} as BambooProject
    }).toThrow(TypeError)
  })

  test('two microtasks share one synchronous construction', async () => {
    const read = vi.spyOn(nodeRuntime.fs, 'readFileSync')
    const createSourceFile = vi.spyOn(TsProject.prototype, 'createSourceFile')
    const { context, directory } = contextFor({ 'src/a.ts': 'export const a = 1' })
    const file = path.join(directory, 'src/a.ts')

    const [first, second] = await Promise.all([
      Promise.resolve().then(() => context.project.getSourceFile(file)),
      Promise.resolve().then(() => context.project.getSourceFile(file)),
    ])

    expect(second).toBe(first)
    expect(read).toHaveBeenCalledTimes(1)
    expect(createSourceFile).toHaveBeenCalledTimes(1)
  })

  test('a failed preload leaves the wrapper intact and retries a fresh project', () => {
    const realRead = nodeRuntime.fs.readFileSync.bind(nodeRuntime.fs)
    let reads = 0
    const read = vi.spyOn(nodeRuntime.fs, 'readFileSync').mockImplementation((file) => {
      reads++
      if (reads === 2) throw new Error('synthetic read failure')
      return realRead(file)
    })
    const createSourceFile = vi.spyOn(TsProject.prototype, 'createSourceFile')
    const { context, directory } = contextFor({
      'src/a.ts': 'export const a = 1',
      'src/b.ts': 'export const b = 2',
    })

    const project = context.project
    expect(() => project.getSourceFile(path.join(directory, 'src/a.ts'))).toThrow('synthetic read failure')
    const descriptor = Object.getOwnPropertyDescriptor(context, 'project')!
    expect(descriptor.writable).toBe(true)
    expect(descriptor.value).toBe(project)

    expect(project.getSourceFile(path.join(directory, 'src/a.ts'))).toBeDefined()
    expect(project.getSourceFile(path.join(directory, 'src/b.ts'))).toBeDefined()
    expect(read).toHaveBeenCalledTimes(4)
    // One file entered the discarded Project; both entered the successful retry.
    expect(createSourceFile).toHaveBeenCalledTimes(3)
  })

  test('an AST construction failure also retries without caching the partial Project', () => {
    const originalCreateSourceFile = TsProject.prototype.createSourceFile
    let fail = true
    const createSourceFile = vi.spyOn(TsProject.prototype, 'createSourceFile').mockImplementation(function (
      this: TsProject,
      ...args
    ) {
      if (fail) {
        fail = false
        throw new Error('synthetic AST failure')
      }
      return originalCreateSourceFile.apply(this, args)
    })
    const read = vi.spyOn(nodeRuntime.fs, 'readFileSync')
    const { context, directory } = contextFor({ 'src/a.ts': 'export const a = 1' })
    const project = context.project

    expect(() => project.getSourceFile(path.join(directory, 'src/a.ts'))).toThrow('synthetic AST failure')
    const descriptor = Object.getOwnPropertyDescriptor(context, 'project')!
    expect(descriptor.writable).toBe(true)
    expect(descriptor.value).toBe(project)
    expect(project.getSourceFile(path.join(directory, 'src/a.ts'))).toBeDefined()
    expect(read).toHaveBeenCalledTimes(2)
    expect(createSourceFile).toHaveBeenCalledTimes(2)
  })

  test('a true reentrant source operation fails cleanly and remains retryable', () => {
    const realRead = nodeRuntime.fs.readFileSync.bind(nodeRuntime.fs)
    let context!: BambooContext
    let reenter = true
    const read = vi.spyOn(nodeRuntime.fs, 'readFileSync').mockImplementation((file) => {
      if (reenter) {
        reenter = false
        void context.project.getSourceFile(file as string)
      }
      return realRead(file)
    })
    const fixture = createFiles({ 'src/a.ts': 'export const a = 1' })
    context = new BambooContext(createConfig(fixture))

    const project = context.project
    expect(() => project.getSourceFile(path.join(fixture, 'src/a.ts'))).toThrow(/already being initialized/i)
    const descriptor = Object.getOwnPropertyDescriptor(context, 'project')!
    expect(descriptor.writable).toBe(true)
    expect(descriptor.value).toBe(project)
    expect(context.project.getSourceFile(path.join(fixture, 'src/a.ts'))).toBeDefined()
    expect(read).toHaveBeenCalledTimes(2)
  })

  test('an included file disappearing before first access is still an ENOENT skip', () => {
    const read = vi.spyOn(nodeRuntime.fs, 'readFileSync')
    const createSourceFile = vi.spyOn(TsProject.prototype, 'createSourceFile')
    const { context, directory } = contextFor({ 'src/gone.ts': 'export const gone = true' })
    const file = path.join(directory, 'src/gone.ts')
    unlinkSync(file)

    const project = context.project

    expect(project.getSourceFile(file)).toBeUndefined()
    expect(read).toHaveBeenCalledTimes(1)
    expect(createSourceFile).not.toHaveBeenCalled()

    writeFileSync(file, 'export const back = true')
    project.reloadSourceFiles()
    expect(project.getSourceFile(file)).toBeDefined()
  })

  test('the initial inventory glob and its errors remain at context construction', () => {
    const createSourceFile = vi.spyOn(TsProject.prototype, 'createSourceFile')
    vi.spyOn(nodeRuntime.fs, 'glob').mockImplementation(() => {
      throw new Error('synthetic glob failure')
    })
    const directory = createFiles({ 'src/a.ts': 'export const a = 1' })

    expect(() => new BambooContext(createConfig(directory))).toThrow('synthetic glob failure')
    expect(createSourceFile).not.toHaveBeenCalled()
  })
})

describe('eager-equivalent snapshots', () => {
  test('freezes the initial inventory and tsconfig values while later file queries stay live', () => {
    const directory = createFiles({ 'src/a.ts': 'export const a = 1' })
    const read = vi.spyOn(nodeRuntime.fs, 'readFileSync')
    const createSourceFile = vi.spyOn(TsProject.prototype, 'createSourceFile')
    const compilerOptions = { target: 'ES5' } satisfies NonNullable<TSConfig['compilerOptions']>
    const conf = createConfig(directory, { include: ['src/*.ts'], tsconfig: { compilerOptions } })
    const context = new BambooContext(conf)

    // Neither a broader filesystem inventory nor a changed config can alter the membership
    // the formerly eager Project observed. Contents are the deliberately deferred half.
    writeFileSync(path.join(directory, 'src/a.ts'), 'export const a = 9')
    writeFileSync(path.join(directory, 'src/b.ts'), 'export const b = 2')
    context.config.include = ['src/b.ts']
    compilerOptions.target = 'ESNext'

    const project = context.project
    const a = path.join(directory, 'src/a.ts')
    const b = path.join(directory, 'src/b.ts')

    // Inventory queries remain live and do not need a ts-morph source graph.
    expect(project.files).toEqual([b])
    expect(read).not.toHaveBeenCalled()
    expect(createSourceFile).not.toHaveBeenCalled()

    expect(project.getSourceFile(a)).toBeDefined()
    expect(project.getSourceFile(a)?.getFullText()).toContain('a = 9')
    expect(project.getSourceFile(b)).toBeUndefined()
    expect(project.project.getCompilerOptions().target).toBe(ts.ScriptTarget.ES5)
    expect(project.files).toEqual([b])

    project.reloadSourceFiles()
    expect(project.getSourceFile(b)).toBeDefined()
  })
})

describe('transparent Project consumers', () => {
  test('codegen does not materialize the source project', async () => {
    const read = vi.spyOn(nodeRuntime.fs, 'readFileSync')
    const createSourceFile = vi.spyOn(TsProject.prototype, 'createSourceFile')
    const { context } = contextFor({ 'src/a.ts': 'export const a = 1' })

    await codegen(context)

    expect(read).not.toHaveBeenCalled()
    expect(createSourceFile).not.toHaveBeenCalled()
  })

  test('parses JSON without materializing the TypeScript source graph', () => {
    const donor = contextFor({}).context
    const directory = createFiles({
      'src/a.ts': 'export const a = 1',
      'src/styles.json': JSON.stringify(donor.encoder.toJSON()),
    })
    const read = vi.spyOn(nodeRuntime.fs, 'readFileSync')
    const createSourceFile = vi.spyOn(TsProject.prototype, 'createSourceFile')
    const context = new BambooContext(createConfig(directory))
    const file = path.join(directory, 'src/styles.json')
    const source = path.join(directory, 'src/a.ts')

    expect(read).not.toHaveBeenCalled()
    void context.project
    expect(read).not.toHaveBeenCalled()

    const result = context.parseFile(file)
    expect(result?.filePath).toBe(file)
    expect(read).toHaveBeenCalledTimes(1)
    expect(createSourceFile).not.toHaveBeenCalled()

    expect(context.project.getSourceFile(source)).toBeDefined()
    expect(read).toHaveBeenCalledTimes(3)
    expect(createSourceFile).toHaveBeenCalledTimes(2)
  })

  test.each([
    {
      extension: 'vue',
      hook: pluginVue().hooks?.['parser:before'],
      source: `<script setup lang="ts">
        import { css } from 'styled-system/css'
        const className = css({ color: 'red.300' })
      </script><template><div :class="className" /></template>`,
    },
    {
      extension: 'svelte',
      hook: pluginSvelte().hooks?.['parser:before'],
      source: `<script>
        import { css } from 'styled-system/css'
        const className = css({ color: 'red.300' })
      </script><div class={className} />`,
    },
    {
      extension: 'custom',
      hook: () => `import { css } from 'styled-system/css'; export const className = css({ color: 'red.300' })`,
      source: 'not javascript until the hook runs',
    },
  ])('$extension parser hook runs at parse time, not materialization time', ({ extension, hook, source }) => {
    const before = vi.fn(hook!)
    const directory = createFiles({ [`src/component.${extension}`]: source })
    const hooks = mergeHooks([{ name: `test-${extension}`, hooks: { 'parser:before': before } }])
    const context = new BambooContext(createConfig(directory, { hooks }))
    const file = path.join(directory, `src/component.${extension}`)

    expect(before).not.toHaveBeenCalled()
    expect(context.project.getSourceFile(file)).toBeDefined()
    expect(before).not.toHaveBeenCalled()

    const result = context.project.parseSourceFile(file)
    expect(before).toHaveBeenCalledTimes(1)
    expect(Array.from(result?.css ?? []).flatMap((entry) => entry.data)).toEqual([{ color: 'red.300' }])
  })

  test('first access preloads the complete cross-file style and recipe graph', () => {
    const { context, directory } = contextFor({
      'src/styles.ts': `export const base = { color: 'red.500' }`,
      'src/recipes.ts': `import { cva } from 'styled-system/css'
        export const badge = cva({ base: { padding: '2' }, variants: { tone: { info: { color: 'blue.500' } } } })`,
      'src/app.tsx': `import { css } from 'styled-system/css'
        import { badge } from './recipes'
        import { base } from './styles'
        export const className = css(base)
        export const recipeClass = badge({ tone: 'info' })`,
    })
    const app = path.join(directory, 'src/app.tsx')

    const result = context.project.parseSourceFile(app)!

    expect(Array.from(result.css).flatMap((entry) => entry.data)).toEqual([{ color: 'red.500' }])
    expect(Array.from(result.cvaCall).map((entry) => entry.data)).toEqual([[{ tone: 'info' }]])
    expect(result.importedRecipes.get('badge')?.filePath).toBe(path.join(directory, 'src/recipes.ts'))
  })

  test('first-access Project supports the create/add/reload/remove/dependents watch sequence', () => {
    const { context, directory } = contextFor({
      'src/styles.ts': `export const base = { color: 'red.500' }`,
      'src/app.tsx': `import { css } from 'styled-system/css'
        import { base } from './styles'
        export const className = css(base)`,
    })
    const styles = path.join(directory, 'src/styles.ts')
    const app = path.join(directory, 'src/app.tsx')
    const added = path.join(directory, 'src/added.ts')
    const project = context.project

    project.parseSourceFile(styles)
    expect(sourceStyles(context, app)).toEqual([{ color: 'red.500' }])
    expect(project.getDependents(styles)).toContain(app)

    project.addSourceFile(added, 'export const added = true')
    expect(project.getSourceFile(added)).toBeDefined()

    writeFileSync(styles, `export const base = { color: 'blue.500' }`)
    expect(project.reloadSourceFile(styles)).toBeDefined()
    project.parseSourceFile(styles)
    for (const dependent of project.getDependents(styles)) project.parseSourceFile(dependent)
    expect(sourceStyles(context, app)).toEqual([{ color: 'blue.500' }])

    expect(project.removeSourceFile(styles)).toBe(true)
    expect(project.getSourceFile(styles)).toBeUndefined()
    expect(project.getDependents(styles)).toContain(app)
  })
})
