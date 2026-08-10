import type { ParserOptions } from '@bamboocss/core'
import type {
  ConfigTsOptions,
  BambooHooks,
  ParserResultConfigureOptions,
  ParserResultInterface,
  Runtime,
} from '@bamboocss/types'
import {
  FileSystemRefreshResult,
  ScriptKind,
  SourceFile,
  Project as TsProject,
  ts,
  type ProjectOptions as TsProjectOptions,
} from 'ts-morph'
import { clearBoxNodeCache } from '@bamboocss/extractor'
import { classifyProject } from './classify'
import { clearImportedRecipeCache } from './imported-recipes'
import { createParser } from './parser'
import { ParserResult } from './parser-result'

/**
 * Everything memoized against another file's contents.
 *
 * Both caches answer a question about a *different* module than the one being parsed — what
 * an identifier resolved to, and which recipes a module exports — so both go stale on exactly
 * the same events, and clearing one without the other leaves the pair disagreeing.
 */
const invalidateResolutions = () => {
  clearBoxNodeCache()
  clearImportedRecipeCache()
}

// TS 6.0 rejects raw JSON compiler options (e.g. `target: "ESNext"`) in createProgram.
// They must be normalized to numeric enum values via TypeScript's own parser API first.
const normalizeCompilerOptions = (raw: ts.CompilerOptions | undefined): ts.CompilerOptions => {
  if (!raw) return {}
  const { options } = ts.convertCompilerOptionsFromJson(raw, process.cwd())
  return options
}

const createTsProject = (options: Partial<TsProjectOptions>) =>
  new TsProject({
    skipAddingFilesFromTsConfig: true,
    skipFileDependencyResolution: true,
    skipLoadingLibFiles: true,
    ...options,
    compilerOptions: {
      allowJs: true,
      strictNullChecks: false,
      skipLibCheck: true,
      ...normalizeCompilerOptions(options.compilerOptions),
    },
  })

export interface ProjectOptions extends TsProjectOptions {
  readFile: Runtime['fs']['readFileSync']
  getFiles(): string[]
  hooks: Partial<BambooHooks>
  parserOptions: ParserOptions
  tsOptions?: ConfigTsOptions
}

/**
 * How to parse a file, decided by its extension.
 *
 * Everything used to be `TSX`, which is not a superset of `TS`: the two disagree on exactly
 * the constructs where `<` is ambiguous. Under `TSX` a generic arrow `<T>(x: T) => x` and an
 * old-style assertion `<HTMLElement>node` parse as a *JSX element*, which then swallows the
 * rest of the file into its children. The file still reads fine and the bytes are unchanged;
 * the tree is simply wrong, and every `css()` call below the offending line stops existing as
 * far as extraction is concerned. It reports as styles that silently never got emitted.
 *
 * Only `.ts` moves. A `.ts` file cannot legally contain JSX — TypeScript requires `.tsx` for
 * that — so parsing one as `TSX` can only ever mis-parse, never accept something real.
 *
 * Everything else stays `TSX` deliberately:
 *
 * - `.js` and `.jsx` routinely carry JSX in projects that never adopted TypeScript, and `TSX`
 *   accepts the type syntax they do not use anyway.
 * - a single-file component is stored under its own extension after `parser:before` rewrites
 *   it to tsx, so `.vue` and `.svelte` have to keep parsing as tsx.
 * - an unknown extension is somebody's template that a hook may have compiled to jsx.
 */
const scriptKindFor = (filePath: string): ScriptKind => {
  const extension = filePath.slice(filePath.lastIndexOf('.')).toLowerCase()
  return extension === '.ts' || extension === '.mts' || extension === '.cts' ? ScriptKind.TS : ScriptKind.TSX
}

export class Project {
  project: TsProject
  parser: ReturnType<typeof createParser>

  get parserOptions() {
    return this.options.parserOptions
  }

  constructor(private options: ProjectOptions) {
    const { parserOptions } = options

    this.project = createTsProject(options)
    this.parser = createParser(parserOptions)
    this.createSourceFiles()
  }

  get files() {
    return this.options.getFiles()
  }

  /**
   * Reverse dependency graph: imported file -> files importing it, both keyed on
   * the source file's own normalized path so lookups match regardless of whether
   * the caller passed a relative, aliased or platform-specific path.
   *
   * Populated while parsing. Cross-file extraction folds imported values into the
   * importer's output, so editing a shared style file has to re-parse everyone who
   * imports it — re-parsing only the changed file leaves consumers stale.
   */
  private dependents = new Map<string, Set<string>>()

  /** Forward edges, so a re-parse can retract exactly the previous ones. */
  private dependencies = new Map<string, Set<string>>()

  /**
   * Path as a caller spells it -> the source file's own path.
   *
   * The graph is keyed on the latter, but callers pass whatever the watcher gave
   * them. Resolving through the project covers that while the file is loaded;
   * this keeps it resolvable afterwards too, so asking which files imported a
   * *deleted* file still works and the unlink path does not depend on querying
   * before removal.
   */
  private canonicalPaths = new Map<string, string>()

