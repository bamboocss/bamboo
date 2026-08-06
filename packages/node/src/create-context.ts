import type { StyleEncoder, Stylesheet } from '@bamboocss/core'
import { checkNamingAgreement, formatNamingDisagreement } from '@bamboocss/core'
import { Generator } from '@bamboocss/generator'
import { generateGroupRegistry, GROUP_REGISTRY_FILE } from '@bamboocss/generator'
import { logger } from '@bamboocss/logger'
import { ParserResult, Project } from '@bamboocss/parser'
import { BambooError, uniq } from '@bamboocss/shared'
import type { LoadConfigResult, Runtime, WatchOptions, WatcherEventType } from '@bamboocss/types'
import { debounce } from 'perfect-debounce'
import { createBox } from './cli-box'
import { DiffEngine } from './diff-engine'
import { nodeRuntime } from './node-runtime'
import { OutputEngine } from './output-engine'

export class BambooContext extends Generator {
  runtime: Runtime
  project: Project
  output: OutputEngine
  diff: DiffEngine
  explicitDeps: string[] = []

  constructor(conf: LoadConfigResult) {
    super(conf)

    const config = conf.config
    this.runtime = nodeRuntime

    config.cwd ||= this.runtime.cwd()

    if (config.logLevel) {
      logger.level = config.logLevel
    }

    this.project = new Project({
      ...conf.tsconfig,
      getFiles: this.getFiles.bind(this),
      readFile: this.runtime.fs.readFileSync.bind(this),
      hooks: conf.hooks,
      parserOptions: {
        ...this.parserOptions,
        join: this.runtime.path.join || this.parserOptions.join,
      },
    })

    this.output = new OutputEngine(this)
    this.diff = new DiffEngine(this)
    this.explicitDeps = this.getExplicitDependencies()

    // Once per build, against the config actually being built. A class name is derived
    // both here and in the browser, and the two only meet in the DOM — where a mismatch
    // is silent and total. Failing now costs a build; not failing ships a blank app.
    const disagreement = checkNamingAgreement(this)
    if (disagreement) {
      throw new BambooError('NAMING_DISAGREEMENT', formatNamingDisagreement(disagreement))
    }

    // `staticCss` enumerates atoms; `grouped` names whole `css()` calls. The rules are
    // emitted either way and remain valid to write by hand, but no class a grouped runtime
    // returns can match one — so a config pairing them is almost always reaching for the
    // dynamic-value escape hatch that `dynamic-styling.mdx` documents, and not getting it.
    if (config.cssMode === 'grouped' && config.staticCss?.css?.length) {
      logger.warn(
        'config',
        "`staticCss.css` does not back runtime `css()` calls under `cssMode: 'grouped'`. It pre-generates one rule per property and value, while a grouped class names a whole call. The rules are still emitted, but nothing the runtime returns will match them — see https://bamboocss.com/docs/references/config#cssmode",
      )
    }
  }

  /**
   * Report `css()` calls whose styles the build could not fully see.
   *
   * Only under `cssMode: 'grouped'`, and only as a warning: the build is not wrong, the
   * call site is unresolvable, and erroring would reject code that an `atomic` build
   * accepts. But under `grouped` that call renders the element with *no* styles rather
   * than merely losing a declaration, so it must not be silent.
   */
  reportUnresolvedStyles = (result: { unresolved?: ParserResult['unresolved'] }) => {
    const unresolved = result.unresolved
    if (!unresolved?.length) return

    for (const entry of unresolved) {
      const where = `${entry.filePath}:${entry.line}:${entry.column}`
      const prop = entry.prop ? `\`${entry.prop}\`` : 'a property'
      const why =
        entry.reason === 'missing-property'
          ? 'its value could not be evaluated at build time'
          : 'its value is not statically known'
      logger.warn(
        'grouped',
        `${where} — ${prop} will not reach the stylesheet because ${why}. Under \`cssMode: 'grouped'\` one class names the whole \`css()\` call, so this call cannot use one: it falls back to naming each declaration separately and keeps only the ones the build could resolve. Make the value static to group it. See https://bamboocss.com/docs/references/config#cssmode`,
      )
    }
  }

