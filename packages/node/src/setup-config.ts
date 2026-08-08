import { findConfig } from '@bamboocss/config'
import { messages } from '@bamboocss/core'
import { logger, quote } from '@bamboocss/logger'
import { BambooError } from '@bamboocss/shared'
import type { Config } from '@bamboocss/types'
import fsExtra from 'fs-extra'
import { lookItUpSync } from 'look-it-up'
import { outdent } from 'outdent'
import { join } from 'path'
import { execFileSync } from 'child_process'

type SetupOptions = Partial<Config> & {
  force?: boolean
}

export async function setupConfig(cwd: string, opts: SetupOptions = {}) {
  const { force, outExtension, outdir = 'styled-system' } = opts

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

    // Files to exclude
    exclude: [],

    // Tokens, keyframes and @property rules nothing in the emitted css reaches are dropped
    // by default — worth 50-60% of a new project's stylesheet. Set \`pruneUnusedTokens: false\`
    // if you read tokens from somewhere the build cannot see them — \`token.var()\` with a
    // computed path, or a hand-written stylesheet outside \`include\` — or list those under
    // \`staticCss\` to keep them.

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
