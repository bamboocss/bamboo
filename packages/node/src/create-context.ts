import type { StyleEncoder, Stylesheet } from '@bamboocss/core'
import { checkNamingAgreement, formatNamingDisagreement } from '@bamboocss/core'
import { Generator } from '@bamboocss/generator'
import { logger } from '@bamboocss/logger'
import { ParserResult, Project } from '@bamboocss/parser'
import { BambooError, uniq } from '@bamboocss/shared'
import type { LoadConfigResult, Runtime, WatchOptions, WatcherEventType } from '@bamboocss/types'
import { debounce } from 'perfect-debounce'
import { createBox } from './cli-box'
import { DiffEngine } from './diff-engine'
import { nodeRuntime } from './node-runtime'
import { OutputEngine } from './output-engine'

/**
 * What each loss is, and what the author can do about it.
 *
 * Kept apart from the sentence around it so every reason has to answer both questions.
 * "Make the value static" is the fix for a value the build could not evaluate and no help
 * at all for two arguments it could not tell apart, and a diagnostic that gives the wrong
 * instruction is worse than one that gives none.
 */
const unresolvedReasons: Record<ParserResult['unresolved'][number]['reason'], (prop: string) => [string, string]> = {
  'unresolvable-value': (prop) => [
    `${prop} will not reach the stylesheet because its value is not statically known`,
    'Make the value static to group it.',
  ],
  'missing-property': (prop) => [
    `${prop} will not reach the stylesheet because its value could not be evaluated at build time`,
    'Make the value static to group it.',
  ],
  'unenumerable-keys': () => [
    'an object spread or computed key leaves the build unable to tell which properties this call sets',
    'Write the properties out, or spread a value the build can resolve, to group it.',
  ],
  'unresolved-raw': (prop) => [
    `${prop}.raw() composes its own props rather than its styles, so ${prop}'s declarations will not reach the stylesheet`,
    `Call it instead — cx(${prop}(props), css({ … })) — or move the overrides into ${prop} itself.`,
  ],
}

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
  }

  /**
   * Report `css()` calls whose styles the build could not fully see.
   *
   * A warning rather than an error: the build is not wrong, the call site is unresolvable,
   * and the declarations it did resolve still apply. But the ones it could not have no rule
   * behind them and are simply absent, so it must not be silent.
   */
  reportUnresolvedStyles = (result: { unresolved?: ParserResult['unresolved'] }) => {
    const unresolved = result.unresolved
    if (!unresolved?.length) return

    for (const entry of unresolved) {
      const where = `${entry.filePath}:${entry.line}:${entry.column}`
      const prop = entry.prop ? `\`${entry.prop}\`` : 'a property'
      const [what] = unresolvedReasons[entry.reason](prop)

      // A recipe does not degrade the way a `css()` call does, so it does not get the same
      // explanation. Its classes are named from a hash of its config: a
      // declaration the build cannot see changes that hash, the browser asks for a name no
      // rule was emitted under, and *every* style is lost rather than the unresolved one.
      if (entry.kind === 'recipe') {
        // The path is what makes several losses in one config distinguishable — without
        // it they render as identical lines at the same position.
        const at = entry.prop ? ` at \`${entry.prop}\`` : ''
        logger.warn(
          'recipe',
          `${where} — ${what}${at}. A recipe's classes are named from a hash of its config, so a declaration the build cannot see gives the build and the browser different names and the element renders with no styles at all. Set \`className\` on the recipe, so its name does not depend on what the build could resolve. See https://bamboocss.com/docs/concepts/recipes`,
        )
        continue
      }

      {
        // The loss is partial rather than total — what the build saw still applies — so the
        // wording says which half is missing rather than implying the element is unstyled.
        const at = entry.prop ? ` at \`${entry.prop}\`` : ''
        logger.warn(
          'css',
          `${where} — ${what}${at}. The build emits a rule per declaration it can see, and the runtime names a class for every declaration the object actually has — so the ones it could not see have no rule behind them and are simply absent. Write the value out, or generate it with \`staticCss\` if it is genuinely dynamic. See https://bamboocss.com/docs/guides/dynamic-styling`,
        )
      }
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

    return {
      filesWithCss,
      files,
      results,
    }
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
