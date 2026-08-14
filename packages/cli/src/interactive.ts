import { findViteConfig, hasUncompilableSources } from '@bamboocss/node'
import type { Config } from '@bamboocss/types'
import * as p from '@clack/prompts'
import { version } from '../package.json'

/**
 * Which integration this project wants, before anybody is asked.
 *
 * The question is not really a preference. `@bamboocss/vite` compiles every `css()` and `cva()`
 * call to a literal class string; `@bamboocss/postcss` emits the stylesheet and compiles
 * nothing, so those calls stay runtime calls and the style engine ships to the client. Which of
 * the two applies is decided by the bundler, and the answer is on disk: a Vite config means the
 * compiler is available.
 *
 * Asked cold, with `yes` preselected, this steered every Vite project onto the runtime path by
 * pressing Enter — and both setups render identically, so nothing afterwards reveals the
 * choice. That is the same defect the React Router guide had, reached by a different door.
 *
 * Svelte, Vue and Astro are the exception in the other direction: their components are
 * templates the compiler does not transform, so PostCSS is the integration they should be on
 * and the default stays `yes`.
 */
export const suggestPostcss = (cwd: string) => {
  if (!findViteConfig(cwd)) return 'yes'
  return hasUncompilableSources({ cwd }) ? 'yes' : 'no'
}

export const interactive = async (options: { cwd?: string } = {}) => {
  const cwd = options.cwd ?? process.cwd()
  const postcssDefault = suggestPostcss(cwd)

  p.intro(`bamboo v${version}`)

  const initFlags = await p.group(
    {
      usePostcss: () =>
        p.select({
          // Named by what it decides rather than by the tool, because "would you like to use
          // PostCSS?" reads as "do you have PostCSS in this project?" — which most Vite and
          // Next projects do, for autoprefixer, and which is not the question being asked.
          message:
            postcssDefault === 'no'
              ? 'Emit the stylesheet through PostCSS? This project has a Vite config, and `@bamboocss/vite` compiles your style calls away instead.'
              : 'Emit the stylesheet through PostCSS?',
          initialValue: postcssDefault,
          options: [
            { value: 'yes', label: 'Yes' },
            { value: 'no', label: 'No' },
          ],
        }),
      useMjsExtension: () =>
        p.select({
          message: 'Use the mjs extension ?',
          initialValue: 'yes',
          options: [
            { value: 'yes', label: 'Yes' },
            { value: 'no', label: 'No' },
          ],
        }),
      withStrictTokens: () =>
        p.select({
          message: 'Must every style value be a token?',
          // A misspelled token is reported by the build either way, so this asks only about the
          // policy — and a project that answers yes is committing every raw value to `[14px]`.
          initialValue: 'no',
          options: [
            { value: 'no', label: 'No — raw css values are fine' },
            { value: 'yes', label: 'Yes — every raw value is written `[14px]`' },
          ],
        }),
      shouldUpdateGitignore: () =>
        p.select({
          message: 'Update gitignore?',
          initialValue: 'yes',
          options: [
            { value: 'yes', label: 'Yes' },
            { value: 'no', label: 'No' },
          ],
        }),
    },
    {
      // On Cancel callback that wraps the group
      // So if the user cancels one of the prompts in the group this function will be called
      onCancel: () => {
        p.cancel('Operation cancelled.')
        process.exit(0)
      },
    },
  )

  p.outro("Let's get started! 🎋")

  return {
    postcss: initFlags.usePostcss === 'yes',
    outExtension: initFlags.useMjsExtension === 'yes' ? 'mjs' : 'js',
    strictValues: strictValuesFrom(initFlags.withStrictTokens),
    gitignore: initFlags.shouldUpdateGitignore === 'yes',
  } satisfies InitFlags
}

/** `'yes'` is the historical spelling of `true`. */
const strictValuesFrom = (answer: string): Config['strictValues'] | undefined => (answer === 'yes' ? true : undefined)

interface InitFlags {
  postcss: boolean
  /** The two the prompt offers, rather than `string`, which is what the config accepts. */
  outExtension: 'mjs' | 'js'
  /**
   * Declared, which it was not.
   *
   * The old shape returned this field and omitted it from the interface, behind an
   * `as InitFlags` cast. `satisfies` catches that half — returning a field the interface does
   * not declare is now an error where the cast was silent. It does not catch the other half,
   * a field declared everywhere and read nowhere, which is what actually dropped the answer:
   * `InitCommandFlags` naming it, and the caller's `options` being typed rather than `{}`, are
   * what close that.
   */
  strictValues: Config['strictValues'] | undefined
  gitignore: boolean
}
