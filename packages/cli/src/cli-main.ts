import { findConfig } from '@bamboocss/config'
import { colors, logger } from '@bamboocss/logger'
import {
  BambooContext,
  analyze,
  buildInfo,
  codegen,
  cssgen,
  debug,
  generate,
  loadConfigAndCreateContext,
  setLogStream,
  setupConfig,
  setupGitIgnore,
  setupPostcss,
  spec,
  startProfiling,
  type CssGenOptions,
} from '@bamboocss/node'
import { BambooError, compact } from '@bamboocss/shared'
import type { CssArtifactType } from '@bamboocss/types'
import { cac } from 'cac'
import { join, resolve } from 'path'
import { version } from '../package.json'
import { interactive } from './interactive'
import type {
  AnalyzeCommandFlags,
  CodegenCommandFlags,
  CssGenCommandFlags,
  DebugCommandFlags,
  EmitPackageCommandFlags,
  InitCommandFlags,
  MainCommandFlags,
  McpInitCommandFlags,
  ShipCommandFlags,
  SpecCommandFlags,
  StudioCommandFlags,
} from './types'

export async function main() {
  const cli = cac('bamboo')

  const cwd = process.cwd()

  cli
    .command('init', 'Initialize the bamboo config file')
    .option('-i, --interactive', 'Run in interactive mode', { default: false })
    .option('-f, --force', 'Force overwrite existing config file')
    .option('-p, --postcss', 'Emit postcss config file')
    .option('-c, --config <path>', 'Path to bamboo config file')
    .option('--cwd <cwd>', 'Current working directory', { default: cwd })
    .option('--silent', 'Suppress all messages except errors')
    .option('--no-gitignore', "Don't update the .gitignore")
    .option('--no-codegen', "Don't run the codegen logic")
    .option('--out-extension <ext>', "The extension of the generated js files (default: 'mjs')")
    .option('--outdir <dir>', 'The output directory for the generated files')
    .option('--jsx-framework <framework>', 'The jsx framework to use')
    .option('--syntax <syntax>', 'The css syntax preference')
    .option('--strict-tokens', 'Using strictTokens: true')
    .option('--logfile <file>', 'Outputs logs to a file')
    .action(async (initFlags: Partial<InitCommandFlags> = {}) => {
      let options = {}

      if (initFlags.interactive) {
        options = await interactive()
      }

      const flags = { ...initFlags, ...options }

      const { force, postcss, silent, gitignore, outExtension, jsxFramework, config: configPath, syntax } = flags

      const cwd = resolve(flags.cwd ?? '')

      if (silent) {
        logger.level = 'silent'
      }

      const stream = setLogStream({ cwd, logfile: flags.logfile })

      logger.info('cli', `Bamboo v${version}\n`)

      const done = logger.time.info('✨ Bamboo initialized')

      if (postcss) {
        await setupPostcss(cwd)
      }

      await setupConfig(
        cwd,
        compact({
          force,
          outExtension,
          jsxFramework,
          syntax,
          outdir: flags.outdir,
        }),
      )

      const ctx = await loadConfigAndCreateContext({
        cwd,
        configPath,
        config: compact({ gitignore, outdir: flags.outdir }),
      })

      if (gitignore) {
        setupGitIgnore(ctx)
      }

      if (flags.codegen) {
        const { msg, box } = await codegen(ctx)
        logger.log(msg + box)
      } else {
        logger.log(ctx.initMessage())
      }

      done()

      stream.end()
    })

  cli
    .command('codegen', 'Generate the bamboo system')
    .option('--silent', "Don't print any logs")
    .option('--clean', 'Clean the output directory before generating')
    .option('-c, --config <path>', 'Path to bamboo config file')
    .option('-w, --watch', 'Watch files and rebuild')
    .option('-p, --poll', 'Use polling instead of filesystem events when watching')
    .option('--cwd <cwd>', 'Current working directory', { default: cwd })
    .option('--cpu-prof', 'Generates a `.cpuprofile` to help debug performance issues')
    .option('--logfile <file>', 'Outputs logs to a file')
    .action(async (flags: CodegenCommandFlags) => {
      const { silent, clean, config: configPath, watch, poll } = flags

      const cwd = resolve(flags.cwd ?? '')

      const stream = setLogStream({ cwd, logfile: flags.logfile })

      let stopProfiling: Function = () => void 0
      if (flags.cpuProf) {
        stopProfiling = await startProfiling(cwd, 'codegen', flags.watch)
      }

      if (silent) {
        logger.level = 'silent'
      }

      let ctx = await loadConfigAndCreateContext({
        cwd,
        config: { clean },
        configPath,
      })

      const { msg } = await codegen(ctx)
      logger.log(msg)

      if (watch) {
        ctx.watchConfig(
          async () => {
            const affecteds = await ctx.diff.reloadConfigAndRefreshContext((conf) => {
              ctx = new BambooContext(conf)
            })

            await ctx.hooks['config:change']?.({ config: ctx.config, changes: affecteds })
            await codegen(ctx, Array.from(affecteds.artifacts))
            logger.info('ctx:updated', 'config rebuilt ✅')
          },
          { cwd, poll },
        )
      } else {
        stream.end()
      }

      stopProfiling()
    })

  cli
    .command(
      'cssgen [globOrType]',
      'Generate the css from files, or generate the css from the specified type which can be: preflight, tokens, static, global, keyframes',
    )
    .option('--silent', "Don't print any logs")
    .option('-m, --minify', 'Minify generated code')
    .option('--clean', 'Clean the output before generating')
    .option('-c, --config <path>', 'Path to bamboo config file')
    .option('-w, --watch', 'Watch files and rebuild')
    .option('--minimal', 'Do not include CSS generation for theme tokens, preflight, keyframes, static and global css')
    .option('--lightningcss', 'Use `lightningcss` instead of `postcss` for css optimization.')
    .option('--polyfill', 'Polyfill CSS @layers at-rules for older browsers.')
    .option('-p, --poll', 'Use polling instead of filesystem events when watching')
    .option('-o, --outfile [file]', "Output file for extracted css, default to './styled-system/styles.css'")
    .option('--splitting', 'Emit CSS as separate files per layer (reset, global, tokens, utilities) and per recipe')
    .option('--cwd <cwd>', 'Current working directory', { default: cwd })
    .option('--cpu-prof', 'Generates a `.cpuprofile` to help debug performance issues')
    .option('--logfile <file>', 'Outputs logs to a file')
    .action(async (maybeGlob?: string, flags: CssGenCommandFlags = {}) => {
      const { silent, config: configPath, outfile, watch, poll, minimal, splitting, ...rest } = flags

      const cwd = resolve(flags.cwd ?? '')
      const stream = setLogStream({ cwd, logfile: flags.logfile })

      let stopProfiling: Function = () => void 0
      if (flags.cpuProf) {
        stopProfiling = await startProfiling(cwd, 'cssgen', flags.watch)
      }

      const cssArtifact = ['preflight', 'tokens', 'static', 'global', 'keyframes'].find(
        (type) => type === maybeGlob,
      ) as CssArtifactType | undefined

      const glob = cssArtifact ? undefined : maybeGlob

      if (silent) {
        logger.level = 'silent'
      }

      const overrideConfig = {
        ...rest,
        ...(glob ? { include: [glob] } : undefined),
      }

      let ctx = await loadConfigAndCreateContext({
        cwd,
        config: overrideConfig,
        configPath,
      })

      const options: CssGenOptions = {
        cwd,
        outfile,
        type: cssArtifact,
        minimal,
        splitting,
      }

      await cssgen(ctx, options)

      if (watch) {
        //
        ctx.watchConfig(
          async () => {
            const affecteds = await ctx.diff.reloadConfigAndRefreshContext((conf) => {
              ctx = new BambooContext(conf)
            })

            await ctx.hooks['config:change']?.({ config: ctx.config, changes: affecteds })
            await cssgen(ctx, options)
            logger.info('ctx:updated', 'config rebuilt ✅')
          },
          { cwd, poll },
        )

        ctx.watchFiles(async (event, file) => {
          if (event === 'unlink') {
            ctx.project.removeSourceFile(ctx.runtime.path.abs(cwd, file))
          } else if (event === 'change') {
            ctx.project.reloadSourceFile(ctx.runtime.path.abs(cwd, file))
            await cssgen(ctx, options)
          } else if (event === 'add') {
            ctx.project.createSourceFile(ctx.runtime.path.abs(cwd, file))
            await cssgen(ctx, options)
          }
        })
      } else {
        stream.end()
        stopProfiling()
      }
    })

  cli
    .command('[files]', 'Include file glob', { ignoreOptionDefaultValue: true })
    .option('-o, --outdir <dir>', 'Output directory', { default: 'styled-system' })
    .option('-m, --minify', 'Minify generated code')
    .option('-w, --watch', 'Watch files and rebuild')
    .option('-p, --poll', 'Use polling instead of filesystem events when watching')
    .option('-c, --config <path>', 'Path to bamboo config file')
    .option('--cwd <cwd>', 'Current working directory', { default: cwd })
    .option('--preflight', 'Enable css reset')
    .option('--silent', 'Suppress all messages except errors')
    .option('-e, --exclude <files>', 'Exclude files', { default: [] })
    .option('--clean', 'Clean output directory')
    .option('--hash', 'Hash the generated classnames to make them shorter')
    .option('--lightningcss', 'Use `lightningcss` instead of `postcss` for css optimization.')
    .option('--polyfill', 'Polyfill CSS @layers at-rules for older browsers.')
    .option('--emitTokensOnly', 'Whether to only emit the `tokens` directory')
    .option('--cpu-prof', 'Generates a `.cpuprofile` to help debug performance issues')
    .option('--logfile <file>', 'Outputs logs to a file')
    .action(async (files: string[], flags: MainCommandFlags) => {
      const { config: configPath, silent, ...rest } = flags

      const cwd = resolve(flags.cwd ?? '')
      const stream = setLogStream({ cwd, logfile: flags.logfile })

      let stopProfiling: Function = () => void 0
      if (flags.cpuProf) {
        stopProfiling = await startProfiling(cwd, 'cli', flags.watch)
      }

      if (silent) {
        logger.level = 'silent'
      }

      const config = compact({ include: files, ...rest, cwd })
      await generate(config, configPath)

      stopProfiling()

      if (!flags.watch) {
        stream.end()
      }
    })

  cli
    .command('spec', 'Generate spec files for your theme (useful for documentation)')
    .option('--silent', "Don't print any logs")
    .option('--outdir <dir>', 'Output directory for spec files')
    .option('-c, --config <path>', 'Path to bamboo config file')
    .option('--cwd <cwd>', 'Current working directory', { default: cwd })
    .action(async (flags: SpecCommandFlags) => {
      const { silent, config: configPath, outdir } = flags
      const cwd = resolve(flags.cwd ?? '')

      if (silent) {
        logger.level = 'silent'
      }

      const ctx = await loadConfigAndCreateContext({
        cwd,
        configPath,
        config: { cwd },
      })

      await spec(ctx, { outdir })
    })

  cli
    .command('studio', 'Realtime documentation for your design tokens')
    .option('--build', 'Build')
    .option('--preview', 'Preview')
    .option('--port <port>', 'Port')
    .option('--host', 'Host')
    .option('-c, --config <path>', 'Path to bamboo config file')
    .option('--cwd <cwd>', 'Current working directory', { default: cwd })
    .option('--outdir <dir>', 'Output directory for static files')
    .option('--base <path>', 'Base path of project')
    .action(async (flags: StudioCommandFlags) => {
      const { build, preview, port, host, outdir, config, base } = flags

      const cwd = resolve(flags.cwd ?? '')

      const ctx = await loadConfigAndCreateContext({
        cwd,
        configPath: config,
      })

      const buildOpts = {
        configPath: findConfig({ cwd, file: config })!,
        outDir: resolve(outdir || ctx.studio.outdir),
        port,
        host,
        base,
      }

      let studio: any

      try {
        const studioPath = require.resolve('@bamboocss/studio', { paths: [cwd] })
        studio = require(studioPath)
      } catch (error) {
        throw new BambooError('MISSING_STUDIO', "You need to install '@bamboocss/studio' to use this command", {
          cause: error,
        })
      }

      if (preview) {
        await studio.previewStudio(buildOpts)
      } else if (build) {
        await studio.buildStudio(buildOpts)
      } else {
        await studio.serveStudio(buildOpts)

        const note = `use ${colors.reset(colors.bold('--build'))} to build`
        const port = `use ${colors.reset(colors.bold('--port'))} for a different port`
        logger.log(colors.dim(`  ${colors.green('➜')}  ${colors.bold('Build')}: ${note}`))
        logger.log(colors.dim(`  ${colors.green('➜')}  ${colors.bold('Port')}: ${port}`))
      }
    })

  cli
    .command('analyze [glob]', 'Analyze design token usage in glob')
    .option('--outfile [filepath]', 'Output analyze report in JSON')
    .option('--silent', "Don't print any logs")
    .option('--scope <type>', 'Select analysis scope (token or recipe)')
    .option('-c, --config <path>', 'Path to bamboo config file')
    .option('--cwd <cwd>', 'Current working directory', { default: cwd })
    .action(async (maybeGlob?: string, flags: AnalyzeCommandFlags = {}) => {
      const { silent, config: configPath, scope } = flags

      const tokenScope = scope == null || scope === 'token'
      const recipeScope = scope == null || scope === 'recipe'

      const cwd = resolve(flags.cwd!)

      if (silent) {
        logger.level = 'silent'
      }

      const ctx = await loadConfigAndCreateContext({
        cwd,
        config: maybeGlob ? { include: [maybeGlob] } : undefined,
        configPath,
      })

      const result = analyze(ctx)

      if (flags?.outfile && typeof flags.outfile === 'string') {
        await result.writeReport(flags.outfile)
        logger.info('cli', `JSON report saved to ${resolve(flags.outfile)}`)
        return
      }

      if (tokenScope) {
        if (!ctx.tokens.isEmpty) {
          const tokenAnalysis = result.getTokenReport()
          logger.info('analyze:tokens', `Token usage report 🎨 \n${tokenAnalysis.formatted}`)
        } else {
          logger.info('analyze:tokens', 'No tokens found')
        }
      }

      if (recipeScope) {
        if (!ctx.recipes.isEmpty()) {
          const recipeAnalysis = result.getRecipeReport()
          logger.info('analyze:recipes', `Config recipes usage report 🎛️ \n${recipeAnalysis.formatted}`)
        } else {
          logger.info('analyze:recipes', 'No config recipes found')
        }
      }
    })

  cli
    .command('debug [glob]', 'Debug design token extraction & css generated from files in glob')
    .option('--silent', "Don't print any logs")
    .option('--dry', 'Output debug files in stdout without writing to disk')
    .option('--outdir [dir]', "Output directory for debug files, default to './styled-system/debug'")
    .option('--only-config', "Should only output the config file, default to 'false'")
    .option('-c, --config <path>', 'Path to bamboo config file')
    .option('--cwd <cwd>', 'Current working directory', { default: cwd })
    .option('--cpu-prof', 'Generates a `.cpuprofile` to help debug performance issues')
    .option('--logfile <file>', 'Outputs logs to a file')
    .action(async (maybeGlob?: string, flags: DebugCommandFlags = {}) => {
      const { silent, dry = false, outdir: outdirFlag, config: configPath } = flags ?? {}

      const cwd = resolve(flags.cwd!)
      const stream = setLogStream({ cwd, logfile: flags.logfile })

      let stopProfiling: Function = () => void 0
      if (flags.cpuProf) {
        stopProfiling = await startProfiling(cwd, 'debug')
      }

      if (silent) {
        logger.level = 'silent'
      }

      const ctx = await loadConfigAndCreateContext({
        cwd,
        config: maybeGlob ? { include: [maybeGlob] } : undefined,
        configPath,
      })

      const outdir = outdirFlag ?? join(...ctx.paths.root, 'debug')

      await debug(ctx, { outdir, dry, onlyConfig: flags.onlyConfig })

      stopProfiling()
      stream.end()
    })

  cli
    .command('ship [glob]', 'Ship extract result from files in glob')
    .option('--silent', "Don't print any logs")
    .option(
      '--o, --outfile [file]',
      "Output path for the build info file, default to './styled-system/bamboo.buildinfo.json'",
    )
    .option('-m, --minify', 'Minify generated JSON file')
    .option('-c, --config <path>', 'Path to bamboo config file')
    .option('--cwd <cwd>', 'Current working directory', { default: cwd })
    .option('-w, --watch', 'Watch files and rebuild')
    .option('-p, --poll', 'Use polling instead of filesystem events when watching')
    .action(async (maybeGlob?: string, flags: ShipCommandFlags = {}) => {
      const { silent, outfile: outfileFlag, minify, config: configPath, watch, poll } = flags

      const cwd = resolve(flags.cwd!)

      if (silent) {
        logger.level = 'silent'
      }

      let ctx = await loadConfigAndCreateContext({
        cwd,
        config: maybeGlob ? { include: [maybeGlob] } : undefined,
        configPath,
      })

      const outfile = outfileFlag ?? join(...ctx.paths.root, 'bamboo.buildinfo.json')

      if (minify) {
        ctx.config.minify = true
      }

      await buildInfo(ctx, outfile)

      if (watch) {
        ctx.watchConfig(
          async () => {
            const affecteds = await ctx.diff.reloadConfigAndRefreshContext((conf) => {
              ctx = new BambooContext(conf)
            })

            await ctx.hooks['config:change']?.({ config: ctx.config, changes: affecteds })
            await buildInfo(ctx, outfile)
            logger.info('ctx:updated', 'config rebuilt ✅')
          },
          { cwd, poll },
        )

        ctx.watchFiles(async (event, file) => {
          if (event === 'unlink') {
            ctx.project.removeSourceFile(ctx.runtime.path.abs(cwd, file))
          } else if (event === 'change') {
            ctx.project.reloadSourceFile(ctx.runtime.path.abs(cwd, file))
            await buildInfo(ctx, outfile)
          } else if (event === 'add') {
            ctx.project.createSourceFile(ctx.runtime.path.abs(cwd, file))
            await buildInfo(ctx, outfile)
          }
        })
      }
    })

  cli
    .command('emit-pkg', 'Emit package.json with entrypoints')
    .option('--outdir <dir>', 'Output directory', { default: '.' })
    .option('--base <source>', 'The base directory of the package.json entrypoints')
    .option('--silent', "Don't print any logs")
    .option('--cwd <cwd>', 'Current working directory', { default: cwd })
    .action(async (flags: EmitPackageCommandFlags) => {
      const { outdir, silent, base } = flags

      if (silent) {
        logger.level = 'silent'
      }

      const cwd = resolve(flags.cwd!)

      const ctx = await loadConfigAndCreateContext({
        cwd,
        config: { cwd },
      })

      const pkgPath = resolve(cwd, outdir, 'package.json')
      const exists = ctx.runtime.fs.existsSync(pkgPath)

      const exports = [] as any[]

      const createDir = (...dir: string[]) => {
        return ['.', base, ...dir].filter(Boolean).join('/')
      }

      const createEntry = (dir: string) => ({
        types: ctx.file.extDts(createDir(dir, 'index')),
        require: ctx.file.ext(createDir(dir, 'index')),
        import: ctx.file.ext(createDir(dir, 'index')),
      })

      exports.push(
        ['./css', createEntry('css')],
        ['./tokens', createEntry('tokens')],
        ['./types', createEntry('types')],
      )

      if (!ctx.patterns.isEmpty()) {
        exports.push(['./patterns', createEntry('patterns')])
      }

      if (!ctx.recipes.isEmpty()) {
        exports.push(['./recipes', createEntry('recipes')])
      }

      if (!ctx.patterns.isEmpty()) {
        exports.push(['./jsx', createEntry('jsx')])
      }

      if (ctx.config.themes) {
        exports.push(['./themes', createEntry('themes')])
      }

      const stylesDir = createDir('styles.css')

      const identity = {
        name: outdir,
        description: 'This package is auto-generated by Bamboo CSS',
        version: '0.1.0',
        type: 'module',
        keywords: ['bamboocss', 'styled-system', 'codegen'],
        license: 'ISC',
        scripts: {
          prepare: 'bamboo codegen --clean',
        },
      }

      const existing = exists ? JSON.parse(ctx.runtime.fs.readFileSync(pkgPath)) : {}

      /**
       * Codegen writes a package.json of its own into the outdir so that bundlers get a
       * `sideEffects` hint, and marks it `private` because a generated directory is not
       * something to publish. This command is what turns it into a real package: it
       * supplies the identity the file lacks and lifts that flag.
       *
       * This used to key on a missing `name`. Codegen now emits one — a nameless
       * package.json is what pnpm, npm and changesets refuse to scan rather than skip —
       * so its absence no longer distinguishes anything.
       *
       * `private` alone will not do either: a consumer can own a private *named* package
       * here, which is the `@acme/styled-system` workspace layout the component-library
       * guide recommends. What separates the two is `version`. Ours never carries one, and
       * a file that is private with no version is by definition not publishable and holds
       * no identity worth preserving, so supplying one is the whole point of the command.
       *
       * `existing` is spread last, so anything already declared wins and a second run
       * only refreshes `exports`.
       */
      const isGenerated = existing.private === true && existing.version === undefined
      const content = isGenerated ? { ...identity, ...existing } : existing
      if (isGenerated) delete content.private

      content.exports = {
        ...content.exports,
        ...Object.fromEntries(exports),
        './styles.css': stylesDir,
      }

      await ctx.runtime.fs.writeFile(pkgPath, JSON.stringify(content, null, 2) + '\n')

      logger.info('cli', `Emit package.json to ${pkgPath}`)
    })

  cli
    .command('mcp', 'Moved to the standalone @bamboocss/mcp package')
    .option('-c, --config <path>', 'Path to bamboo config file')
    .option('--cwd <cwd>', 'Current working directory', { default: cwd })
    .action(() => {
      // Kept as a command rather than deleted so the configs written before the move fail with
      // this instead of cac's "unknown command".
      //
      // Written to stderr directly rather than through the logger, which prints to stdout. A
      // stale config invokes this *as the server*, where stdout is the protocol channel the
      // client parses and discards, and stderr is what it surfaces in its logs.
      process.stderr.write(
        [
          'The MCP server now ships as its own package, so installing Bamboo no longer pulls in',
          'the Model Context Protocol SDK and its HTTP server dependencies.',
          '',
          'Run `bamboo init-mcp` to rewrite your client config, or start it directly with:',
          '',
          `  npx -y @bamboocss/mcp@${version}`,
          '',
        ].join('\n'),
      )
      process.exitCode = 1
    })

  cli
    .command('init-mcp', 'Initialize MCP configuration for AI clients')
    .option('--cwd <cwd>', 'Current working directory', { default: cwd })
    .option('--client <clients>', 'AI clients to configure (claude, cursor, vscode, windsurf, codex)')
    .action(async (mcpInitFlags: McpInitCommandFlags) => {
      const { initMcpConfig } = await import('./mcp-init')
      const resolvedCwd = resolve(mcpInitFlags.cwd ?? cwd)

      // Parse comma-separated clients if provided
      let clients: string[] | undefined
      if (mcpInitFlags.client) {
        clients = (Array.isArray(mcpInitFlags.client) ? mcpInitFlags.client : [mcpInitFlags.client])
          .flatMap((c) => c.split(','))
          .map((c) => c.trim())
      }

      await initMcpConfig({ cwd: resolvedCwd, clients: clients as any })
    })

  cli.help()

  cli.version(version)

  cli.parse(process.argv, { run: false })
  await cli.runMatchedCommand()
}
