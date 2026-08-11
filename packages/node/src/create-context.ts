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

/** A thrown value's message, for a `catch` binding that is typed `unknown`. */
const messageOf = (error: unknown) => (error instanceof Error ? error.message : String(error))

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

  /**
   * Files whose extraction threw, keyed by path, holding what it threw.
   *
   * A parse failure is not an opinion about a build that still works. The file's styles never
   * reach the encoder, so every rule it would have contributed is absent from the stylesheet
   * and the classes its components ask for have nothing behind them — the same shape as a
   * naming disagreement, and the reverse of `reportUnresolvedStyles`, where what the build
   * *did* see still applies. Logging it and carrying on is how a build printed error-level
   * lines, dropped rules, and exited 0.
   *
   * Retained rather than rethrown from the `catch`, so one pass names every broken file
   * instead of the first. Keyed by file, so a failure survives the incremental passes that
   * skip an unchanged file: nothing re-parses it, and its styles stay missing until it does.
   *
   * The error rather than its message, so `assertExtracted` can hand the originals on as a
   * `cause`. The aggregate carries a code of its own — `ERR_BAMBOO_EXTRACT_FAILED` — and the
   * codes underneath it are what a caller has to read to tell a retired token spelling from a
   * syntax error.
   */
  parseFailures = new Map<string, unknown>()

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

  /**
   * Fail the build if any file's extraction threw.
   *
   * Called at the end of an extraction pass rather than from the `catch`, so the message names
   * every broken file at once — a config with one retired token spelling in six components is
   * fixed once, not six builds in a row.
   *
   * This is what makes the integrations agree. `cssgen` already exited non-zero on a file it
   * could not extract, by letting the throw through; every bundler goes through `parseFile`,
   * which caught it. CI running a build passed what CI running `cssgen` rejected, over the same
   * source.
   *
   * `files` is the set still in scope, which the caller has usually just globbed. Deleting the
   * offending file, or taking it out of `include`, is a *fix* — and nothing re-parses a file
   * that is gone, so the entry that outlived it would fail every later build, naming a path
   * that no longer exists. A context outlives rebuilds (it is replaced only when the config
   * changes) and both long-lived integrations hold one, so that wedged a dev server until the
   * process was restarted.
   */
  assertExtracted = (files?: Iterable<string>) => {
    // Before the glob, so the common case costs nothing: no failures, no question to ask.
    if (!this.parseFailures.size) return

    const inScope = new Set(
      Array.from(files ?? this.getFiles(), (file) => this.runtime.path.abs(this.config.cwd, file)),
    )

    for (const file of this.parseFailures.keys()) {
      if (!inScope.has(file)) this.parseFailures.delete(file)
    }

    if (!this.parseFailures.size) return

    // Relative to `cwd`, like `formatDeclined` beside it — an absolute path per entry buries
    // the part that differs. Non-empty lines only, so a message with a blank line between
    // paragraphs does not gain a line of trailing whitespace per paragraph.
    const detail = Array.from(this.parseFailures.entries())
      .map(([file, error]) => `${this.relative(file)}\n${messageOf(error).replace(/^(?=.)/gm, '  ')}`)
      .join('\n\n')

    throw new BambooError(
      'EXTRACT_FAILED',
      `${this.parseFailures.size} file(s) could not be extracted:\n\n${detail}\n\n` +
        `Nothing emits a rule for a file the build could not read, so every style in these is ` +
        `absent from the stylesheet and the classes their components ask for have nothing behind ` +
        `them.`,
      {
        // Always an `AggregateError`, including for one file, so a caller reads `cause.errors`
        // without first testing how many there were. This aggregates by construction — six
        // broken files can throw six different errors — and flattening that to whichever came
        // first would hand back an arbitrary one of them.
        cause: new AggregateError(
          Array.from(this.parseFailures.values()),
          `${this.parseFailures.size} file(s) could not be extracted`,
        ),
      },
    )
  }

  /** A path as the user typed it, when it is under `cwd`. */
  private relative = (file: string) =>
    file.startsWith(this.config.cwd) ? file.slice(this.config.cwd.length + 1) : file

  parseFile = (filePath: string, styleEncoder?: StyleEncoder) => {
    const file = this.runtime.path.abs(this.config.cwd, filePath)
    logger.debug('file:extract', file)

    const measure = logger.time.debug(`Parsed ${file}`)

    let result: ParserResult | undefined

    try {
      const encoder = styleEncoder || this.parserOptions.encoder
      result = this.project.parseSourceFile(file, encoder)
      this.parseFailures.delete(file)
    } catch (error) {
      logger.caughtError('file:extract', `Failed to parse ${file}`, error)
      this.parseFailures.set(file, error)
    }

    if (result) this.reportUnresolvedStyles(result)

    measure()
    return result
  }

  /**
   * Extract every file in one pass, and fail on the ones that could not be read.
   *
   * Routed through `parseFile` rather than parsing directly, so the two entry points cannot
   * disagree about what a failure means. This one used to let the first throw out, which is
   * why `cssgen` and a bundler build reported different things about the same source.
   */
  parseFiles = (styleEncoder?: StyleEncoder) => {
    const encoder = styleEncoder || this.parserOptions.encoder

    const files = this.getFiles()
    const filesWithCss = [] as string[]
    const results = [] as ParserResult[]

    files.forEach((file) => {
      // `parseFile` reports unresolved styles itself, before the empty checks below: a file
      // whose only `css()` call was unresolvable produces no styles at all, which is exactly
      // the case worth warning about.
      const result = this.parseFile(file, encoder)

      if (!result || result.isEmpty() || encoder.isEmpty()) return

      filesWithCss.push(file)
      results.push(result)
    })

    this.assertExtracted(files)

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
        await reportRebuildFailure(() => cb(file))
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
        await reportRebuildFailure(() => cb(event, file))
      }),
    )
  }
}

/**
 * Report a failed rebuild as a failed rebuild.
 *
 * Chokidar is an `EventEmitter`, so it discards whatever a listener returns, and the debounce
 * wrapper attaches no rejection handler — a throw from inside a rebuild became a dangling
 * promise. `node-runtime.ts` then catches it as `Unhandled rejection`, which labels a config
 * error as an internal crash, leaves the exit code at 0, and is suppressed entirely at
 * `logLevel: 'silent'`. The initial build is caught by the CLI and prints properly; only
 * rebuilds of the identical source were silent, which is the worse half of the asymmetry.
 *
 * Caught rather than rethrown: a watcher's job is to survive a bad intermediate state and
 * rebuild when the next edit fixes it. What it must not do is claim success.
 */
async function reportRebuildFailure(run: () => void | Promise<void>) {
  try {
    await run()
  } catch (error) {
    logger.error('ctx:rebuild', error instanceof Error ? error.message : String(error))
  }
}
