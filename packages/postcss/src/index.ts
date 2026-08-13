import { Builder, findViteConfig, hasUncompilableSources, isStaticCompilerActive, setLogStream } from '@bamboocss/node'
import { logger } from '@bamboocss/logger'
import { createRequire } from 'module'
import path from 'path'
import type { PluginCreator, TransformCallback } from 'postcss'

const customRequire = createRequire(__dirname)

const PLUGIN_NAME = 'bamboocss'

export interface PluginOptions {
  configPath?: string
  cwd?: string
  logfile?: string
  allow?: RegExp[]
  /**
   * Confirm that styles resolving at runtime is the intent.
   *
   * This plugin emits CSS and does not compile source, so `css()` and `cva()` stay runtime
   * calls and the generated style engine ships to the client. In a project that has no Vite
   * plugin available that is simply the integration. In a Vite project it is a choice, and one
   * this plugin warns about — since the alternative, `@bamboocss/vite`, compiles those calls to
   * literal class strings and ships no engine at all.
   *
   * Set this to silence that warning where the choice is deliberate.
   *
   * @default false
   */
  runtimeStyling?: boolean
}

const interopDefault = (obj: any) => (obj && obj.__esModule ? obj.default : obj)

export const loadConfig = () => interopDefault(customRequire('@bamboocss/postcss'))

let stream: ReturnType<typeof setLogStream> | undefined

// export for unit test
export const builder = new Builder()
let builderGuard: Promise<void> | undefined

export const bamboocss: PluginCreator<PluginOptions> = (options = {}) => {
  const { configPath, cwd, logfile, allow, runtimeStyling = false } = options

  if (!stream && logfile) {
    stream = setLogStream({ cwd, logfile })
  }
  const postcssProcess: TransformCallback = async function (root, result) {
    const fileName = result.opts.from

    const skip = shouldSkip(fileName, allow)
    if (skip) return

    await builder.setup({ configPath, cwd })

    // ignore non-bamboo css file
    if (!builder.isValidRoot(root)) return

    // After `isValidRoot`, so it is said about a project actually emitting Bamboo's stylesheet
    // through PostCSS rather than about any stylesheet that passed through this plugin.
    //
    // Rooted at the bamboo config's own directory rather than at the cwd. `config.cwd` is only
    // assigned when a caller passed one, and the generated PostCSS config passes nothing, so it
    // otherwise falls back to wherever the build was launched — which in a monorepo, or under
    // `vite --root apps/web`, is not the project at all. The config file is found by searching
    // *upward*, so its directory is the one a `vite.config.ts` would sit in.
    if (!runtimeStyling) {
      const configPath = builder.context?.conf.path
      warnIfViteWithoutCompiler(
        configPath ? path.dirname(configPath) : (builder.context?.config.cwd ?? cwd ?? process.cwd()),
        builder.context?.config.include ?? [],
      )
    }

    await builder.emit()

    builder.extract()

    builder.registerDependency((dep) => {
      result.messages.push({
        ...dep,
        plugin: PLUGIN_NAME,
        parent: result.opts.from,
      })
    })

    builder.write(root)

    root.walk((node) => {
      if (!node.source) {
        node.source = root.source
      }
    })
  }

  return {
    postcssPlugin: PLUGIN_NAME,
    plugins: [
      function (...args) {
        builderGuard = Promise.resolve(builderGuard)
          .catch(() => {
            /**/
          })
          .then(() => postcssProcess(...args))
        return builderGuard
      },
    ],
  }
}

bamboocss.postcss = true

export default bamboocss

/**
 * A Vite project emitting the stylesheet through PostCSS is almost never what was meant.
 *
 * This plugin only emits CSS. `@bamboocss/vite` compiles every `css()`/`cva()` call to a
 * literal class string and ships no style engine, so the two are not two ways of doing the
 * same thing — and the difference is invisible from the outside. The stylesheet is correct
 * under both, the app renders under both, and the PostCSS one quietly carries the engine into
 * the client bundle. Bamboo's own React Router guide described exactly that setup, which is
 * how a project ends up here without deciding to.
 *
 * Detected from a Vite config in the project, and suppressed when a Bamboo source compiler is
 * loaded in this process — a project running both is a different mistake, and the one place
 * that says so is the Vite guide, since only that combination emits two stylesheets.
 *
 * A warning rather than an error, and once per project rather than once per stylesheet. The
 * combination is legal: a Vite project may want runtime styling, and `runtimeStyling: true`
 * says so and silences this. A project that only keeps a Vite config for its tests is the
 * false positive, and the message is written to be readable as "not applicable" by whoever
 * sees it.
 */
/**
 * Answered once per project, whichever way it comes out.
 *
 * Keyed rather than a boolean because one process can build more than one project, and cached
 * on the quiet answer as well as the loud one: a Svelte project takes the `hasUncompilableSources`
 * branch, which reads a `package.json` and stats up to six paths, and this runs on every
 * stylesheet pass — meaning every rebuild, for the length of a dev session.
 */
const decidedProjects = new Set<string>()

const warnIfViteWithoutCompiler = (cwd: string, include: readonly string[]) => {
  if (decidedProjects.has(cwd)) return
  // Not cached: the flag arrives when a Vite config is evaluated, which can be after the first
  // stylesheet in an unusual order, and answering "no compiler" permanently on that basis is
  // the one wrong answer worth re-checking.
  if (isStaticCompilerActive()) return
  if (!findViteConfig(cwd)) {
    decidedProjects.add(cwd)
    return
  }
  // A Svelte or Vue project is not making the mistake this describes: its components are not
  // files the Vite compiler transforms, so PostCSS is the integration it should be on.
  if (hasUncompilableSources({ cwd, include })) {
    decidedProjects.add(cwd)
    return
  }

  decidedProjects.add(cwd)
  logger.warn(
    PLUGIN_NAME,
    'This project has a Vite config, and Bamboo is emitting its stylesheet through PostCSS. ' +
      'That works, and it is not the Vite integration: this plugin emits CSS only, so `css()` and ' +
      '`cva()` calls stay runtime calls and the generated style engine ships in your client bundle. ' +
      'Add `@bamboocss/vite` to the `plugins` in your Vite config to compile them away instead, and ' +
      'remove this plugin from your PostCSS config — each emits a complete stylesheet, so keeping ' +
      'both puts two copies of it in the bundle. If runtime styling is what you want, or Vite is ' +
      'only here for tests, pass `{ runtimeStyling: true }` to silence this.',
  )
}

const nodeModulesRegex = /node_modules/

function isValidCss(file: string) {
  const [filePath] = file.split('?')
  return path.extname(filePath) === '.css'
}

const shouldSkip = (fileName: string | undefined, allow: PluginOptions['allow']) => {
  if (!fileName) return true
  if (!isValidCss(fileName)) return true
  if (allow?.some((p) => p.test(fileName))) return false
  return nodeModulesRegex.test(fileName)
}
