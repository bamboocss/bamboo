import { findConfig } from '@bamboocss/config'
import { messages } from '@bamboocss/core'
import { logger, quote } from '@bamboocss/logger'
import { BambooError } from '@bamboocss/shared'
import type { Config } from '@bamboocss/types'
import fsExtra from 'fs-extra'
import { lookItUpSync } from 'look-it-up'
import { outdent } from 'outdent'
import { basename, join } from 'path'
import { execFileSync } from 'child_process'
import { findViteConfig, hasUncompilableSources } from './vite-integration'

type SetupOptions = Partial<Config> & {
  force?: boolean
}

export async function setupConfig(cwd: string, opts: SetupOptions = {}) {
  const { force, outExtension, outdir = 'styled-system', strictTokens } = opts

  let configFile: string | undefined

  try {
    configFile = findConfig({ cwd })
  } catch (err) {
    // ignore config not found error
    if (!(err instanceof BambooError)) {
      throw err
    }
  }

  const { detect } = await import('package-manager-detector')
  const pmResult = await detect({ cwd })
  const pm = (pmResult?.agent ?? 'npm').split('@')[0]
  const cmd = pm === 'npm' ? 'npm run' : pm

  const isTs = lookItUpSync('tsconfig.json', cwd)
  const file = isTs ? 'bamboo.config.ts' : 'bamboo.config.mjs'

  logger.info('init:config', `creating bamboo config file: ${quote(file)}`)

  if (!force && configFile) {
    logger.warn('init:config', messages.configExists(cmd))
  } else {
    const content = outdent`
import { defineConfig } from "@bamboocss/dev"

export default defineConfig({
    // Whether to use css reset
    preflight: true,
    ${outExtension ? `\n // The extension for the emitted JavaScript files\noutExtension: '${outExtension}',` : ''}
    // Where to look for your css declarations
    include: ["./src/**/*.{js,jsx,ts,tsx}", "./pages/**/*.{js,jsx,ts,tsx}"],
${
  // Written only when asked for, and nothing at all otherwise — including no blank line.
  // The key is absent by default rather than present and `false`, so a config that never
  // mentions it reads as "not a decision I made", which is what `bamboo init` without the
  // flag is.
  strictTokens
    ? `\n// Require every style value to be a token, so a raw css value is written \`[14px]\`.\n` +
      `// A misspelled token is reported by the build whether or not this is on.\n` +
      `strictTokens: ${JSON.stringify(strictTokens)},\n`
    : ''
}

    // Files to exclude
    exclude: [],

    // Tokens, keyframes and @property rules nothing in the emitted css reaches are dropped
    // by default — worth 36-78% of a new project's stylesheet. If you read tokens from
    // somewhere the build cannot see them — \`token()\` with a computed path, or a
    // hand-written stylesheet outside \`include\` — name the categories they land in with
    // \`prune: { keepTokens: ['colors.*'] }\`, or set \`prune: { tokens: 'off' }\`.

    // Useful for theme customization
    theme: {
      extend: {}
    },

    // The output directory for your css system
    outdir: ${JSON.stringify(outdir)},
})
    `

    const filePath = join(cwd, file)
    await fsExtra.writeFile(filePath, content)
    try {
      execFileSync('oxfmt', [filePath], { stdio: 'ignore' })
    } catch {
      // oxfmt not available, file is written unformatted
    }
    logger.log(messages.thankYou())
  }
}

export async function setupPostcss(cwd: string) {
  // Said at the moment of choosing, as well as on every build the PostCSS plugin then runs.
  // This is where a project takes the wrong branch — following a guide, usually — and it is
  // the one place the choice is still one line away from being a different one.
  const viteConfig = findViteConfig(cwd)
  if (viteConfig && !hasUncompilableSources({ cwd })) {
    logger.warn(
      'init:postcss',
      `This project has ${quote(basename(viteConfig))}, so ${quote('@bamboocss/vite')} is the integration to use. ` +
        `The PostCSS one emits CSS only: it does not compile source, so ${quote('css()')} and ${quote('cva()')} stay ` +
        `runtime calls and the generated style engine ships in your client bundle. Both render identically, which is ` +
        `what makes the difference easy to miss. See https://bamboocss.com/docs/installation/vite`,
    )
  }

  logger.info('init:postcss', `creating postcss config file: ${quote('postcss.config.cjs')}`)

  const content = outdent`
module.exports = {
  plugins: {
    '@bamboocss/dev/postcss': {},
  },
}
  `

  await fsExtra.writeFile(join(cwd, 'postcss.config.cjs'), content)
}