  private getExplicitDependencies = () => {
    const { cwd, dependencies } = this.config
    if (!dependencies) return []
    return this.runtime.fs.glob({ include: dependencies, cwd })
  }

  initMessage = () => {
    return createBox({
      content: this.messages.codegenComplete(),
      title: this.messages.exclamation(),
    })
  }

  getFiles = () => {
    const { include, exclude, cwd } = this.config
    return this.runtime.fs.glob({ include, exclude, cwd })
  }

  parseFile = (filePath: string, styleEncoder?: StyleEncoder) => {
    const file = this.runtime.path.abs(this.config.cwd, filePath)
    logger.debug('file:extract', file)

    const measure = logger.time.debug(`Parsed ${file}`)

    let result: ParserResult | undefined

    try {
      const encoder = styleEncoder || this.parserOptions.encoder
      result = this.project.parseSourceFile(file, encoder)
    } catch (error) {
      logger.caughtError('file:extract', `Failed to parse ${file}`, error)
    }

    if (result) this.reportUnresolvedStyles(result)

    measure()
    return result
  }

  parseFiles = (styleEncoder?: StyleEncoder) => {
    const encoder = styleEncoder || this.parserOptions.encoder

    const files = this.getFiles()
    const filesWithCss = [] as string[]
    const results = [] as ParserResult[]

    files.forEach((file) => {
      const measure = logger.time.debug(`Parsed ${file}`)
      const result = this.project.parseSourceFile(file, encoder)

      measure()
      // Before the empty checks below: a file whose only `css()` call was unresolvable
      // produces no styles at all, which is exactly the case worth warning about.
      if (result) this.reportUnresolvedStyles(result)
      if (!result || result.isEmpty() || encoder.isEmpty()) return

      filesWithCss.push(file)
      results.push(result)
    })

    // The batch path — `cssgen` and `generate` reach extraction through here rather than
    // through `Builder.extract`, which walks files one at a time for the PostCSS plugin.
    // Both finish extraction, so both refresh the registry; neither covers the other.
    this.writeGroupRegistry()

    return {
      filesWithCss,
      files,
      results,
    }
  }

  /**
   * Refresh the group registry the generated `css()` consults.
   *
   * `codegen` emits it empty — it runs on config change, before anything is extracted — so
   * this is the pass that fills it in. Called after extraction rather than alongside the
   * CSS, because the PostCSS plugin never writes a stylesheet to disk at all and would
   * otherwise never get one.
   *
   * Safe to run late or not at all: the runtime *adds* atomic names to the group class
   * rather than replacing it, so a stale registry costs a class that matches nothing.
   */
  writeGroupRegistry = () => {
    if (this.config.cssMode !== 'grouped' || this.isTemplateLiteralSyntax) return

    const names = this.getGroupRegistry()

    // An empty set means this pass extracted nothing — `codegen` on a config change, say.
    // Writing it would discard the set the last CSS build produced and leave every call
    // site degrading to group-plus-atomic names until the next one. Seed the file when it
    // is missing, so `css.mjs`'s import resolves on a fresh project, and otherwise leave a
    // populated one alone.
    if (!names.length) {
      // Joined exactly the way `OutputEngine.write` joins it — `paths.css` is already a
      // complete path, so prefixing `cwd` here would look for a file that never exists and
      // silently blank the registry anyway.
      const existing = this.runtime.path.join(...this.paths.css, this.file.ext(GROUP_REGISTRY_FILE))
      if (this.runtime.fs.existsSync(existing)) return
    }

    const registry = generateGroupRegistry(this, names)
    return this.output.write({
      id: 'css-fn',
      dir: this.paths.css,
      files: [
        { file: this.file.ext(GROUP_REGISTRY_FILE), code: registry.js },
        { file: this.file.extDts(GROUP_REGISTRY_FILE), code: registry.dts },
      ],
    })
  }