  /**
   * Files holding at least one import whose specifier resolved to nothing.
   *
   * A broken or not-yet-created import produces no edge, so when the file it wants
   * finally appears there is nothing in the graph connecting them. These importers
   * are the only candidates for that, and the set is normally empty.
   */
  private unresolvedImporters = new Set<string>()

  /** Files whose imports did not all resolve when they were last parsed. */
  getUnresolvedImporters = (): string[] => [...this.unresolvedImporters]

  getSourceFile = (filePath: string): SourceFile | undefined => {
    return this.project.getSourceFile(filePath)
  }

  /** ts-morph reports forward slashes; normalize callers' paths to match on Windows. */
  private normalizePath = (filePath: string) => filePath.replaceAll('\\', '/')

  /**
   * Resolves a module specifier to a file already in the project.
   *
   * Deliberately not `decl.getModuleSpecifierSourceFile()`: that goes through the
   * symbol table, which forces `initializeTypeChecker` on first use and costs
   * hundreds of ms on a cold build. `ts.resolveModuleName` is purely a filesystem
   * lookup, and a shared cache keeps repeat specifiers off the disk.
   *
   * Looks the result up rather than adding it, so resolving `react` cannot pull a
   * `.d.ts` into the project. The graph only tracks files bamboo already scans.
   */
  private moduleResolutionCache: ts.ModuleResolutionCache | undefined

  /**
   * Everything memoized against the shape of the file tree, including the negative half.
   *
   * `resolveModuleName` caches failures too, so a specifier that resolved to nothing before
   * its target existed stays unresolved for the life of the process. That silently dropped a
   * dependency edge; now it would also leave a recipe permanently invisible to the module
   * importing it, since resolution is what finds one.
   */
  private invalidate = (fileTreeChanged = true) => {
    invalidateResolutions()
    // Only when the set of files could have changed. Overwriting a file the project already
    // holds cannot satisfy a resolution that previously failed, and `addSourceFile` runs once
    // per module on the transform path — dropping the cache there measured +50% on a module
    // with eight relative imports, for no correctness gained.
    if (fileTreeChanged) this.moduleResolutionCache = undefined
  }

  private resolveImport = (decl: { getModuleSpecifierValue(): string | undefined; getSourceFile(): SourceFile }) => {
    const moduleName = decl.getModuleSpecifierValue()
    if (!moduleName) return

    const compilerOptions = this.project.getCompilerOptions()
    this.moduleResolutionCache ??= ts.createModuleResolutionCache(
      this.project.getFileSystem().getCurrentDirectory(),
      (f) => f,
      compilerOptions,
    )

    const resolved = ts.resolveModuleName(
      moduleName,
      decl.getSourceFile().getFilePath(),
      compilerOptions,
      this.project.getModuleResolutionHost(),
      this.moduleResolutionCache,
    )

    const name = resolved.resolvedModule?.resolvedFileName
    return name ? this.project.getSourceFile(name) : undefined
  }

  /**
   * `resolveImport` in the shape a caller can use, for a specifier read off any declaration.
   *
   * Shares the module resolution cache above, so a barrel resolved while tracking
   * dependencies is not resolved again while looking for recipes.
   */
  private resolveModule = (specifier: string, from: SourceFile): SourceFile | undefined =>
    this.resolveImport({ getModuleSpecifierValue: () => specifier, getSourceFile: () => from })

  private trackDependencies = (filePath: string, sourceFile: SourceFile) => {
    const importer = this.normalizePath(sourceFile.getFilePath())
    this.canonicalPaths.set(this.normalizePath(filePath), importer)

    // Retract this file's previous edges, so an import removed by an edit stops
    // forcing a rebuild of a file it no longer depends on. Walking the forward
    // edges keeps this proportional to the file's own imports rather than to the
    // size of the whole graph, which would make a full parse quadratic.
    for (const previous of this.dependencies.get(importer) ?? []) {
      this.dependents.get(previous)?.delete(importer)
    }
    const current = new Set<string>()

    // Re-exports (`export { base } from './tokens'`) carry a module specifier too,
    // and are how a barrel file forwards styles, so they are dependencies as well.
    const declarations = [...sourceFile.getImportDeclarations(), ...sourceFile.getExportDeclarations()]

    let unresolved = false

    for (const decl of declarations) {
      const imported = this.resolveImport(decl)
      if (!imported) {
        // Bare package specifiers are never going to resolve into the project, so
        // they must not keep this file on the pending list forever.
        if (decl.getModuleSpecifierValue()?.startsWith('.')) unresolved = true
        continue
      }
      const importedPath = this.normalizePath(imported.getFilePath())
      if (importedPath === importer) continue
      const importers = this.dependents.get(importedPath) ?? new Set<string>()
      importers.add(importer)
      this.dependents.set(importedPath, importers)
      current.add(importedPath)
    }

    this.dependencies.set(importer, current)

    if (unresolved) this.unresolvedImporters.add(importer)
    else this.unresolvedImporters.delete(importer)
  }