  writeCss = (sheet?: Stylesheet) => {
    logger.info('css', this.runtime.path.join(...this.paths.root, 'styles.css'))
    return this.output.write({
      id: 'styles.css',
      dir: this.paths.root,
      files: [{ file: 'styles.css', code: this.getCss(sheet) }],
    })
  }

  writeSplitCss = async (sheet: Stylesheet) => {
    const { path: pathUtil, fs } = this.runtime
    const rootDir = this.paths.root
    const stylesDir = [...rootDir, 'styles']

    // Get all artifacts from the generator
    const artifacts = this.getSplitCssArtifacts(sheet)

    // Derive and create directories from artifacts
    const subDirs = new Set([...artifacts.recipes, ...artifacts.themes].map((a) => a.dir).filter(Boolean))
    fs.ensureDirSync(pathUtil.join(...stylesDir))
    subDirs.forEach((dir) => fs.ensureDirSync(pathUtil.join(...stylesDir, dir!)))

    // Collect all files for batched write
    const styleFiles: Array<{ file: string; code: string }> = []

    // Layer files
    for (const layer of artifacts.layers) {
      styleFiles.push({ file: layer.file, code: layer.code })
      logger.info('css', pathUtil.join(...stylesDir, layer.file))
    }

    // Recipe files
    for (const recipe of artifacts.recipes) {
      styleFiles.push({ file: `${recipe.dir}/${recipe.file}`, code: recipe.code })
      logger.info('css', pathUtil.join(...stylesDir, recipe.dir!, recipe.file))
    }

    // Recipes index
    if (artifacts.recipes.length) {
      styleFiles.push({ file: 'recipes.css', code: artifacts.recipesIndex })
      logger.info('css', pathUtil.join(...stylesDir, 'recipes.css'))
    }

    // Theme files
    for (const theme of artifacts.themes) {
      styleFiles.push({ file: `${theme.dir}/${theme.file}`, code: theme.code })
      logger.info('css', pathUtil.join(...stylesDir, theme.dir!, theme.file))
    }

    // Write all split files to styles/ directory
    await this.output.write({
      id: 'styles',
      dir: stylesDir,
      files: styleFiles,
    })

    // Write main styles.css
    logger.info('css', pathUtil.join(...rootDir, 'styles.css'))
    await this.output.write({
      id: 'styles.css',
      dir: rootDir,
      files: [{ file: 'styles.css', code: artifacts.index }],
    })
  }

  watchConfig = (cb: (file: string) => void | Promise<void>, opts?: Omit<WatchOptions, 'include'>) => {
    const { cwd, poll, exclude } = opts ?? {}
    logger.info('ctx:watch', this.messages.configWatch())

    const watcher = this.runtime.fs.watch({
      include: uniq([...this.explicitDeps, ...this.conf.dependencies]),
      exclude,
      cwd,
      poll,
    })

    watcher.on(
      'change',
      debounce(async (file) => {
        logger.info('ctx:change', 'config changed, rebuilding...')
        await cb(file)
      }),
    )
  }

  watchFiles = (
    cb: (event: WatcherEventType, file: string) => void | Promise<void>,
    opts?: Omit<WatchOptions, 'include' | 'exclude' | 'poll' | 'cwd' | 'logger'>,
  ) => {
    const { include, exclude, poll, cwd } = this.config
    logger.info('ctx:watch', this.messages.watch())

    const watcher = this.runtime.fs.watch({
      ...opts,
      include,
      exclude,
      poll,
      cwd,
    })

    watcher.on(
      'all',
      debounce(async (event, file) => {
        logger.info(`file:${event}`, file)
        await cb(event, file)
      }),
    )
  }
}