  /**
   * Every file that transitively imports `filePath`, so a watcher can re-parse the
   * consumers of an edited file. Excludes `filePath` itself.
   */
  getDependents = (filePath: string): string[] => {
    // Callers pass whatever the watcher handed them — relative, aliased, or
    // platform-specific. The graph is keyed on the source file's own path, so
    // resolve through the project first rather than string-matching.
    const given = this.normalizePath(filePath)
    const resolved = this.project.getSourceFile(filePath)?.getFilePath()
    const start = resolved ? this.normalizePath(resolved) : (this.canonicalPaths.get(given) ?? given)
    const seen = new Set<string>()
    const queue = [start]

    while (queue.length) {
      const current = queue.shift()!
      for (const importer of this.dependents.get(current) ?? []) {
        if (importer === start || seen.has(importer)) continue
        seen.add(importer)
        queue.push(importer)
      }
    }

    return [...seen]
  }

  createSourceFile = (filePath: string): SourceFile => {
    const { readFile } = this.options
    // A file appearing can satisfy an import that previously resolved to nothing,
    // and this overwrites when the path already exists.
    this.invalidate()
    return this.project.createSourceFile(filePath, readFile(filePath), {
      overwrite: true,
      scriptKind: scriptKindFor(filePath),
    })
  }

  createSourceFiles = () => {
    const files = this.getFiles()
    for (const file of files) {
      this.createSourceFile(file)
    }
  }

  addSourceFile = (filePath: string, content: string): SourceFile => {
    // Resolutions memoized against other files' nodes can now be out of date.
    // Path-qualified, because `getSourceFile` falls back to a suffix search for a bare
    // filename — so `styles.ts` would match an existing `/app/styles.ts`, report the tree
    // unchanged, and leave a negative resolution cached against the `/styles.ts` this then
    // creates.
    this.invalidate(!(filePath.includes('/') && this.project.getSourceFile(filePath)))
    return this.project.createSourceFile(filePath, content, {
      overwrite: true,
      scriptKind: scriptKindFor(filePath),
    })
  }

  removeSourceFile = (filePath: string): boolean => {
    const sourceFile = this.project.getSourceFile(filePath)
    if (sourceFile) {
      // Importers memoized the values this file exported; without dropping them
      // they would keep emitting styles from a file that no longer exists.
      this.invalidate()
      return this.project.removeSourceFile(sourceFile)
    }
    return false
  }

  reloadSourceFile = (filePath: string): FileSystemRefreshResult | undefined => {
    // Same reason as `addSourceFile`: this is the watch-mode entry point for an
    // edit, and importers' memoized resolutions must not survive it. The file tree is
    // unchanged — this path re-reads a file the project already holds.
    this.invalidate(false)
    return this.getSourceFile(filePath)?.refreshFromFileSystemSync()
  }

  reloadSourceFiles = () => {
    const files = this.getFiles()

    // Once for the batch rather than per file: every file is about to be re-read,
    // so any resolution memoized against another file's contents is suspect.
    this.invalidate()

    for (const file of files) {
      const source = this.getSourceFile(file)
      source?.refreshFromFileSystemSync() ?? this.project.addSourceFileAtPath(file)
    }
  }

  get readFile() {
    return this.options.readFile
  }

  get getFiles() {
    return this.options.getFiles
  }

  parseJson = (filePath: string) => {
    const { readFile, parserOptions } = this.options

    const content = readFile(filePath)
    parserOptions.encoder.fromJSON(JSON.parse(content))

    const result = new ParserResult(parserOptions)
    return result.setFilePath(filePath)
  }

  parseSourceFile = (filePath: string, encoder?: ParserOptions['encoder']) => {
    const { hooks } = this.options

    if (filePath.endsWith('.json')) {
      return this.parseJson(filePath)
    }

    const sourceFile = this.project.getSourceFile(filePath)
    if (!sourceFile) return

    this.trackDependencies(filePath, sourceFile)

    const original = sourceFile.getText()

    const options: ParserResultConfigureOptions = {}
    const custom = hooks['parser:before']?.({
      filePath,
      content: original,
      configure(opts) {
        const { matchTag, matchTagMode, matchTagProp } = opts
        if (matchTag) {
          options.matchTag = matchTag
        }
        if (matchTagMode) {
          options.matchTagMode = matchTagMode
        }
        if (matchTagProp) {
          options.matchTagProp = matchTagProp
        }
      },
    })
    const transformed = custom ?? this.transformFile(filePath, original)

    // update SourceFile AST if content is different (.vue, .svelte)
    // or if the hook returned a different content
    if (original !== transformed) {
      sourceFile.replaceWithText(transformed)
    }

    const result = this.parser(sourceFile, encoder, options, this.resolveModule)?.setFilePath(filePath)

    hooks['parser:after']?.({ filePath, result })

    return result
  }

  transformFile = (_filePath: string, content: string): string => {
    return content
  }

  classify = (fileMap: Map<string, ParserResultInterface>) => {
    const { parserOptions } = this.options
    return classifyProject(parserOptions, fileMap)
  }
}
